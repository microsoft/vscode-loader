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

module NLSLoaderPlugin {

	class Environment {

		private _detected: boolean;
		_isPseudo: boolean;

		public get isPseudo(): boolean {
			this._detect();
			return this._isPseudo;
		}

		constructor() {
			this._detected = false;
			this._isPseudo = false;
		}

		private _detect(): void {
			if (this._detected) {
				return;
			}
			this._detected = true;
			this._isPseudo = (typeof document !== 'undefined' && document.location && document.location.hash.indexOf('pseudo=true') >= 0);
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
		(info: ILocalizeInfo, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
		(key: string, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
	}

	interface IBoundLocalizeFunc {
		(idx: number, defaultValue: null);
	}

	export interface IConsumerAPI {
		localize: ILocalizeFunc | IBoundLocalizeFunc;
	}

	export interface BundleLoader {
		(bundle: string, locale: string, cb: (err: Error, messages: string[] | IBundledStrings) => void): void;
	}

	function _format(message: string, args: (string | number | boolean | undefined | null)[], env: Environment): string {
		let result: string;

		if (args.length === 0) {
			result = message;
		} else {
			result = message.replace(/\{(\d+)\}/g, (match, rest) => {
				let index = rest[0];
				let arg = args[index];
				let result = match;
				if (typeof arg === 'string') {
					result = arg;
				} else if (typeof arg === 'number' || typeof arg === 'boolean' || arg === void 0 || arg === null) {
					result = String(arg);
				}
				return result;
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

	function localize(env: Environment, data, message, ...args: (string | number | boolean | undefined | null)[]) {
		return _format(message, args, env);
	}

	function createScopedLocalize(scope: string[], env: Environment): IBoundLocalizeFunc {
		return function (idx: number, defaultValue: null) {
			let restArgs = Array.prototype.slice.call(arguments, 2);
			return _format(scope[idx], restArgs, env);
		}
	}

	export class NLSPlugin implements AMDLoader.ILoaderPlugin {

		private static DEFAULT_TAG = 'i-default';
		private _env: Environment;

		public localize: (data, message, ...args: (string | number | boolean | undefined | null)[]) => string;

		constructor(env: Environment) {
			this._env = env;
			this.localize = (data, message, ...args: (string | number | boolean | undefined | null)[]) => localize(this._env, data, message, ...args);
		}

		public setPseudoTranslation(value: boolean) {
			this._env._isPseudo = value;
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
				let messagesLoaded = (messages: string[] | IBundledStrings) => {
					if (Array.isArray(messages)) {
						(messages as any as IConsumerAPI).localize = createScopedLocalize(messages, this._env);
					} else {
						(messages as any as IConsumerAPI).localize = createScopedLocalize(messages[name], this._env);
					}
					load(messages);
				};
				if (typeof pluginConfig.loadBundle === 'function') {
					(pluginConfig.loadBundle as BundleLoader)(name, language, (err: Error, messages) => {
						// We have an error. Load the English default strings to not fail
						if (err) {
							req([name + '.nls'], messagesLoaded);
						} else {
							messagesLoaded(messages);
						}
					});
				} else {
					req([name + suffix], messagesLoaded);
				}
			}
		}
	}

	define('vs/nls', new NLSPlugin(new Environment()));
}
