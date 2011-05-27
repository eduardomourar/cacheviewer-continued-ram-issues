/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is CacheViewer.
 *
 * The Initial Developer of the Original Code is The Tiny BENKI.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * The Tiny BENKI. All Rights Reserved.
 *
 * Contributor(s): The Tiny BENKI
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var CacheViewer = {
	
	// ***** Members *****
	_tree: null,
	_bundle: null,
	
	_DBConn: null,
	_rdf: null,
	_root: null,
	_metaData: "",
	_visitAll: true,
	_isLoading: false,
	_isDooming: false,
	_entries: null,
	
	get _cacheService() {
		if (!this.__cacheService) {
			this.__cacheService = Cc["@mozilla.org/network/cache-service;1"]
							.getService(Ci.nsICacheService);
		}
		return this.__cacheService;
	},
	__cacheService: null,
	
	get _dateService() {
		if (!this.__dateService) {
			this.__dateService = Cc["@mozilla.org/intl/scriptabledateformat;1"]
							.getService(Ci.nsIScriptableDateFormat);
		}
		return this.__dateService;
	},
	__dateService: null,
	
	// ***** CacheViewer *****
	init: function CV_init() {
		
		this._tree = document.getElementById("cacheTree");
		this._bundle = document.getElementById("strings");
		
		this._label = document.getElementById("selectionCountLabel");
		
		this._rdf = new RDF();
		this._root = this._rdf.makeSeqContainer(this._rdf.RDF_ITEM_ROOT);
		
		this._tree.database.AddDataSource(this._rdf.datasource);
		this._tree.setAttribute("ref", this._rdf.RDF_ITEM_ROOT);
		
		var appInfo = Cc["@mozilla.org/xre/app-info;1"]
						.getService(Ci.nsIXULAppInfo);
		var versionChecker = Cc["@mozilla.org/xpcom/version-comparator;1"]
						.getService(Ci.nsIVersionComparator);
		if (versionChecker.compare(appInfo.version, "3.1a") >= 0) {
			document.getElementById("search").setAttribute("type", "search");
		} else {
			document.getElementById("search").setAttribute("type", "timed");
		}
		
		this._DBConn = Cc["@mozilla.org/storage/service;1"]
						.getService(Ci.mozIStorageService)
						.openSpecialDatabase("memory");
		
		if (this._DBConn.tableExists("cacheentries")) {
			this._DBConn.executeSimpleSQL("DROP TABLE cacheentries");
			//this._DBConn.executeSimpleSQL("VACUUM");
		}
		this._DBConn.createTable("cacheentries", "\
			id INTEGER PRIMARY KEY, \
			key TEXT, \
			type TEXT");
		
		this._visitAll = true;
		this._entries = new Array();
		this._cacheService.visitEntries(this);
		
		var it = new Iterator(this._entries);
		
		var timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
		
		var keyProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"key");
		var sizeProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"size");
		var devProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"dev");
		var clntProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"clnt");
		var strmProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"strm");
		var modProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"mod");
		var fetProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"fet");
		var expProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"exp");
		var cntProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"cnt");
		var typeProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"type");
		
		// local cache
		var ds = this._rdf.datasource;
		var rs = this._rdf.rdfService;
		
		var self = this;
		
		function timerCallback() {}
		timerCallback.prototype = {
			
			observe: function(aTimer, aTopic, aData) {
				
				try {
					var [index, value] = it.next();
				} catch(e) {
					self._entries = null;
					self._DBConn.commitTransaction();
					self._rdf.datasource.endUpdateBatch();
					self._tree.builder.rebuild();
					self._toggleButton(self._isLoading = false);
					document.getElementById("search").focus();
					return;
				}
				
				if (!self._root)
					return;
				
				var resource = rs.GetResource(index);
				self._root.AppendElement(resource);
				
				ds.Assert(resource, keyProperty, rs.GetLiteral(value[0]), true);
				ds.Assert(resource, sizeProperty, rs.GetIntLiteral(value[1]), true);
				ds.Assert(resource, devProperty, rs.GetLiteral(value[2]), true);
				ds.Assert(resource, clntProperty, rs.GetLiteral(value[3]), true);
				ds.Assert(resource, strmProperty, rs.GetIntLiteral(value[4]), true);
				ds.Assert(resource, modProperty, rs.GetDateLiteral(value[5]), true);
				ds.Assert(resource, fetProperty, rs.GetDateLiteral(value[6]), true);
				ds.Assert(resource, expProperty, rs.GetDateLiteral(value[7]), true);
				ds.Assert(resource, cntProperty, rs.GetIntLiteral(value[8]), true);
				
				// inline getMimeType
				try {
					var session = self._cacheService.createSession(value[3], Ci.nsICache.STORE_ANYWHERE, value[4]);
					session.doomEntriesIfExpired = false;
					var descriptor = session.openCacheEntry(value[0], Ci.nsICache.ACCESS_READ, false);
				} catch(e) {
					ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
					timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
					return;
				}
				try {
					var head = descriptor.getMetaDataElement("response-head");
				} catch(e) {
					descriptor.close();
					ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
					timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
					return;
				}
				descriptor.close();
				
				// Don't use RegExp
				var type = "-";
				var a = head.indexOf("Content-Type: ");
				if (a > 0) {
					var b = head.indexOf("\n", a+14);
					type = head.substring(a+14, b-1);
					
					b = type.indexOf(";");
					if (b > 0) {
						type = type.substring(0, b);
					}
				}
				ds.Assert(resource, typeProperty, rs.GetLiteral(type), true);
				
				self._DBConn.executeSimpleSQL("INSERT INTO cacheentries (id, key, type) VALUES (" + index + ", '" + value[0] + "', '" + type + "')");
				
				//self._getMimeType(resource, value[0], value[3], value[4]);
				//self._rdf.datasource.endUpdateBatch();
				timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
			}
		};
		this._toggleButton(this._isLoading = true);
		this._DBConn.beginTransaction();
		this._rdf.datasource.beginUpdateBatch();
		timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
	},
	
	finish: function CV_finish() {
		this._DBConn.close();
		this._DBConn = null;
		
		this._root = null;
		this._rdf = null;
		this._bundle = null;
		this._tree = null;
	},
	
	openCache: function CV_openCache() {
		var resources = this._getResourcesAtSelection();
		if (!resources || this._isDooming) return;
		
		if (!this._confirm(resources.length))
			return;
		
		var urls = new Array();
		for (var i=0; i<resources.length; i++) {
			urls.push(this._rdf.getLiteralProperty(resources[i], this._rdf.NS_CACHEVIEWER+"key"));
		}
		this._getBrowser().loadTabs(urls, false, false);
	},
	
	deleteCache: function CV_deleteCache() {
		if (this._isLoading || this._isDooming) return;
		
		var resources = this._getResourcesAtSelection();
		if (!resources) return;
		
		var it = new Iterator(resources);
		
		var timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
		
		var self = this;
		function timerCallback() {}
		timerCallback.prototype = {
			observe: function(aTimer, aTopic, aData) {
				try {
					var [i, resource] = it.next();
				} catch(e) {
					// Get currentIndex before "endUpdateBatch()". 
					//dump(self._tree.view.selection.currentIndex+" : "+self._tree.view.rowCount+"\n");
					var currentIndex = self._tree.view.selection.currentIndex;
					
					self._DBConn.commitTransaction();
					self._rdf.datasource.endUpdateBatch();
					self._tree.builder.rebuild();
					
					// Get rowCount after "endUpdateBatch()". 
					//dump(self._tree.view.selection.currentIndex+" : "+self._tree.view.rowCount+"\n");
					var rowCount = self._tree.view.rowCount;
					if (rowCount > 0) {
						if (rowCount <= currentIndex) {
							self._tree.view.selection.select(rowCount-1);
							self._tree.treeBoxObject.ensureRowIsVisible(rowCount-1);
						} else {
							self._tree.view.selection.select(currentIndex);
							self._tree.treeBoxObject.ensureRowIsVisible(currentIndex);
						}
					} else {
						document.getElementById("cacheInfo").value = "";
					}	
					var cacheService = Cc["@mozilla.org/network/cache-service;1"]
									.getService(Ci.nsICacheService);
					self._visitAll = false;
					cacheService.visitEntries(self);
					self._toggleButton(self._isDooming = false);
					return;
				}
				
				/*
				var dev = self._rdf.getLiteralProperty(resource, self._rdf.NS_CACHEVIEWER+"dev");
				dump(dev+"\n");
				if (dev == "memory") {
					timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
					return;
				}
				*/
				
				if (!self._rdf)
					return;
					
				var key = self._rdf.getLiteralProperty(resource, self._rdf.NS_CACHEVIEWER+"key");
				var client = self._rdf.getLiteralProperty(resource, self._rdf.NS_CACHEVIEWER+"clnt");
				var stream = self._rdf.getIntProperty(resource, self._rdf.NS_CACHEVIEWER+"strm");
				
				var entry = self._openCacheEntry(key, client, stream);
				if (entry) {
					entry.doom();
					entry.close();
				}
				self._rdf.removeResource(resource, self._rdf.getContainer(self._rdf.RDF_ITEM_ROOT));
				if (self._tree.ref == self._rdf.RDF_ITEM_SEARCH)
					self._rdf.removeResource(resource, self._rdf.getContainer(self._rdf.RDF_ITEM_SEARCH));
				
				self._DBConn.executeSimpleSQL("DELETE FROM cacheentries WHERE id = "+resource.Value);
				
				timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
			}
		};
		this._toggleButton(this._isDooming = true);
		this._DBConn.beginTransaction();
		this._rdf.datasource.beginUpdateBatch();
		timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
	},
	
	reloadCache: function CV_reloadCache() {
		if (this._isLoading || this._isDooming) return;
		
		var image = document.getElementById("previewImage");
		image.src = "";
		document.getElementById("cacheInfo").value = "";
		
		this._tree.database.RemoveDataSource(this._rdf.datasource);
		this._tree.builder.rebuild();
		
		this._rdf = null;
		this.__cacheService = null;
		
		this.init();
	},
	
	saveCache: function CV_saveCache() {
		var resources = this._getResourcesAtSelection();
		if (!resources || this._isDooming) return;
		
		var pref = Cc["@mozilla.org/preferences-service;1"]
					.getService(Ci.nsIPrefService)
					.getBranch("extensions.cacheviewer.");
		var lastFolderPath = pref.getComplexValue("folder", Ci.nsISupportsString).data;
		var lastFolder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile)
		if (lastFolderPath)
			lastFolder.initWithPath(lastFolderPath);
		
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
		
		if (resources.length > 1) {
			fp.init(window, null, Ci.nsIFilePicker.modeGetFolder);
		} else {
			fp.init(window, null, Ci.nsIFilePicker.modeSave);
			fp.defaultString = this._guessFileName(this._rdf.getLiteralProperty(resources[0], this._rdf.NS_CACHEVIEWER+"key"), this._rdf.getLiteralProperty(resources[0], this._rdf.NS_CACHEVIEWER+"type"))
		}
		fp.displayDirectory = lastFolder;
		var res = fp.show();
		if (res == Ci.nsIFilePicker.returnCancel)
			return;
		
		var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		if (resources.length > 1) {
			str.data = fp.file.path;
		} else {
			str.data = fp.file.parent.path;
		}
		pref.setComplexValue("folder", Ci.nsISupportsString, str);
		
		var folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
		folder.initWithPath(fp.file.path);
		
		for (i=0; i<resources.length; i++) {
			var key = this._rdf.getLiteralProperty(resources[i], this._rdf.NS_CACHEVIEWER+"key");
			var client = this._rdf.getLiteralProperty(resources[i], this._rdf.NS_CACHEVIEWER+"clnt");
			var stream = this._rdf.getIntProperty(resources[i], this._rdf.NS_CACHEVIEWER+"strm");
			var device = this._rdf.getLiteralProperty(resources[i], this._rdf.NS_CACHEVIEWER+"dev");
			var type = this._rdf.getLiteralProperty(resources[i], this._rdf.NS_CACHEVIEWER+"type");
			
			var descriptor = this._openCacheEntry(key, client, stream);
			if (!descriptor) {
				continue;
			}
			
			var file = folder.clone();
			if (resources.length > 1)
				file.append(this._guessFileName(key, type));
				
			if (res == Ci.nsIFilePicker.returnReplace) {
				if (!file.exists()) {
					file.create(Ci.nsILocalFile.NORMAL_FILE_TYPE, 0755);
				}
			} else
				file.createUnique(Ci.nsILocalFile.NORMAL_FILE_TYPE, 0755);
			
			// If memory cache, use "internalSave".
			// (See chrome://global/content/contentAreaUtils.js)
			if (device == "memory") {
				var auto = new AutoChosen(file, makeURI(key));
				internalSave(key, null, null, null,
							 null, false, null,
							 auto, null, true);
				continue;
			}
			
			// Check the encoding.
			var metaData = "";
			var encode = "";
			var visitor = {
				visitMetaDataElement: function(aKey, aValue) {
					metaData += aKey + ": " + aValue + "\n";
					return true;
				}
			};
			descriptor.visitMetaData(visitor);
			if (metaData.match(/Content-Encoding: (.+)$/m)) {
				encode = RegExp.$1;
			}
			
			try {
				var inputStream = descriptor.openInputStream(0);
				
				if (encode) {
					var converterService = Cc["@mozilla.org/streamConverters;1"]
									.getService(Ci.nsIStreamConverterService);
					var converter = converterService.asyncConvertData(encode, "uncompressed", new StreamListener(file), null);
					converter.onStartRequest(null, null);
					converter.onDataAvailable(null, null, inputStream, 0, inputStream.available());
					converter.onStopRequest(null, null, null);
					continue;
				}
				
				var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
											.createInstance(Ci.nsIFileOutputStream);
				var binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
											.createInstance(Ci.nsIBinaryInputStream);
				binaryInputStream.setInputStream(inputStream);
				var content = binaryInputStream.readBytes(binaryInputStream.available());
				fileOutputStream.init(file, -1, 0666, 0);
				fileOutputStream.write(content, content.length);
				fileOutputStream.flush();
			} catch(e) {
				dump(e+"\n");
				file.remove(false);
			}
			binaryInputStream.close();
			fileOutputStream.close();
		}
	},
	
	search: function CV_search(aSearchString) {
		aSearchString = aSearchString.replace(/^ +/, "");
		
		if (aSearchString || !this._isDooming) {
			this._rdf.datasource.beginUpdateBatch();
			this._rdf.removeResource(this._rdf.getResource(this._rdf.RDF_ITEM_SEARCH), null);
			
			var statement = this._DBConn.createStatement("SELECT id FROM cacheentries WHERE key||type LIKE '%"+ aSearchString.replace(/ +/g, " ").replace(/ $/, "").split(" ").join("%' AND key||type LIKE '%") +"%'");
			
			var searchContainer = this._rdf.getContainer(this._rdf.RDF_ITEM_SEARCH);
			while (statement.executeStep()) {
				searchContainer.AppendElement(this._rdf.getResource(statement.getInt32(0)));
				
			}
			this._rdf.datasource.endUpdateBatch();
			
			statement.reset();
			statement.finalize();
			statement = null;
			
			this._tree.ref = this._rdf.RDF_ITEM_SEARCH;
		} else {
			this._tree.ref = this._rdf.RDF_ITEM_ROOT;
		}
		document.getElementById("showall").disabled = !aSearchString;
	},
	
	showAll: function CV_showAll() {
		var textbox = document.getElementById("search");
		textbox.value = "";
		textbox.focus();
		this.search("");
	},
	
	onSelect: function CV_onSelect() {
		this._label.value = this._tree.view.selection.count;

		var timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
		var self = this;
		function timerCallback() {}
		timerCallback.prototype = {
			observe: function(aTimer, aTopic, aData) {
				self._makePreview(self._tree.view.selection.currentIndex);
			}
		}
		timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
	},
	
	onPopupShowing: function CV_onPopupShowing() {
		var menu = document.getElementById("deleteCache");
		if (this._isLoading)
			menu.setAttribute("disabled", "true");
		else
			if (menu.hasAttribute("disabled"))
				menu.removeAttribute("disabled");
	},
	
	resize: function CV_resize(event) {
		var image = document.getElementById("previewImage");
		if (image.hasAttribute("style")) {
			image.removeAttribute("style");
			return;
		}
		
		var width = parseInt(window.getComputedStyle(image, "").width.replace("px", ""));
		var height = parseInt(window.getComputedStyle(image, "").height.replace("px", ""));
		
		var containerWidth = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").width.replace("px", ""));
		var containerHeight = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").height.replace("px", ""));
		
		if (width > containerWidth) {
			var zoomX = containerWidth / width;
			width = containerWidth - 2;
			height = height * zoomX - 2;
		}
		if (height > containerHeight) {
			var zoomY = containerHeight / height;
			height = containerHeight - 2;
			width = width * zoomY - 2;
		}
		image.setAttribute("style", "width:"+width+"px;"+"height:"+height+"px;");
	},
	
	// ***** nsICacheVisitor *****
	visitDevice: function CV_visitDevice(aDeviceID, aDeviceInfo) {
		if (aDeviceID == "offline") return true;
		
		document.getElementById(aDeviceID).setAttribute("value", Math.round(aDeviceInfo.totalSize/1024000*100)/100+"/"+Math.round(aDeviceInfo.maximumSize/1024000*100)/100);
		document.getElementById(aDeviceID + "Meter").setAttribute("value", Math.round(aDeviceInfo.totalSize/aDeviceInfo.maximumSize*100));
		document.getElementById(aDeviceID + "Entries").setAttribute("value", aDeviceInfo.entryCount +" "+ this._bundle.getString("entries"));
		return true;
	},
	
	visitEntry: function CV_visitEntry(aDeviceID, aEntryInfo) {
		if (!this._visitAll)
			return false;
		
		if (aEntryInfo.dataSize == 0)
			return true;
		
		if (aEntryInfo.key.indexOf("http") == 0) {
			this._entries.push(new Array(
				aEntryInfo.key,
				aEntryInfo.dataSize,
				aEntryInfo.deviceID,
				aEntryInfo.clientID,
				aEntryInfo.isStreamBased() ? 1 : 0,
				aEntryInfo.lastFetched*1000000,
				aEntryInfo.lastModified*1000000,
				aEntryInfo.expirationTime*1000000,
				aEntryInfo.fetchCount
			));
		}
		return true;
	},
	
	// ***** nsICacheMetaDataVisitor *****
	visitMetaDataElement: function CV_visitMetaDataElement(aKey, aValue) {
		this._metaData += aKey + ": " + aValue + "\n";
		return true;
	},
	
	// ***** Helper funcitons *****
	_makePreview: function CV__makePreview(aRow) {
		var resource = this._tree.view.getResourceAtIndex(aRow);
		
		var key = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"key");
		var device =  this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"dev");
		var type =  this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"type");
		var client =  this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"clnt");
		var stream =  this._rdf.getIntProperty(resource, this._rdf.NS_CACHEVIEWER+"strm");
		
		var descriptor = this._openCacheEntry(key, client, stream);
		if (!descriptor) return;
		
		var value = this._bundle.getString("key")        + " " + descriptor.key + "\n" +
					this._bundle.getString("size")       + " " + descriptor.dataSize + " bytes\n" +
					this._bundle.getString("count")      + " " + descriptor.fetchCount + "\n" +
					this._bundle.getString("modified")   + " " + this._formatDate(descriptor.lastModified*1000) + "\n" +
					this._bundle.getString("fetched")    + " " + this._formatDate(descriptor.lastFetched*1000) + "\n" + 
					this._bundle.getString("expiration") + " ";
		
		if (parseInt(0xFFFFFFFF) <= descriptor.expirationTime)
			value += this._bundle.getString("noexpiration") + "\n";
		else
			value += this._formatDate(descriptor.expirationTime*1000) + "\n";
		
		value += this._bundle.getString("fileondisk") + " ";
		
		var cacheFile;
		try { cacheFile = descriptor.file; } catch(e) { cacheFile = null; }
		if (cacheFile)
			value += cacheFile.path + "\n\n";
		else
			value += this._bundle.getString("nofile") + "\n\n";
		
		this._metaData = "";
		descriptor.visitMetaData(this);
		value += this._metaData;
		descriptor.close();
		
		document.getElementById("cacheInfo").value = value;
		
		var url = "chrome://cacheviewer/content/not_image.png";
		if ((type.indexOf("image") == 0) ||
			(key.match(/.*(\.png|\.gif|\.jpg|\.ico|\.bmp)$/i))) {
				url = "about:cacheviewer?"+key;
		}

		var image = document.getElementById("previewImage");
		image.src = url;
		if (image.hasAttribute("style"))
			image.removeAttribute("style");
		
		var self = this;
		image.onload = function() {
			self.resize();
		}
	},
	
	_confirm: function CV__confirm(numTabsToOpen) {
		var pref = Cc["@mozilla.org/preferences-service;1"]
					.getService(Ci.nsIPrefBranch);

		const kWarnOnOpenPref = "extensions.cacheviewer.warn_on_open";
		var reallyOpen = true;
		if (pref.getBoolPref(kWarnOnOpenPref)) {
			if (numTabsToOpen >= pref.getIntPref("extensions.cacheviewer.max_open_before_warn")) {
				var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Ci.nsIPromptService);

				var warnOnOpen = { value: true };

				var messageKey = "tabs.openWarningMultipleBranded";
				var openKey = "tabs.openButtonMultiple";
				const BRANDING_BUNDLE_URI = "chrome://branding/locale/brand.properties";
				var brandShortName = Cc["@mozilla.org/intl/stringbundle;1"]
										.getService(Ci.nsIStringBundleService)
										.createBundle(BRANDING_BUNDLE_URI)
										.GetStringFromName("brandShortName");
										
				var bundle = Cc["@mozilla.org/intl/stringbundle;1"]
								.getService(Ci.nsIStringBundleService)
								.createBundle("chrome://browser/locale/places/places.properties");
								
				var buttonPressed = promptService.confirmEx(window,
									bundle.GetStringFromName("tabs.openWarningTitle"),
									bundle.formatStringFromName(messageKey, [numTabsToOpen, brandShortName], 2),
									(promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0)
									+ (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
									bundle.GetStringFromName(openKey), null, null,
									bundle.formatStringFromName("tabs.openWarningPromptMeBranded",
									[brandShortName], 1), warnOnOpen);

				reallyOpen = (buttonPressed == 0);
				
				if (reallyOpen && !warnOnOpen.value)
					pref.setBoolPref(kWarnOnOpenPref, false);
			}
		}
		return reallyOpen;
	},
	
	_getResourceAtCurrentIndex: function CV__getResourceAtCurrentIndex() {
		if (!this._tree.view.selection || this._tree.view.selection.count != 1)
			return null;
			
		return this._tree.view.getResourceAtIndex(this._tree.view.selection.currentIndex);
	},
	
	_getResourcesAtSelection: function () {
		if (!this._tree.view.selection)
			return null;
		
		var resources = new Array();
		var rangeCount = this._tree.view.selection.getRangeCount();
		for (var i=0; i<rangeCount; ++i) {
			var rangeMin = {};
			var rangeMax = {};
			this._tree.view.selection.getRangeAt(i, rangeMin, rangeMax);
			for (var j=rangeMin.value; j<=rangeMax.value; ++j) {
				resources.push(this._tree.view.getResourceAtIndex(j));
			}
		}
		return resources;
	},
	
	_guessFileName: function CV__geussFileName(aKey, aMimeType) {
		var URIFix = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
		var URI = URIFix.createFixupURI(aKey, 0);
		var fileInfo = new FileInfo();
		initFileInfo(fileInfo, URI.spec, null, null, null, null);
		var ext = fileInfo.fileExt;
		if ((aMimeType != "text/html") && (ext.indexOf("htm") >= 0)) {
			if (aMimeType == "image/jpeg")
				ext = "jpg";
			else if (aMimeType == "image/gif")
				ext = "gif";
			else if (aMimeType == "image/png")
				ext = "png";
			else if (aMimeType == "image/x-icon")
				ext = "ico";
			else if ((aMimeType.indexOf("javascript") >= 0) ||
				(aMimeType == "application/json"))
				ext = "js";
			else if (aMimeType.indexOf("/xml") >= 0)
				ext = "xml";
			else if (aMimeType == "application/x-shockwave-flash")
				ext = "swf";
			else if (aMimeType == "text/css")
				ext = "css";
			else if (aMimeType == "video/flv")
				ext = "flv";
		}
		return fileInfo.fileBaseName+"."+ext;
	},
	
	_getBrowser: function CV__getBrowser() {
		return this._getTopWin().document.getElementById("content");
	},
	
	_getTopWin: function CV__getTopWin() {
		var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"].getService();
		var windowManagerInterface = windowManager.QueryInterface(Ci.nsIWindowMediator);
		return windowManagerInterface.getMostRecentWindow("navigator:browser");
	},
	
	_toggleButton: function CV__toggleButton(aIsLoading) {
		var reload = document.getElementById("reload");
		if (aIsLoading) {
			if (reload.hasAttribute("enable"))
				reload.removeAttribute("enable");
		} else {
			reload.setAttribute("enable", "true");
		}
	},
	
	_formatDate: function CV__formatDate(aTime) {
		var date = new Date(aTime);
		return this._dateService.FormatDateTime("",
					this._dateService.dateFormatLong,
					this._dateService.timeFormatSeconds,
					date.getFullYear(),
					date.getMonth()+1,
					date.getDate(),
					date.getHours(),
					date.getMinutes(),
					date.getSeconds());
	},
	
	_openCacheEntry: function CV__openCacheEntry(aKey, aClientID, aStreamBased) {
		try {
			var session = this._cacheService.createSession(aClientID, Ci.nsICache.STORE_ANYWHERE, aStreamBased);
			session.doomEntriesIfExpired = false;
			return session.openCacheEntry(aKey, Ci.nsICache.ACCESS_READ, false);
		} catch(e) {
			//dump(e+"\n");
			// 0x804b003d NS_ERROR_CACHE_KEY_NOT_FOUND
			// 0x804b0040 NS_ERROR_CACHE_WAIT_FOR_VALIDATION 
			// 0x804b0044 NS_ERROR_CACHE_IN_USE 
			return null;
		}
	}
};

// ***** StreamListener for Asynchronous Converter *****
function StreamListener(aFile) {
	this._file = aFile;
	this._data = new Array();
}

StreamListener.prototype = {
	
	onStartRequest: function(aRequest, aContext) {},
	
	onStopRequest: function(aRequest, aContext, aStatusCode) {
		var data = this._data.join("");
		var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
											.createInstance(Ci.nsIFileOutputStream);
		try {
			fileOutputStream.init(this._file, -1, 0755, 0);
			fileOutputStream.write(data, data.length);
			fileOutputStream.flush();
		} catch(e) {
			dump(e+"\n");
			this._file.remove(false);
		} finally {
			fileOutputStream.close();
		}
	},
	
	onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
		var binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
											.createInstance(Ci.nsIBinaryInputStream);
		binaryInputStream.setInputStream(aInputStream);
		this._data.push(binaryInputStream.readBytes(binaryInputStream.available()));
		binaryInputStream.close();
	}
};
