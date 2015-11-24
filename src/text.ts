/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/// <reference path="declares.ts" />
/// <reference path="loader.ts" />

'use strict';

module TextLoaderPlugin {

	export interface ITextLoader {
		load(name:string, fileUrl:string, externalCallback:(contents:string)=>void, externalErrorback:(err:any)=>void): void;
	}

	class BrowserTextLoader implements ITextLoader {

		public load(name:string, fileUrl:string, externalCallback:(contents:string)=>void, externalErrorback:(err:any)=>void): void {
			var req = new XMLHttpRequest();
			req.onreadystatechange = () => {
				if (req.readyState === 4) {
					if ((req.status >= 200 && req.status < 300) || /*IE is very weird*/req.status === 1223 || /*Node webkit is very weird*/(req.status === 0 && req.responseText && req.responseText.length > 0)) {
						externalCallback(req.responseText);
					} else {
						externalErrorback(req);
					}
					req.onreadystatechange = null;
				}
			};

			req.open('GET', fileUrl, true);
			req.responseType = '';
			req.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

			req.send(null);
		}
	}

	interface INodeFS {
		readFileSync(filename:string, encoding:string): string;
	}

	function readFileAndRemoveBOM(fs:INodeFS, path:string): string {
		var BOM_CHAR_CODE = 65279;
		var contents = fs.readFileSync(path, 'utf8');
		// Remove BOM
		if (contents.charCodeAt(0) === BOM_CHAR_CODE) {
			contents = contents.substring(1);
		}
		return contents;
	}

	class NodeTextLoader {

		private fs:INodeFS;

		constructor() {
			this.fs = require.nodeRequire('fs');
		}

		public load(name:string, fileUrl:string, callback:(contents:string)=>void, errorback:(err:any)=>void): void {
			callback(readFileAndRemoveBOM(this.fs, fileUrl));
		}
	}

	// ------------------------------ Finally, the plugin

	export class TextPlugin implements AMDLoader.ILoaderPlugin {

		static BUILD_MAP: {[name:string]:string;} = <any>{};

		private textLoader:ITextLoader;

		constructor(textLoader:ITextLoader) {
			this.textLoader = textLoader;
		}

		public load(name:string, req:AMDLoader.IRelativeRequire, load:AMDLoader.IPluginLoadCallback, config:AMDLoader.IConfigurationOptions): void {
			config = config || {};
			var myConfig = config['vs/text'] || {};
			var myPaths = myConfig.paths || {};
			var redirectedName = name;
			for (var path in myPaths) {
				if (myPaths.hasOwnProperty(path)) {
					if (name.indexOf(path) === 0) {
						redirectedName = myPaths[path] + name.substr(path.length);
					}
				}
			}
			var fileUrl = req.toUrl(redirectedName);
			this.textLoader.load(name, fileUrl, (contents) => {
				if (config.isBuild) {
					TextPlugin.BUILD_MAP[name] = contents;
				}
				load(contents);
			}, (err) => {
				if (typeof load.error === 'function') {
					load.error('Could not find ' + fileUrl);
				}
			});
		}

		public write(pluginName:string, moduleName:string, write:AMDLoader.IPluginWriteCallback): void {
			if (TextPlugin.BUILD_MAP.hasOwnProperty(moduleName)) {
				var escapedText = Utilities.escapeText(TextPlugin.BUILD_MAP[moduleName]);
				write('define("' + pluginName + '!' + moduleName + '", function () { return "' + escapedText + '"; });');
			}
		}
	}

	export class Utilities {

		/**
		 * Escape text such that it can be used in a javascript string enclosed by double quotes (")
		 */
		public static escapeText(text:string): string {
			// http://www.javascriptkit.com/jsref/escapesequence.shtml
			// \b	Backspace.
			// \f	Form feed.
			// \n	Newline.
			// \O	Nul character.
			// \r	Carriage return.
			// \t	Horizontal tab.
			// \v	Vertical tab.
			// \'	Single quote or apostrophe.
			// \"	Double quote.
			// \\	Backslash.
			// \ddd	The Latin-1 character specified by the three octal digits between 0 and 377. ie, copyright symbol is \251.
			// \xdd	The Latin-1 character specified by the two hexadecimal digits dd between 00 and FF.  ie, copyright symbol is \xA9.
			// \udddd	The Unicode character specified by the four hexadecimal digits dddd. ie, copyright symbol is \u00A9.

			var _backspace = '\b'.charCodeAt(0);
			var _formFeed = '\f'.charCodeAt(0);
			var _newLine = '\n'.charCodeAt(0);
			var _nullChar = 0;
			var _carriageReturn = '\r'.charCodeAt(0);
			var _tab = '\t'.charCodeAt(0);
			var _verticalTab = '\v'.charCodeAt(0);
			var _backslash = '\\'.charCodeAt(0);
			var _doubleQuote = '"'.charCodeAt(0);

			var startPos = 0, chrCode:number, replaceWith:string = null, resultPieces:string[] = [];
			for (var i = 0, len = text.length; i < len; i++) {
				chrCode = text.charCodeAt(i);
				switch(chrCode) {
					case _backspace:
						replaceWith = '\\b';
						break;
					case _formFeed:
						replaceWith = '\\f';
						break;
					case _newLine:
						replaceWith = '\\n';
						break;
					case _nullChar:
						replaceWith = '\\0';
						break;
					case _carriageReturn:
						replaceWith = '\\r';
						break;
					case _tab:
						replaceWith = '\\t';
						break;
					case _verticalTab:
						replaceWith = '\\v';
						break;
					case _backslash:
						replaceWith = '\\\\';
						break;
					case _doubleQuote:
						replaceWith = '\\"';
						break;
				}
				if (replaceWith !== null) {
					resultPieces.push(text.substring(startPos, i));
					resultPieces.push(replaceWith);
					startPos = i + 1;
					replaceWith = null;
				}
			}
			resultPieces.push(text.substring(startPos, len));

			return resultPieces.join('');
		}
	}

	(function() {
		var textLoader:ITextLoader = null;
		var isAtomShell = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions['electron'] !== 'undefined');
		if (typeof process !== 'undefined' && process.versions && !!process.versions.node && !isAtomShell) {
			textLoader = new NodeTextLoader();
		} else {
			textLoader = new BrowserTextLoader();
		}

		define('vs/text', new TextPlugin(textLoader));
	})();
}