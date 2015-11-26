/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 * Please make sure to make edits in the .ts file at https://github.com/Microsoft/vscode-loader/
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *--------------------------------------------------------------------------------------------*/

/// <reference path="declares.ts" />
/// <reference path="loader.ts" />

'use strict';

var _nlsPluginGlobal = this;

module NLSLoaderPlugin {

	var global = _nlsPluginGlobal;
	var Resources = global.Plugin && global.Plugin.Resources ? global.Plugin.Resources : undefined;
	var DEFAULT_TAG = 'i-default';
	var IS_PSEUDO = (global && global.document && global.document.location && global.document.location.hash.indexOf('pseudo=true') >= 0);
	var slice = Array.prototype.slice;

	export interface IBundledStrings {
		[moduleId:string]: string[];
	}

	export interface ILocalizeInfo {
		key:string;
		comment:string[];
	}

	export interface ILocalizeFunc {
		(info:ILocalizeInfo, message:string, ...args:any[]):string;
		(key:string, message:string, ...args:any[]):string;
	}

	export interface IConsumerAPI {
		localize: ILocalizeFunc;
	}

	function _format(message:string, args:string[]): string {
		var result:string;

		if (args.length === 0) {
			result = message;
		} else {
			result = message.replace(/\{(\d+)\}/g, (match, rest) => {
				var index = rest[0];
				return typeof args[index] !== 'undefined' ? args[index] : match;
			});
		}

		if (IS_PSEUDO) {
			// FF3B and FF3D is the Unicode zenkaku representation for [ and ]
			result= '\uFF3B' + result.replace(/[aouei]/g, '$&$&') + '\uFF3D';
		}

		return result;
	}

	function findLanguageForModule(config, name) {
		var result = config[name];
		if (result)
			return result;
		result = config['*'];
		if (result)
			return result;
		return null;
	}

	function localize(data, message) {
		var args = [];
		for (var _i = 0; _i < (arguments.length - 2); _i++) {
			args[_i] = arguments[_i+2];
		}
		return _format(message, args);
	}

	function createScopedLocalize(scope:string[]): ILocalizeFunc {
		return function(idx, defaultValue) {
			var restArgs = slice.call(arguments, 2);
			return _format(scope[idx], restArgs);
		}
	}

	export class NLSPlugin implements AMDLoader.ILoaderPlugin {
		static BUILD_MAP: {[name:string]:string[];} = {};
		static BUILD_MAP_KEYS: {[name:string]:string[];} = {};

		public localize;

		constructor() {
			this.localize = localize;
		}

		public create(key:string, data:IBundledStrings): IConsumerAPI {
			return {
				localize: createScopedLocalize(data[key])
			}
		}

		public load(name:string, req:AMDLoader.IRelativeRequire, load:AMDLoader.IPluginLoadCallback, config:AMDLoader.IConfigurationOptions): void {
			config = config || {};
			if (!name || name.length === 0) {
				load({
					localize: localize
				});
			} else {
				var suffix;
				if (Resources) {
					suffix = '.nls.keys';
					req([name + suffix], function(keyMap) {
						load({
							localize: function(moduleKey, index) {
								if (!keyMap[moduleKey])
									return 'NLS error: unknown key ' + moduleKey;
								var mk = keyMap[moduleKey].keys;
								if (index >= mk.length)
									return 'NLS error unknow index ' + index;
								var subKey = mk[index];
								var args = [];
								args[0] = moduleKey + '_' + subKey;
								for (var _i = 0; _i < (arguments.length - 2); _i++) {
									args[_i + 1] = arguments[_i + 2];
								}
								return Resources.getString.apply(Resources, args);
							}
						});
					});
				} else {
					if (config.isBuild) {
						req([name + '.nls', name + '.nls.keys'], function (messages:string[], keys:string[]) {
							NLSPlugin.BUILD_MAP[name] = messages;
							NLSPlugin.BUILD_MAP_KEYS[name] = keys;
							load(messages);
						});
					} else {
						var pluginConfig = config['vs/nls'] || {};
						var language = pluginConfig.availableLanguages ? findLanguageForModule(pluginConfig.availableLanguages, name) : null;
						suffix = '.nls';
						if (language !== null && language !== DEFAULT_TAG) {
							suffix = suffix + '.' + language;
						}

						req([name + suffix], function(messages) {
							if (Array.isArray(messages)) {
								messages.localize = createScopedLocalize(messages);
							} else {
								messages.localize = createScopedLocalize(messages[name]);
							}
							load(messages);
						});
					}
				}
			}
		}

		private _getEntryPointsMap(): {[entryPoint:string]:string[]} {
			global.nlsPluginEntryPoints = global.nlsPluginEntryPoints || {};
			return global.nlsPluginEntryPoints;
		}

		public write(pluginName:string, moduleName:string, write:AMDLoader.IPluginWriteCallback): void {
			// getEntryPoint is a Monaco extension to r.js
			var entryPoint = write.getEntryPoint();

			// r.js destroys the context of this plugin between calling 'write' and 'writeFile'
			// so the only option at this point is to leak the data to a global
			var entryPointsMap = this._getEntryPointsMap();
			entryPointsMap[entryPoint] = entryPointsMap[entryPoint] || [];
			entryPointsMap[entryPoint].push(moduleName);

			if (moduleName !== entryPoint) {
				write.asModule(pluginName + '!' + moduleName, 'define([\'vs/nls\', \'vs/nls!' + entryPoint + '\'], function(nls, data) { return nls.create("'+moduleName+'", data); });');
			}
		}

		public writeFile(pluginName:string, moduleName:string, req:AMDLoader.IRelativeRequire, write:AMDLoader.IPluginWriteFileCallback, config:AMDLoader.IConfigurationOptions): void {
			var entryPointsMap = this._getEntryPointsMap();
			if (entryPointsMap.hasOwnProperty(moduleName)) {
				var fileName = req.toUrl(moduleName + '.nls.js');
				var contents = [
						'/*---------------------------------------------------------',
						' * Copyright (C) Microsoft Corporation. All rights reserved.',
						' *--------------------------------------------------------*/'
					],
					entries = entryPointsMap[moduleName];

				var data:{[moduleName:string]:string[];} = {};
				for (var i = 0; i < entries.length; i++) {
					data[entries[i]] = NLSPlugin.BUILD_MAP[entries[i]];
				}

				contents.push('define("'+moduleName+'.nls", ' + JSON.stringify(data, null, '\t') +');');
				write(fileName, contents.join('\r\n'));
			}
		}

		public finishBuild(write:AMDLoader.IPluginWriteFileCallback): void {
			write('nls.metadata.json', JSON.stringify({
				keys: NLSPlugin.BUILD_MAP_KEYS,
				messages: NLSPlugin.BUILD_MAP,
				bundles: this._getEntryPointsMap()
			}, null, '\t'));
		};
	}

	(function() {
		define('vs/nls', new NLSPlugin());
	})();

}