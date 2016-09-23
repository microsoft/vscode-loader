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

// Limitation: To load jquery through the loader, always require 'jquery' and add a path for it in the loader configuration

var _amdLoaderGlobal = this, define;

declare var module;
declare var process;
declare var require;

module AMDLoader {

	export interface IScriptLoader {
		load(scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void, recorder:ILoaderEventRecorder): void;
		setModuleManager(moduleManager:ModuleManager): void;
	}

	export interface ILoaderPlugin {
		dynamic?:boolean;
		normalize?:(pluginParam:string, normalize:(moduleId:string)=>string)=>string;
		load?:(pluginParam:string, parentRequire:IRelativeRequire, loadCallback:IPluginLoadCallback, options:IConfigurationOptions)=>void;
		write?:(pluginName:string, moduleName:string, write:IPluginWriteCallback)=>void;
		writeFile?:(pluginName:string, moduleName:string, req:IRelativeRequire, write:IPluginWriteFileCallback, config:IConfigurationOptions)=>void;
		finishBuild?:(write:(filename:string, contents:string)=>void)=>void;
	}

	export interface IDefineCall {
		id?:string;
		stack:string;
		dependencies:string[];
		callback:any;
	}

	export interface IRelativeRequire {
		(dependencies:string[], callback:Function): void;
		(dependency:string): any;
		toUrl(id:string): string;
		getStats(): LoaderEvent[];
		getChecksums(): {[scriptSrc:string]:string};
	}

	export interface IPluginLoadCallback {
		(value:any): void;
		error(err:any): void;
	}

	export interface IPluginWriteCallback {
		(contents:string): void;
		getEntryPoint(): string;
		asModule(moduleId:string, contents:string): void;
	}

	export interface IPluginWriteFileCallback {
		(filename:string, contents:string): void;
		getEntryPoint(): string;
		asModule(moduleId:string, contents:string): void;
	}

	// ------------------------------------------------------------------------
	// Utilities
	function _isWindows() {
		if (typeof navigator !== 'undefined') {
			if (navigator.userAgent && navigator.userAgent.indexOf('Windows') >= 0) {
				return true;
			}
		}
		if (typeof process !== 'undefined') {
			return (process.platform === 'win32');
		}
		return false;
	}
	var isWindows = _isWindows();
	export class Utilities {
		/**
		 * This method does not take care of / vs \
		 */
		public static fileUriToFilePath(uri:string): string {
			uri = decodeURI(uri);
			if (isWindows) {
				if (/^file:\/\/\//.test(uri)) {
					// This is a URI without a hostname => return only the path segment
					return uri.substr(8);
				}
				if (/^file:\/\//.test(uri)) {
					return uri.substr(5);
				}
			} else {
				if (/^file:\/\//.test(uri)) {
					return uri.substr(7);
				}
			}
			// Not sure...
			return uri;
		}

		public static startsWith(haystack:string, needle:string): boolean {
			return haystack.length >= needle.length && haystack.substr(0, needle.length) === needle;
		}

		public static endsWith(haystack:string, needle:string): boolean {
			return haystack.length >= needle.length && haystack.substr(haystack.length - needle.length) === needle;
		}

		// only check for "?" before "#" to ensure that there is a real Query-String
		public static containsQueryString(url:string): boolean {
			return /^[^\#]*\?/gi.test(url);
		}

		/**
		 * Does `url` start with http:// or https:// or / ?
		 */
		public static isAbsolutePath(url:string): boolean {
			return (
				Utilities.startsWith(url, 'http://')
				|| Utilities.startsWith(url, 'https://')
				|| Utilities.startsWith(url, 'file://')
				|| Utilities.startsWith(url, '/')
			);
		}

		public static forEachProperty(obj:any, callback:(key:string, value:any)=>void): void {
			if (obj) {
				var key:string;
				for (key in obj) {
					if (obj.hasOwnProperty(key)) {
						callback(key, obj[key]);
					}
				}
			}
		}

		public static isEmpty(obj:any): boolean {
			var isEmpty = true;
			Utilities.forEachProperty(obj, () => {
				isEmpty = false;
			});
			return isEmpty;
		}

		public static isArray(obj:any): boolean {
			if (Array.isArray) {
				return Array.isArray(obj);
			}
			return Object.prototype.toString.call(obj) === '[object Array]';
		}

		public static recursiveClone(obj:any): any {
			if (!obj || typeof obj !== 'object') {
				return obj;
			}
			var result = Utilities.isArray(obj) ? [] : {};
			Utilities.forEachProperty(obj, (key:string, value:any) => {
				if (value && typeof value === 'object') {
					result[key] = Utilities.recursiveClone(value);
				} else {
					result[key] = value;
				}
			});
			return result;
		}


		static NEXT_ANONYMOUS_ID = 1;

		public static generateAnonymousModule(): string {
			return '===anonymous' + (Utilities.NEXT_ANONYMOUS_ID++) + '===';
		}

		public static isAnonymousModule(id:string): boolean {
			return id.indexOf('===anonymous') === 0;
		}
	}

	// ------------------------------------------------------------------------
	// Configuration

	export interface IShimConfiguration {
		deps?:string[];
		exports?:any;
		init?:(...depsValues:any[])=>any;
	}

	export interface IBundleConfiguration {
		location: string;
		modules: string[];
	}

	export interface IModuleConfiguration {
		[key:string]:any;
	}

	export interface INodeRequire {
		(nodeModule:string): any;
		main: {
			filename: string;
		};
	}

	export interface IConfigurationOptions {
		/**
		 * The prefix that will be aplied to all modules when they are resolved to a location
		 */
		baseUrl?:string;
		/**
		 * Redirect rules for modules. The redirect rules will affect the module ids themselves
		 */
		paths?:{ [path:string]:any; };
		/**
		 * Bundle mappings for modules. (@TODO)
		 */
		bundles?: any;
		/**
		 * Definitions for non-AMD scripts.
		 */
		shim?:{ [path:string]:IShimConfiguration; };
		/**
		 * Per-module configuration
		 */
		config?:{ [moduleId:string]:IModuleConfiguration };
		/**
		 * Catch errors when invoking the module factories
		 */
		catchError?:boolean;
		/**
		 * Record statistics
		 */
		recordStats?:boolean;
		/**
		 * The suffix that will be aplied to all modules when they are resolved to a location
		 */
		urlArgs?:string;
		/**
		 * Callback that will be called when errors are encountered
		 */
		onError?:(err:any)=>void;
		/**
		 * The loader will issue warnings when duplicate modules are encountered.
		 * This list will inhibit those warnings if duplicate modules are expected.
		 */
		ignoreDuplicateModules?:string[];
		/**
		 * Flag to indicate if current execution is as part of a build. Used by plugins
		 */
		isBuild?:boolean;
		/**
		 * The main entry point node's require
		 */
		nodeRequire?:INodeRequire;
		/**
		 * An optional transformation applied to the source before it is loaded in node's vm
		 */
		nodeInstrumenter?:(source:string, vmScriptSrc:string)=>string;
		nodeMain?:string;
		nodeModules?:string[];
		checksum?:boolean;
	}

	export class ConfigurationOptionsUtil {

		/**
		 * Ensure configuration options make sense
		 */
		private static validateConfigurationOptions(options:IConfigurationOptions): IConfigurationOptions {

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
			if (typeof options.bundles !== 'object') {
				options.bundles = [];
			}
			if (typeof options.shim !== 'object') {
				options.shim = {};
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
			if (typeof options.ignoreDuplicateModules !== 'object' || !Utilities.isArray(options.ignoreDuplicateModules)) {
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

			return options;
		}

		public static mergeConfigurationOptions(overwrite:IConfigurationOptions = null, base:IConfigurationOptions = null): IConfigurationOptions {
			var result:IConfigurationOptions = Utilities.recursiveClone(base || {});

			// Merge known properties and overwrite the unknown ones
			Utilities.forEachProperty(overwrite, (key:string, value:any) => {
				if (key === 'bundles' && typeof result.bundles !== 'undefined') {
					if (Utilities.isArray(value)) {
						// Compatibility style
						result.bundles = result.bundles.concat(value);
					} else {
						// AMD API style
						Utilities.forEachProperty(value, (key:string, value:any) => {
							var bundleConfiguration:IBundleConfiguration = {
								location: key,
								modules: value
							};
							result.bundles.push(bundleConfiguration);
						});
					}
				} else if (key === 'ignoreDuplicateModules' && typeof result.ignoreDuplicateModules !== 'undefined') {
					result.ignoreDuplicateModules = result.ignoreDuplicateModules.concat(value);
				} else if (key === 'paths' && typeof result.paths !== 'undefined') {
					Utilities.forEachProperty(value, (key2:string, value2:any) => result.paths[key2] = value2);
				} else if (key === 'shim' && typeof result.shim !== 'undefined') {
					Utilities.forEachProperty(value, (key2:string, value2:any) => result.shim[key2] = value2);
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

		private options:IConfigurationOptions;

		/**
		 * Generated from the `ignoreDuplicateModules` configuration option.
		 */
		private ignoreDuplicateModulesMap:{ [moduleId:string]:boolean; };

		/**
		 * Generated from the `paths` configuration option. These are sorted with the longest `from` first.
		 */
		private sortedPathsRules:{ from:string; to:string[]; }[];

		/**
		 * Generated from the `shim` configuration option.
		 */
		private shimModules: { [path:string]:IDefineCall; };
		private shimModulesStr: { [path:string]:string; };

		/**
		 * Generated from the `bundles` configuration option.
		 */
		private overwriteModuleIdToPath: { [moduleId:string]:string; };

		constructor(options?:IConfigurationOptions) {
			this.options = ConfigurationOptionsUtil.mergeConfigurationOptions(options);

			this._createIgnoreDuplicateModulesMap();
			this._createSortedPathsRules();
			this._createShimModules();
			this._createOverwriteModuleIdToPath();

			if (this.options.baseUrl === '') {
				if (isNode && this.options.nodeRequire && this.options.nodeRequire.main && this.options.nodeRequire.main.filename) {
					var nodeMain = this.options.nodeRequire.main.filename;
					var dirnameIndex = Math.max(nodeMain.lastIndexOf('/'), nodeMain.lastIndexOf('\\'));
					this.options.baseUrl = nodeMain.substring(0, dirnameIndex + 1);
				}
				if (isNode && this.options.nodeMain) {
					var nodeMain = this.options.nodeMain;
					var dirnameIndex = Math.max(nodeMain.lastIndexOf('/'), nodeMain.lastIndexOf('\\'));
					this.options.baseUrl = nodeMain.substring(0, dirnameIndex + 1);
				}
			}
		}

		private _createOverwriteModuleIdToPath(): void {
			this.overwriteModuleIdToPath = {};
			for (var i = 0; i < this.options.bundles.length; i++) {
				var bundle = this.options.bundles[i];

				var location = bundle.location;
				if (bundle.modules) {
					for (var j = 0; j < bundle.modules.length; j++) {
						this.overwriteModuleIdToPath[bundle.modules[j]] = location;
					}
				}
			}
		}

		private _createIgnoreDuplicateModulesMap(): void {
			// Build a map out of the ignoreDuplicateModules array
			this.ignoreDuplicateModulesMap = {};
			for (var i = 0; i < this.options.ignoreDuplicateModules.length; i++) {
				this.ignoreDuplicateModulesMap[this.options.ignoreDuplicateModules[i]] = true;
			}
		}

		private _createSortedPathsRules(): void {
			// Create an array our of the paths rules, sorted descending by length to
			// result in a more specific -> less specific order
			this.sortedPathsRules = [];
			Utilities.forEachProperty(this.options.paths, (from:string, to:any) => {
				if (!Utilities.isArray(to)) {
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

		private _ensureShimModule1(path:string, shimMD:string[]): void {
			// Ensure dependencies are also shimmed
			for (var i = 0; i < shimMD.length; i++) {
				var dependencyId = shimMD[i];

				if (!this.shimModules.hasOwnProperty(dependencyId)) {
					this._ensureShimModule1(dependencyId, []);
				}
			}

			this.shimModules[path] = {
				stack: null,
				dependencies: shimMD,
				callback: null
			};

			if (this.options.isBuild) {
				this.shimModulesStr[path] = 'null';
			}
		}

		private _ensureShimModule2(path:string, shimMD:IShimConfiguration): void {
			this.shimModules[path] = {
				stack: null,
				dependencies: shimMD.deps || [],
				callback: (...depsValues:any[]) => {
					if (typeof shimMD.init === 'function') {
						var initReturnValue = shimMD.init.apply(global, depsValues);
						if (typeof initReturnValue !== 'undefined') {
							return initReturnValue;
						}
					}

					if (typeof shimMD.exports === 'function') {
						return shimMD.exports.apply(global, depsValues);
					}

					if (typeof shimMD.exports === 'string') {
						var pieces = (<string>shimMD.exports).split('.');
						var obj = global;
						for (var i = 0; i < pieces.length; i++) {
							if (obj) {
								obj = obj[pieces[i]];
							}
						}
						return obj;
					}

					return shimMD.exports || {};
				}
			};
			if (this.options.isBuild) {
				if (typeof shimMD.init === 'function') {
					this.shimModulesStr[path] = shimMD.init.toString();
				} else if (typeof shimMD.exports === 'function') {
					this.shimModulesStr[path] = shimMD.exports.toString();
				} else if (typeof shimMD.exports === 'string') {
					this.shimModulesStr[path] = 'function() { return this.' + shimMD.exports + '; }';
				} else {
					this.shimModulesStr[path] = JSON.stringify(shimMD.exports);
				}
			}
		}

		private _createShimModules(): void {
			this.shimModules = {};
			this.shimModulesStr = {};
			Utilities.forEachProperty(this.options.shim, (path:string, shimMD:any) => {
				if (!shimMD) {
					return;
				}

				if (Utilities.isArray(shimMD)) {
					this._ensureShimModule1(path, <string[]>shimMD);
					return;
				}

				this._ensureShimModule2(path, <IShimConfiguration>shimMD);
			});
		}

		/**
		 * Clone current configuration and overwrite options selectively.
		 * @param options The selective options to overwrite with.
		 * @result A new configuration
		 */
		public cloneAndMerge(options?:IConfigurationOptions): Configuration {
			return new Configuration(ConfigurationOptionsUtil.mergeConfigurationOptions(options, this.options));
		}

		/**
		 * Get current options bag. Useful for passing it forward to plugins.
		 */
		public getOptionsLiteral(): IConfigurationOptions {
			return this.options;
		}

		private _applyPaths(moduleId:string): string[] {
			var pathRule: { from:string; to:string[]; };
			for (var i = 0, len = this.sortedPathsRules.length; i < len; i++) {
				pathRule = this.sortedPathsRules[i];
				if (Utilities.startsWith(moduleId, pathRule.from)) {
					var result: string[] = [];
					for (var j = 0, lenJ = pathRule.to.length; j < lenJ; j++) {
						result.push(pathRule.to[j] + moduleId.substr(pathRule.from.length));
					}
					return result;
				}
			}
			return [moduleId];
		}

		private _addUrlArgsToUrl(url:string): string {
			if (Utilities.containsQueryString(url)) {
				return url + '&' + this.options.urlArgs;
			} else {
				return url + '?' + this.options.urlArgs;
			}
		}

		private _addUrlArgsIfNecessaryToUrl(url:string): string {
			if (this.options.urlArgs) {
				return this._addUrlArgsToUrl(url);
			}
			return url;
		}

		private _addUrlArgsIfNecessaryToUrls(urls:string[]): string[] {
			if (this.options.urlArgs) {
				for (var i = 0, len = urls.length; i < len; i++) {
					urls[i] = this._addUrlArgsToUrl(urls[i]);
				}
			}
			return urls;
		}

		/**
		 * Transform a module id to a location. Appends .js to module ids
		 */
		public moduleIdToPaths(moduleId:string): string[] {

			if (this.isBuild() && this.options.nodeModules.indexOf(moduleId) >= 0) {
				// This is a node module and we are at build time, drop it
				return ['empty:'];
			}

			var result = moduleId;

			if (this.overwriteModuleIdToPath.hasOwnProperty(result)) {
				result = this.overwriteModuleIdToPath[result];
			}

			var results: string[];
			if (!Utilities.endsWith(result, '.js') && !Utilities.isAbsolutePath(result)) {
				results = this._applyPaths(result);

				for (var i = 0, len = results.length; i < len; i++) {
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
		public requireToUrl(url:string): string {
			var result = url;

			if (!Utilities.isAbsolutePath(result)) {
				result = this._applyPaths(result)[0];

				if (!Utilities.isAbsolutePath(result)) {
					result = this.options.baseUrl + result;
				}
			}

			return this._addUrlArgsIfNecessaryToUrl(result);
		}

		/**
		 * Test if `moduleId` is shimmed.
		 */
		public isShimmed(moduleId:string): boolean {
			return this.shimModules.hasOwnProperty(moduleId);
		}

		/**
		 * Flag to indicate if current execution is as part of a build.
		 */
		public isBuild(): boolean {
			return this.options.isBuild;
		}

		/**
		 * Get a normalized shim definition for `moduleId`.
		 */
		public getShimmedModuleDefine(moduleId:string): IDefineCall {
			return this.shimModules[moduleId];
		}

		public getShimmedModulesStr(moduleId:string): string {
			return this.shimModulesStr[moduleId];
		}

		/**
		 * Test if module `moduleId` is expected to be defined multiple times
		 */
		public isDuplicateMessageIgnoredFor(moduleId:string): boolean {
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
		public onError(err:any): void {
			this.options.onError(err);
		}
	}

	// ------------------------------------------------------------------------
	// ModuleIdResolver

	export class ModuleIdResolver {

		private _config:Configuration;
		private fromModulePath:string;

		constructor(config:Configuration, fromModuleId:string) {
			this._config = config;

			var lastSlash = fromModuleId.lastIndexOf('/');
			if (lastSlash !== -1) {
				this.fromModulePath = fromModuleId.substr(0, lastSlash + 1);
			} else {
				this.fromModulePath = '';
			}
		}

		public isBuild(): boolean {
			return this._config.isBuild();
		}

		/**
		 * Normalize 'a/../name' to 'name', etc.
		 */
		static _normalizeModuleId(moduleId:string): string {
			var r = moduleId,
				pattern: RegExp;

			// replace /./ => /
			pattern = /\/\.\//;
			while (pattern.test(r)) {
				r = r.replace(pattern, '/');
			}

			// replace ^./ => nothing
			r = r.replace(/^\.\//g, '');

			// replace /aa/../ => / (BUT IGNORE /../../)
			pattern = /\/(([^\/])|([^\/][^\/\.])|([^\/\.][^\/])|([^\/][^\/][^\/]+))\/\.\.\//;
			while (pattern.test(r)) {
				r = r.replace(pattern, '/');
			}

			// replace ^aa/../ => nothing (BUT IGNORE ../../)
			r = r.replace(/^(([^\/])|([^\/][^\/\.])|([^\/\.][^\/])|([^\/][^\/][^\/]+))\/\.\.\//, '');

			return r;
		}

		/**
		 * Resolve relative module ids
		 */
		public resolveModule(moduleId:string): string {
			var result = moduleId;

			if (!Utilities.isAbsolutePath(result)) {
				if (Utilities.startsWith(result, './') || Utilities.startsWith(result, '../')) {
					result = ModuleIdResolver._normalizeModuleId(this.fromModulePath + result);
				}
			}

			return result;
		}

		/**
		 * Transform a module id to a location. Appends .js to module ids
		 */
		public moduleIdToPaths(moduleId:string): string[] {
			var r = this._config.moduleIdToPaths(moduleId);

			if (isNode && moduleId.indexOf('/') === -1) {
				r.push('node|' + this.fromModulePath + '|' + moduleId);
			}

			return r;
		}

		/**
		 * Transform a module id or url to a location.
		 */
		public requireToUrl(url:string): string {
			return this._config.requireToUrl(url);
		}

		/**
		 * Should errors be caught when executing module factories?
		 */
		public shouldCatchError(): boolean {
			return this._config.shouldCatchError();
		}

		/**
		 * Forward an error to the error handler.
		 */
		public onError(err:any): void {
			this._config.onError(err);
		}
	}

	// ------------------------------------------------------------------------
	// Module

	export class Module {

		private _id:string;
		private _dependencies:string[];
		private _dependenciesValues:any[];
		private _callback:any;
		private _errorback:Function;
		private _recorder: ILoaderEventRecorder;
		private _moduleIdResolver:ModuleIdResolver;
		private _exports:any;
		private _exportsPassedIn:boolean;
		private _unresolvedDependenciesCount:number;

		private _config: IModuleConfiguration;
		private _normalizedDependencies:string[];
		private _defineCallStack:string;
		private _managerDependencies:string[];
		private _managerDependenciesMap:{ [id:string]:any; };

		constructor(id: string, dependencies: string[], callback: any, errorback: Function, recorder: ILoaderEventRecorder,
			moduleIdResolver: ModuleIdResolver, config?: IModuleConfiguration, defineCallStack:string = null) {
			this._id = id;
			this._dependencies = dependencies;
			this._dependenciesValues = [];
			this._callback = callback;
			this._errorback = errorback;
			this._recorder = recorder;
			this._moduleIdResolver = moduleIdResolver;
			this._exports = {};
			this._exportsPassedIn = false;
			this._config = config;
			this._defineCallStack = defineCallStack;

			this._digestDependencies();

			if (this._unresolvedDependenciesCount === 0) {
				this._complete();
			}
		}

		private _digestDependencies(): void {
			// Exact count of dependencies
			this._unresolvedDependenciesCount = this._dependencies.length;

			// Send on to the manager only a subset of dependencies
			// For example, 'exports' and 'module' can be fulfilled locally
			this._normalizedDependencies = [];
			this._managerDependencies = [];
			this._managerDependenciesMap = {};

			var i:number, len:number, d:string;
			for (i = 0, len = this._dependencies.length; i < len; i ++) {
				d = this._dependencies[i];

				if (!d) {
					// Most likely, undefined sneaked in to the dependency array
					// Also, IE8 interprets ['a', 'b',] as ['a', 'b', undefined]
					console.warn('Please check module ' + this._id + ', the dependency list looks broken');
					this._normalizedDependencies[i] = d;
					this._dependenciesValues[i] = null;
					this._unresolvedDependenciesCount--;
					continue;
				}

				if (d === 'exports') {
					// Fulfill 'exports' locally and remember that it was passed in
					// Later on, we will ignore the return value of the factory method
					this._exportsPassedIn = true;
					this._normalizedDependencies[i] = d;
					this._dependenciesValues[i] = this._exports;
					this._unresolvedDependenciesCount--;
				} else if (d === 'module') {
					// Fulfill 'module' locally
					this._normalizedDependencies[i] = d;
					this._dependenciesValues[i] = {
						id: this._id,
						config: () => this._config
					};
					this._unresolvedDependenciesCount--;
				} else if (d === 'require') {
					// Request 'requre' from the manager
					this._normalizedDependencies[i] = d;
					this.addManagerDependency(d, i);
				} else {
					// Normalize dependency and then request it from the manager
					var bangIndex = d.indexOf('!');
					if (bangIndex >= 0) {
						var pluginId = d.substring(0, bangIndex);
						var pluginParam = d.substring(bangIndex + 1, d.length);
						d = this._moduleIdResolver.resolveModule(pluginId) + '!' + pluginParam;
					} else {
						d = this._moduleIdResolver.resolveModule(d);
					}
					this._normalizedDependencies[i] = d;
					this.addManagerDependency(d, i);
				}
			}
		}

		private addManagerDependency(dependency:string, index:number): void {
			if (this._managerDependenciesMap.hasOwnProperty(dependency)) {
				throw new Error('Module ' + this._id + ' contains multiple times a dependency to ' + dependency);
			}

			this._managerDependencies.push(dependency);
			this._managerDependenciesMap[dependency] = index;
		}

		/**
		 * Called by the module manager because plugin dependencies can not
		 * be normalized statically, the part after '!' can only be normalized
		 * once the plugin has loaded and its normalize logic is plugged in.
		 */
		public renameDependency(oldDependencyId:string, newDependencyId:string): void {
			if (!this._managerDependenciesMap.hasOwnProperty(oldDependencyId)) {
				throw new Error('Loader: Cannot rename an unknown dependency!');
			}

			var index = this._managerDependenciesMap[oldDependencyId];
			delete this._managerDependenciesMap[oldDependencyId];
			this._managerDependenciesMap[newDependencyId] = index;
			this._normalizedDependencies[index] = newDependencyId;
		}

		/**
		 * Get module's id
		 */
		public getId(): string {
			return this._id;
		}

		/**
		 * Get the module id resolver associated with this module
		 */
		public getModuleIdResolver(): ModuleIdResolver {
			return this._moduleIdResolver;
		}

		public isExportsPassedIn(): boolean {
			return this._exportsPassedIn;
		}

		public getExports(): any {
			return this._exports;
		}

		/**
		 * Get the initial dependencies (resolved).
		 * Does not account for any renames
		 */
		public getDependencies(): string[] {
			return this._managerDependencies;
		}

		public getNormalizedDependencies(): string[] {
			return this._normalizedDependencies;
		}

		public getDefineCallStack(): string {
			return this._defineCallStack;
		}

		private _invokeFactory(): { returnedValue:any; producedError:any; } {
			if (this._moduleIdResolver.isBuild() && !Utilities.isAnonymousModule(this._id)) {
				return {
					returnedValue: null,
					producedError: null
				};
			}
			var producedError:any = null,
				returnedValue:any = null;

			if (this._moduleIdResolver.shouldCatchError()) {
				try {
					returnedValue = this._callback.apply(global, this._dependenciesValues);
				} catch (e) {
					producedError = e;
				} finally {
					// this.recordLoaderEvent
				}
			} else {
				returnedValue = this._callback.apply(global, this._dependenciesValues);
			}

			return {
				returnedValue: returnedValue,
				producedError: producedError
			};
		}

		private _complete(): void {
			var producedError:any = null;
			if (this._callback) {
				if (typeof this._callback === 'function') {

					this._recorder.record(LoaderEventType.BeginInvokeFactory, this._id);
					var r = this._invokeFactory();
					producedError = r.producedError;
					this._recorder.record(LoaderEventType.EndInvokeFactory, this._id);

					if (!producedError && typeof r.returnedValue !== 'undefined' && (!this._exportsPassedIn || Utilities.isEmpty(this._exports))) {
						this._exports = r.returnedValue;
					}

				} else {
					this._exports = this._callback;
				}
			}

			if (producedError) {
				this.getModuleIdResolver().onError({
					errorCode: 'factory',
					moduleId: this._id,
					detail: producedError
				});
			}
		}

		/**
		 * Release references used while resolving module
		 */
		public cleanUp(): void {
			if (this._moduleIdResolver && !this._moduleIdResolver.isBuild()) {
				this._normalizedDependencies = null;
				this._moduleIdResolver = null;
			}
			this._dependencies = null;
			this._dependenciesValues = null;
			this._callback = null;
			this._managerDependencies = null;
			this._managerDependenciesMap = null;
		}

		/**
		 * One of the direct dependencies or a transitive dependency has failed to load.
		 */
		public onDependencyError(err:any): boolean {
			if (this._errorback) {
				this._errorback(err);
				return true;
			}
			return false;
		}

		/**
		 * Resolve a dependency with a value.
		 */
		public resolveDependency(id:string, value:any): void {
			if (!this._managerDependenciesMap.hasOwnProperty(id)) {
				throw new Error('Cannot resolve a dependency I do not have!');
			}

			this._dependenciesValues[this._managerDependenciesMap[id]] = value;

			// Prevent resolving the same dependency twice
			delete this._managerDependenciesMap[id];

			this._unresolvedDependenciesCount--;
			if (this._unresolvedDependenciesCount === 0) {
				this._complete();
			}
		}

		/**
		 * Is the current module complete?
		 */
		public isComplete(): boolean {
			return this._unresolvedDependenciesCount === 0;
		}
	}

	// ------------------------------------------------------------------------
	// LoaderEvent

	export enum LoaderEventType {
		LoaderAvailable = 1,

		BeginLoadingScript = 10,
		EndLoadingScriptOK = 11,
		EndLoadingScriptError = 12,

		BeginInvokeFactory = 21,
		EndInvokeFactory = 22,

		NodeBeginEvaluatingScript = 31,
		NodeEndEvaluatingScript = 32,

		NodeBeginNativeRequire = 33,
		NodeEndNativeRequire = 34
	}

	function getHighPerformanceTimestamp(): number {
		return (hasPerformanceNow ? global.performance.now() : Date.now());
	}

	export class LoaderEvent {
		public type:LoaderEventType;
		public timestamp: number;
		public detail:string;

		constructor(type:LoaderEventType, detail:string, timestamp:number) {
			this.type = type;
			this.detail = detail;
			this.timestamp = timestamp;
		}
	}

	export interface ILoaderEventRecorder {
		record(type:LoaderEventType, detail:string): void;
		getEvents(): LoaderEvent[];
	}

	export class LoaderEventRecorder implements ILoaderEventRecorder {
		private _events: LoaderEvent[];

		constructor(loaderAvailableTimestamp:number) {
			this._events = [new LoaderEvent(LoaderEventType.LoaderAvailable, '', loaderAvailableTimestamp)];
		}

		public record(type:LoaderEventType, detail:string): void {
			this._events.push(new LoaderEvent(type, detail, getHighPerformanceTimestamp()));
		}

		public getEvents(): LoaderEvent[] {
			return this._events;
		}
	}

	export class NullLoaderEventRecorder implements ILoaderEventRecorder {
		public static INSTANCE = new NullLoaderEventRecorder();

		public record(type:LoaderEventType, detail:string): void {
			// Nothing to do
		}

		public getEvents(): LoaderEvent[] {
			return [];
		}
	}

	// ------------------------------------------------------------------------
	// ModuleManager
	export interface IPosition {
		line: number;
		col: number;
	}

	export interface IBuildModuleInfo {
		id: string;
		path: string;
		defineLocation: IPosition;
		dependencies: string[];
		shim: string;
		exports: any;
	}

	export class ModuleManager {

		private _config:Configuration;
		private _scriptLoader:IScriptLoader;

		/**
		 * Hash map of module id => module.
		 * If a module is found in _modules, its code has been loaded, but
		 * not necessary all its dependencies have been resolved
		 */
		private _modules: { [moduleId:string]:Module; };

		/**
		 * Set of module ids => true
		 * If a module is found in _knownModules, a call has been made
		 * to the scriptLoader to load its code or a call will be made
		 * This is mainly used as a flag to not try loading the same module twice
		 */
		private _knownModules: { [moduleId:string]:boolean; };

		/**
		 * Hash map of module id => array [module id]
		 */
		private _inverseDependencies: { [moduleId:string]:string[]; };

		/**
		 * Hash map of module id => array [module id]
		 */
		private _dependencies: { [moduleId:string]:string[]; };

		/**
		 * Hash map of module id => array [ { moduleId, pluginParam } ]
		 */
		private _inversePluginDependencies: { [moduleId:string]:{moduleId:string;dependencyId:string;}[]; };

		/**
		 * define calls received, but not yet processed
		 */
		private _queuedDefineCalls: IDefineCall[];

		/**
		 * Count the number of scripts currently loading
		 */
		private _loadingScriptsCount: number;

		/**
		 * Hash map of module id => path where module was loaded from. Used only when `isBuild` is set.
		 */
		private _resolvedScriptPaths: { [moduleId:string]: string; };

		/**
		 * Hash map of scriptSrc => checksum.
		 */
		private _checksums: { [scriptSrc:string]: string; };

		constructor(scriptLoader:IScriptLoader) {
			this._config = new Configuration();
			this._scriptLoader = scriptLoader;
			this._modules = {};
			this._knownModules = {};
			this._inverseDependencies = {};
			this._dependencies = {};
			this._inversePluginDependencies = {};
			this._queuedDefineCalls = [];
			this._loadingScriptsCount = 0;
			this._resolvedScriptPaths = {};
			this._checksums = {};
		}

		private static _findRelevantLocationInStack(needle: string, stack: string): IPosition {
			var normalize = (str) => str.replace(/\\/g, '/');
			var normalizedPath = normalize(needle);

			var stackPieces = stack.split(/\n/);
			for (var i = 0; i < stackPieces.length; i++) {
				var m = stackPieces[i].match(/(.*):(\d+):(\d+)\)?$/);
				if (m) {
					var stackPath = m[1];
					var stackLine = m[2];
					var stackColumn = m[3];

					var trimPathOffset = Math.max(
						stackPath.lastIndexOf(' ') + 1,
						stackPath.lastIndexOf('(') + 1
					);

					stackPath = stackPath.substr(trimPathOffset);
					stackPath = normalize(stackPath);

					if (stackPath === normalizedPath) {
						var r = {
							line: parseInt(stackLine, 10),
							col: parseInt(stackColumn, 10)
						};
						if (r.line === 1) {
							r.col -= '(function (require, define, __filename, __dirname) { '.length;
						}
						return r;
					}
				}
			}

			throw new Error('Could not correlate define call site for needle ' + needle);
		}

		public getBuildInfo(): IBuildModuleInfo[] {
			if (!this._config.isBuild()) {
				return null;
			}

			return Object.keys(this._modules).map((moduleId) => {
				var m = this._modules[moduleId];

				var location = this._resolvedScriptPaths[moduleId] || null;
				var defineStack = m.getDefineCallStack();
				return {
					id: moduleId,
					path: location,
					defineLocation: (location && defineStack ? ModuleManager._findRelevantLocationInStack(location, defineStack) : null),
					dependencies: m.getNormalizedDependencies(),
					shim: (this._config.isShimmed(moduleId) ? this._config.getShimmedModulesStr(moduleId) : null),
					exports: m.getExports()
				};
			});
		}

		private _recorder: ILoaderEventRecorder = null;
		public getRecorder(): ILoaderEventRecorder {
			if (!this._recorder) {
				if (this._config.shouldRecordStats()) {
					this._recorder = new LoaderEventRecorder(loaderAvailableTimestamp);
				} else {
					this._recorder = NullLoaderEventRecorder.INSTANCE;
				}
			}
			return this._recorder;
		}

		public getLoaderEvents(): LoaderEvent[] {
			return this.getRecorder().getEvents();
		}

		public recordChecksum(scriptSrc:string, checksum:string): void {
			this._checksums[scriptSrc] = checksum;
		}

		public getChecksums(): {[scriptSrc:string]:string} {
			return this._checksums;
		}

		/**
		 * Defines a module.
		 * @param id @see defineModule
		 * @param dependencies @see defineModule
		 * @param callback @see defineModule
		 */
		public enqueueDefineModule(id:string, dependencies:string[], callback:any): void {
			if (this._loadingScriptsCount === 0) {
				// There are no scripts currently loading, so no load event will be fired, so the queue will not be consumed
				this.defineModule(id, dependencies, callback, null, null);
			} else {
				this._queuedDefineCalls.push({
					id: id,
					stack: null,
					dependencies: dependencies,
					callback: callback
				});
			}
		}

		/**
		 * Defines an anonymous module (without an id). Its name will be resolved as we receive a callback from the scriptLoader.
		 * @param dependecies @see defineModule
		 * @param callback @see defineModule
		 */
		public enqueueDefineAnonymousModule(dependencies:string[], callback:any): void {
			var stack: string = null;
			if (this._config.isBuild()) {
				stack = (<any>new Error('StackLocation')).stack;
			}
			this._queuedDefineCalls.push({
				id: null,
				stack: stack,
				dependencies: dependencies,
				callback: callback
			});
		}

		/**
		 * Creates a module and stores it in _modules. The manager will immediately begin resolving its dependencies.
		 * @param id An unique and absolute id of the module. This must not collide with another module's id
		 * @param dependencies An array with the dependencies of the module. Special keys are: "require", "exports" and "module"
		 * @param callback if callback is a function, it will be called with the resolved dependencies. if callback is an object, it will be considered as the exports of the module.
		 */
		public defineModule(id:string, dependencies:string[], callback:any, errorback:Function, stack:string, moduleIdResolver:ModuleIdResolver = new ModuleIdResolver(this._config, id)): void {
			if (this._modules.hasOwnProperty(id)) {
				if (!this._config.isDuplicateMessageIgnoredFor(id)) {
					console.warn('Duplicate definition of module \'' + id + '\'');
				}
				// Super important! Completely ignore duplicate module definition
				return;
			}
			var moduleConfig = this._config.getConfigForModule(id);
			var m = new Module(id, dependencies, callback, errorback, this.getRecorder(), moduleIdResolver, moduleConfig, stack);
			this._modules[id] = m;

			// Resolving of dependencies is immediate (not in a timeout). If there's a need to support a packer that concatenates in an
			// unordered manner, in order to finish processing the file, execute the following method in a timeout
			this._resolve(m);
		}

		private _relativeRequire(moduleIdResolver:ModuleIdResolver, dependencies:any, callback?:Function, errorback?:Function): any {
			if (typeof dependencies === 'string') {
				return this.synchronousRequire(<string>dependencies, moduleIdResolver);
			}

			this.defineModule(Utilities.generateAnonymousModule(), <string[]>dependencies, callback, errorback, null, moduleIdResolver);
		}

		/**
		 * Require synchronously a module by its absolute id. If the module is not loaded, an exception will be thrown.
		 * @param id The unique and absolute id of the required module
		 * @return The exports of module 'id'
		 */
		public synchronousRequire(id:string, moduleIdResolver:ModuleIdResolver = new ModuleIdResolver(this._config, id)): any {
			var moduleId = moduleIdResolver.resolveModule(id);

			var bangIndex = moduleId.indexOf('!');
			if (bangIndex >= 0) {
				// This is a synchronous require for a plugin dependency, so be sure to normalize the pluginParam (the piece after '!')

				var pluginId = moduleId.substring(0, bangIndex),
					pluginParam = moduleId.substring(bangIndex + 1, moduleId.length),
					plugin: ILoaderPlugin = {};

				if (this._modules.hasOwnProperty(pluginId)) {
					plugin = this._modules[pluginId];
				}

				// Helper to normalize the part which comes after '!'
				var normalize = (_arg:string) => {
					return moduleIdResolver.resolveModule(_arg);
				};
				if (typeof plugin.normalize === 'function') {
					pluginParam = plugin.normalize(pluginParam, normalize);
				} else {
					pluginParam = normalize(pluginParam);
				}

				moduleId = pluginId + '!' + pluginParam;
			}

			if (!this._modules.hasOwnProperty(moduleId)) {
				throw new Error('Check dependency list! Synchronous require cannot resolve module \'' + moduleId + '\'. This is the first mention of this module!');
			}

			var m = this._modules[moduleId];

			if (!m.isComplete()) {
				throw new Error('Check dependency list! Synchronous require cannot resolve module \'' + moduleId + '\'. This module has not been resolved completely yet.');
			}

			return m.getExports();
		}

		public configure(params:IConfigurationOptions, shouldOverwrite:boolean): void {
			var oldShouldRecordStats = this._config.shouldRecordStats();
			if (shouldOverwrite) {
				this._config = new Configuration(params);
			} else {
				this._config = this._config.cloneAndMerge(params);
			}
			if (this._config.shouldRecordStats() && !oldShouldRecordStats) {
				this._recorder = null;
			}
		}

		public getConfigurationOptions(): IConfigurationOptions {
			return this._config.getOptionsLiteral();
		}

		/**
		 * Callback from the scriptLoader when a module has been loaded.
		 * This means its code is available and has been executed.
		 */
		private _onLoad(id:string): void {
			var defineCall:IDefineCall;

			this._loadingScriptsCount --;

			if (this._config.isShimmed(id)) {
				// Do not consume queue, might end up consuming a module that is later expected
				// If a shimmed module has loaded, create a define call for it
				defineCall = this._config.getShimmedModuleDefine(id);
				this.defineModule(id, defineCall.dependencies, defineCall.callback, null, defineCall.stack);
			} else {
				if (this._queuedDefineCalls.length === 0) {
					// Loaded a file and it didn't call `define`
					this._loadingScriptsCount++;
					this._onLoadError(id, new Error('No define call received from module ' + id + '.'));
				} else {
					// Consume queue until first anonymous define call
					// or until current id is found in the queue
					while (this._queuedDefineCalls.length > 0) {
						defineCall = this._queuedDefineCalls.shift();
						if (defineCall.id === id || defineCall.id === null) {
							// Hit an anonymous define call or its own define call
							defineCall.id = id;
							this.defineModule(defineCall.id, defineCall.dependencies, defineCall.callback, null, defineCall.stack);
							break;
						} else {
							// Hit other named define calls
							this.defineModule(defineCall.id, defineCall.dependencies, defineCall.callback, null, defineCall.stack);
						}
					}
				}
			}

			if (this._loadingScriptsCount === 0) {
				// No more on loads will be triggered, so make sure queue is empty
				while (this._queuedDefineCalls.length > 0) {
					defineCall = this._queuedDefineCalls.shift();
					if (defineCall.id === null) {
						console.warn('Found an unmatched anonymous define call in the define queue. Ignoring it!');
						console.warn(defineCall.callback);
					} else {
						// Hit other named define calls
						this.defineModule(defineCall.id, defineCall.dependencies, defineCall.callback, null, defineCall.stack);
					}
				}
			}
		}

		/**
		 * Callback from the scriptLoader when a module hasn't been loaded.
		 * This means that the script was not found (e.g. 404) or there was an error in the script.
		 */
		private _onLoadError(id:string, err:any): void {
			this._loadingScriptsCount --;

			var error = {
				errorCode: 'load',
				moduleId: id,
				neededBy: (this._inverseDependencies[id] ? this._inverseDependencies[id].slice(0): []),
				detail: err
			};

			// Find any 'local' error handlers, walk the entire chain of inverse dependencies if necessary.
			var seenModuleId: { [moduleId:string]:boolean; } = {},
				queueElement: string,
				someoneNotified = false,
				queue: string[] = [];

			queue.push(id);
			seenModuleId[id] = true;

			while (queue.length > 0) {
				queueElement = queue.shift();
				if (this._modules[queueElement]) {
					someoneNotified = this._modules[queueElement].onDependencyError(error) || someoneNotified;
				}

				if (this._inverseDependencies[queueElement]) {
					for (var i = 0, len = this._inverseDependencies[queueElement].length; i < len; i++) {
						if (!seenModuleId.hasOwnProperty(this._inverseDependencies[queueElement][i])) {
							queue.push(this._inverseDependencies[queueElement][i]);
							seenModuleId[this._inverseDependencies[queueElement][i]] = true;
						}
					}
				}
			}

			if (!someoneNotified) {
				this._config.onError(error);
			}
		}

		/**
		 * Module id has been loaded completely, its exports are available.
		 * @param id module's id
		 * @param exports module's exports
		 */
		private _onModuleComplete(id:string, exports:any): void {
			var i:number,
				len:number,
				inverseDependencyId:string,
				inverseDependency:Module;

			// Clean up module's dependencies since module is now complete
			delete this._dependencies[id];

			if (this._inverseDependencies.hasOwnProperty(id)) {
				// Fetch and clear inverse dependencies
				var inverseDependencies = this._inverseDependencies[id];
				delete this._inverseDependencies[id];

				// Resolve one inverse dependency at a time, always
				// on the lookout for a completed module.
				for (i = 0, len = inverseDependencies.length; i < len; i++) {
					inverseDependencyId = inverseDependencies[i];
					inverseDependency = this._modules[inverseDependencyId];

					inverseDependency.resolveDependency(id, exports);
					if (inverseDependency.isComplete()) {
						this._onModuleComplete(inverseDependencyId, inverseDependency.getExports());
					}
				}
			}

			if (this._inversePluginDependencies.hasOwnProperty(id)) {
				// This module is used as a plugin at least once
				// Fetch and clear these inverse plugin dependencies

				var inversePluginDependencies = this._inversePluginDependencies[id];
				delete this._inversePluginDependencies[id];

				// Resolve plugin dependencies one at a time
				for (i = 0, len = inversePluginDependencies.length; i < len; i++) {
					var inversePluginDependencyId = inversePluginDependencies[i].moduleId;
					var inversePluginDependency = this._modules[inversePluginDependencyId];

					this._resolvePluginDependencySync(inversePluginDependencyId, inversePluginDependencies[i].dependencyId, exports);

					// Anonymous modules might already be gone at this point
					if (inversePluginDependency.isComplete()) {
						this._onModuleComplete(inversePluginDependencyId, inversePluginDependency.getExports());
					}
				}
			}

			if (Utilities.isAnonymousModule(id)) {
				// Clean up references to anonymous modules, to prevent memory leaks
				delete this._modules[id];
				delete this._dependencies[id];
			} else {
				this._modules[id].cleanUp();
			}
		}

		/**
		 * Walks (recursively) the dependencies of 'from' in search of 'to'.
		 * Returns true if there is such a path or false otherwise.
		 * @param from Module id to start at
		 * @param to Module id to look for
		 */
		private _hasDependencyPath(from:string, to:string): boolean {
			var i:number,
				len:number,
				inQueue:{ [moduleId:string]:boolean; } = {},
				queue:string[] = [],
				element:string,
				dependencies:string[],
				dependency:string;

			// Insert 'from' in queue
			queue.push(from);
			inQueue[from] = true;

			while (queue.length > 0) {
				// Pop first inserted element of queue
				element = queue.shift();

				if (this._dependencies.hasOwnProperty(element)) {
					dependencies = this._dependencies[element];

					// Walk the element's dependencies
					for (i = 0, len = dependencies.length; i < len; i++) {
						dependency = dependencies[i];

						if (dependency === to) {
							// There is a path to 'to'
							return true;
						}

						if (!inQueue.hasOwnProperty(dependency)) {
							// Insert 'dependency' in queue
							inQueue[dependency] = true;
							queue.push(dependency);
						}
					}
				}
			}

			// There is no path to 'to'
			return false;
		}

		/**
		 * Walks (recursively) the dependencies of 'from' in search of 'to'.
		 * Returns cycle as array.
		 * @param from Module id to start at
		 * @param to Module id to look for
		 */
		private _findCyclePath(from:string, to:string, depth:number): string[] {
			if (from === to || depth === 50) {
				return [from];
			}
			if (!this._dependencies.hasOwnProperty(from)) {
				return null;
			}
			var path:string[],
				dependencies = this._dependencies[from];

			// Walk the element's dependencies
			for (var i = 0, len = dependencies.length; i < len; i++) {
				path = this._findCyclePath(dependencies[i], to, depth + 1);
				if (path !== null) {
					path.push(from);
					return path;
				}
			}
			return null;
		}

		/**
		 * Create the local 'require' that is passed into modules
		 */
		private _createRequire(moduleIdResolver:ModuleIdResolver): IRelativeRequire {
			var result:IRelativeRequire = <any>((dependencies:any, callback?:Function, errorback?:Function) => {
				return this._relativeRequire(moduleIdResolver, dependencies, callback, errorback);
			});
			result.toUrl = (id:string) => {
				return moduleIdResolver.requireToUrl(moduleIdResolver.resolveModule(id));
			};
			result.getStats = () => {
				return this.getLoaderEvents();
			};
			result.getChecksums = () => {
				return this.getChecksums();
			};
			(<any>result).__$__nodeRequire = global.nodeRequire;
			return result;
		}

		/**
		 * Resolve a plugin dependency with the plugin loaded & complete
		 * @param moduleId The module that has this dependency
		 * @param dependencyId The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
		 * @param plugin The plugin (what the plugin exports)
		 */
		private _resolvePluginDependencySync(moduleId:string, dependencyId:string, plugin:ILoaderPlugin): void {
			var m = this._modules[moduleId],
				moduleIdResolver = m.getModuleIdResolver(),
				bangIndex = dependencyId.indexOf('!'),
				pluginId = dependencyId.substring(0, bangIndex),
				pluginParam = dependencyId.substring(bangIndex + 1, dependencyId.length);

			// Helper to normalize the part which comes after '!'
			var normalize = (_arg:string) => {
				return moduleIdResolver.resolveModule(_arg);
			};
			if (typeof plugin.normalize === 'function') {
				pluginParam = plugin.normalize(pluginParam, normalize);
			} else {
				pluginParam = normalize(pluginParam);
			}

			if (!plugin.dynamic) {
				// Now normalize the entire dependency
				var oldDependencyId = dependencyId;
				dependencyId = pluginId + '!' + pluginParam;

				// Let the module know that the dependency has been normalized so it can update its internal state
				m.renameDependency(oldDependencyId, dependencyId);

				this._resolveDependency(moduleId, dependencyId, (moduleId:string) => {
					// Delegate the loading of the resource to the plugin
					var load:IPluginLoadCallback = <any>((value:any) => {
						this.defineModule(dependencyId, [], value, null, null);
					});
					load.error = (err:any) => {
						this._config.onError({
							errorCode: 'load',
							moduleId: dependencyId,
							neededBy: (this._inverseDependencies[dependencyId] ? this._inverseDependencies[dependencyId].slice(0) : []),
							detail: err
						});
					};

					plugin.load(pluginParam, this._createRequire(moduleIdResolver), load, this._config.getOptionsLiteral());
				});
			} else {
				// This plugin is dynamic and does not want the loader to cache anything on its behalf

				// Delegate the loading of the resource to the plugin
				var load:IPluginLoadCallback = <any>((value:any) => {
					m.resolveDependency(dependencyId, value);
					if (m.isComplete()) {
						this._onModuleComplete(moduleId, m.getExports());
					}
				});
				load.error = (err:any) => {
					this._config.onError({
						errorCode: 'load',
						moduleId: dependencyId,
						neededBy: [moduleId],
						detail: err
					});
				};

				plugin.load(pluginParam, this._createRequire(moduleIdResolver), load, this._config.getOptionsLiteral());
			}
		}

		/**
		 * Resolve a plugin dependency with the plugin not loaded or not complete yet
		 * @param moduleId The module that has this dependency
		 * @param dependencyId The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
		 */
		private _resolvePluginDependencyAsync(moduleId:string, dependencyId:string): void {
			var m = this._modules[moduleId],
				bangIndex = dependencyId.indexOf('!'),
				pluginId = dependencyId.substring(0, bangIndex);

			// Record dependency for when the plugin gets loaded
			this._inversePluginDependencies[pluginId] = this._inversePluginDependencies[pluginId] || [];
			this._inversePluginDependencies[pluginId].push({
				moduleId: moduleId,
				dependencyId: dependencyId
			});

			if (!this._modules.hasOwnProperty(pluginId) && !this._knownModules.hasOwnProperty(pluginId)) {
				// This is the first mention of module 'pluginId', so load it
				this._knownModules[pluginId] = true;
				this._loadModule(m.getModuleIdResolver(), pluginId);
			}
		}

		/**
		 * Resolve a plugin dependency
		 * @param moduleId The module that has this dependency
		 * @param dependencyId The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
		 */
		private _resolvePluginDependency(moduleId:string, dependencyId:string): void {
			var bangIndex = dependencyId.indexOf('!'),
				pluginId = dependencyId.substring(0, bangIndex);

			if (this._modules.hasOwnProperty(pluginId) && this._modules[pluginId].isComplete()) {
				// Plugin has already been loaded & resolved
				this._resolvePluginDependencySync(moduleId, dependencyId, this._modules[pluginId].getExports());
			} else {
				// Plugin is not loaded or not resolved
				this._resolvePluginDependencyAsync(moduleId, dependencyId);
			}
		}

		/**
		 * Resolve a module dependency to a shimmed module and delegate the loading to loadCallback.
		 * @param moduleId The module that has this dependency
		 * @param dependencyId The normalized dependency that appears in the module -- this module is shimmed
		 * @param loadCallback Callback that will be called to trigger the loading of 'dependencyId' if needed
		 */
		private _resolveShimmedDependency(moduleId:string, dependencyId:string, loadCallback:(moduleId:string)=>void): void {
			// If a shimmed module has dependencies, we must first load those dependencies
			// and only when those are loaded we can load the shimmed module.
			// To achieve this, we inject a module definition with those dependencies
			// and from its factory method we really load the shimmed module.
			var defineInfo = this._config.getShimmedModuleDefine(dependencyId);
			if (defineInfo.dependencies.length > 0) {
				this.defineModule(
					Utilities.generateAnonymousModule(),
					defineInfo.dependencies,
					() => loadCallback(dependencyId),
					null,
					null,
					new ModuleIdResolver(this._config, dependencyId));
			} else {
				loadCallback(dependencyId);
			}
		}

		/**
		 * Resolve a module dependency and delegate the loading to loadCallback
		 * @param moduleId The module that has this dependency
		 * @param dependencyId The normalized dependency that appears in the module
		 * @param loadCallback Callback that will be called to trigger the loading of 'dependencyId' if needed
		 */
		private _resolveDependency(moduleId:string, dependencyId:string, loadCallback:(moduleId:string)=>void): void {
			var m = this._modules[moduleId];

			if (this._modules.hasOwnProperty(dependencyId) && this._modules[dependencyId].isComplete()) {
				// Dependency has already been loaded & resolved
				m.resolveDependency(dependencyId, this._modules[dependencyId].getExports());
			} else {
				// Dependency is not loaded or not resolved

				// Record dependency
				this._dependencies[moduleId].push(dependencyId);

				if (this._hasDependencyPath(dependencyId, moduleId)) {
					console.warn('There is a dependency cycle between \'' + dependencyId + '\' and \'' + moduleId + '\'. The cyclic path follows:');
					var cyclePath = this._findCyclePath(dependencyId, moduleId, 0);
					cyclePath.reverse();
					cyclePath.push(dependencyId);
					console.warn(cyclePath.join(' => \n'));

					// Break the cycle
					var dependency = this._modules.hasOwnProperty(dependencyId) ? this._modules[dependencyId] : null;
					var dependencyValue: any;
					if (dependency && dependency.isExportsPassedIn()) {
						// If dependency uses 'exports', then resolve it with that object
						dependencyValue = dependency.getExports();
					}
					// Resolve dependency with undefined or with 'exports' object
					m.resolveDependency(dependencyId, dependencyValue);
				} else {
					// Since we are actually waiting for this dependency,
					// record inverse dependency
					this._inverseDependencies[dependencyId] = this._inverseDependencies[dependencyId] || [];
					this._inverseDependencies[dependencyId].push(moduleId);

					if (!this._modules.hasOwnProperty(dependencyId) && !this._knownModules.hasOwnProperty(dependencyId)) {
						// This is the first mention of module 'dependencyId', so load it
						// Mark this module as loaded so we don't hit this case again
						this._knownModules[dependencyId] = true;
						if (this._config.isShimmed(dependencyId)) {
							this._resolveShimmedDependency(moduleId, dependencyId, loadCallback);
						} else {
							loadCallback(dependencyId);
						}
					}
				}
			}
		}

		private _loadModule(anyModuleIdResolver:ModuleIdResolver, moduleId: string): void {
			this._loadingScriptsCount++;

			var paths = anyModuleIdResolver.moduleIdToPaths(moduleId);
			var lastPathIndex = -1;
			var loadNextPath = (err:any) => {
				lastPathIndex++;

				if (lastPathIndex >= paths.length) {
					// No more paths to try
					this._onLoadError(moduleId, err);
				} else {
					var currentPath = paths[lastPathIndex];
					var recorder = this.getRecorder();

					if(this._config.isBuild() && currentPath === 'empty:') {
						this._resolvedScriptPaths[moduleId] = currentPath;
						this.enqueueDefineModule(moduleId, [], null);
						this._onLoad(moduleId);
						return;
					}

					recorder.record(LoaderEventType.BeginLoadingScript, currentPath);
					this._scriptLoader.load(currentPath, () => {
						if (this._config.isBuild()) {
							this._resolvedScriptPaths[moduleId] = currentPath;
						}
						recorder.record(LoaderEventType.EndLoadingScriptOK, currentPath);
						this._onLoad(moduleId);
					}, (err) => {
						recorder.record(LoaderEventType.EndLoadingScriptError, currentPath);
						loadNextPath(err);
					}, recorder);
				}
			};

			loadNextPath(null);
		}

		/**
		 * Examine the dependencies of module 'module' and resolve them as needed.
		 */
		private _resolve(m:Module): void {
			var i:number,
				len:number,
				id:string,
				dependencies:string[],
				dependencyId:string,
				moduleIdResolver:ModuleIdResolver;

			id = m.getId();
			dependencies = m.getDependencies();
			moduleIdResolver = m.getModuleIdResolver();

			this._dependencies[id] = [];

			var loadCallback = (moduleId:string) => this._loadModule(moduleIdResolver, moduleId);

			for (i = 0, len = dependencies.length; i < len; i++) {
				dependencyId = dependencies[i];

				if (dependencyId === 'require') {
					m.resolveDependency(dependencyId, this._createRequire(moduleIdResolver));
					continue;
				} else {
					if (dependencyId.indexOf('!') >= 0) {
						this._resolvePluginDependency(id, dependencyId);
					} else {
						this._resolveDependency(id, dependencyId, loadCallback);
					}
				}
			}

			if (m.isComplete()) {
				// This module was completed as soon as its been seen.
				this._onModuleComplete(id, m.getExports());
			}
		}
	}

	// ------------------------------------------------------------------------
	// IScriptLoader(s)

	interface IScriptCallbacks {
		callback:()=>void;
		errorback:(err:any)=>void;
	}

	/**
	 * Load `scriptSrc` only once (avoid multiple <script> tags)
	 */
	class OnlyOnceScriptLoader implements IScriptLoader {

		private actualScriptLoader:IScriptLoader;
		private callbackMap:{ [scriptSrc:string]:IScriptCallbacks[]; };

		constructor(actualScriptLoader:IScriptLoader) {
			this.actualScriptLoader = actualScriptLoader;
			this.callbackMap = {};
		}

		public setModuleManager(moduleManager:ModuleManager): void {
			this.actualScriptLoader.setModuleManager(moduleManager);
		}

		public load(scriptSrc:string, callback:()=>void, errorback:(err:any)=>void, recorder:ILoaderEventRecorder): void {
			var scriptCallbacks:IScriptCallbacks = {
				callback: callback,
				errorback: errorback
			};
			if (this.callbackMap.hasOwnProperty(scriptSrc)) {
				this.callbackMap[scriptSrc].push(scriptCallbacks);
				return;
			}
			this.callbackMap[scriptSrc] = [scriptCallbacks];
			this.actualScriptLoader.load(scriptSrc, () => this.triggerCallback(scriptSrc), (err:any) => this.triggerErrorback(scriptSrc, err), recorder);
		}

		private triggerCallback(scriptSrc:string): void {
			var scriptCallbacks = this.callbackMap[scriptSrc];
			delete this.callbackMap[scriptSrc];

			for (var i = 0; i < scriptCallbacks.length; i++) {
				scriptCallbacks[i].callback();
			}
		}

		private triggerErrorback(scriptSrc:string, err:any): void {
			var scriptCallbacks = this.callbackMap[scriptSrc];
			delete this.callbackMap[scriptSrc];

			for (var i = 0; i < scriptCallbacks.length; i++) {
				scriptCallbacks[i].errorback(err);
			}
		}
	}

	class BrowserScriptLoader implements IScriptLoader {

		/**
		 * Attach load / error listeners to a script element and remove them when either one has fired.
		 * Implemented for browssers supporting 'onreadystatechange' events, such as IE8 or IE9
		 */
		private attachListenersV1(script:HTMLScriptElement, callback:()=>void, errorback:(err:any)=>void): void {
			var unbind = () => {
				script.detachEvent('onreadystatechange', loadEventListener);
				if (script.addEventListener) {
					script.removeEventListener('error', errorEventListener);
				}
			};

			var loadEventListener = (e:any) => {
				if (script.readyState === 'loaded' || script.readyState === 'complete') {
					unbind();
					callback();
				}
			};

			var errorEventListener = (e:any) => {
				unbind();
				errorback(e);
			};

			script.attachEvent('onreadystatechange', loadEventListener);
			if (script.addEventListener) {
				script.addEventListener('error', errorEventListener);
			}
		}

		/**
		 * Attach load / error listeners to a script element and remove them when either one has fired.
		 * Implemented for browssers supporting HTML5 standard 'load' and 'error' events.
		 */
		private attachListenersV2(script:HTMLScriptElement, callback:()=>void, errorback:(err:any)=>void): void {
			var unbind = () => {
				script.removeEventListener('load', loadEventListener);
				script.removeEventListener('error', errorEventListener);
			};

			var loadEventListener = (e:any) => {
				unbind();
				callback();
			};

			var errorEventListener = (e:any) => {
				unbind();
				errorback(e);
			};

			script.addEventListener('load', loadEventListener);
			script.addEventListener('error', errorEventListener);
		}

		public setModuleManager(moduleManager:ModuleManager): void {
			/* Intentional empty */
		}

		public load(scriptSrc:string, callback:()=>void, errorback:(err:any)=>void): void {
			var script = document.createElement('script');
			script.setAttribute('async', 'async');
			script.setAttribute('type', 'text/javascript');

			if (global.attachEvent) {
				this.attachListenersV1(script, callback, errorback);
			} else {
				this.attachListenersV2(script, callback, errorback);
			}

			script.setAttribute('src', scriptSrc);

			document.getElementsByTagName('head')[0].appendChild(script);
		}
	}

	class WorkerScriptLoader implements IScriptLoader {

		private loadCalls:{scriptSrc:string;callback:()=>void;errorback:(err:any)=>void;}[];
		private loadTimeout:number;

		constructor() {
			this.loadCalls = [];
			this.loadTimeout = -1;
		}

		public setModuleManager(moduleManager:ModuleManager): void {
			/* Intentional empty */
		}

		public load(scriptSrc:string, callback:()=>void, errorback:(err:any)=>void): void {
			this.loadCalls.push({
				scriptSrc: scriptSrc,
				callback: callback,
				errorback: errorback
			});

			if (navigator.userAgent.indexOf('Firefox') >= 0) {
				// Firefox fails installing the timer every now and then :(
				this._load();
			} else {
				if (this.loadTimeout === -1) {
					this.loadTimeout = setTimeout(() => {
						this.loadTimeout = -1;
						this._load();
					}, 0);
				}
			}
		}

		private _load(): void {
			var loadCalls = this.loadCalls;
			this.loadCalls = [];

			var i:number, len = loadCalls.length, scripts:string[] = [];

			for (i = 0; i < len; i++) {
				scripts.push(loadCalls[i].scriptSrc);
			}

			var errorOccured = false;
			try {
				importScripts.apply(null, scripts);
			} catch (e) {
				errorOccured = true;
				for (i = 0; i < len; i++) {
					loadCalls[i].errorback(e);
				}
			}

			if (!errorOccured) {
				for (i = 0; i < len; i++) {
					loadCalls[i].callback();
				}
			}
		}
	}

	interface INodeFS {
		readFile(filename:string, options:{encoding?:string; flag?:string}, callback:(err:any, data:any)=>void): void;
	}

	interface INodeVM {
		runInThisContext(contents:string, { filename:string });
		runInThisContext(contents:string, filename:string);
	}

	interface INodePath {
		dirname(filename:string): string;
		normalize(filename:string): string;
	}

	interface INodeCryptoHash {
		update(str:string, encoding:string): INodeCryptoHash;
		digest(type:string): string;
	}
	interface INodeCrypto {
		createHash(type:string): INodeCryptoHash;
	}

	class NodeScriptLoader implements IScriptLoader {

		private static _BOM = 0xFEFF;

		private _initialized: boolean;
		private _fs: INodeFS;
		private _vm: INodeVM;
		private _path: INodePath;
		private _crypto: INodeCrypto;
		private _moduleManager:ModuleManager;

		constructor() {
			this._initialized = false;
		}

		public setModuleManager(moduleManager:ModuleManager): void {
			this._moduleManager = moduleManager;
		}

		private _init(nodeRequire:INodeRequire): void {
			if (this._initialized) {
				return;
			}
			this._initialized = true;
			this._fs = nodeRequire('fs');
			this._vm = nodeRequire('vm');
			this._path = nodeRequire('path');
			this._crypto = nodeRequire('crypto');
		}

		public load(scriptSrc:string, callback:()=>void, errorback:(err:any)=>void, recorder:ILoaderEventRecorder): void {
			const opts = this._moduleManager.getConfigurationOptions();
			const checksum = opts.checksum || false;
			const nodeRequire = (opts.nodeRequire || global.nodeRequire);
			const nodeInstrumenter = (opts.nodeInstrumenter || function (c) { return c; });
			this._init(nodeRequire);

			if (/^node\|/.test(scriptSrc)) {

				var pieces = scriptSrc.split('|');

				var moduleExports = null;
				try {
					recorder.record(LoaderEventType.NodeBeginNativeRequire, pieces[2]);
					moduleExports = nodeRequire(pieces[2]);
				} catch (err) {
					recorder.record(LoaderEventType.NodeEndNativeRequire, pieces[2]);
					errorback(err);
					return;
				}
				recorder.record(LoaderEventType.NodeEndNativeRequire, pieces[2]);

				this._moduleManager.enqueueDefineAnonymousModule([], () => moduleExports);
				callback();

			} else {

				scriptSrc = Utilities.fileUriToFilePath(scriptSrc);

				this._fs.readFile(scriptSrc, { encoding:'utf8' }, (err, data:string) => {
					if (err) {
						errorback(err);
						return;
					}

					if (checksum) {
						let hash = this._crypto
							.createHash('md5')
							.update(data, 'utf8')
							.digest('base64')
							.replace(/=+$/, '');

						this._moduleManager.recordChecksum(scriptSrc, hash);
					}

					recorder.record(LoaderEventType.NodeBeginEvaluatingScript, scriptSrc);

					let vmScriptSrc = this._path.normalize(scriptSrc);
					// Make the script src friendly towards electron
					if (isElectronRenderer) {
						let driveLetterMatch = vmScriptSrc.match(/^([a-z])\:(.*)/i);
						if (driveLetterMatch) {
							vmScriptSrc = driveLetterMatch[1].toUpperCase() + ':' + driveLetterMatch[2];
						}
						vmScriptSrc = 'file:///' + vmScriptSrc.replace(/\\/g, '/');
					}

					let contents: string,
						prefix = '(function (require, define, __filename, __dirname) { ',
						suffix = '\n});';

					if (data.charCodeAt(0) === NodeScriptLoader._BOM) {
						contents = prefix + data.substring(1) + suffix;
					} else {
						contents = prefix + data + suffix;
					}

					contents = nodeInstrumenter(contents, vmScriptSrc);

					let r;
					if (/^v0\.12/.test(process.version)) {
						r = this._vm.runInThisContext(contents, { filename:vmScriptSrc });
					} else {
						r = this._vm.runInThisContext(contents, vmScriptSrc);
					}

					r.call(global, RequireFunc, DefineFunc, vmScriptSrc, this._path.dirname(scriptSrc));

					recorder.record(LoaderEventType.NodeEndEvaluatingScript, scriptSrc);

					callback();
				});
			}
		}
	}

	// ------------------------------------------------------------------------
	// ------------------------------------------------------------------------
	// ------------------------------------------------------------------------
	// define

	class DefineFunc {

		constructor(id:any, dependencies:any, callback:any) {
			if (typeof id !== 'string') {
				callback = dependencies;
				dependencies = id;
				id = null;
			}
			if (typeof dependencies !== 'object' || !Utilities.isArray(dependencies)) {
				callback = dependencies;
				dependencies = null;
			}
			if (!dependencies) {
				dependencies = ['require', 'exports', 'module'];
			}

			if (id) {
				moduleManager.enqueueDefineModule(id, dependencies, callback);
			} else {
				moduleManager.enqueueDefineAnonymousModule(dependencies, callback);
			}
		}

		public static amd = {
			jQuery: true
		};
	}

	class RequireFunc {

		constructor() {
			if (arguments.length === 1) {
				if ((arguments[0] instanceof Object) && !Utilities.isArray(arguments[0])) {
					RequireFunc.config(arguments[0]);
					return;
				}
				if (typeof arguments[0] === 'string') {
					return moduleManager.synchronousRequire(arguments[0]);
				}
			}
			if (arguments.length === 2 || arguments.length === 3) {
				if (Utilities.isArray(arguments[0])) {
					moduleManager.defineModule(Utilities.generateAnonymousModule(), arguments[0], arguments[1], arguments[2], null);
					return;
				}
			}
			throw new Error('Unrecognized require call');
		}

		public static config(params:IConfigurationOptions, shouldOverwrite:boolean = false): void {
			moduleManager.configure(params, shouldOverwrite);
		}

		public static getConfig(): IConfigurationOptions {
			return moduleManager.getConfigurationOptions();
		}

		/**
		 * Non standard extension to reset completely the loader state. This is used for running amdjs tests
		 */
		public static reset(): void {
			moduleManager = new ModuleManager(scriptLoader);
			scriptLoader.setModuleManager(moduleManager);
		}

		/**
		 * Non standard extension to fetch loader state for building purposes.
		 */
		public static getBuildInfo(): IBuildModuleInfo[] {
			return moduleManager.getBuildInfo();
		}

		/**
		 * Non standard extension to fetch loader events
		 */
		public static getStats(): LoaderEvent[] {
			return moduleManager.getLoaderEvents();
		}

		/**
		 * Non standard extension to fetch checksums
		 */
		public static getChecksums(): {[scriptSrc:string]:string} {
			return moduleManager.getChecksums();
		}
	}

	var global:any = _amdLoaderGlobal,
		hasPerformanceNow = (global.performance && typeof global.performance.now === 'function'),
		isWebWorker: boolean,
		isElectronRenderer: boolean,
		isElectronMain: boolean,
		isNode: boolean,
		scriptLoader:IScriptLoader,
		moduleManager: ModuleManager,
		loaderAvailableTimestamp:number;

	function initVars(): void {
		isWebWorker = (typeof global.importScripts === 'function');
		isElectronRenderer = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions['electron'] !== 'undefined' && process.type === 'renderer');
		isElectronMain = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions['electron'] !== 'undefined' && process.type === 'browser');
		isNode = (typeof module !== 'undefined' && !!module.exports);
		if (isWebWorker) {
			scriptLoader = new OnlyOnceScriptLoader(new WorkerScriptLoader());
		} else if (isNode) {
			scriptLoader = new OnlyOnceScriptLoader(new NodeScriptLoader());
		} else {
			scriptLoader = new OnlyOnceScriptLoader(new BrowserScriptLoader());
		}
		moduleManager = new ModuleManager(scriptLoader);
		scriptLoader.setModuleManager(moduleManager);
	}

	function initConsole(): void {
		// Define used console.* functions, in order to not fail in environments where they are not available
		if (!isNode) {
			if (!global.console) {
				global.console = {};
			}
			if (!global.console.log) {
				global.console.log = function () { /* Intentional empty */ };
			}
			if (!global.console.warn) {
				global.console.warn = global.console.log;
			}
			if (!global.console.error) {
				global.console.error = global.console.log;
			}
		}
	}

	function initMainScript(): void {
		if (!isWebWorker && !isNode) {
			window.onload = function () {

				var i:number,
					len:number,
					main:string,
					scripts = document.getElementsByTagName('script');

				// Look through all the scripts for the data-main attribute
				for (i = 0, len = scripts.length; i < len; i++) {
					main = scripts[i].getAttribute('data-main');
					if (main) {
						break;
					}
				}

				// Load the main script
				if (main) {
					moduleManager.defineModule(Utilities.generateAnonymousModule(), [main], null, null, null, new ModuleIdResolver(new Configuration(), ''));
				}
			};
		}
	}

	function init(): void {
		initVars();
		initConsole();
		initMainScript();

		if (isNode) {
			var _nodeRequire = (global.require || require);
			var nodeRequire = function(what) {
				moduleManager.getRecorder().record(LoaderEventType.NodeBeginNativeRequire, what);
				var r = _nodeRequire(what);
				moduleManager.getRecorder().record(LoaderEventType.NodeEndNativeRequire, what);
				return r;
			};

			global.nodeRequire = nodeRequire;
			(<any>RequireFunc).nodeRequire = nodeRequire;
		}

		if (isNode && !isElectronRenderer) {
			module.exports = RequireFunc;
			// These two defs are fore the local closure defined in node in the case that the loader is concatenated
			define = function() {
				DefineFunc.apply(null, arguments);
			};
			require = RequireFunc;
		} else {
			// The global variable require can configure the loader
			if (typeof global.require !== 'undefined' && typeof global.require !== 'function') {
				RequireFunc.config(global.require);
			}
			if (!isElectronRenderer) {
				global.define = define = DefineFunc;
			} else {
				define = function () {
					DefineFunc.apply(null, arguments);
				};
			}
			global.require = RequireFunc;
			global.require.__$__nodeRequire = nodeRequire;
		}
	}

	if (typeof global.define !== 'function' || !global.define.amd) {
		init();
		loaderAvailableTimestamp = getHighPerformanceTimestamp();
	}

}
