/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export interface IModuleManager {
		getGlobalAMDDefineFunc(): IDefineFunc;
		getGlobalAMDRequireFunc(): IRequireFunc;
		getConfig(): Configuration;
		enqueueDefineAnonymousModule(dependencies: string[], callback: any): void;
		getRecorder(): ILoaderEventRecorder;
	}

	export interface IScriptLoader {
		load(moduleManager: IModuleManager, scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void): void;
	}

	// ------------------------------------------------------------------------
	// IScriptLoader(s)

	interface IScriptCallbacks {
		callback: () => void;
		errorback: (err: any) => void;
	}

	/**
	 * Load `scriptSrc` only once (avoid multiple <script> tags)
	 */
	class OnlyOnceScriptLoader implements IScriptLoader {

		private readonly _env: Environment;
		private _scriptLoader: IScriptLoader;
		private readonly _callbackMap: { [scriptSrc: string]: IScriptCallbacks[]; };

		constructor(env: Environment) {
			this._env = env;
			this._scriptLoader = null;
			this._callbackMap = {};
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			if (!this._scriptLoader) {
				this._scriptLoader = (
					this._env.isWebWorker
						? new WorkerScriptLoader()
						: this._env.isNode
							? new NodeScriptLoader(this._env)
							: new BrowserScriptLoader()
				);
			}
			let scriptCallbacks: IScriptCallbacks = {
				callback: callback,
				errorback: errorback
			};
			if (this._callbackMap.hasOwnProperty(scriptSrc)) {
				this._callbackMap[scriptSrc].push(scriptCallbacks);
				return;
			}
			this._callbackMap[scriptSrc] = [scriptCallbacks];
			this._scriptLoader.load(moduleManager, scriptSrc, () => this.triggerCallback(scriptSrc), (err: any) => this.triggerErrorback(scriptSrc, err));
		}

		private triggerCallback(scriptSrc: string): void {
			let scriptCallbacks = this._callbackMap[scriptSrc];
			delete this._callbackMap[scriptSrc];

			for (let i = 0; i < scriptCallbacks.length; i++) {
				scriptCallbacks[i].callback();
			}
		}

		private triggerErrorback(scriptSrc: string, err: any): void {
			let scriptCallbacks = this._callbackMap[scriptSrc];
			delete this._callbackMap[scriptSrc];

			for (let i = 0; i < scriptCallbacks.length; i++) {
				scriptCallbacks[i].errorback(err);
			}
		}
	}

	class BrowserScriptLoader implements IScriptLoader {

		/**
		 * Attach load / error listeners to a script element and remove them when either one has fired.
		 * Implemented for browssers supporting HTML5 standard 'load' and 'error' events.
		 */
		private attachListeners(script: HTMLScriptElement, callback: () => void, errorback: (err: any) => void): void {
			let unbind = () => {
				script.removeEventListener('load', loadEventListener);
				script.removeEventListener('error', errorEventListener);
			};

			let loadEventListener = (e: any) => {
				unbind();
				callback();
			};

			let errorEventListener = (e: any) => {
				unbind();
				errorback(e);
			};

			script.addEventListener('load', loadEventListener);
			script.addEventListener('error', errorEventListener);
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			let script = document.createElement('script');
			script.setAttribute('async', 'async');
			script.setAttribute('type', 'text/javascript');

			this.attachListeners(script, callback, errorback);

			script.setAttribute('src', scriptSrc);

			// Propagate CSP nonce to dynamically created script tag.
			const { cspNonce } = moduleManager.getConfig().getOptionsLiteral();
			if (cspNonce) {
				script.setAttribute('nonce', cspNonce);
			}

			document.getElementsByTagName('head')[0].appendChild(script);
		}
	}

	class WorkerScriptLoader implements IScriptLoader {

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			try {
				importScripts(scriptSrc);
				callback();
			} catch (e) {
				errorback(e);
			}
		}
	}

	declare class Buffer {
		length: number;
	}

	interface INodeFS {
		readFile(filename: string, options: { encoding?: string; flag?: string }, callback: (err: any, data: any) => void): void;
		readFile(filename: string, callback: (err: any, data: Buffer) => void): void;
		readFileSync(filename: string): string;
		writeFile(filename: string, data: Buffer, callback: (err: any) => void): void;
		unlink(path: string, callback: (err: any) => void): void;
	}

	interface INodeVMScriptOptions {
		filename: string;
		cachedData?: Buffer;
	}

	interface INodeVMScript {
		cachedData: Buffer;
		cachedDataProduced: boolean;
		cachedDataRejected: boolean;
		runInThisContext(options: INodeVMScriptOptions);
		createCachedData(): Buffer;
	}

	interface INodeVM {
		Script: { new(contents: string, options?: INodeVMScriptOptions): INodeVMScript }
		runInThisContext(contents: string, { filename: string });
		runInThisContext(contents: string, filename: string);
	}

	interface INodePath {
		dirname(filename: string): string;
		normalize(filename: string): string;
		basename(filename: string): string;
		join(...parts: string[]): string;
	}

	interface INodeCryptoHash {
		update(str: string, encoding: string): INodeCryptoHash;
		digest(type: string): string;
	}
	interface INodeCrypto {
		createHash(type: string): INodeCryptoHash;
	}

	class NodeScriptLoader implements IScriptLoader {

		private static _BOM = 0xFEFF;

		private readonly _env: Environment;

		private _didPatchNodeRequire: boolean;
		private _didInitialize: boolean;
		private _fs: INodeFS;
		private _vm: INodeVM;
		private _path: INodePath;
		private _crypto: INodeCrypto;

		constructor(env: Environment) {
			this._env = env;
			this._didInitialize = false;
			this._didPatchNodeRequire = false;
		}

		private _init(nodeRequire: INodeRequire): void {
			if (this._didInitialize) {
				return;
			}
			this._didInitialize = true;

			// capture node modules
			this._fs = nodeRequire('fs');
			this._vm = nodeRequire('vm');
			this._path = nodeRequire('path');
			this._crypto = nodeRequire('crypto');
		}

		// patch require-function of nodejs such that we can manually create a script
		// from cached data. this is done by overriding the `Module._compile` function
		private _initNodeRequire(nodeRequire: INodeRequire, moduleManager: IModuleManager): void {
			// It is important to check for `nodeCachedData` first and then set `_didPatchNodeRequire`.
			// That's because `nodeCachedData` is set _after_ calling this for the first time...
			const { nodeCachedData } = moduleManager.getConfig().getOptionsLiteral();
			if (!nodeCachedData) {
				return;
			}
			if (this._didPatchNodeRequire) {
				return;
			}
			this._didPatchNodeRequire = true;

			const that = this
			const Module = nodeRequire('module');

			function makeRequireFunction(mod: any) {
				const Module = mod.constructor;
				let require = <any>function require(path) {
					try {
						return mod.require(path);
					} finally {
						// nothing
					}
				}
				require.resolve = function resolve(request) {
					return Module._resolveFilename(request, mod);
				};
				require.main = process.mainModule;
				require.extensions = Module._extensions;
				require.cache = Module._cache;
				return require;
			}

			Module.prototype._compile = function (content: string, filename: string) {
				// remove shebang
				content = content.replace(/^#!.*/, '')

				// create wrapper function
				const wrapper = Module.wrap(content);

				const cachedDataPath = that._getCachedDataPath(nodeCachedData, filename);
				const options: INodeVMScriptOptions = { filename };
				try {
					options.cachedData = that._fs.readFileSync(cachedDataPath)
				} catch (e) {
					// ignore
				}
				const script = new that._vm.Script(wrapper, options);
				const compileWrapper = script.runInThisContext(options);

				const dirname = that._path.dirname(filename);
				const require = makeRequireFunction(this);
				const args = [this.exports, require, this, filename, dirname, process, _commonjsGlobal, Buffer];
				const result = compileWrapper.apply(this.exports, args);

				that._processCachedData(script, cachedDataPath, Boolean(options.cachedData), moduleManager.getConfig(), moduleManager.getRecorder());
				return result;
			}
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			const opts = moduleManager.getConfig().getOptionsLiteral();
			const nodeRequire = (opts.nodeRequire || global.nodeRequire);
			const nodeInstrumenter = (opts.nodeInstrumenter || function (c) { return c; });
			this._init(nodeRequire);
			this._initNodeRequire(nodeRequire, moduleManager);
			let recorder = moduleManager.getRecorder();

			if (/^node\|/.test(scriptSrc)) {

				let pieces = scriptSrc.split('|');

				let moduleExports = null;
				try {
					moduleExports = nodeRequire(pieces[1]);
				} catch (err) {
					errorback(err);
					return;
				}

				moduleManager.enqueueDefineAnonymousModule([], () => moduleExports);
				callback();

			} else {

				scriptSrc = Utilities.fileUriToFilePath(this._env.isWindows, scriptSrc);

				this._fs.readFile(scriptSrc, { encoding: 'utf8' }, (err, data: string) => {
					if (err) {
						errorback(err);
						return;
					}

					let normalizedScriptSrc = this._path.normalize(scriptSrc);
					let vmScriptSrc = normalizedScriptSrc;
					// Make the script src friendly towards electron
					if (this._env.isElectronRenderer) {
						let driveLetterMatch = vmScriptSrc.match(/^([a-z])\:(.*)/i);
						if (driveLetterMatch) {
							// windows
							vmScriptSrc = `file:///${(driveLetterMatch[1].toUpperCase() + ':' + driveLetterMatch[2]).replace(/\\/g, '/')}`;
						} else {
							// nix
							vmScriptSrc = `file://${vmScriptSrc}`;
						}
					}

					let contents: string,
						prefix = '(function (require, define, __filename, __dirname) { ',
						suffix = '\n});';

					if (data.charCodeAt(0) === NodeScriptLoader._BOM) {
						contents = prefix + data.substring(1) + suffix;
					} else {
						contents = prefix + data + suffix;
					}

					contents = nodeInstrumenter(contents, normalizedScriptSrc);

					if (!opts.nodeCachedData) {

						this._loadAndEvalScript(moduleManager, scriptSrc, vmScriptSrc, contents, { filename: vmScriptSrc }, recorder, callback, errorback);

					} else {

						const cachedDataPath = this._getCachedDataPath(opts.nodeCachedData, scriptSrc);
						this._fs.readFile(cachedDataPath, (_err, cachedData) => {
							// create script options
							const options: INodeVMScriptOptions = {
								filename: vmScriptSrc,
								cachedData
							};
							recorder.record(cachedData ? LoaderEventType.CachedDataFound : LoaderEventType.CachedDataMissed, scriptSrc);
							const script = this._loadAndEvalScript(moduleManager, scriptSrc, vmScriptSrc, contents, options, recorder, callback, errorback);
							this._processCachedData(script, cachedDataPath, Boolean(cachedData), moduleManager.getConfig(), recorder);
						});
					}
				});
			}
		}

		private _loadAndEvalScript(moduleManager: IModuleManager, scriptSrc: string, vmScriptSrc: string, contents: string, options: INodeVMScriptOptions, recorder: ILoaderEventRecorder, callback: () => void, errorback: (err: any) => void): INodeVMScript {

			// create script, run script
			recorder.record(LoaderEventType.NodeBeginEvaluatingScript, scriptSrc);

			const script = new this._vm.Script(contents, options);

			const r = script.runInThisContext(options);

			const globalDefineFunc = moduleManager.getGlobalAMDDefineFunc();
			let receivedDefineCall = false;
			const localDefineFunc: IDefineFunc = <any>function () {
				receivedDefineCall = true;
				return globalDefineFunc.apply(null, arguments);
			};
			localDefineFunc.amd = globalDefineFunc.amd;

			r.call(global, moduleManager.getGlobalAMDRequireFunc(), localDefineFunc, vmScriptSrc, this._path.dirname(scriptSrc));

			// signal done
			recorder.record(LoaderEventType.NodeEndEvaluatingScript, scriptSrc);

			if (receivedDefineCall) {
				callback();
			} else {
				errorback(new Error(`Didn't receive define call in ${scriptSrc}!`));
			}

			return script;
		}

		private _getCachedDataPath(config: INodeCachedDataConfiguration, filename: string): string {
			const hash = this._crypto.createHash('md5').update(filename, 'utf8').update(config.seed, 'utf8').digest('hex');
			const basename = this._path.basename(filename).replace(/\.js$/, '');
			return this._path.join(config.path, `${basename}-${hash}.code`);
		}

		private _processCachedData(script: INodeVMScript, cachedDataPath: string, hadCachedData: boolean, config: Configuration, recorder: ILoaderEventRecorder): void {
			if (script.cachedDataRejected) {
				// rejected cached data
				// (1) delete data
				// (2) create new data
				recorder.record(LoaderEventType.CachedDataRejected, cachedDataPath);
				this._fs.unlink(cachedDataPath, err => {
					if (err) {
						config.onError(err);
					}
					this._createCachedData(script, cachedDataPath, config, recorder);
				});

			} else if (!hadCachedData) {
				// create cached data unless we already had
				// and accepted cached data
				this._createCachedData(script, cachedDataPath, config, recorder);
			}
		}

		private _createCachedData(script: INodeVMScript, cachedDataPath: string, config: Configuration, recorder: ILoaderEventRecorder): void {

			let timeout = Math.ceil(config.getOptionsLiteral().nodeCachedData.writeDelay * (1 + Math.random()));
			let lastSize: number = -1;
			let iteration = 0;

			const createLoop = () => {
				setTimeout(() => {
					const data = script.createCachedData();
					if (data.length === lastSize) {
						return;
					}
					lastSize = data.length;
					this._fs.writeFile(cachedDataPath, data, err => {
						if (err) {
							config.onError(err);
						}
						recorder.record(LoaderEventType.CachedDataCreated, cachedDataPath);
						createLoop();
					});

				}, timeout * (4 ** iteration++));
			};

			// with some delay (`timeout`) create cached data
			// and repeat that (with backoff delay) until the
			// data seems to be not changing anymore
			createLoop();
		}
	}

	export function createScriptLoader(env: Environment): IScriptLoader {
		return new OnlyOnceScriptLoader(env);
	}
}
