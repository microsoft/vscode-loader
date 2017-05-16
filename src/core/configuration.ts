/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export interface IModuleConfiguration {
		[key: string]: any;
	}

	export interface INodeRequire {
		(nodeModule: string): any;
		main: {
			filename: string;
		};
	}

	export interface IConfigurationOptions {
		/**
		 * The prefix that will be aplied to all modules when they are resolved to a location
		 */
		baseUrl?: string;
		/**
		 * Redirect rules for modules. The redirect rules will affect the module ids themselves
		 */
		paths?: { [path: string]: any; };
		/**
		 * Per-module configuration
		 */
		config?: { [moduleId: string]: IModuleConfiguration };
		/**
		 * Catch errors when invoking the module factories
		 */
		catchError?: boolean;
		/**
		 * Record statistics
		 */
		recordStats?: boolean;
		/**
		 * The suffix that will be aplied to all modules when they are resolved to a location
		 */
		urlArgs?: string;
		/**
		 * Callback that will be called when errors are encountered
		 */
		onError?: (err: any) => void;
		/**
		 * The loader will issue warnings when duplicate modules are encountered.
		 * This list will inhibit those warnings if duplicate modules are expected.
		 */
		ignoreDuplicateModules?: string[];
		/**
		 * Flag to indicate if current execution is as part of a build. Used by plugins
		 */
		isBuild?: boolean;
		/**
		 * The main entry point node's require
		 */
		nodeRequire?: INodeRequire;
		/**
		 * An optional transformation applied to the source before it is loaded in node's vm
		 */
		nodeInstrumenter?: (source: string, vmScriptSrc: string) => string;
		nodeMain?: string;
		nodeModules?: string[];
		/**
		 * Optional data directory for reading/writing v8 cached data (http://v8project.blogspot.co.uk/2015/07/code-caching.html)
		 */
		nodeCachedDataDir?: string;
		/**
		 * Optional delay for filesystem write/delete operations
		 */
		nodeCachedDataWriteDelay?: number;
		/**
		 * Optional callback that will be invoked when cached data has been created
		 */
		onNodeCachedData?: (err: any, data?: any) => void;
	}

	export class ConfigurationOptionsUtil {

		/**
		 * Ensure configuration options make sense
		 */
		private static validateConfigurationOptions(options: IConfigurationOptions): IConfigurationOptions {

			function defaultOnError(err): void {
				if (err.errorCode === 'load') {
					console.error('Loading "' + err.moduleId + '" failed');
					console.error('Detail: ', err.detail);
					if (err.detail && err.detail.stack) {
						console.error(err.detail.stack);
					}
					console.error('Here are the modules that depend on it:');
					console.error(err.neededBy);
					return;
				}

				if (err.errorCode === 'factory') {
					console.error('The factory method of "' + err.moduleId + '" has thrown an exception');
					console.error(err.detail);
					if (err.detail && err.detail.stack) {
						console.error(err.detail.stack);
					}
					return;
				}
			}

			options = options || {};
			if (typeof options.baseUrl !== 'string') {
				options.baseUrl = '';
			}
			if (typeof options.isBuild !== 'boolean') {
				options.isBuild = false;
			}
			if (typeof options.paths !== 'object') {
				options.paths = {};
			}
			if (typeof options.config !== 'object') {
				options.config = {};
			}
			if (typeof options.catchError === 'undefined') {
				// Catch errors by default in web workers, do not catch errors by default in other contexts
				options.catchError = isWebWorker;
			}
			if (typeof options.urlArgs !== 'string') {
				options.urlArgs = '';
			}
			if (typeof options.onError !== 'function') {
				options.onError = defaultOnError;
			}
			if (typeof options.ignoreDuplicateModules !== 'object' || !Array.isArray(options.ignoreDuplicateModules)) {
				options.ignoreDuplicateModules = [];
			}
			if (options.baseUrl.length > 0) {
				if (!Utilities.endsWith(options.baseUrl, '/')) {
					options.baseUrl += '/';
				}
			}
			if (!Array.isArray(options.nodeModules)) {
				options.nodeModules = [];
			}
			if (typeof options.nodeCachedDataWriteDelay !== 'number' || options.nodeCachedDataWriteDelay < 0) {
				options.nodeCachedDataWriteDelay = 1000 * 7;
			}
			if (typeof options.onNodeCachedData !== 'function') {
				options.onNodeCachedData = (err, data?) => {
					if (!err) {
						// ignore

					} else if (err.errorCode === 'cachedDataRejected') {
						console.warn('Rejected cached data from file: ' + err.path);

					} else if (err.errorCode === 'unlink' || err.errorCode === 'writeFile') {
						console.error('Problems writing cached data file: ' + err.path);
						console.error(err.detail);

					} else {
						console.error(err);
					}
				};
			}

			return options;
		}

		public static mergeConfigurationOptions(overwrite: IConfigurationOptions = null, base: IConfigurationOptions = null): IConfigurationOptions {
			let result: IConfigurationOptions = Utilities.recursiveClone(base || {});

			// Merge known properties and overwrite the unknown ones
			Utilities.forEachProperty(overwrite, (key: string, value: any) => {
				if (key === 'ignoreDuplicateModules' && typeof result.ignoreDuplicateModules !== 'undefined') {
					result.ignoreDuplicateModules = result.ignoreDuplicateModules.concat(value);
				} else if (key === 'paths' && typeof result.paths !== 'undefined') {
					Utilities.forEachProperty(value, (key2: string, value2: any) => result.paths[key2] = value2);
				} else if (key === 'config' && typeof result.config !== 'undefined') {
					Utilities.forEachProperty(value, (key2: string, value2: any) => result.config[key2] = value2);
				} else {
					result[key] = Utilities.recursiveClone(value);
				}
			});

			return ConfigurationOptionsUtil.validateConfigurationOptions(result);
		}
	}

	export class Configuration {

		private options: IConfigurationOptions;

		/**
		 * Generated from the `ignoreDuplicateModules` configuration option.
		 */
		private ignoreDuplicateModulesMap: { [moduleId: string]: boolean; };

		/**
		 * Generated from the `nodeModules` configuration option.
		 */
		private nodeModulesMap: { [nodeModuleId: string]: boolean };

		/**
		 * Generated from the `paths` configuration option. These are sorted with the longest `from` first.
		 */
		private sortedPathsRules: { from: string; to: string[]; }[];

		constructor(options?: IConfigurationOptions) {
			this.options = ConfigurationOptionsUtil.mergeConfigurationOptions(options);

			this._createIgnoreDuplicateModulesMap();
			this._createNodeModulesMap();
			this._createSortedPathsRules();

			if (this.options.baseUrl === '') {
				if (isNode && this.options.nodeRequire && this.options.nodeRequire.main && this.options.nodeRequire.main.filename) {
					let nodeMain = this.options.nodeRequire.main.filename;
					let dirnameIndex = Math.max(nodeMain.lastIndexOf('/'), nodeMain.lastIndexOf('\\'));
					this.options.baseUrl = nodeMain.substring(0, dirnameIndex + 1);
				}
				if (isNode && this.options.nodeMain) {
					let nodeMain = this.options.nodeMain;
					let dirnameIndex = Math.max(nodeMain.lastIndexOf('/'), nodeMain.lastIndexOf('\\'));
					this.options.baseUrl = nodeMain.substring(0, dirnameIndex + 1);
				}
			}
		}

		private _createIgnoreDuplicateModulesMap(): void {
			// Build a map out of the ignoreDuplicateModules array
			this.ignoreDuplicateModulesMap = {};
			for (let i = 0; i < this.options.ignoreDuplicateModules.length; i++) {
				this.ignoreDuplicateModulesMap[this.options.ignoreDuplicateModules[i]] = true;
			}
		}

		private _createNodeModulesMap(): void {
			// Build a map out of nodeModules array
			this.nodeModulesMap = Object.create(null);
			for (const nodeModule of this.options.nodeModules) {
				this.nodeModulesMap[nodeModule] = true;
			}
		}

		private _createSortedPathsRules(): void {
			// Create an array our of the paths rules, sorted descending by length to
			// result in a more specific -> less specific order
			this.sortedPathsRules = [];
			Utilities.forEachProperty(this.options.paths, (from: string, to: any) => {
				if (!Array.isArray(to)) {
					this.sortedPathsRules.push({
						from: from,
						to: [to]
					});
				} else {
					this.sortedPathsRules.push({
						from: from,
						to: to
					});
				}
			});
			this.sortedPathsRules.sort((a, b) => {
				return b.from.length - a.from.length;
			});
		}

		/**
		 * Clone current configuration and overwrite options selectively.
		 * @param options The selective options to overwrite with.
		 * @result A new configuration
		 */
		public cloneAndMerge(options?: IConfigurationOptions): Configuration {
			return new Configuration(ConfigurationOptionsUtil.mergeConfigurationOptions(options, this.options));
		}

		/**
		 * Get current options bag. Useful for passing it forward to plugins.
		 */
		public getOptionsLiteral(): IConfigurationOptions {
			return this.options;
		}

		private _applyPaths(moduleId: string): string[] {
			let pathRule: { from: string; to: string[]; };
			for (let i = 0, len = this.sortedPathsRules.length; i < len; i++) {
				pathRule = this.sortedPathsRules[i];
				if (Utilities.startsWith(moduleId, pathRule.from)) {
					let result: string[] = [];
					for (let j = 0, lenJ = pathRule.to.length; j < lenJ; j++) {
						result.push(pathRule.to[j] + moduleId.substr(pathRule.from.length));
					}
					return result;
				}
			}
			return [moduleId];
		}

		private _addUrlArgsToUrl(url: string): string {
			if (Utilities.containsQueryString(url)) {
				return url + '&' + this.options.urlArgs;
			} else {
				return url + '?' + this.options.urlArgs;
			}
		}

		private _addUrlArgsIfNecessaryToUrl(url: string): string {
			if (this.options.urlArgs) {
				return this._addUrlArgsToUrl(url);
			}
			return url;
		}

		private _addUrlArgsIfNecessaryToUrls(urls: string[]): string[] {
			if (this.options.urlArgs) {
				for (let i = 0, len = urls.length; i < len; i++) {
					urls[i] = this._addUrlArgsToUrl(urls[i]);
				}
			}
			return urls;
		}

		/**
		 * Transform a module id to a location. Appends .js to module ids
		 */
		public moduleIdToPaths(moduleId: string): string[] {

			if (this.nodeModulesMap[moduleId] === true) {
				// This is a node module...
				if (this.isBuild()) {
					// ...and we are at build time, drop it
					return ['empty:'];
				} else {
					// ...and at runtime we create a `shortcut`-path
					return ['node|' + moduleId];
				}
			}

			let result = moduleId;

			let results: string[];
			if (!Utilities.endsWith(result, '.js') && !Utilities.isAbsolutePath(result)) {
				results = this._applyPaths(result);

				for (let i = 0, len = results.length; i < len; i++) {
					if (this.isBuild() && results[i] === 'empty:') {
						continue;
					}

					if (!Utilities.isAbsolutePath(results[i])) {
						results[i] = this.options.baseUrl + results[i];
					}

					if (!Utilities.endsWith(results[i], '.js') && !Utilities.containsQueryString(results[i])) {
						results[i] = results[i] + '.js';
					}
				}
			} else {
				if (!Utilities.endsWith(result, '.js') && !Utilities.containsQueryString(result)) {
					result = result + '.js';
				}
				results = [result];
			}

			return this._addUrlArgsIfNecessaryToUrls(results);
		}

		/**
		 * Transform a module id or url to a location.
		 */
		public requireToUrl(url: string): string {
			let result = url;

			if (!Utilities.isAbsolutePath(result)) {
				result = this._applyPaths(result)[0];

				if (!Utilities.isAbsolutePath(result)) {
					result = this.options.baseUrl + result;
				}
			}

			return this._addUrlArgsIfNecessaryToUrl(result);
		}

		/**
		 * Flag to indicate if current execution is as part of a build.
		 */
		public isBuild(): boolean {
			return this.options.isBuild;
		}

		/**
		 * Test if module `moduleId` is expected to be defined multiple times
		 */
		public isDuplicateMessageIgnoredFor(moduleId: string): boolean {
			return this.ignoreDuplicateModulesMap.hasOwnProperty(moduleId);
		}

		/**
		 * Get the configuration settings for the provided module id
		 */
		public getConfigForModule(moduleId: string): IModuleConfiguration {
			if (this.options.config) {
				return this.options.config[moduleId];
			}
		}

		/**
		 * Should errors be caught when executing module factories?
		 */
		public shouldCatchError(): boolean {
			return this.options.catchError;
		}

		/**
		 * Should statistics be recorded?
		 */
		public shouldRecordStats(): boolean {
			return this.options.recordStats;
		}

		/**
		 * Forward an error to the error handler.
		 */
		public onError(err: any): void {
			this.options.onError(err);
		}
	}
}
