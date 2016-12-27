declare const _amdLoaderGlobal: any;
declare var module: {
    exports: any;
};
declare var process: {
    platform: string;
    type: string;
    versions: {
        node: string;
        electron: string;
    };
};
declare var require: {
    nodeRequire(module: string): any;
};
interface Map<K, V> {
    clear(): void;
    delete(key: K): boolean;
    forEach(callbackfn: (value: V, index: K, map: Map<K, V>) => void, thisArg?: any): void;
    get(key: K): V;
    has(key: K): boolean;
    set(key: K, value?: V): Map<K, V>;
    size: number;
}
interface MapConstructor {
    new <K, V>(): Map<K, V>;
    prototype: Map<any, any>;
}
declare var Map: MapConstructor;
declare namespace AMDLoader {
    const global: any;
    const isNode: boolean;
    const isWindows: boolean;
    const isWebWorker: boolean;
    const isElectronRenderer: boolean;
    const isElectronMain: boolean;
    const hasPerformanceNow: boolean;
}
declare namespace AMDLoader {
    enum LoaderEventType {
        LoaderAvailable = 1,
        BeginLoadingScript = 10,
        EndLoadingScriptOK = 11,
        EndLoadingScriptError = 12,
        BeginInvokeFactory = 21,
        EndInvokeFactory = 22,
        NodeBeginEvaluatingScript = 31,
        NodeEndEvaluatingScript = 32,
        NodeBeginNativeRequire = 33,
        NodeEndNativeRequire = 34,
    }
    function getHighPerformanceTimestamp(): number;
    class LoaderEvent {
        type: LoaderEventType;
        timestamp: number;
        detail: string;
        constructor(type: LoaderEventType, detail: string, timestamp: number);
    }
    interface ILoaderEventRecorder {
        record(type: LoaderEventType, detail: string): void;
        getEvents(): LoaderEvent[];
    }
    class LoaderEventRecorder implements ILoaderEventRecorder {
        private _events;
        constructor(loaderAvailableTimestamp: number);
        record(type: LoaderEventType, detail: string): void;
        getEvents(): LoaderEvent[];
    }
    class NullLoaderEventRecorder implements ILoaderEventRecorder {
        static INSTANCE: NullLoaderEventRecorder;
        record(type: LoaderEventType, detail: string): void;
        getEvents(): LoaderEvent[];
    }
}
declare namespace AMDLoader {
    class Utilities {
        /**
         * This method does not take care of / vs \
         */
        static fileUriToFilePath(uri: string): string;
        static startsWith(haystack: string, needle: string): boolean;
        static endsWith(haystack: string, needle: string): boolean;
        static containsQueryString(url: string): boolean;
        /**
         * Does `url` start with http:// or https:// or file:// or / ?
         */
        static isAbsolutePath(url: string): boolean;
        static forEachProperty(obj: any, callback: (key: string, value: any) => void): void;
        static isEmpty(obj: any): boolean;
        static recursiveClone(obj: any): any;
        static NEXT_ANONYMOUS_ID: number;
        static generateAnonymousModule(): string;
        static isAnonymousModule(id: string): boolean;
    }
}
declare namespace AMDLoader {
    interface IModuleConfiguration {
        [key: string]: any;
    }
    interface INodeRequire {
        (nodeModule: string): any;
        main: {
            filename: string;
        };
    }
    interface IConfigurationOptions {
        /**
         * The prefix that will be aplied to all modules when they are resolved to a location
         */
        baseUrl?: string;
        /**
         * Redirect rules for modules. The redirect rules will affect the module ids themselves
         */
        paths?: {
            [path: string]: any;
        };
        /**
         * Per-module configuration
         */
        config?: {
            [moduleId: string]: IModuleConfiguration;
        };
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
         * Optional callback that will be invoked when errors with cached code occur
         */
        onNodeCachedDataError?: (err: any) => void;
    }
    class ConfigurationOptionsUtil {
        /**
         * Ensure configuration options make sense
         */
        private static validateConfigurationOptions(options);
        static mergeConfigurationOptions(overwrite?: IConfigurationOptions, base?: IConfigurationOptions): IConfigurationOptions;
    }
    class Configuration {
        private options;
        /**
         * Generated from the `ignoreDuplicateModules` configuration option.
         */
        private ignoreDuplicateModulesMap;
        /**
         * Generated from the `nodeModules` configuration option.
         */
        private nodeModulesMap;
        /**
         * Generated from the `paths` configuration option. These are sorted with the longest `from` first.
         */
        private sortedPathsRules;
        constructor(options?: IConfigurationOptions);
        private _createIgnoreDuplicateModulesMap();
        private _createNodeModulesMap();
        private _createSortedPathsRules();
        /**
         * Clone current configuration and overwrite options selectively.
         * @param options The selective options to overwrite with.
         * @result A new configuration
         */
        cloneAndMerge(options?: IConfigurationOptions): Configuration;
        /**
         * Get current options bag. Useful for passing it forward to plugins.
         */
        getOptionsLiteral(): IConfigurationOptions;
        private _applyPaths(moduleId);
        private _addUrlArgsToUrl(url);
        private _addUrlArgsIfNecessaryToUrl(url);
        private _addUrlArgsIfNecessaryToUrls(urls);
        /**
         * Transform a module id to a location. Appends .js to module ids
         */
        moduleIdToPaths(moduleId: string): string[];
        /**
         * Transform a module id or url to a location.
         */
        requireToUrl(url: string): string;
        /**
         * Flag to indicate if current execution is as part of a build.
         */
        isBuild(): boolean;
        /**
         * Test if module `moduleId` is expected to be defined multiple times
         */
        isDuplicateMessageIgnoredFor(moduleId: string): boolean;
        /**
         * Get the configuration settings for the provided module id
         */
        getConfigForModule(moduleId: string): IModuleConfiguration;
        /**
         * Should errors be caught when executing module factories?
         */
        shouldCatchError(): boolean;
        /**
         * Should statistics be recorded?
         */
        shouldRecordStats(): boolean;
        /**
         * Forward an error to the error handler.
         */
        onError(err: any): void;
    }
}
declare namespace AMDLoader {
    interface IModuleManager {
        getConfig(): Configuration;
        enqueueDefineAnonymousModule(dependencies: string[], callback: any): void;
        getRecorder(): ILoaderEventRecorder;
    }
    interface IScriptLoader {
        load(moduleManager: IModuleManager, scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void): void;
    }
    const scriptLoader: IScriptLoader;
}
declare namespace AMDLoader {
    interface ILoaderPlugin {
        load: (pluginParam: string, parentRequire: IRelativeRequire, loadCallback: IPluginLoadCallback, options: IConfigurationOptions) => void;
    }
    interface IDefineCall {
        stack: string;
        dependencies: string[];
        callback: any;
    }
    interface IRelativeRequire {
        (dependencies: string[], callback: Function): void;
        (dependency: string): any;
        toUrl(id: string): string;
        getStats(): LoaderEvent[];
        getChecksums(): {
            [scriptSrc: string]: string;
        };
    }
    interface IPluginLoadCallback {
        (value: any): void;
        error(err: any): void;
    }
    interface IPluginWriteCallback {
        (contents: string): void;
        getEntryPoint(): string;
        asModule(moduleId: string, contents: string): void;
    }
    interface IPluginWriteFileCallback {
        (filename: string, contents: string): void;
        getEntryPoint(): string;
        asModule(moduleId: string, contents: string): void;
    }
    class ModuleIdResolver {
        static ROOT: ModuleIdResolver;
        private fromModulePath;
        constructor(fromModuleId: string);
        /**
         * Normalize 'a/../name' to 'name', etc.
         */
        static _normalizeModuleId(moduleId: string): string;
        /**
         * Resolve relative module ids
         */
        resolveModule(moduleId: string): string;
    }
    class Module {
        readonly id: ModuleId;
        readonly strId: string;
        readonly dependencies: Dependency[];
        private readonly _callback;
        private readonly _errorback;
        readonly moduleIdResolver: ModuleIdResolver;
        exports: any;
        exportsPassedIn: boolean;
        unresolvedDependenciesCount: number;
        private _isComplete;
        constructor(id: ModuleId, strId: string, dependencies: Dependency[], callback: any, errorback: Function, moduleIdResolver: ModuleIdResolver);
        private static _safeInvokeFunction(callback, args);
        private static _invokeFactory(config, strModuleId, callback, dependenciesValues);
        complete(recorder: ILoaderEventRecorder, config: Configuration, dependenciesValues: any[]): void;
        /**
         * One of the direct dependencies or a transitive dependency has failed to load.
         */
        onDependencyError(err: any): boolean;
        /**
         * Is the current module complete?
         */
        isComplete(): boolean;
    }
    interface IPosition {
        line: number;
        col: number;
    }
    interface IBuildModuleInfo {
        id: string;
        path: string;
        defineLocation: IPosition;
        dependencies: string[];
        shim: string;
        exports: any;
    }
    const enum ModuleId {
        EXPORTS = 0,
        MODULE = 1,
        REQUIRE = 2,
    }
    class RegularDependency {
        static EXPORTS: RegularDependency;
        static MODULE: RegularDependency;
        static REQUIRE: RegularDependency;
        readonly id: ModuleId;
        constructor(id: ModuleId);
    }
    class PluginDependency {
        readonly id: ModuleId;
        readonly pluginId: ModuleId;
        readonly pluginParam: string;
        constructor(id: ModuleId, pluginId: ModuleId, pluginParam: string);
    }
    type Dependency = RegularDependency | PluginDependency;
    class ModuleManager {
        private readonly _moduleIdProvider;
        private _config;
        private readonly _loaderAvailableTimestamp;
        private readonly _scriptLoader;
        /**
         * map of module id => module.
         * If a module is found in _modules, its code has been loaded, but
         * not necessary all its dependencies have been resolved
         */
        private _modules2;
        /**
         * Set of module ids => true
         * If a module is found in _knownModules, a call has been made
         * to the scriptLoader to load its code or a call will be made
         * This is mainly used as a flag to not try loading the same module twice
         */
        private _knownModules2;
        /**
         * map of module id => array [module id]
         */
        private _inverseDependencies2;
        /**
         * Hash map of module id => array [ { moduleId, pluginParam } ]
         */
        private _inversePluginDependencies2;
        /**
         * current annonymous received define call, but not yet processed
         */
        private _currentAnnonymousDefineCall;
        private _buildInfoPath;
        private _buildInfoDefineStack;
        private _buildInfoDependencies;
        constructor(scriptLoader: IScriptLoader, loaderAvailableTimestamp?: number);
        private static _findRelevantLocationInStack(needle, stack);
        getBuildInfo(): IBuildModuleInfo[];
        private _recorder;
        getRecorder(): ILoaderEventRecorder;
        getLoaderEvents(): LoaderEvent[];
        /**
         * Defines an anonymous module (without an id). Its name will be resolved as we receive a callback from the scriptLoader.
         * @param dependecies @see defineModule
         * @param callback @see defineModule
         */
        enqueueDefineAnonymousModule(dependencies: string[], callback: any): void;
        /**
         * Creates a module and stores it in _modules. The manager will immediately begin resolving its dependencies.
         * @param strModuleId An unique and absolute id of the module. This must not collide with another module's id
         * @param dependencies An array with the dependencies of the module. Special keys are: "require", "exports" and "module"
         * @param callback if callback is a function, it will be called with the resolved dependencies. if callback is an object, it will be considered as the exports of the module.
         */
        defineModule(strModuleId: string, dependencies: string[], callback: any, errorback: Function, stack: string, moduleIdResolver?: ModuleIdResolver): void;
        private _normalizeDependency(dependency, moduleIdResolver);
        private _normalizeDependencies(dependencies, moduleIdResolver);
        private _relativeRequire(moduleIdResolver, dependencies, callback?, errorback?);
        /**
         * Require synchronously a module by its absolute id. If the module is not loaded, an exception will be thrown.
         * @param id The unique and absolute id of the required module
         * @return The exports of module 'id'
         */
        synchronousRequire(_strModuleId: string, moduleIdResolver?: ModuleIdResolver): any;
        configure(params: IConfigurationOptions, shouldOverwrite: boolean): void;
        getConfig(): Configuration;
        /**
         * Callback from the scriptLoader when a module has been loaded.
         * This means its code is available and has been executed.
         */
        private _onLoad(moduleId);
        private _createLoadError(moduleId, err);
        /**
         * Callback from the scriptLoader when a module hasn't been loaded.
         * This means that the script was not found (e.g. 404) or there was an error in the script.
         */
        private _onLoadError(moduleId, err);
        /**
         * Walks (recursively) the dependencies of 'from' in search of 'to'.
         * Returns true if there is such a path or false otherwise.
         * @param from Module id to start at
         * @param to Module id to look for
         */
        private _hasDependencyPath(fromId, toId);
        /**
         * Walks (recursively) the dependencies of 'from' in search of 'to'.
         * Returns cycle as array.
         * @param from Module id to start at
         * @param to Module id to look for
         */
        private _findCyclePath(fromId, toId, depth);
        /**
         * Create the local 'require' that is passed into modules
         */
        private _createRequire(moduleIdResolver);
        private _loadModule(moduleId);
        /**
         * Resolve a plugin dependency with the plugin loaded & complete
         * @param module The module that has this dependency
         * @param pluginDependency The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
         * @param plugin The plugin (what the plugin exports)
         */
        private _loadPluginDependency(plugin, pluginDependency);
        /**
         * Examine the dependencies of module 'module' and resolve them as needed.
         */
        private _resolve(module);
        private _completingQueue;
        private _onModuleComplete2(module);
        private _processCompletingQueue();
    }
}
declare var define: any;
declare namespace AMDLoader {
    class DefineFunc {
        constructor(id: any, dependencies: any, callback: any);
        static amd: {
            jQuery: boolean;
        };
    }
    class RequireFunc {
        constructor();
        static config(params: IConfigurationOptions, shouldOverwrite?: boolean): void;
        static getConfig(): IConfigurationOptions;
        /**
         * Non standard extension to reset completely the loader state. This is used for running amdjs tests
         */
        static reset(): void;
        /**
         * Non standard extension to fetch loader state for building purposes.
         */
        static getBuildInfo(): IBuildModuleInfo[];
        /**
         * Non standard extension to fetch loader events
         */
        static getStats(): LoaderEvent[];
    }
}
