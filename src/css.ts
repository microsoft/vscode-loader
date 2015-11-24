/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/// <reference path="declares.ts" />
/// <reference path="loader.ts" />

'use strict';

var _cssPluginGlobal = this;

module CSSLoaderPlugin {

	var global = _cssPluginGlobal;

	export interface ICSSLoader {
		load(name:string, cssUrl:string, externalCallback:(contents?:string)=>void, externalErrorback:(err:any)=>void): void;
	}

	/**
	 * Known issue:
	 * - In IE there is no way to know if the CSS file loaded successfully or not.
	 */
	class BrowserCSSLoader implements ICSSLoader {

		private _pendingLoads:number;

		constructor() {
			this._pendingLoads = 0;
		}

		public attachListeners(name:string, linkNode:HTMLLinkElement, callback:()=>void, errorback:(err:any)=>void): void {
			var unbind = () => {
				linkNode.removeEventListener('load', loadEventListener);
				linkNode.removeEventListener('error', errorEventListener);
			};

			var loadEventListener = (e:any) => {
				unbind();
				callback();
			};

			var errorEventListener = (e:any) => {
				unbind();
				errorback(e);
			};

			linkNode.addEventListener('load', loadEventListener);
			linkNode.addEventListener('error', errorEventListener);
		}

		public _onLoad(name:string, callback:()=>void): void {
			this._pendingLoads --;
			callback();
		}

		public _onLoadError(name:string, errorback:(err:any)=>void, err:any): void {
			this._pendingLoads --;
			errorback(err);
		}

		public _insertLinkNode(linkNode:HTMLLinkElement): void {
			this._pendingLoads ++;
			var head = document.head || document.getElementsByTagName('head')[0];
			var other:NodeListOf<HTMLElement> = head.getElementsByTagName('link') || document.head.getElementsByTagName('script');
			if (other.length > 0) {
				head.insertBefore(linkNode, other[other.length-1]);
			} else {
				head.appendChild(linkNode);
			}
		}

		public createLinkTag(name:string, cssUrl:string, externalCallback:()=>void, externalErrorback:(err:any)=>void): HTMLLinkElement {
			var linkNode = document.createElement('link');
			linkNode.setAttribute('rel', 'stylesheet');
			linkNode.setAttribute('type', 'text/css');
			linkNode.setAttribute('data-name', name);

			var callback = () => this._onLoad(name, externalCallback);
			var errorback = (err:any) => this._onLoadError(name, externalErrorback, err);

			this.attachListeners(name, linkNode, callback, errorback);
			linkNode.setAttribute('href', cssUrl);

			return linkNode;
		}

		public _linkTagExists(name:string, cssUrl:string): boolean {

			var i:number,
				len:number,
				nameAttr:string,
				hrefAttr:string,
				links = document.getElementsByTagName('link');

			for (i = 0, len = links.length; i < len; i++) {
				nameAttr = links[i].getAttribute('data-name');
				hrefAttr = links[i].getAttribute('href');
				if (nameAttr === name || hrefAttr === cssUrl) {
					return true;
				}
			}
			return false;
		}

		public load(name:string, cssUrl:string, externalCallback:(contents?:string)=>void, externalErrorback:(err:any)=>void): void {
			if (this._linkTagExists(name, cssUrl)) {
				externalCallback();
				return;
			}
			var linkNode = this.createLinkTag(name, cssUrl, externalCallback, externalErrorback);
			this._insertLinkNode(linkNode);
		}
	}

	interface IE9HTMLLinkElement {
		styleSheet: IE9StyleSheet;
	}

	interface IE9StyleSheet {
		rules:{cssText:string;}[];
		insertRule(rule:string, position:number): void;
	}
	/**
	 * Prior to IE10, IE could not go above 31 stylesheets in a page
	 * http://blogs.msdn.com/b/ieinternals/archive/2011/05/14/internet-explorer-stylesheet-rule-selector-import-sheet-limit-maximum.aspx
	 *
	 * The general strategy here is to not write more than 31 link nodes to the page at the same time
	 * When stylesheets get loaded, they will get merged one into another to free up
	 * some positions for new link nodes.
	 */
	class IE9CSSLoader extends BrowserCSSLoader {

		private _blockedLoads:HTMLLinkElement[];
		private _mergeStyleSheetsTimeout:number;

		constructor() {
			super();
			this._blockedLoads = [];
			this._mergeStyleSheetsTimeout = -1;
		}

		public load(name:string, cssUrl:string, externalCallback:(contents?:string)=>void, externalErrorback:(err:any)=>void): void {
			if (this._linkTagExists(name, cssUrl)) {
				externalCallback();
				return;
			}
			var linkNode = this.createLinkTag(name, cssUrl, externalCallback, externalErrorback);
			if (this._styleSheetCount() < 31) {
				this._insertLinkNode(linkNode);
			} else {
				this._blockedLoads.push(linkNode);
				this._handleBlocked();
			}
		}

		private _styleSheetCount(): number {
			var linkCount = document.getElementsByTagName('link').length;
			var styleCount = document.getElementsByTagName('style').length;
			return linkCount + styleCount;
		}

		public _onLoad(name:string, callback:()=>void): void {
			super._onLoad(name, callback);
			this._handleBlocked();
		}

		public _onLoadError(name:string, errorback:(err:any)=>void, err:any): void {
			super._onLoadError(name, errorback, err);
			this._handleBlocked();
		}

		private _handleBlocked(): void {
			var blockedLoadsCount = this._blockedLoads.length;
			if (blockedLoadsCount > 0 && this._mergeStyleSheetsTimeout === -1) {
				this._mergeStyleSheetsTimeout = window.setTimeout(() => this._mergeStyleSheets(), 0);
			}
		}

		private _mergeStyleSheet(dstPath:string, dst:IE9StyleSheet, srcPath:string, src:IE9StyleSheet): void {
			for (var i = src.rules.length - 1; i >= 0; i--) {
				dst.insertRule(Utilities.rewriteUrls(srcPath, dstPath, src.rules[i].cssText), 0);
			}
		}

		private _asIE9HTMLLinkElement(linkElement:HTMLLinkElement): IE9HTMLLinkElement {
			return <IE9HTMLLinkElement><any>linkElement;
		}

		private _mergeStyleSheets(): void {
			this._mergeStyleSheetsTimeout = -1;
			var blockedLoadsCount = this._blockedLoads.length;

			var i:number, linkDomNodes = document.getElementsByTagName('link');
			var linkDomNodesCount = linkDomNodes.length;
			var mergeCandidates:{ linkNode:HTMLLinkElement; rulesLength:number; }[] = [];
			for (i = 0; i < linkDomNodesCount; i++) {
				if (linkDomNodes[i].readyState === 'loaded' || linkDomNodes[i].readyState === 'complete') {
					mergeCandidates.push({
						linkNode: linkDomNodes[i],
						rulesLength: this._asIE9HTMLLinkElement(linkDomNodes[i]).styleSheet.rules.length
					});
				}
			}

			var mergeCandidatesCount = mergeCandidates.length;

			// Just a little legend here :)
			// - linkDomNodesCount: total number of link nodes in the DOM (this should be kept <= 31)
			// - mergeCandidatesCount: loaded (finished) link nodes in the DOM (only these can be merged)
			// - blockedLoadsCount: remaining number of load requests that did not fit in before (because of the <= 31 constraint)

			// Now comes the heuristic part, we don't want to do too much work with the merging of styles,
			// but we do need to merge stylesheets to free up loading slots.
			var mergeCount = Math.min(Math.floor(mergeCandidatesCount / 2), blockedLoadsCount);

			// Sort the merge candidates descending (least rules last)
			mergeCandidates.sort((a, b) => {
				return b.rulesLength - a.rulesLength;
			});

			var srcIndex:number, dstIndex:number;
			for (i = 0; i < mergeCount; i ++) {
				srcIndex = mergeCandidates.length - 1 - i;
				dstIndex = i % (mergeCandidates.length - mergeCount);

				// Merge rules of src into dst
				this._mergeStyleSheet(mergeCandidates[dstIndex].linkNode.href, this._asIE9HTMLLinkElement(mergeCandidates[dstIndex].linkNode).styleSheet, mergeCandidates[srcIndex].linkNode.href, this._asIE9HTMLLinkElement(mergeCandidates[srcIndex].linkNode).styleSheet);

				// Remove dom node of src
				mergeCandidates[srcIndex].linkNode.parentNode.removeChild(mergeCandidates[srcIndex].linkNode);
				linkDomNodesCount --;
			}

			var styleSheetCount = this._styleSheetCount();
			while (styleSheetCount < 31 && this._blockedLoads.length > 0) {
				this._insertLinkNode(this._blockedLoads.shift());
				styleSheetCount ++;
			}
		}
	}

	class IE8CSSLoader extends IE9CSSLoader {

		constructor() {
			super();
		}

		public attachListeners(name:string, linkNode:HTMLLinkElement, callback:()=>void, errorback:(err:any)=>void): void {
			linkNode.onload = () => {
				linkNode.onload = null;
				callback();
			};
		}
	}

	interface INodeFS {
		readFileSync(filename:string, encoding:string): string;
	}
	class NodeCSSLoader implements ICSSLoader {

		static BOM_CHAR_CODE = 65279;

		private fs:INodeFS;

		constructor() {
			this.fs = require.nodeRequire('fs');
		}

		public load(name:string, cssUrl:string, externalCallback:(contents?:string)=>void, externalErrorback:(err:any)=>void): void {
			var contents = this.fs.readFileSync(cssUrl, 'utf8');
			// Remove BOM
			if (contents.charCodeAt(0) === NodeCSSLoader.BOM_CHAR_CODE) {
				contents = contents.substring(1);
			}
			externalCallback(contents);
		}
	}

	// ------------------------------ Finally, the plugin



	export class CSSPlugin implements AMDLoader.ILoaderPlugin {

		static BUILD_MAP:{[moduleName:string]:string;} = <any>{};

		private cssLoader:ICSSLoader;

		constructor(cssLoader:ICSSLoader) {
			this.cssLoader = cssLoader;
		}

		public load(name:string, req:AMDLoader.IRelativeRequire, load:AMDLoader.IPluginLoadCallback, config:AMDLoader.IConfigurationOptions): void {
			config = config || {};
			var cssUrl = req.toUrl(name + '.css');
			this.cssLoader.load(name, cssUrl, (contents?:string) => {
				// Contents has the CSS file contents if we are in a build
				if (config.isBuild) {
					CSSPlugin.BUILD_MAP[name] = contents;
				}
				load({});
			}, (err:any) => {
				if (typeof load.error === 'function') {
					load.error('Could not find ' + cssUrl + ' or it was empty');
				}
			});
		}

		public write(pluginName:string, moduleName:string, write:AMDLoader.IPluginWriteCallback): void {
			// getEntryPoint is a Monaco extension to r.js
			var entryPoint = write.getEntryPoint();

			// r.js destroys the context of this plugin between calling 'write' and 'writeFile'
			// so the only option at this point is to leak the data to a global
			global.cssPluginEntryPoints = global.cssPluginEntryPoints || {};
			global.cssPluginEntryPoints[entryPoint] = global.cssPluginEntryPoints[entryPoint] || [];
			global.cssPluginEntryPoints[entryPoint].push({
				moduleName: moduleName,
				contents: CSSPlugin.BUILD_MAP[moduleName]
			});

			write.asModule(pluginName + '!' + moduleName,
				'define([\'vs/css!' + entryPoint + '\'], {});'
			);
		}

		public writeFile(pluginName:string, moduleName:string, req:AMDLoader.IRelativeRequire, write:AMDLoader.IPluginWriteFileCallback, config:AMDLoader.IConfigurationOptions): void {
			if (global.cssPluginEntryPoints && global.cssPluginEntryPoints.hasOwnProperty(moduleName)) {
				var fileName = req.toUrl(moduleName + '.css');
				var contents = [
						'/*---------------------------------------------------------',
						' * Copyright (C) Microsoft Corporation. All rights reserved.',
						' *--------------------------------------------------------*/'
					],
					entries = global.cssPluginEntryPoints[moduleName];
				for (var i = 0; i < entries.length; i++) {
					contents.push(Utilities.rewriteUrls(entries[i].moduleName, moduleName, entries[i].contents));
				}
				write(fileName, contents.join('\r\n'));
			}
		}
	}

	export class Utilities {

		public static startsWith(haystack:string, needle:string): boolean {
			return haystack.length >= needle.length && haystack.substr(0, needle.length) === needle;
		}

		/**
		 * Find the path of a file.
		 */
		public static pathOf(filename:string): string {
			var lastSlash = filename.lastIndexOf('/');
			if (lastSlash !== -1) {
				return filename.substr(0, lastSlash + 1);
			} else {
				return '';
			}
		}

		/**
		 * A conceptual a + b for paths.
		 * Takes into account if `a` contains a protocol.
		 * Also normalizes the result: e.g.: a/b/ + ../c => a/c
		 */
		public static joinPaths(a:string, b:string): string {

			function findSlashIndexAfterPrefix(haystack:string, prefix:string): number {
				if (Utilities.startsWith(haystack, prefix)) {
					return Math.max(prefix.length, haystack.indexOf('/', prefix.length));
				}
				return 0;
			}

			var aPathStartIndex = 0;
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, '//');
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, 'http://');
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, 'https://');

			function pushPiece(pieces:string[], piece:string): void {
				if (piece === './') {
					// Ignore
					return;
				}
				if (piece === '../') {
					var prevPiece = (pieces.length > 0 ? pieces[pieces.length - 1] : null);
					if (prevPiece && prevPiece === '/') {
						// Ignore
						return;
					}
					if (prevPiece && prevPiece !== '../') {
						// Pop
						pieces.pop();
						return;
					}
				}
				// Push
				pieces.push(piece);
			}

			function push(pieces:string[], path:string): void {
				while (path.length > 0) {
					var slashIndex = path.indexOf('/');
					var piece = (slashIndex >= 0 ? path.substring(0, slashIndex + 1) : path);
					path = (slashIndex >= 0 ? path.substring(slashIndex + 1) : '');
					pushPiece(pieces, piece);
				}
			}

			var pieces:string[] = [];
			push(pieces, a.substr(aPathStartIndex));
			if (b.length > 0 && b.charAt(0) === '/') {
				pieces = [];
			}
			push(pieces, b);

			return a.substring(0, aPathStartIndex) + pieces.join('');
		}

		public static commonPrefix(str1:string, str2:string): string {
			var len = Math.min(str1.length, str2.length);
			for (var i = 0; i < len; i++) {
				if (str1.charCodeAt(i) !== str2.charCodeAt(i)) {
					break;
				}
			}
			return str1.substring(0, i);
		}

		public static commonFolderPrefix(fromPath:string, toPath:string): string {
			var prefix = Utilities.commonPrefix(fromPath, toPath);
			var slashIndex = prefix.lastIndexOf('/');
			if (slashIndex === -1) {
				return '';
			}
			return prefix.substring(0, slashIndex + 1);
		}

		public static relativePath(fromPath:string, toPath:string): string {
			if (Utilities.startsWith(toPath, '/') || Utilities.startsWith(toPath, 'http://') || Utilities.startsWith(toPath, 'https://')) {
				return toPath;
			}

			// Ignore common folder prefix
			var prefix = Utilities.commonFolderPrefix(fromPath, toPath);
			fromPath = fromPath.substr(prefix.length);
			toPath = toPath.substr(prefix.length);

			var upCount = fromPath.split('/').length;
			var result = '';
			for (var i = 1; i < upCount; i++) {
				result += '../';
			}
			return result + toPath;
		}

		public static rewriteUrls(originalFile:string, newFile:string, contents:string): string {
			// Use ")" as the terminator as quotes are oftentimes not used at all
			return contents.replace(/url\(\s*([^\)]+)\s*\)?/g, (_:string, ...matches:string[]) => {
				var url = matches[0];
				// Eliminate starting quotes (the initial whitespace is not captured)
				if (url.charAt(0) === '"' || url.charAt(0) === '\'') {
					url = url.substring(1);
				}
				// The ending whitespace is captured
				while (url.length > 0 && (url.charAt(url.length - 1) === ' ' || url.charAt(url.length - 1) === '\t')) {
					url = url.substring(0, url.length - 1);
				}
				// Eliminate ending quotes
				if (url.charAt(url.length - 1) === '"' || url.charAt(url.length - 1) === '\'') {
					url = url.substring(0, url.length - 1);
				}

				if (!Utilities.startsWith(url, 'data:') && !Utilities.startsWith(url, 'http://') && !Utilities.startsWith(url, 'https://')) {
					var absoluteUrl = Utilities.joinPaths(Utilities.pathOf(originalFile), url);
					url = Utilities.relativePath(newFile, absoluteUrl);
				}
				return 'url(' + url + ')';
			});
		}
	}

	(function() {
		var cssLoader:ICSSLoader = null;
		var isAtomShell = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions['electron'] !== 'undefined');
		if (typeof process !== 'undefined' && process.versions && !!process.versions.node && !isAtomShell) {
			cssLoader = new NodeCSSLoader();
		} else if (typeof navigator !== 'undefined' && navigator.userAgent.indexOf('MSIE 9') >= 0) {
			cssLoader = new IE9CSSLoader();
		} else if (typeof navigator !== 'undefined' && navigator.userAgent.indexOf('MSIE 8') >= 0) {
			cssLoader = new IE8CSSLoader();
		} else {
			cssLoader = new BrowserCSSLoader();
		}
		define('vs/css', new CSSPlugin(cssLoader));
	})();
}