/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export interface ILoaderPlugin {
		load: (pluginParam: string, parentRequire: IRelativeRequire, loadCallback: IPluginLoadCallback, options: IConfigurationOptions) => void;
		// write?: (pluginName: string, moduleName: string, write: IPluginWriteCallback) => void;
		// writeFile?: (pluginName: string, moduleName: string, req: IRelativeRequire, write: IPluginWriteFileCallback, config: IConfigurationOptions) => void;
		// finishBuild?: (write: (filename: string, contents: string) => void) => void;
	}

	export interface IDefineCall {
		stack: string | null;
		dependencies: string[];
		callback: any;
	}

	export interface IRelativeRequire {
		(dependencies: string[], callback: Function, errorback?: (error: Error) => void): void;
		(dependency: string): any;
		toUrl(id: string): string;
		getStats(): LoaderEvent[];
		hasDependencyCycle(): boolean;
		getChecksums(): { [scriptSrc: string]: string };
		config(params: IConfigurationOptions, shouldOverwrite?: boolean): void;
	}

	export interface IPluginLoadCallback {
		(value: any): void;
		error(err: any): void;
	}

	export interface IPluginWriteCallback {
		(contents: string): void;
		getEntryPoint(): string;
		asModule(moduleId: string, contents: string): void;
	}

	export interface IPluginWriteFileCallback {
		(filename: string, contents: string): void;
		getEntryPoint(): string;
		asModule(moduleId: string, contents: string): void;
	}

	// ------------------------------------------------------------------------
	// ModuleIdResolver

	export class ModuleIdResolver {

		public static ROOT = new ModuleIdResolver('');

		private fromModulePath: string;

		constructor(fromModuleId: string) {
			let lastSlash = fromModuleId.lastIndexOf('/');
			if (lastSlash !== -1) {
				this.fromModulePath = fromModuleId.substr(0, lastSlash + 1);
			} else {
				this.fromModulePath = '';
			}
		}

		/**
		 * Normalize 'a/../name' to 'name', etc.
		 */
		static _normalizeModuleId(moduleId: string): string {
			let r = moduleId,
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
		public resolveModule(moduleId: string): string {
			let result = moduleId;

			if (!Utilities.isAbsolutePath(result)) {
				if (Utilities.startsWith(result, './') || Utilities.startsWith(result, '../')) {
					result = ModuleIdResolver._normalizeModuleId(this.fromModulePath + result);
				}
			}

			return result;
		}
	}

	// ------------------------------------------------------------------------
	// Module
	export class Module {

		public readonly id: ModuleId;
		public readonly strId: string;
		public readonly dependencies: Dependency[] | null;

		private readonly _callback: any | null;
		private readonly _errorback: ((err: AnnotatedError) => void) | null | undefined;
		public readonly moduleIdResolver: ModuleIdResolver | null;

		public exports: any;
		public error: AnnotatedError | null;
		public exportsPassedIn: boolean;
		public unresolvedDependenciesCount: number;
		private _isComplete: boolean;

		constructor(
			id: ModuleId,
			strId: string,
			dependencies: Dependency[],
			callback: any,
			errorback: ((err: AnnotatedError) => void) | null | undefined,
			moduleIdResolver: ModuleIdResolver | null,
		) {
			this.id = id;
			this.strId = strId;
			this.dependencies = dependencies;
			this._callback = callback;
			this._errorback = errorback;
			this.moduleIdResolver = moduleIdResolver;
			this.exports = {};
			this.error = null;
			this.exportsPassedIn = false;
			this.unresolvedDependenciesCount = this.dependencies.length;
			this._isComplete = false;
		}

		private static _safeInvokeFunction(callback: Function, args: any[]): { returnedValue: any; producedError: any; } {
			try {
				return {
					returnedValue: callback.apply(global, args),
					producedError: null
				};
			} catch (e) {
				return {
					returnedValue: null,
					producedError: e
				};
			}
		}

		private static _invokeFactory(config: Configuration, strModuleId: string, callback: Function, dependenciesValues: any[]): { returnedValue: any; producedError: any; } {
			if (!config.shouldInvokeFactory(strModuleId)) {
				return {
					returnedValue: null,
					producedError: null
				};
			}

			if (config.shouldCatchError()) {
				return this._safeInvokeFunction(callback, dependenciesValues);
			}

			return {
				returnedValue: callback.apply(global, dependenciesValues),
				producedError: null
			};
		}

		public complete(recorder: ILoaderEventRecorder, config: Configuration, dependenciesValues: any[], inversedependenciesProvider: (moduleId: number) => string[]): void {
			this._isComplete = true;

			let producedError: any = null;
			if (this._callback) {
				if (typeof this._callback === 'function') {

					recorder.record(LoaderEventType.BeginInvokeFactory, this.strId);
					let r = Module._invokeFactory(config, this.strId, this._callback, dependenciesValues);
					producedError = r.producedError;
					recorder.record(LoaderEventType.EndInvokeFactory, this.strId);

					if (!producedError && typeof r.returnedValue !== 'undefined' && (!this.exportsPassedIn || Utilities.isEmpty(this.exports))) {
						this.exports = r.returnedValue;
					}

				} else {
					this.exports = this._callback;
				}
			}

			if (producedError) {
				let err = ensureError<AnnotatedFactoryError>(producedError);
				err.phase = 'factory';
				err.moduleId = this.strId;
				err.neededBy = inversedependenciesProvider(this.id);
				this.error = err;
				config.onError(err);
			}

			(<any>this).dependencies = null;
			(<any>this)._callback = null;
			(<any>this)._errorback = null;
			(<any>this).moduleIdResolver = null;
		}

		/**
		 * One of the direct dependencies or a transitive dependency has failed to load.
		 */
		public onDependencyError(err: AnnotatedError): boolean {
			this._isComplete = true;
			this.error = err;
			if (this._errorback) {
				this._errorback(err);
				return true;
			}
			return false;
		}

		/**
		 * Is the current module complete?
		 */
		public isComplete(): boolean {
			return this._isComplete;
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
		path: string | null;
		defineLocation: IPosition | null;
		dependencies: string[];
		shim: string | null;
		exports: any;
	}

	export const enum ModuleId {
		EXPORTS = 0,
		MODULE = 1,
		REQUIRE = 2
	}

	class ModuleIdProvider {
		private _nextId: number;
		private _strModuleIdToIntModuleId: Map<string, ModuleId>;
		private _intModuleIdToStrModuleId: string[];

		constructor() {
			this._nextId = 0;
			this._strModuleIdToIntModuleId = new Map<string, ModuleId>();
			this._intModuleIdToStrModuleId = [];

			// Ensure values 0, 1, 2 are assigned accordingly with ModuleId
			this.getModuleId('exports');
			this.getModuleId('module');
			this.getModuleId('require');
		}

		public getMaxModuleId(): number {
			return this._nextId;
		}

		public getModuleId(strModuleId: string): ModuleId {
			let id = this._strModuleIdToIntModuleId.get(strModuleId);
			if (typeof id === 'undefined') {
				id = this._nextId++;
				this._strModuleIdToIntModuleId.set(strModuleId, id);
				this._intModuleIdToStrModuleId[id] = strModuleId;
			}
			return id;
		}

		public getStrModuleId(moduleId: ModuleId): string {
			return this._intModuleIdToStrModuleId[moduleId];
		}
	}

	export class RegularDependency {
		public static EXPORTS = new RegularDependency(ModuleId.EXPORTS);
		public static MODULE = new RegularDependency(ModuleId.MODULE);
		public static REQUIRE = new RegularDependency(ModuleId.REQUIRE);

		public readonly id: ModuleId;

		constructor(id: ModuleId) {
			this.id = id;
		}
	}

	export class PluginDependency {
		public readonly id: ModuleId;
		public readonly pluginId: ModuleId;
		public readonly pluginParam: string;

		constructor(id: ModuleId, pluginId: ModuleId, pluginParam: string) {
			this.id = id;
			this.pluginId = pluginId;
			this.pluginParam = pluginParam;
		}
	}

	export type Dependency = RegularDependency | PluginDependency;

	export class ModuleManager {

		private readonly _env: Environment;
		private readonly _scriptLoader: IScriptLoader;
		private readonly _loaderAvailableTimestamp: number;
		private readonly _defineFunc: IDefineFunc;
		private readonly _requireFunc: IRequireFunc;

		private _moduleIdProvider: ModuleIdProvider;
		private _config: Configuration;
		private _hasDependencyCycle: boolean;

		/**
		 * map of module id => module.
		 * If a module is found in _modules, its code has been loaded, but
		 * not necessary all its dependencies have been resolved
		 */
		private _modules2: Module[];

		/**
		 * Set of module ids => true
		 * If a module is found in _knownModules, a call has been made
		 * to the scriptLoader to load its code or a call will be made
		 * This is mainly used as a flag to not try loading the same module twice
		 */
		private _knownModules2: boolean[];

		/**
		 * map of module id => array [module id]
		 */
		private _inverseDependencies2: (ModuleId[] | null)[];

		/**
		 * Hash map of module id => array [ { moduleId, pluginParam } ]
		 */
		private _inversePluginDependencies2: Map<ModuleId, PluginDependency[]>;

		/**
		 * current annonymous received define call, but not yet processed
		 */
		private _currentAnonymousDefineCall: IDefineCall | null;

		private _recorder: ILoaderEventRecorder | null;

		private _buildInfoPath: string[];
		private _buildInfoDefineStack: (string | null)[];
		private _buildInfoDependencies: string[][];

		constructor(env: Environment, scriptLoader: IScriptLoader, defineFunc: IDefineFunc, requireFunc: IRequireFunc, loaderAvailableTimestamp: number = 0) {
			this._env = env;
			this._scriptLoader = scriptLoader;
			this._loaderAvailableTimestamp = loaderAvailableTimestamp;
			this._defineFunc = defineFunc;
			this._requireFunc = requireFunc;
			this._moduleIdProvider = new ModuleIdProvider();
			this._config = new Configuration(this._env);
			this._hasDependencyCycle = false;
			this._modules2 = [];
			this._knownModules2 = [];
			this._inverseDependencies2 = [];
			this._inversePluginDependencies2 = new Map<ModuleId, PluginDependency[]>();
			this._currentAnonymousDefineCall = null;

			this._recorder = null;
			this._buildInfoPath = [];
			this._buildInfoDefineStack = [];
			this._buildInfoDependencies = [];
		}

		public reset(): ModuleManager {
			return new ModuleManager(this._env, this._scriptLoader, this._defineFunc, this._requireFunc, this._loaderAvailableTimestamp);
		}

		public getGlobalAMDDefineFunc(): IDefineFunc {
			return this._defineFunc;
		}

		public getGlobalAMDRequireFunc(): IRequireFunc {
			return this._requireFunc;
		}

		private static _findRelevantLocationInStack(needle: string, stack: string): IPosition {
			let normalize = (str) => str.replace(/\\/g, '/');
			let normalizedPath = normalize(needle);

			let stackPieces = stack.split(/\n/);
			for (let i = 0; i < stackPieces.length; i++) {
				let m = stackPieces[i].match(/(.*):(\d+):(\d+)\)?$/);
				if (m) {
					let stackPath = m[1];
					let stackLine = m[2];
					let stackColumn = m[3];

					let trimPathOffset = Math.max(
						stackPath.lastIndexOf(' ') + 1,
						stackPath.lastIndexOf('(') + 1
					);

					stackPath = stackPath.substr(trimPathOffset);
					stackPath = normalize(stackPath);

					if (stackPath === normalizedPath) {
						let r = {
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

		public getBuildInfo(): IBuildModuleInfo[] | null {
			if (!this._config.isBuild()) {
				return null;
			}

			let result: IBuildModuleInfo[] = [], resultLen = 0;
			for (let i = 0, len = this._modules2.length; i < len; i++) {
				let m = this._modules2[i];
				if (!m) {
					continue;
				}

				let location = this._buildInfoPath[m.id] || null;
				let defineStack = this._buildInfoDefineStack[m.id] || null;
				let dependencies = this._buildInfoDependencies[m.id];
				result[resultLen++] = {
					id: m.strId,
					path: location,
					defineLocation: (location && defineStack ? ModuleManager._findRelevantLocationInStack(location, defineStack) : null),
					dependencies: dependencies,
					shim: null,
					exports: m.exports
				};
			}
			return result;
		}

		public getRecorder(): ILoaderEventRecorder {
			if (!this._recorder) {
				if (this._config.shouldRecordStats()) {
					this._recorder = new LoaderEventRecorder(this._loaderAvailableTimestamp);
				} else {
					this._recorder = NullLoaderEventRecorder.INSTANCE;
				}
			}
			return this._recorder;
		}

		public getLoaderEvents(): LoaderEvent[] {
			return this.getRecorder().getEvents();
		}

		/**
		 * Defines an anonymous module (without an id). Its name will be resolved as we receive a callback from the scriptLoader.
		 * @param dependencies @see defineModule
		 * @param callback @see defineModule
		 */
		public enqueueDefineAnonymousModule(dependencies: string[], callback: any): void {
			if (this._currentAnonymousDefineCall !== null) {
				throw new Error('Can only have one anonymous define call per script file');
			}
			let stack: string | null = null;
			if (this._config.isBuild()) {
				stack = new Error('StackLocation').stack || null;
			}
			this._currentAnonymousDefineCall = {
				stack: stack,
				dependencies: dependencies,
				callback: callback
			};
		}

		/**
		 * Creates a module and stores it in _modules. The manager will immediately begin resolving its dependencies.
		 * @param strModuleId An unique and absolute id of the module. This must not collide with another module's id
		 * @param dependencies An array with the dependencies of the module. Special keys are: "require", "exports" and "module"
		 * @param callback if callback is a function, it will be called with the resolved dependencies. if callback is an object, it will be considered as the exports of the module.
		 */
		public defineModule(strModuleId: string, dependencies: string[], callback: any, errorback: ((err: AnnotatedError) => void) | null | undefined, stack: string | null, moduleIdResolver: ModuleIdResolver = new ModuleIdResolver(strModuleId)): void {
			let moduleId = this._moduleIdProvider.getModuleId(strModuleId);
			if (this._modules2[moduleId]) {
				if (!this._config.isDuplicateMessageIgnoredFor(strModuleId)) {
					console.warn('Duplicate definition of module \'' + strModuleId + '\'');
				}
				// Super important! Completely ignore duplicate module definition
				return;
			}

			let m = new Module(moduleId, strModuleId, this._normalizeDependencies(dependencies, moduleIdResolver), callback, errorback, moduleIdResolver);
			this._modules2[moduleId] = m;

			if (this._config.isBuild()) {
				this._buildInfoDefineStack[moduleId] = stack;
				this._buildInfoDependencies[moduleId] = (m.dependencies || []).map(dep => this._moduleIdProvider.getStrModuleId(dep.id));
			}

			// Resolving of dependencies is immediate (not in a timeout). If there's a need to support a packer that concatenates in an
			// unordered manner, in order to finish processing the file, execute the following method in a timeout
			this._resolve(m);
		}

		private _normalizeDependency(dependency: string, moduleIdResolver: ModuleIdResolver): Dependency {
			if (dependency === 'exports') {
				return RegularDependency.EXPORTS;
			}
			if (dependency === 'module') {
				return RegularDependency.MODULE;
			}
			if (dependency === 'require') {
				return RegularDependency.REQUIRE;
			}
			// Normalize dependency and then request it from the manager
			let bangIndex = dependency.indexOf('!');

			if (bangIndex >= 0) {
				let strPluginId = moduleIdResolver.resolveModule(dependency.substr(0, bangIndex));
				let pluginParam = moduleIdResolver.resolveModule(dependency.substr(bangIndex + 1));
				let dependencyId = this._moduleIdProvider.getModuleId(strPluginId + '!' + pluginParam);
				let pluginId = this._moduleIdProvider.getModuleId(strPluginId);
				return new PluginDependency(dependencyId, pluginId, pluginParam);
			}

			return new RegularDependency(this._moduleIdProvider.getModuleId(moduleIdResolver.resolveModule(dependency)));
		}

		private _normalizeDependencies(dependencies: string[], moduleIdResolver: ModuleIdResolver): Dependency[] {
			let result: Dependency[] = [], resultLen = 0;
			for (let i = 0, len = dependencies.length; i < len; i++) {
				result[resultLen++] = this._normalizeDependency(dependencies[i], moduleIdResolver);
			}
			return result;
		}

		private _relativeRequire(moduleIdResolver: ModuleIdResolver, dependencies: string | string[], callback?: Function, errorback?: ((err: AnnotatedError) => void)): any {
			if (typeof dependencies === 'string') {
				return this.synchronousRequire(dependencies, moduleIdResolver);
			}

			this.defineModule(Utilities.generateAnonymousModule(), dependencies, callback, errorback, null, moduleIdResolver);
		}

		/**
		 * Require synchronously a module by its absolute id. If the module is not loaded, an exception will be thrown.
		 * @param id The unique and absolute id of the required module
		 * @return The exports of module 'id'
		 */
		public synchronousRequire(_strModuleId: string, moduleIdResolver: ModuleIdResolver = new ModuleIdResolver(_strModuleId)): any {
			let dependency = this._normalizeDependency(_strModuleId, moduleIdResolver);
			let m = this._modules2[dependency.id];

			if (!m) {
				throw new Error('Check dependency list! Synchronous require cannot resolve module \'' + _strModuleId + '\'. This is the first mention of this module!');
			}
			if (!m.isComplete()) {
				throw new Error('Check dependency list! Synchronous require cannot resolve module \'' + _strModuleId + '\'. This module has not been resolved completely yet.');
			}
			if (m.error) {
				throw m.error;
			}
			return m.exports;
		}

		public configure(params: IConfigurationOptions, shouldOverwrite: boolean): void {
			let oldShouldRecordStats = this._config.shouldRecordStats();
			if (shouldOverwrite) {
				this._config = new Configuration(this._env, params);
			} else {
				this._config = this._config.cloneAndMerge(params);
			}
			if (this._config.shouldRecordStats() && !oldShouldRecordStats) {
				this._recorder = null;
			}
		}

		public getConfig(): Configuration {
			return this._config;
		}

		/**
		 * Callback from the scriptLoader when a module has been loaded.
		 * This means its code is available and has been executed.
		 */
		private _onLoad(moduleId: ModuleId): void {
			if (this._currentAnonymousDefineCall !== null) {
				let defineCall = this._currentAnonymousDefineCall;
				this._currentAnonymousDefineCall = null;

				// Hit an anonymous define call
				this.defineModule(this._moduleIdProvider.getStrModuleId(moduleId), defineCall.dependencies, defineCall.callback, null, defineCall.stack);
			}
		}

		private _createLoadError(moduleId: ModuleId, _err: any): AnnotatedError {
			let strModuleId = this._moduleIdProvider.getStrModuleId(moduleId);
			let neededBy = (this._inverseDependencies2[moduleId] || []).map((intModuleId) => this._moduleIdProvider.getStrModuleId(intModuleId));

			const err = ensureError<AnnotatedLoadingError>(_err);
			err.phase = 'loading';
			err.moduleId = strModuleId;
			err.neededBy = neededBy;

			return err;
		}

		/**
		 * Callback from the scriptLoader when a module hasn't been loaded.
		 * This means that the script was not found (e.g. 404) or there was an error in the script.
		 */
		private _onLoadError(moduleId: ModuleId, err: any): void {
			const error = this._createLoadError(moduleId, err);
			if (!this._modules2[moduleId]) {
				this._modules2[moduleId] = new Module(moduleId, this._moduleIdProvider.getStrModuleId(moduleId), [], () => {}, null, null);
			}

			// Find any 'local' error handlers, walk the entire chain of inverse dependencies if necessary.
			let seenModuleId: boolean[] = [];
			for (let i = 0, len = this._moduleIdProvider.getMaxModuleId(); i < len; i++) {
				seenModuleId[i] = false;
			}
			let someoneNotified = false;
			let queue: ModuleId[] = [];

			queue.push(moduleId);
			seenModuleId[moduleId] = true;

			while (queue.length > 0) {
				let queueElement = queue.shift()!;
				let m = this._modules2[queueElement];
				if (m) {
					someoneNotified = m.onDependencyError(error) || someoneNotified;
				}

				let inverseDeps = this._inverseDependencies2[queueElement];
				if (inverseDeps) {
					for (let i = 0, len = inverseDeps.length; i < len; i++) {
						let inverseDep = inverseDeps[i];
						if (!seenModuleId[inverseDep]) {
							queue.push(inverseDep);
							seenModuleId[inverseDep] = true;
						}
					}
				}
			}

			if (!someoneNotified) {
				this._config.onError(error);
			}
		}

		/**
		 * Walks (recursively) the dependencies of 'from' in search of 'to'.
		 * Returns true if there is such a path or false otherwise.
		 * @param from Module id to start at
		 * @param to Module id to look for
		 */
		private _hasDependencyPath(fromId: ModuleId, toId: ModuleId): boolean {
			let from = this._modules2[fromId];
			if (!from) {
				return false;
			}

			let inQueue: boolean[] = [];
			for (let i = 0, len = this._moduleIdProvider.getMaxModuleId(); i < len; i++) {
				inQueue[i] = false;
			}
			let queue: Module[] = [];

			// Insert 'from' in queue
			queue.push(from);
			inQueue[fromId] = true;

			while (queue.length > 0) {
				// Pop first inserted element of queue
				let element = queue.shift()!;
				let dependencies = element.dependencies;
				if (dependencies) {
					// Walk the element's dependencies
					for (let i = 0, len = dependencies.length; i < len; i++) {
						let dependency = dependencies[i];

						if (dependency.id === toId) {
							// There is a path to 'to'
							return true;
						}

						let dependencyModule = this._modules2[dependency.id];
						if (dependencyModule && !inQueue[dependency.id]) {
							// Insert 'dependency' in queue
							inQueue[dependency.id] = true;
							queue.push(dependencyModule);
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
		private _findCyclePath(fromId: ModuleId, toId: ModuleId, depth: number): (ModuleId[] | null) {
			if (fromId === toId || depth === 50) {
				return [fromId];
			}

			let from = this._modules2[fromId];
			if (!from) {
				return null;
			}

			// Walk the element's dependencies
			let dependencies = from.dependencies;
			if (dependencies) {
				for (let i = 0, len = dependencies.length; i < len; i++) {
					let path = this._findCyclePath(dependencies[i].id, toId, depth + 1);
					if (path !== null) {
						path.push(fromId);
						return path;
					}
				}
			}

			return null;
		}

		/**
		 * Create the local 'require' that is passed into modules
		 */
		private _createRequire(moduleIdResolver: ModuleIdResolver): IRelativeRequire {
			let result: IRelativeRequire = <any>((dependencies: any, callback?: Function, errorback?: ((err: AnnotatedError) => void)) => {
				return this._relativeRequire(moduleIdResolver, dependencies, callback, errorback);
			});
			result.toUrl = (id: string) => {
				return this._config.requireToUrl(moduleIdResolver.resolveModule(id));
			};
			result.getStats = () => {
				return this.getLoaderEvents();
			};
			result.hasDependencyCycle = () => {
				return this._hasDependencyCycle;
			};
			result.config = (params: IConfigurationOptions, shouldOverwrite: boolean = false) => {
				this.configure(params, shouldOverwrite);
			};
			(<any>result).__$__nodeRequire = global.nodeRequire;
			return result;
		}

		private _loadModule(moduleId: ModuleId): void {
			if (this._modules2[moduleId] || this._knownModules2[moduleId]) {
				// known module
				return;
			}
			this._knownModules2[moduleId] = true;

			let strModuleId = this._moduleIdProvider.getStrModuleId(moduleId);
			let paths = this._config.moduleIdToPaths(strModuleId);

			let scopedPackageRegex = /^@[^\/]+\/[^\/]+$/ // matches @scope/package-name
			if (this._env.isNode && (strModuleId.indexOf('/') === -1 || scopedPackageRegex.test(strModuleId))) {
				paths.push('node|' + strModuleId);
			}

			let lastPathIndex = -1;
			let loadNextPath = (err: any) => {
				lastPathIndex++;

				if (lastPathIndex >= paths.length) {
					// No more paths to try
					this._onLoadError(moduleId, err);
				} else {
					let currentPath = paths[lastPathIndex];
					let recorder = this.getRecorder();

					if (this._config.isBuild() && currentPath === 'empty:') {
						this._buildInfoPath[moduleId] = currentPath;
						this.defineModule(this._moduleIdProvider.getStrModuleId(moduleId), [], null, null, null);
						this._onLoad(moduleId);
						return;
					}

					recorder.record(LoaderEventType.BeginLoadingScript, currentPath);
					this._scriptLoader.load(this, currentPath, () => {
						if (this._config.isBuild()) {
							this._buildInfoPath[moduleId] = currentPath;
						}
						recorder.record(LoaderEventType.EndLoadingScriptOK, currentPath);
						this._onLoad(moduleId);
					}, (err) => {
						recorder.record(LoaderEventType.EndLoadingScriptError, currentPath);
						loadNextPath(err);
					});
				}
			};

			loadNextPath(null);
		}

		/**
		 * Resolve a plugin dependency with the plugin loaded & complete
		 * @param module The module that has this dependency
		 * @param pluginDependency The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
		 * @param plugin The plugin (what the plugin exports)
		 */
		private _loadPluginDependency(plugin: ILoaderPlugin, pluginDependency: PluginDependency): void {
			if (this._modules2[pluginDependency.id] || this._knownModules2[pluginDependency.id]) {
				// known module
				return;
			}
			this._knownModules2[pluginDependency.id] = true;

			// Delegate the loading of the resource to the plugin
			let load: IPluginLoadCallback = <any>((value: any) => {
				this.defineModule(this._moduleIdProvider.getStrModuleId(pluginDependency.id), [], value, null, null);
			});
			load.error = (err: any) => {
				this._config.onError(this._createLoadError(pluginDependency.id, err));
			};

			plugin.load(pluginDependency.pluginParam, this._createRequire(ModuleIdResolver.ROOT), load, this._config.getOptionsLiteral());
		}

		/**
		 * Examine the dependencies of module 'module' and resolve them as needed.
		 */
		private _resolve(module: Module): void {
			let dependencies = module.dependencies;
			if (dependencies) {
				for (let i = 0, len = dependencies.length; i < len; i++) {
					let dependency = dependencies[i];

					if (dependency === RegularDependency.EXPORTS) {
						module.exportsPassedIn = true;
						module.unresolvedDependenciesCount--;
						continue;
					}

					if (dependency === RegularDependency.MODULE) {
						module.unresolvedDependenciesCount--;
						continue;
					}

					if (dependency === RegularDependency.REQUIRE) {
						module.unresolvedDependenciesCount--;
						continue;
					}

					let dependencyModule = this._modules2[dependency.id];
					if (dependencyModule && dependencyModule.isComplete()) {
						if (dependencyModule.error) {
							module.onDependencyError(dependencyModule.error);
							return;
						}
						module.unresolvedDependenciesCount--;
						continue;
					}

					if (this._hasDependencyPath(dependency.id, module.id)) {
						this._hasDependencyCycle = true;
						console.warn('There is a dependency cycle between \'' + this._moduleIdProvider.getStrModuleId(dependency.id) + '\' and \'' + this._moduleIdProvider.getStrModuleId(module.id) + '\'. The cyclic path follows:');
						let cyclePath = this._findCyclePath(dependency.id, module.id, 0) || [];
						cyclePath.reverse();
						cyclePath.push(dependency.id);
						console.warn(cyclePath.map(id => this._moduleIdProvider.getStrModuleId(id)).join(' => \n'));

						// Break the cycle
						module.unresolvedDependenciesCount--;
						continue;
					}

					// record inverse dependency
					this._inverseDependencies2[dependency.id] = this._inverseDependencies2[dependency.id] || [];
					this._inverseDependencies2[dependency.id]!.push(module.id);

					if (dependency instanceof PluginDependency) {
						let plugin = this._modules2[dependency.pluginId];
						if (plugin && plugin.isComplete()) {
							this._loadPluginDependency(plugin.exports, dependency);
							continue;
						}

						// Record dependency for when the plugin gets loaded
						let inversePluginDeps: PluginDependency[] | undefined = this._inversePluginDependencies2.get(dependency.pluginId);
						if (!inversePluginDeps) {
							inversePluginDeps = [];
							this._inversePluginDependencies2.set(dependency.pluginId, inversePluginDeps);
						}

						inversePluginDeps.push(dependency);

						this._loadModule(dependency.pluginId);
						continue;
					}

					this._loadModule(dependency.id);
				}
			}

			if (module.unresolvedDependenciesCount === 0) {
				this._onModuleComplete(module);
			}
		}

		private _onModuleComplete(module: Module): void {
			let recorder = this.getRecorder();

			if (module.isComplete()) {
				// already done
				return;
			}

			let dependencies = module.dependencies;
			let dependenciesValues: any[] = [];
			if (dependencies) {
				for (let i = 0, len = dependencies.length; i < len; i++) {
					let dependency = dependencies[i];

					if (dependency === RegularDependency.EXPORTS) {
						dependenciesValues[i] = module.exports;
						continue;
					}

					if (dependency === RegularDependency.MODULE) {
						dependenciesValues[i] = {
							id: module.strId,
							config: () => {
								return this._config.getConfigForModule(module.strId);
							}
						};
						continue;
					}

					if (dependency === RegularDependency.REQUIRE) {
						dependenciesValues[i] = this._createRequire(module.moduleIdResolver!);
						continue;
					}

					let dependencyModule = this._modules2[dependency.id];
					if (dependencyModule) {
						dependenciesValues[i] = dependencyModule.exports;
						continue;
					}

					dependenciesValues[i] = null;
				}
			}

			const inversedependenciesProvider = (moduleId: number) => {
				return (this._inverseDependencies2[moduleId] || []).map((intModuleId) => this._moduleIdProvider.getStrModuleId(intModuleId));
			}

			module.complete(recorder, this._config, dependenciesValues, inversedependenciesProvider);

			// Fetch and clear inverse dependencies
			let inverseDeps = this._inverseDependencies2[module.id];
			this._inverseDependencies2[module.id] = null;

			if (inverseDeps) {
				// Resolve one inverse dependency at a time, always
				// on the lookout for a completed module.
				for (let i = 0, len = inverseDeps.length; i < len; i++) {
					let inverseDependencyId = inverseDeps[i];
					let inverseDependency = this._modules2[inverseDependencyId];
					inverseDependency.unresolvedDependenciesCount--;
					if (inverseDependency.unresolvedDependenciesCount === 0) {
						this._onModuleComplete(inverseDependency);
					}
				}
			}

			let inversePluginDeps = this._inversePluginDependencies2.get(module.id);
			if (inversePluginDeps) {
				// This module is used as a plugin at least once
				// Fetch and clear these inverse plugin dependencies
				this._inversePluginDependencies2.delete(module.id);

				// Resolve plugin dependencies one at a time
				for (let i = 0, len = inversePluginDeps.length; i < len; i++) {
					this._loadPluginDependency(module.exports, inversePluginDeps[i]);
				}
			}
		}
	}
}
