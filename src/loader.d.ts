declare const _amdLoaderGlobal: typeof globalThis;
declare var module: {
    exports: any;
};
declare var process: {
    platform: string;
    type: string;
    mainModule: string;
    arch: string;
    argv: string[];
    versions: {
        node: string;
        electron: string;
    };
};
declare var require: {
    nodeRequire(module: string): any;
};
declare var global: object;
declare const _commonjsGlobal: object;
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
    class Environment {
        private _detected;
        private _isWindows;
        private _isNode;
        private _isElectronRenderer;
        private _isWebWorker;
        private _isElectronNodeIntegrationWebWorker;
        get isWindows(): boolean;
        get isNode(): boolean;
        get isElectronRenderer(): boolean;
        get isWebWorker(): boolean;
        get isElectronNodeIntegrationWebWorker(): boolean;
        constructor();
        private _detect;
        private static _isWindows;
    }
}
declare namespace AMDLoader {
    const enum LoaderEventType {
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
        CachedDataFound = 60,
        CachedDataMissed = 61,
        CachedDataRejected = 62,
        CachedDataCreated = 63
    }
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
        static fileUriToFilePath(isWindows: boolean, uri: string): string;
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
        private static NEXT_ANONYMOUS_ID;
        static generateAnonymousModule(): string;
        static isAnonymousModule(id: string): boolean;
        private static PERFORMANCE_NOW_PROBED;
        private static HAS_PERFORMANCE_NOW;
        static getHighPerformanceTimestamp(): number;
    }
}
declare namespace AMDLoader {
    interface AnnotatedLoadingError extends Error {
        phase: 'loading';
        moduleId: string;
        neededBy: string[];
    }
    interface AnnotatedFactoryError extends Error {
        phase: 'factory';
        moduleId: string;
        neededBy: string[];
    }
    interface AnnotatedValidationError extends Error {
        phase: 'configuration';
    }
    type AnnotatedError = AnnotatedLoadingError | AnnotatedFactoryError | AnnotatedValidationError;
    function ensureError<T extends Error>(err: any): T;
    /**
     * The signature for the loader's AMD "define" function.
     */
    interface IDefineFunc {
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
    interface IRequireFunc {
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
    interface IModuleConfiguration {
        [key: string]: any;
    }
    interface INodeRequire {
        (nodeModule: string): any;
        main: {
            filename: string;
        };
    }
    interface INodeCachedDataConfiguration {
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
         * Normally, during a build, no module factories are invoked. This can be used
         * to forcefully execute a module's factory.
         */
        buildForceInvokeFactory?: {
            [moduleId: string]: boolean;
        };
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
         * A trusted types policy which will be used to create TrustedScriptURL-values.
         * https://w3c.github.io/webappsec-trusted-types/dist/spec/#introduction.
         */
        trustedTypesPolicy?: {
            createScriptURL(value: string): string & object;
            createScript(_: string, value: string): string;
        };
        /**
         * A regex to help determine if a module is an AMD module or a node module.
         * If defined, then all amd modules in the system must match this regular expression.
         */
        amdModulesPattern?: RegExp;
        /**
         * The main entry point node's require
         */
        nodeRequire?: INodeRequire;
        /**
         * An optional transformation applied to the source before it is loaded in node's vm
         */
        nodeInstrumenter?: (source: string, vmScriptSrc: string) => string;
        /**
        * Support v8 cached data (http://v8project.blogspot.co.uk/2015/07/code-caching.html)
        */
        nodeCachedData?: INodeCachedDataConfiguration;
    }
    interface IValidatedConfigurationOptions extends IConfigurationOptions {
        baseUrl: string;
        paths: {
            [path: string]: any;
        };
        config: {
            [moduleId: string]: IModuleConfiguration;
        };
        catchError: boolean;
        recordStats: boolean;
        urlArgs: string;
        onError: (err: AnnotatedError) => void;
        ignoreDuplicateModules: string[];
        isBuild: boolean;
        cspNonce: string;
        preferScriptTags: boolean;
    }
    class ConfigurationOptionsUtil {
        /**
         * Ensure configuration options make sense
         */
        private static validateConfigurationOptions;
        static mergeConfigurationOptions(overwrite?: IConfigurationOptions | null, base?: IConfigurationOptions | null): IValidatedConfigurationOptions;
    }
    class Configuration {
        private readonly _env;
        private options;
        /**
         * Generated from the `ignoreDuplicateModules` configuration option.
         */
        private ignoreDuplicateModulesMap;
        /**
         * Generated from the `paths` configuration option. These are sorted with the longest `from` first.
         */
        private sortedPathsRules;
        constructor(env: Environment, options?: IConfigurationOptions);
        private _createIgnoreDuplicateModulesMap;
        private _createSortedPathsRules;
        /**
         * Clone current configuration and overwrite options selectively.
         * @param options The selective options to overwrite with.
         * @result A new configuration
         */
        cloneAndMerge(options?: IConfigurationOptions): Configuration;
        /**
         * Get current options bag. Useful for passing it forward to plugins.
         */
        getOptionsLiteral(): IValidatedConfigurationOptions;
        private _applyPaths;
        private _addUrlArgsToUrl;
        private _addUrlArgsIfNecessaryToUrl;
        private _addUrlArgsIfNecessaryToUrls;
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
        shouldInvokeFactory(strModuleId: string): boolean;
        /**
         * Test if module `moduleId` is expected to be defined multiple times
         */
        isDuplicateMessageIgnoredFor(moduleId: string): boolean;
        /**
         * Get the configuration settings for the provided module id
         */
        getConfigForModule(moduleId: string): IModuleConfiguration | undefined;
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
        onError(err: AnnotatedError): void;
    }
}
declare namespace AMDLoader {
    interface IModuleManager {
        getGlobalAMDDefineFunc(): IDefineFunc;
        getGlobalAMDRequireFunc(): IRequireFunc;
        getConfig(): Configuration;
        enqueueDefineAnonymousModule(dependencies: string[], callback: any): void;
        getRecorder(): ILoaderEventRecorder;
    }
    interface IScriptLoader {
        load(moduleManager: IModuleManager, scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void): void;
    }
    function ensureRecordedNodeRequire(recorder: ILoaderEventRecorder, _nodeRequire: (nodeModule: string) => any): (nodeModule: string) => any;
    function createScriptLoader(env: Environment): IScriptLoader;
}
declare namespace AMDLoader {
    interface ILoaderPlugin {
        load: (pluginParam: string, parentRequire: IRelativeRequire, loadCallback: IPluginLoadCallback, options: IConfigurationOptions) => void;
    }
    interface IDefineCall {
        stack: string | null;
        dependencies: string[];
        callback: any;
    }
    interface IRelativeRequire {
        (dependencies: string[], callback: Function, errorback?: (error: Error) => void): void;
        (dependency: string): any;
        toUrl(id: string): string;
        getStats(): LoaderEvent[];
        hasDependencyCycle(): boolean;
        getChecksums(): {
            [scriptSrc: string]: string;
        };
        config(params: IConfigurationOptions, shouldOverwrite?: boolean): void;
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
        readonly dependencies: Dependency[] | null;
        private readonly _callback;
        private readonly _errorback;
        readonly moduleIdResolver: ModuleIdResolver | null;
        exports: any;
        error: AnnotatedError | null;
        exportsPassedIn: boolean;
        unresolvedDependenciesCount: number;
        private _isComplete;
        constructor(id: ModuleId, strId: string, dependencies: Dependency[], callback: any, errorback: ((err: AnnotatedError) => void) | null | undefined, moduleIdResolver: ModuleIdResolver | null);
        private static _safeInvokeFunction;
        private static _invokeFactory;
        complete(recorder: ILoaderEventRecorder, config: Configuration, dependenciesValues: any[], inversedependenciesProvider: (moduleId: number) => string[]): void;
        /**
         * One of the direct dependencies or a transitive dependency has failed to load.
         */
        onDependencyError(err: AnnotatedError): boolean;
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
        path: string | null;
        defineLocation: IPosition | null;
        dependencies: string[];
        shim: string | null;
        exports: any;
    }
    const enum ModuleId {
        EXPORTS = 0,
        MODULE = 1,
        REQUIRE = 2
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
        private readonly _env;
        private readonly _scriptLoader;
        private readonly _loaderAvailableTimestamp;
        private readonly _defineFunc;
        private readonly _requireFunc;
        private _moduleIdProvider;
        private _config;
        private _hasDependencyCycle;
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
        private _currentAnonymousDefineCall;
        private _recorder;
        private _buildInfoPath;
        private _buildInfoDefineStack;
        private _buildInfoDependencies;
        constructor(env: Environment, scriptLoader: IScriptLoader, defineFunc: IDefineFunc, requireFunc: IRequireFunc, loaderAvailableTimestamp?: number);
        reset(): ModuleManager;
        getGlobalAMDDefineFunc(): IDefineFunc;
        getGlobalAMDRequireFunc(): IRequireFunc;
        private static _findRelevantLocationInStack;
        getBuildInfo(): IBuildModuleInfo[] | null;
        getRecorder(): ILoaderEventRecorder;
        getLoaderEvents(): LoaderEvent[];
        /**
         * Defines an anonymous module (without an id). Its name will be resolved as we receive a callback from the scriptLoader.
         * @param dependencies @see defineModule
         * @param callback @see defineModule
         */
        enqueueDefineAnonymousModule(dependencies: string[], callback: any): void;
        /**
         * Creates a module and stores it in _modules. The manager will immediately begin resolving its dependencies.
         * @param strModuleId An unique and absolute id of the module. This must not collide with another module's id
         * @param dependencies An array with the dependencies of the module. Special keys are: "require", "exports" and "module"
         * @param callback if callback is a function, it will be called with the resolved dependencies. if callback is an object, it will be considered as the exports of the module.
         */
        defineModule(strModuleId: string, dependencies: string[], callback: any, errorback: ((err: AnnotatedError) => void) | null | undefined, stack: string | null, moduleIdResolver?: ModuleIdResolver): void;
        private _normalizeDependency;
        private _normalizeDependencies;
        private _relativeRequire;
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
        private _onLoad;
        private _createLoadError;
        /**
         * Callback from the scriptLoader when a module hasn't been loaded.
         * This means that the script was not found (e.g. 404) or there was an error in the script.
         */
        private _onLoadError;
        /**
         * Walks (recursively) the dependencies of 'from' in search of 'to'.
         * Returns true if there is such a path or false otherwise.
         * @param from Module id to start at
         * @param to Module id to look for
         */
        private _hasDependencyPath;
        /**
         * Walks (recursively) the dependencies of 'from' in search of 'to'.
         * Returns cycle as array.
         * @param from Module id to start at
         * @param to Module id to look for
         */
        private _findCyclePath;
        /**
         * Create the local 'require' that is passed into modules
         */
        private _createRequire;
        private _loadModule;
        /**
         * Resolve a plugin dependency with the plugin loaded & complete
         * @param module The module that has this dependency
         * @param pluginDependency The semi-normalized dependency that appears in the module. e.g. 'vs/css!./mycssfile'. Only the plugin part (before !) is normalized
         * @param plugin The plugin (what the plugin exports)
         */
        private _loadPluginDependency;
        /**
         * Examine the dependencies of module 'module' and resolve them as needed.
         */
        private _resolve;
        private _onModuleComplete;
    }
}
declare var doNotInitLoader: any;
declare var define: any;
declare namespace AMDLoader {
    function init(): void;
}
