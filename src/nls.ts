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

'use strict';

module NLSLoaderPlugin {

	class Environment {

		static detect(): Environment {
			let isPseudo = (typeof document !== 'undefined' && document.location && document.location.hash.indexOf('pseudo=true') >= 0);
			return new Environment(isPseudo);
		}

		constructor(
			readonly isPseudo: boolean
		) {
			//
		}
	}

	export interface IBundledStrings {
		[moduleId: string]: string[];
	}

	export interface ILocalizeInfo {
		key: string;
		comment: string[];
	}

	export interface ILocalizeFunc {
		(info: ILocalizeInfo, message: string, ...args: any[]): string;
		(key: string, message: string, ...args: any[]): string;
	}

	export interface IConsumerAPI {
		localize: ILocalizeFunc;
	}

	function _format(message: string, args: string[], env: Environment): string {
		let result: string;

		if (args.length === 0) {
			result = message;
		} else {
			result = message.replace(/\{(\d+)\}/g, (match, rest) => {
				let index = rest[0];
				return typeof args[index] !== 'undefined' ? args[index] : match;
			});
		}

		if (env.isPseudo) {
			// FF3B and FF3D is the Unicode zenkaku representation for [ and ]
			result = '\uFF3B' + result.replace(/[aouei]/g, '$&$&') + '\uFF3D';
		}

		return result;
	}

	function findLanguageForModule(config, name) {
		let result = config[name];
		if (result)
			return result;
		result = config['*'];
		if (result)
			return result;
		return null;
	}

	function localize(env: Environment, data, message, ...args: any[]) {
		return _format(message, args, env);
	}

	function createScopedLocalize(scope: string[], env: Environment): ILocalizeFunc {
		return function (idx, defaultValue) {
			let restArgs = Array.prototype.slice.call(arguments, 2);
			return _format(scope[idx], restArgs, env);
		}
	}

	export class NLSPlugin implements AMDLoader.ILoaderPlugin {

		private static DEFAULT_TAG = 'i-default';
		private _env: Environment;

		public localize: (data, message, ...args: any[]) => string;

		constructor(env: Environment) {
			this._env = env;
			this.localize = (data, message, ...args: any[]) => localize(this._env, data, message, ...args);
		}

		public setPseudoTranslation(value: boolean) {
			this._env = new Environment(value);
		}

		public create(key: string, data: IBundledStrings): IConsumerAPI {
			return {
				localize: createScopedLocalize(data[key], this._env)
			}
		}

		public load(name: string, req: AMDLoader.IRelativeRequire, load: AMDLoader.IPluginLoadCallback, config: AMDLoader.IConfigurationOptions): void {
			config = config || {};
			if (!name || name.length === 0) {
				load({
					localize: this.localize
				});
			} else {
				let pluginConfig = config['vs/nls'] || {};
				let language = pluginConfig.availableLanguages ? findLanguageForModule(pluginConfig.availableLanguages, name) : null;
				let suffix = '.nls';
				if (language !== null && language !== NLSPlugin.DEFAULT_TAG) {
					suffix = suffix + '.' + language;
				}

				req([name + suffix], (messages) => {
					if (Array.isArray(messages)) {
						(<any>messages).localize = createScopedLocalize(messages, this._env);
					} else {
						messages.localize = createScopedLocalize(messages[name], this._env);
					}
					load(messages);
				});

			}
		}
	}

	export function init() {
		define('vs/nls', new NLSPlugin(Environment.detect()));
	}

	if (typeof doNotInitLoader === 'undefined') {
		init();
	}
}
