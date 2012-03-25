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
 * Contributor(s): The Tiny BENKI, James Sumners
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

/*
const DEBUG = true;
var start, stop;
if (DEBUG)
  start = new Date();
*/

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
    this._bundle = document.getElementById("cvc_strings");

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
    this._entries = [];
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

    // Init labels
    document.getElementById("selectionCountLabel").textContent =
      this._tree.view.selection.count;

    function timerCallback() {}
    timerCallback.prototype = {

      observe: function(aTimer, aTopic, aData) {
        var a, b,
            descriptor,
            head,
            index,
            pair,
            resource,
            session,
            type,
            value;

        try {
          pair = it.next();
          index = pair[0];
          value = pair[1];
        } catch(e) {
          self._entries = null;
          self._DBConn.commitTransaction();
          self._rdf.datasource.endUpdateBatch();
          self._tree.builder.rebuild();
          self._toggleButton(self._isLoading = false);
          document.getElementById("search").focus();
          /*
          if (DEBUG) {
            stop = new Date();
            dump("launch time: "+(stop.getTime()-start.getTime())+" ms\n");
          }
          */
          return;
        }

        resource = rs.GetResource(index);
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
          session = self._cacheService.createSession(value[3], Ci.nsICache.STORE_ANYWHERE, value[4]);
          session.doomEntriesIfExpired = false;
          descriptor = session.openCacheEntry(value[0], Ci.nsICache.ACCESS_READ, false);
        } catch(e) {
          ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
          timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
          return;
        }
        try {
          head = descriptor.getMetaDataElement("response-head");
        } catch(e) {
          descriptor.close();
          ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
          timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
          return;
        }
        descriptor.close();

        // Don't use RegExp
        type = "-";
        a = head.indexOf("Content-Type: ");
        if (a > 0) {
          b = head.indexOf("\n", a+14);
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
    var key,
        resources = this._getResourceAtCurrentIndex();
    if (resources.length != 1) return;

    key = this._rdf.getLiteralProperty(resources[0].obj, this._rdf.NS_CACHEVIEWER+"key");

    this._getBrowser().selectedTab = this._getBrowser().addTab(key);
  },

  deleteCache: function CV_deleteCache() {
    var client,
      i, j,
      key,
      resource = {},
      resources = [],
      stream,
      uiIndexes = [];

    if (this._isLoading) return;

    resources = this._getResourceAtCurrentIndex();
    if (resources.length < 1) {
      return;
    }

    for (i = 0, j = resources.length; i < j; i += 1) {
      resource = resources[i].obj;
      key = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"key");
      client = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"clnt");
      stream = this._rdf.getIntProperty(resource, this._rdf.NS_CACHEVIEWER+"strm");
      entry = this._openCacheEntry(key, client, stream);

      //alert('key = ' + key + '\nclient = ' + client + '\nstream = ' + stream + '\nentry = ' + entry);

      if (!entry) {
        continue;
      }

      entry.doom();
      entry.close();

      uiIndexes.push(resources[i].rowId);
    }

    this._updateUI(uiIndexes);
  },

  reloadCache: function CV_reloadCache() {
    if (this._isLoading) return;

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
    var auto,
        binaryInputStream,
        client,
        converter,
        converterService,
        descriptor,
        device,
        encode,
        file,
        fileOutputStream,
        folder,
        fp,
        i,
        inputStream,
        j,
        key,
        lastFolder,
        lastFolderPath,
        metaData,
        prefService,
        rangeMax,
        rangeMin,
        res,
        selection = [],
        str,
        stream,
        type,
        visitor = {},
        rangeCount = this._tree.view.selection.getRangeCount();

    visitor.visitMetaData = function(aKey, aValue) {
      metaData += aKey + ": " + aValue + "\n";
      return true;
    };

    for (i=0; i<rangeCount; ++i) {
      rangeMin = {};
      rangeMax = {};
      this._tree.view.selection.getRangeAt(i, rangeMin, rangeMax);
      for (j=rangeMin.value; j<=rangeMax.value; ++j) {
        selection.push(this._tree.view.getResourceAtIndex(j));
      }
    }

    prefService = Cc["@mozilla.org/preferences-service;1"]
          .getService(Ci.nsIPrefService)
          .getBranch("extensions.cacheviewer.");
    lastFolderPath = prefService.getComplexValue("folder", Ci.nsISupportsString).data;
    lastFolder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    if (lastFolderPath) {
      lastFolder.initWithPath(lastFolderPath);
    }

    fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    if (selection.length > 1) {
      fp.init(window, null, Ci.nsIFilePicker.modeGetFolder);
    } else {
      fp.init(window, null, Ci.nsIFilePicker.modeSave);
      fp.defaultString = this._guessFileName(
        this._rdf.getLiteralProperty(selection[0], this._rdf.NS_CACHEVIEWER+"key"),
        this._rdf.getLiteralProperty(selection[0], this._rdf.NS_CACHEVIEWER+"type")
      );
    }
    fp.displayDirectory = lastFolder;
    res = fp.show();
    if (res == Ci.nsIFilePicker.returnCancel) {
      return;
    }

    str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
    if (selection.length > 1) {
      str.data = fp.file.path;
    } else {
      str.data = fp.file.parent.path;
    }
    prefService.setComplexValue("folder", Ci.nsISupportsString, str);

    folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    folder.initWithPath(fp.file.path);

    for (i=0; i<selection.length; i++) {
      key = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"key");
      client = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"clnt");
      stream = this._rdf.getIntProperty(selection[i], this._rdf.NS_CACHEVIEWER+"strm");
      device = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"dev");
      type = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"type");

      descriptor = this._openCacheEntry(key, client, stream);
      if (!descriptor) {
        continue;
      }

      file = folder.clone();
      if (selection.length > 1)
        file.append(this._guessFileName(key, type));

      if (res == Ci.nsIFilePicker.returnReplace) {
        if (!file.exists()) {
          file.create(Ci.nsILocalFile.NORMAL_FILE_TYPE, 0666);
        }
      } else
        file.createUnique(Ci.nsILocalFile.NORMAL_FILE_TYPE, 0666);

      // If memory cache, use "internalSave".
      // (See chrome://global/content/contentAreaUtils.js)
      if (device == "memory") {
        auto = new AutoChosen(file, makeURI(key));
        internalSave(key, null, null, null, null, false, null, auto, null, true);
        continue;
      }

      // Check the encoding.
      metaData = "";
      encode = "";
      descriptor.visitMetaData(visitor);
      if (metaData.match(/Content-Encoding: (.+)$/m)) {
        encode = RegExp.$1;
      }

      try {
        inputStream = descriptor.openInputStream(0);

        if (encode) {
          converterService = Cc["@mozilla.org/streamConverters;1"].getService(Ci.nsIStreamConverterService);
          converter = converterService.asyncConvertData(encode, "uncompressed", new StreamListener(file), null);
          converter.onStartRequest(null, null);
          converter.onDataAvailable(null, null, inputStream, 0, inputStream.available());
          converter.onStopRequest(null, null, null);
          continue;
        }

        fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
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
    var searchContainer,
        statement;

    aSearchString = aSearchString.replace(/^ +/, "");

    if (aSearchString) {
      this._rdf.datasource.beginUpdateBatch();
      this._rdf.removeResource(this._rdf.getResource(this._rdf.RDF_ITEM_SEARCH), null);

      statement = this._DBConn.createStatement("SELECT id FROM cacheentries WHERE key||type LIKE '%"+ aSearchString.replace(/ +/g, " ").replace(/ $/, "").split(" ").join("%' AND key||type LIKE '%") +"%'");

      searchContainer = this._rdf.getContainer(this._rdf.RDF_ITEM_SEARCH);
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
    var countLabel = document.getElementById("selectionCountLabel"),
        sel = this._tree.view.selection,
        self,
        timer,
        timerCallback = function(){};

    if (sel.count === 1) {
      timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
      self = this;
      timerCallback.prototype = {
        observe: function(aTimer, aTopic, aData) {
          self._makePreview(sel.currentIndex);
        }
      };
      timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
    }

    countLabel.textContent = sel.count;
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
    var containerHeight,
        containerWidth,
        height,
        image,
        width,
        zoomX,
        zoomY;

    image = document.getElementById("previewImage");
    if (image.hasAttribute("style")) {
      image.removeAttribute("style");
      return;
    }

    width = parseInt(window.getComputedStyle(image, "").width.replace("px", ""), 10);
    height = parseInt(window.getComputedStyle(image, "").height.replace("px", ""), 10);

    containerWidth = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").width.replace("px", ""), 10);
    containerHeight = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").height.replace("px", ""), 10);

    if (width > containerWidth) {
      zoomX = containerWidth / width;
      width = containerWidth - 2;
      height = height * zoomX - 2;
    }
    if (height > containerHeight) {
      zoomY = containerHeight / height;
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

    /**
    * Resolve BitBucket issue #9.
    * We may want to add a toggle in the future.
    if (aEntryInfo.dataSize == 0) {
      return true;
    }
    */

    if (aEntryInfo.key.indexOf("http") === 0) {
      this._entries.push([
        aEntryInfo.key,
        aEntryInfo.dataSize,
        aEntryInfo.deviceID,
        aEntryInfo.clientID,
        aEntryInfo.isStreamBased() ? 1 : 0,
        aEntryInfo.lastFetched*1000000,
        aEntryInfo.lastModified*1000000,
        aEntryInfo.expirationTime*1000000,
        aEntryInfo.fetchCount
      ]);
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
    var cacheFile,
        client,
        descriptor,
        device,
        image,
        key,
        resource = this._tree.view.getResourceAtIndex(aRow),
        self = this,
        stream,
        type,
        url,
        value;


    key = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"key");
    device = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"dev");
    type = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"type");
    client = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"clnt");
    stream = this._rdf.getIntProperty(resource, this._rdf.NS_CACHEVIEWER+"strm");

    descriptor = this._openCacheEntry(key, client, stream);
    if (!descriptor) return;

    value = this._bundle.getString("key")        + " " + descriptor.key + "\n" +
          this._bundle.getString("size")       + " " + descriptor.dataSize + " bytes\n" +
          this._bundle.getString("count")      + " " + descriptor.fetchCount + "\n" +
          this._bundle.getString("modified")   + " " + this._formatDate(descriptor.lastModified*1000) + "\n" +
          this._bundle.getString("fetched")    + " " + this._formatDate(descriptor.lastFetched*1000) + "\n" +
          this._bundle.getString("expiration") + " ";

    // Assuming a base of 10 since the original author isn't clear ~ James
    if (parseInt(0xFFFFFFFF, 10) <= descriptor.expirationTime) {
      value += this._bundle.getString("noexpiration") + "\n";
    } else {
      value += this._formatDate(descriptor.expirationTime*1000) + "\n";
    }

    value += this._bundle.getString("fileondisk") + " ";

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

    url = "chrome://cacheviewer/content/not_image.png";

    if ((type.indexOf("image") === 0) ||
      (key.match(/.*(\.png|\.gif|\.jpg|\.ico|\.bmp)$/i))) {
        //url = "about:cacheviewer?"+key;
        if (cacheFile !== null) {
          // Use the local file
          url = "file://" + cacheFile.path;
        } else {
          // Use the remote file
          url = key;
        }
    }

    image = document.getElementById("previewImage");
    image.src = url;
    if (image.hasAttribute("style")) {
      image.removeAttribute("style");
    }

    image.onload = function() {
      self.resize();
    };
  },

  _getResourceAtCurrentIndex: function CV__getResourceAtCurrentIndex() {
    var endObj = {},
        i, j,
        startObj = {},
        resources = [],
        resource = {},
        x;

    if (!this._tree.view.selection || this._tree.view.selection.count < 1) {
      return null;
    }

    // https://developer.mozilla.org/en/XUL_Tutorial/Tree_Selection
    for (i = 0, j = this._tree.view.selection.getRangeCount(); i < j; i += 1) {
      this._tree.view.selection.getRangeAt(i, startObj, endObj);

      for (x = startObj.value; x <= endObj.value; x += 1) {
        resource = {
          obj: this._tree.view.getResourceAtIndex(x),
          rowId: x
        };

        resources.push(resource);
      }
    }

    return resources;
  },

  _guessFileName: function CV__geussFileName(aKey, aMimeType) {
    var ext,
        fileInfo = new FileInfo(),
        URI,
        URIFix;

    URIFix = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
    URI = URIFix.createFixupURI(aKey, 0);
    initFileInfo(fileInfo, URI.spec, null, null, null, null);
    ext = fileInfo.fileExt;

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
    var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"].getService(),
        windowManagerInterface = windowManager.QueryInterface(Ci.nsIWindowMediator);
    return windowManagerInterface.getMostRecentWindow("navigator:browser");
  },

  _updateUI: function CV_updateUI(indexes) {
    // This is about as ugly as you can get.
    var i, j,
        update = function(index) {
          var cacheService,
              resource = this._tree.view.getResourceAtIndex(index),
              rowCount;

          this._rdf.removeResource(resource, this._rdf.getContainer(this._rdf.RDF_ITEM_ROOT));
          if (this._tree.ref === this._rdf.RDF_ITEM_SEARCH) {
            this._rdf.removeResource(resource, this._rdf.getContainer(this._rdf.RDF_ITEM_SEARCH));
          }
          this._DBConn.executeSimpleSQL('DELETE FROM cacheentries WHERE id = ' + resource.Value);

          rowCount = this._tree.view.rowCount;
          if (index === rowCount) {
            index -= 1;
          }
          if (rowCount > 0) {
            this._tree.view.selection.select(index);
          } else {
            document.getElementById('cacheInfo').value = '';
          }

          cacheService = Cc["@mozilla.org/network/cache-service;1"].getService(Ci.nsICacheService);
          this._visitAll = false;
          cacheService.visitEntries(this);
        };

    for (i = 0, j = indexes.length; i < j; i += 1) {
      update.call(this, indexes[i]);
    }
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
    var session;

    try {
      session = this._cacheService.createSession(aClientID, Ci.nsICache.STORE_ANYWHERE, aStreamBased);
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
  this._data = null;
}

StreamListener.prototype = {

  onStartRequest: function(aRequest, aContext) {},

  onStopRequest: function(aRequest, aContext, aStatusCode) {
    var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
                      .createInstance(Ci.nsIFileOutputStream);
    try {
      fileOutputStream.init(this._file, -1, 0666, 0);
      fileOutputStream.write(this._data, this._data.length);
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
    this._data += binaryInputStream.readBytes(binaryInputStream.available());
    binaryInputStream.close();
  }
};
