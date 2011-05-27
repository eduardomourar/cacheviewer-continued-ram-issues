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
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsAboutCacheViewer() {}

nsAboutCacheViewer.prototype = {
	
	getURIFlags: function ACV_getURIFlags(aURI) {
		return 0;
	},
	
	newChannel: function ACV_newChannel(aURI) {
		var ioService = Cc["@mozilla.org/network/io-service;1"]
						.getService(Ci.nsIIOService);
		var key = aURI.spec.substr(18);
		var channel = ioService.newChannel(key, null, null)
						.QueryInterface(Ci.nsIHttpChannel);
		channel.loadFlags = Ci.nsICachingChannel.LOAD_NO_NETWORK_IO |
							Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE |
							Ci.nsICachingChannel.LOAD_CHECK_OFFLINE_CACHE;
		
		var entry = this._openCacheEntry(key, "HTTP", true);
		if (!entry)
			return channel;
		
		try {
			var inputStream = entry.openInputStream(0);
			var inputStreamChannel = Cc["@mozilla.org/network/input-stream-channel;1"]
										.createInstance(Ci.nsIInputStreamChannel);
			var uri = ioService.newURI(key, null, null);
			inputStreamChannel.setURI(uri);
			inputStreamChannel.contentStream = inputStream;
			return inputStreamChannel.QueryInterface(Ci.nsIChannel);
		} catch(e) {
			dump(e+"\n");
			return channel;
		}
	},
	
	get _cacheService() {
		if (!this.__cacheService) {
			this.__cacheService = Cc["@mozilla.org/network/cache-service;1"]
							.getService(Ci.nsICacheService);
		}
		return this.__cacheService;
	},
	__cacheService: null,
	
	_openCacheEntry: function ACV__openCacheEntry(aKey, aClientID, aStreamBased) {
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
	},
	
	//classDescription: "About Module for about:cacheviewer",
	classID: Components.ID("{87020d13-a340-43a0-afe8-510dfe567c57}"),
	//contractID: "@mozilla.org/network/protocol/about;1?what=cacheviewer",
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule])
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsAboutCacheViewer]);
