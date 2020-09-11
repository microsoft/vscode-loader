/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export interface AnnotatedLoadingError extends Error {
		phase: 'loading';
		moduleId: string;
		neededBy: string[];
	}

	export interface AnnotatedFactoryError extends Error {
		phase: 'factory';
		moduleId: string;
	}

	export interface AnnotatedValidationError extends Error {
		phase: 'configuration';
	}

	export type AnnotatedError = AnnotatedLoadingError | AnnotatedFactoryError | AnnotatedValidationError;

	export function ensureError<T extends Error>(err: any): T {
		if (err instanceof Error) {
			return <T>err;
		}
		const result = new Error(err.message || String(err) || 'Unknown Error');
		if (err.stack) {
			result.stack = err.stack;
		}
		return <T>result;
	}

	/**
	 * The signature for the loader's AMD "define" function.
	 */
	export interface IDefineFunc {
		(id: 'string', dependencies: string[], callback: any): void;
		(id: 'string', callback: any): void;
		(dependencies: string[], callback: any): void;
		(callback: any): void;

		amd: {
			jQuery: boolean;
		};
	}

	/**
	 * The signature for the loader's AMD "require" function.
	 */
	export interface IRequireFunc {
		(module: string): any;
		(config: any): void;
		(modules: string[], callback: Function): void;
		(modules: string[], callback: Function, errorback: (err: any) => void): void;

		config(params: IConfigurationOptions, shouldOverwrite?: boolean): void;

		getConfig(): IConfigurationOptions;

		/**
		 * Non standard extension to reset completely the loader state. This is used for running amdjs tests
		 */
		reset(): void;

		/**
		 * Non standard extension to fetch loader state for building purposes.
		 */
		getBuildInfo(): IBuildModuleInfo[] | null;

		/**
		 * Non standard extension to fetch loader events
		 */
		getStats(): LoaderEvent[];

		/**
		 * The define function
		 */
		define(id: 'string', dependencies: string[], callback: any): void;
		define(id: 'string', callback: any): void;
		define(dependencies: string[], callback: any): void;
		define(callback: any): void;
	}

	export interface IModuleConfiguration {
		[key: string]: any;
	}

	export interface INodeRequire {
		(nodeModule: string): any;
		main: {
			filename: string;
		};
	}

	export interface INodeCachedDataConfiguration {
		/**
		 * Directory path in which cached is stored.
		 */
		path: string;
		/**
		 * Seed when generating names of cache files.
		 */
		seed?: string;
		/**
		 * Optional delay for filesystem write/delete operations
		 */
		writeDelay?: number;
	};

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
		onError?: (err: AnnotatedError) => void;
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
		 * Content Security Policy nonce value used to load child scripts.
		 */
		cspNonce?: string;
		/**
		 * If running inside an electron renderer, prefer using <script> tags to load code.
		 * Defaults to false.
		 */
		preferScriptTags?: boolean;
		/**
		 * A callback that enables use of TrustedScriptURL instead of strings, see
		 * https://w3c.github.io/webappsec-trusted-types/dist/spec/#introduction.
		 *
		 * The implementation of this callback should validate the given value (which
		 * represents a script source value) and throw an error if validation fails.
		 */
		createTrustedScriptURL?: (value: string) => string;
		/**
		 * A regex to help determine if a module is an AMD module or a node module.
		 * If defined, then all amd modules in the system must match this regular expression.
		 */
		amdModulesPattern?: RegExp;
		/**
		 * A list of known node modules that should be directly loaded via node's require.
		 */
		nodeModules?: string[];
		/**
		 * The main entry point node's require
		 */
		nodeRequire?: INodeRequire;
		/**
		 * An optional transformation applied to the source before it is loaded in node's vm
		 */
		nodeInstrumenter?: (source: string, vmScriptSrc: string) => string;
		/**
		 * The main entry point.
		 */
		nodeMain?: string;
		/**
		* Support v8 cached data (http://v8project.blogspot.co.uk/2015/07/code-caching.html)
		*/
		nodeCachedData?: INodeCachedDataConfiguration
	}

	export interface IValidatedConfigurationOptions extends IConfigurationOptions {
		baseUrl: string;
		paths: { [path: string]: any; };
		config: { [moduleId: string]: IModuleConfiguration };
		catchError: boolean;
		recordStats: boolean;
		urlArgs: string;
		onError: (err: AnnotatedError) => void;
		ignoreDuplicateModules: string[];
		isBuild: boolean;
		cspNonce: string;
		preferScriptTags: boolean;
		nodeModules: string[];
	}

	export class ConfigurationOptionsUtil {

		/**
		 * Ensure configuration options make sense
		 */
		private static validateConfigurationOptions(options: IConfigurationOptions): IValidatedConfigurationOptions {

			function defaultOnError(err: AnnotatedError): void {
				if (err.phase === 'loading') {
					console.error('Loading "' + err.moduleId + '" failed');
					console.error(err);
					console.error('Here are the modules that depend on it:');
					console.error(err.neededBy);
					return;
				}

				if (err.phase === 'factory') {
					console.error('The factory method of "' + err.moduleId + '" has thrown an exception');
					console.error(err);
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
				options.catchError = false;
			}
			if (typeof options.recordStats === 'undefined') {
				options.recordStats = false;
			}
			if (typeof options.urlArgs !== 'string') {
				options.urlArgs = '';
			}
			if (typeof options.onError !== 'function') {
				options.onError = defaultOnError;
			}
			if (!Array.isArray(options.ignoreDuplicateModules)) {
				options.ignoreDuplicateModules = [];
			}
			if (options.baseUrl.length > 0) {
				if (!Utilities.endsWith(options.baseUrl, '/')) {
					options.baseUrl += '/';
				}
			}
			if (typeof options.cspNonce !== 'string') {
				options.cspNonce = '';
			}
			if (typeof options.preferScriptTags === 'undefined') {
				options.preferScriptTags = false;
			}
			if (!Array.isArray(options.nodeModules)) {
				options.nodeModules = [];
			}
			if (options.nodeCachedData && typeof options.nodeCachedData === 'object') {
				if (typeof options.nodeCachedData.seed !== 'string') {
					options.nodeCachedData.seed = 'seed';
				}
				if (typeof options.nodeCachedData.writeDelay !== 'number' || options.nodeCachedData.writeDelay < 0) {
					options.nodeCachedData.writeDelay = 1000 * 7;
				}
				if (!options.nodeCachedData.path || typeof options.nodeCachedData.path !== 'string') {
					const err = ensureError<AnnotatedValidationError>(new Error('INVALID cached data configuration, \'path\' MUST be set'));
					err.phase = 'configuration';
					options.onError(err);
					options.nodeCachedData = undefined;
				}
			}

			return <IValidatedConfigurationOptions>options;
		}

		public static mergeConfigurationOptions(overwrite: IConfigurationOptions | null = null, base: IConfigurationOptions | null = null): IValidatedConfigurationOptions {
			let result: IConfigurationOptions = Utilities.recursiveClone(base || {});

			// Merge known properties and overwrite the unknown ones
			Utilities.forEachProperty(overwrite, (key: string, value: any) => {
				if (key === 'ignoreDuplicateModules' && typeof result.ignoreDuplicateModules !== 'undefined') {
					result.ignoreDuplicateModules = result.ignoreDuplicateModules.concat(value);
				} else if (key === 'paths' && typeof result.paths !== 'undefined') {
					Utilities.forEachProperty(value, (key2: string, value2: any) => result.paths![key2] = value2);
				} else if (key === 'config' && typeof result.config !== 'undefined') {
					Utilities.forEachProperty(value, (key2: string, value2: any) => result.config![key2] = value2);
				} else {
					result[key] = Utilities.recursiveClone(value);
				}
			});

			return ConfigurationOptionsUtil.validateConfigurationOptions(result);
		}
	}

	export class Configuration {

		private readonly _env: Environment;

		private options: IValidatedConfigurationOptions;

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

		constructor(env: Environment, options?: IConfigurationOptions) {
			this._env = env;
			this.options = ConfigurationOptionsUtil.mergeConfigurationOptions(options);

			this._createIgnoreDuplicateModulesMap();
			this._createNodeModulesMap();
			this._createSortedPathsRules();

			if (this.options.baseUrl === '') {
				if (this.options.nodeRequire && this.options.nodeRequire.main && this.options.nodeRequire.main.filename && this._env.isNode) {
					let nodeMain = this.options.nodeRequire.main.filename;
					let dirnameIndex = Math.max(nodeMain.lastIndexOf('/'), nodeMain.lastIndexOf('\\'));
					this.options.baseUrl = nodeMain.substring(0, dirnameIndex + 1);
				}
				if (this.options.nodeMain && this._env.isNode) {
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
			return new Configuration(this._env, ConfigurationOptionsUtil.mergeConfigurationOptions(options, this.options));
		}

		/**
		 * Get current options bag. Useful for passing it forward to plugins.
		 */
		public getOptionsLiteral(): IValidatedConfigurationOptions {
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

			const isNodeModule = (
				(this.nodeModulesMap[moduleId] === true)
				|| (this.options.amdModulesPattern instanceof RegExp && !this.options.amdModulesPattern.test(moduleId))
			);

			if (isNodeModule) {
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
		public getConfigForModule(moduleId: string): IModuleConfiguration | undefined {
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
		public onError(err: AnnotatedError): void {
			this.options.onError(err);
		}
	}
}
