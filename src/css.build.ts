/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 * Please make sure to make edits in the .ts file at https://github.com/microsoft/vscode-loader/
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *--------------------------------------------------------------------------------------------*/

'use strict';

interface ICSSEntryPointData {
	moduleName: string;
	contents: string;
	fsPath: string;
}

interface IGlobalState {
	inlineResources: string;
	inlineResourcesLimit: number;
	cssPluginEntryPoints: { [entryPoint: string]: ICSSEntryPointData[]; };
	cssInlinedResources: string[];
}

var _cssPluginGlobal = this;

module CSSBuildLoaderPlugin {

	var global: IGlobalState = <any>(_cssPluginGlobal || {});

	export interface ICSSLoader {
		load(name: string, cssUrl: string, externalCallback: (contents?: string) => void, externalErrorback: (err: any) => void): void;
	}

	class BrowserCSSLoader implements ICSSLoader {

		private _pendingLoads: number;

		constructor() {
			this._pendingLoads = 0;
		}

		public attachListeners(name: string, linkNode: HTMLLinkElement, callback: () => void, errorback: (err: any) => void): void {
			var unbind = () => {
				linkNode.removeEventListener('load', loadEventListener);
				linkNode.removeEventListener('error', errorEventListener);
			};

			var loadEventListener = (e: any) => {
				unbind();
				callback();
			};

			var errorEventListener = (e: any) => {
				unbind();
				errorback(e);
			};

			linkNode.addEventListener('load', loadEventListener);
			linkNode.addEventListener('error', errorEventListener);
		}

		public _onLoad(name: string, callback: () => void): void {
			this._pendingLoads--;
			callback();
		}

		public _onLoadError(name: string, errorback: (err: any) => void, err: any): void {
			this._pendingLoads--;
			errorback(err);
		}

		public _insertLinkNode(linkNode: HTMLLinkElement): void {
			this._pendingLoads++;
			var head = document.head || document.getElementsByTagName('head')[0];
			var other: HTMLCollectionOf<HTMLElement> = head.getElementsByTagName('link') || head.getElementsByTagName('script');
			if (other.length > 0) {
				head.insertBefore(linkNode, other[other.length - 1]);
			} else {
				head.appendChild(linkNode);
			}
		}

		public createLinkTag(name: string, cssUrl: string, externalCallback: () => void, externalErrorback: (err: any) => void): HTMLLinkElement {
			var linkNode = document.createElement('link');
			linkNode.setAttribute('rel', 'stylesheet');
			linkNode.setAttribute('type', 'text/css');
			linkNode.setAttribute('data-name', name);

			var callback = () => this._onLoad(name, externalCallback);
			var errorback = (err: any) => this._onLoadError(name, externalErrorback, err);

			this.attachListeners(name, linkNode, callback, errorback);
			linkNode.setAttribute('href', cssUrl);

			return linkNode;
		}

		public _linkTagExists(name: string, cssUrl: string): boolean {

			var i: number,
				len: number,
				nameAttr: string,
				hrefAttr: string,
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

		public load(name: string, cssUrl: string, externalCallback: (contents?: string) => void, externalErrorback: (err: any) => void): void {
			if (this._linkTagExists(name, cssUrl)) {
				externalCallback();
				return;
			}
			var linkNode = this.createLinkTag(name, cssUrl, externalCallback, externalErrorback);
			this._insertLinkNode(linkNode);
		}
	}

	interface INodeFS {
		readFileSync(filename: string, encoding: string): string;
	}
	class NodeCSSLoader implements ICSSLoader {

		static BOM_CHAR_CODE = 65279;

		private fs: INodeFS;

		constructor() {
			this.fs = require.nodeRequire('fs');
		}

		public load(name: string, cssUrl: string, externalCallback: (contents?: string) => void, externalErrorback: (err: any) => void): void {
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

		static BUILD_MAP: { [moduleName: string]: string; } = {};
		static BUILD_PATH_MAP: { [moduleName: string]: string; } = {};

		private cssLoader: ICSSLoader;

		constructor(cssLoader: ICSSLoader) {
			this.cssLoader = cssLoader;
		}

		public load(name: string, req: AMDLoader.IRelativeRequire, load: AMDLoader.IPluginLoadCallback, config: AMDLoader.IConfigurationOptions): void {
			config = config || {};
			let myConfig = config['vs/css'] || {};
			global.inlineResources = myConfig.inlineResources;
			global.inlineResourcesLimit = myConfig.inlineResourcesLimit || 5000;
			var cssUrl = req.toUrl(name + '.css');
			this.cssLoader.load(name, cssUrl, (contents?: string) => {
				// Contents has the CSS file contents if we are in a build
				if (config.isBuild) {
					CSSPlugin.BUILD_MAP[name] = contents;
					CSSPlugin.BUILD_PATH_MAP[name] = cssUrl;
				}
				load({});
			}, (err: any) => {
				if (typeof load.error === 'function') {
					load.error('Could not find ' + cssUrl + ' or it was empty');
				}
			});
		}

		public write(pluginName: string, moduleName: string, write: AMDLoader.IPluginWriteCallback): void {
			// getEntryPoint is a Monaco extension to r.js
			var entryPoint = write.getEntryPoint();

			// r.js destroys the context of this plugin between calling 'write' and 'writeFile'
			// so the only option at this point is to leak the data to a global
			global.cssPluginEntryPoints = global.cssPluginEntryPoints || {};
			global.cssPluginEntryPoints[entryPoint] = global.cssPluginEntryPoints[entryPoint] || [];
			global.cssPluginEntryPoints[entryPoint].push({
				moduleName: moduleName,
				contents: CSSPlugin.BUILD_MAP[moduleName],
				fsPath: CSSPlugin.BUILD_PATH_MAP[moduleName],
			});

			write.asModule(pluginName + '!' + moduleName,
				'define([\'vs/css!' + entryPoint + '\'], {});'
			);
		}

		public writeFile(pluginName: string, moduleName: string, req: AMDLoader.IRelativeRequire, write: AMDLoader.IPluginWriteFileCallback, config: AMDLoader.IConfigurationOptions): void {
			if (global.cssPluginEntryPoints && global.cssPluginEntryPoints.hasOwnProperty(moduleName)) {
				var fileName = req.toUrl(moduleName + '.css');
				var contents = [
					'/*---------------------------------------------------------',
					' * Copyright (c) Microsoft Corporation. All rights reserved.',
					' *--------------------------------------------------------*/'
				],
					entries = global.cssPluginEntryPoints[moduleName];
				for (var i = 0; i < entries.length; i++) {
					if (global.inlineResources) {
						contents.push(Utilities.rewriteOrInlineUrls(entries[i].fsPath, entries[i].moduleName, moduleName, entries[i].contents, global.inlineResources === 'base64', global.inlineResourcesLimit));
					} else {
						contents.push(Utilities.rewriteUrls(entries[i].moduleName, moduleName, entries[i].contents));
					}
				}
				write(fileName, contents.join('\r\n'));
			}
		}

		public getInlinedResources(): string[] {
			return global.cssInlinedResources || [];
		}
	}

	export class Utilities {

		public static startsWith(haystack: string, needle: string): boolean {
			return haystack.length >= needle.length && haystack.substr(0, needle.length) === needle;
		}

		/**
		 * Find the path of a file.
		 */
		public static pathOf(filename: string): string {
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
		public static joinPaths(a: string, b: string): string {

			function findSlashIndexAfterPrefix(haystack: string, prefix: string): number {
				if (Utilities.startsWith(haystack, prefix)) {
					return Math.max(prefix.length, haystack.indexOf('/', prefix.length));
				}
				return 0;
			}

			var aPathStartIndex = 0;
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, '//');
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, 'http://');
			aPathStartIndex = aPathStartIndex || findSlashIndexAfterPrefix(a, 'https://');

			function pushPiece(pieces: string[], piece: string): void {
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

			function push(pieces: string[], path: string): void {
				while (path.length > 0) {
					var slashIndex = path.indexOf('/');
					var piece = (slashIndex >= 0 ? path.substring(0, slashIndex + 1) : path);
					path = (slashIndex >= 0 ? path.substring(slashIndex + 1) : '');
					pushPiece(pieces, piece);
				}
			}

			var pieces: string[] = [];
			push(pieces, a.substr(aPathStartIndex));
			if (b.length > 0 && b.charAt(0) === '/') {
				pieces = [];
			}
			push(pieces, b);

			return a.substring(0, aPathStartIndex) + pieces.join('');
		}

		public static commonPrefix(str1: string, str2: string): string {
			var len = Math.min(str1.length, str2.length);
			for (var i = 0; i < len; i++) {
				if (str1.charCodeAt(i) !== str2.charCodeAt(i)) {
					break;
				}
			}
			return str1.substring(0, i);
		}

		public static commonFolderPrefix(fromPath: string, toPath: string): string {
			var prefix = Utilities.commonPrefix(fromPath, toPath);
			var slashIndex = prefix.lastIndexOf('/');
			if (slashIndex === -1) {
				return '';
			}
			return prefix.substring(0, slashIndex + 1);
		}

		public static relativePath(fromPath: string, toPath: string): string {
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

		private static _replaceURL(contents: string, replacer: (url: string) => string): string {
			// Use ")" as the terminator as quotes are oftentimes not used at all
			return contents.replace(/url\(\s*([^\)]+)\s*\)?/g, (_: string, ...matches: string[]) => {
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
					url = replacer(url);
				}

				return 'url(' + url + ')';
			});
		}

		public static rewriteUrls(originalFile: string, newFile: string, contents: string): string {
			return this._replaceURL(contents, (url) => {
				var absoluteUrl = Utilities.joinPaths(Utilities.pathOf(originalFile), url);
				return Utilities.relativePath(newFile, absoluteUrl);
			});
		}

		public static rewriteOrInlineUrls(originalFileFSPath: string, originalFile: string, newFile: string, contents: string, forceBase64: boolean, inlineByteLimit: number): string {
			let fs = require.nodeRequire('fs');
			let path = require.nodeRequire('path');

			return this._replaceURL(contents, (url) => {
				if (/\.(svg|png)$/.test(url)) {
					let fsPath = path.join(path.dirname(originalFileFSPath), url);
					let fileContents = fs.readFileSync(fsPath);

					if (fileContents.length < inlineByteLimit) {
						global.cssInlinedResources = global.cssInlinedResources || [];
						let normalizedFSPath = fsPath.replace(/\\/g, '/');
						if (global.cssInlinedResources.indexOf(normalizedFSPath) >= 0) {
							// console.warn('CSS INLINING IMAGE AT ' + fsPath + ' MORE THAN ONCE. CONSIDER CONSOLIDATING CSS RULES');
						}
						global.cssInlinedResources.push(normalizedFSPath);

						let MIME = /\.svg$/.test(url) ? 'image/svg+xml' : 'image/png';
						let DATA = ';base64,' + fileContents.toString('base64');

						if (!forceBase64 && /\.svg$/.test(url)) {
							// .svg => url encode as explained at https://codepen.io/tigt/post/optimizing-svgs-in-data-uris
							let newText = fileContents.toString()
								.replace(/"/g, '\'')
								.replace(/</g, '%3C')
								.replace(/>/g, '%3E')
								.replace(/&/g, '%26')
								.replace(/#/g, '%23')
								.replace(/\s+/g, ' ');
							let encodedData = ',' + newText;
							if (encodedData.length < DATA.length) {
								DATA = encodedData;
							}
						}
						return '"data:' + MIME + DATA + '"';
					}
				}

				var absoluteUrl = Utilities.joinPaths(Utilities.pathOf(originalFile), url);
				return Utilities.relativePath(newFile, absoluteUrl);
			});
		}
	}

	(function () {
		var cssLoader: ICSSLoader = null;
		var isElectron = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions['electron'] !== 'undefined');
		if (typeof process !== 'undefined' && process.versions && !!process.versions.node && !isElectron) {
			cssLoader = new NodeCSSLoader();
		} else {
			cssLoader = new BrowserCSSLoader();
		}
		define('vs/css', new CSSPlugin(cssLoader));
	})();
}
