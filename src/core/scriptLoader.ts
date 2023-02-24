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

	// class LazyScriptLoader implements IScriptLoader {
	// 	constructor() {

	// 	}

	// 	public load(moduleManager: IModuleManager, scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void): void {

	// 	}
	// }

	interface IScriptCallbacks {
		callback: () => void;
		errorback: (err: any) => void;
	}

	/**
	 * Load `scriptSrc` only once (avoid multiple <script> tags)
	 */
	class OnlyOnceScriptLoader implements IScriptLoader {

		private readonly _env: Environment;
		private _scriptLoader: IScriptLoader | null;
		private readonly _callbackMap: { [scriptSrc: string]: IScriptCallbacks[]; };

		constructor(env: Environment) {
			this._env = env;
			this._scriptLoader = null;
			this._callbackMap = {};
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			if (!this._scriptLoader) {
				if (this._env.isWebWorker) {
					this._scriptLoader = new WorkerScriptLoader();
				} else if (this._env.isElectronRenderer) {
					const { preferScriptTags } = moduleManager.getConfig().getOptionsLiteral();
					if (preferScriptTags) {
						this._scriptLoader = new BrowserScriptLoader();
					} else {
						this._scriptLoader = new NodeScriptLoader(this._env);
					}
				} else if (this._env.isNode) {
					this._scriptLoader = new NodeScriptLoader(this._env);
				} else {
					this._scriptLoader = new BrowserScriptLoader();
				}
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
		 * Implemented for browsers supporting HTML5 standard 'load' and 'error' events.
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
			if (/^node\|/.test(scriptSrc)) {
				let opts = moduleManager.getConfig().getOptionsLiteral();
				let nodeRequire = ensureRecordedNodeRequire(moduleManager.getRecorder(), (opts.nodeRequire || globalThis.nodeRequire));
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
				let script = document.createElement('script');
				script.setAttribute('async', 'async');
				script.setAttribute('type', 'text/javascript');

				this.attachListeners(script, callback, errorback);

				const { trustedTypesPolicy } = moduleManager.getConfig().getOptionsLiteral();
				if (trustedTypesPolicy) {
					scriptSrc = trustedTypesPolicy.createScriptURL(scriptSrc);
				}
				script.setAttribute('src', scriptSrc);

				// Propagate CSP nonce to dynamically created script tag.
				const { cspNonce } = moduleManager.getConfig().getOptionsLiteral();
				if (cspNonce) {
					script.setAttribute('nonce', cspNonce);
				}

				document.getElementsByTagName('head')[0].appendChild(script);
			}
		}
	}

	function canUseEval(moduleManager: IModuleManager): boolean {
		const { trustedTypesPolicy } = moduleManager.getConfig().getOptionsLiteral();
		try {
			const func = (
				trustedTypesPolicy
					? globalThis.eval(trustedTypesPolicy.createScript('', 'true'))
					: new Function('true')
			);
			func.call(globalThis);
			return true;
		} catch (err) {
			return false;
		}
	}

	class WorkerScriptLoader implements IScriptLoader {

		private _cachedCanUseEval: boolean | null = null;

		private _canUseEval(moduleManager: IModuleManager): boolean {
			if (this._cachedCanUseEval === null) {
				this._cachedCanUseEval = canUseEval(moduleManager);
			}
			return this._cachedCanUseEval;
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {

			if (/^node\|/.test(scriptSrc)) {

				const opts = moduleManager.getConfig().getOptionsLiteral();
				const nodeRequire = ensureRecordedNodeRequire(moduleManager.getRecorder(), (opts.nodeRequire || globalThis.nodeRequire));
				const pieces = scriptSrc.split('|');
				let moduleExports = null;
				try {
					moduleExports = nodeRequire(pieces[1]);
				}
				catch (err) {
					errorback(err);
					return;
				}
				moduleManager.enqueueDefineAnonymousModule([], function () { return moduleExports; });
				callback();

			} else {

				const { trustedTypesPolicy } = moduleManager.getConfig().getOptionsLiteral();

				const isCrossOrigin = (/^((http:)|(https:)|(file:))/.test(scriptSrc) && scriptSrc.substring(0, globalThis.origin.length) !== globalThis.origin);
				if (!isCrossOrigin && this._canUseEval(moduleManager)) {
					// use `fetch` if possible because `importScripts`
					// is synchronous and can lead to deadlocks on Safari
					fetch(scriptSrc).then((response) => {
						if (response.status !== 200) {
							throw new Error(response.statusText);
						}
						return response.text();
					}).then((text) => {
						text = `${text}\n//# sourceURL=${scriptSrc}`;
						const func = (
							trustedTypesPolicy
								? globalThis.eval(trustedTypesPolicy.createScript('', text))
								: new Function(text)
						);
						func.call(globalThis);
						callback();
					}).then(undefined, errorback);
					return;
				}

				try {
					if (trustedTypesPolicy) {
						scriptSrc = trustedTypesPolicy.createScriptURL(scriptSrc);
					}
					importScripts(scriptSrc);
					callback();
				}
				catch (e) {
					errorback(e);
				}
			}
		}
	}

	declare class Buffer {
		static from(value: string, encoding?: string): Buffer;
		static allocUnsafe(size: number): Buffer;
		static concat(buffers: Buffer[], totalLength?: number): Buffer;
		length: number;
		writeInt32BE(value: number, offset: number);
		readInt32BE(offset: number);
		slice(start?: number, end?: number): Buffer;
		equals(b: Buffer): boolean;
		toString(): string;
	}

	interface INodeFS {
		readFile(filename: string, options: { encoding?: string; flag?: string }, callback: (err: any, data: any) => void): void;
		readFile(filename: string, callback: (err: any, data: Buffer) => void): void;
		readFileSync(filename: string): Buffer;
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
		digest(): Buffer;
	}
	interface INodeCrypto {
		createHash(type: string): INodeCryptoHash;
	}

	class NodeScriptLoader implements IScriptLoader {

		private static _BOM = 0xFEFF;
		private static _PREFIX = '(function (require, define, __filename, __dirname) { ';
		private static _SUFFIX = '\n});';

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

		private _init(nodeRequire: (nodeModule: string) => any): void {
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
		private _initNodeRequire(nodeRequire: (nodeModule: string) => any, moduleManager: IModuleManager): void {
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
				require.resolve = function resolve(request, options) {
					return Module._resolveFilename(request, mod, false, options);
				};
				require.resolve.paths = function paths(request) {
					return Module._resolveLookupPaths(request, mod);
				};
				require.main = process.mainModule;
				require.extensions = Module._extensions;
				require.cache = Module._cache;
				return require;
			}

			Module.prototype._compile = function (content: string, filename: string) {
				// remove shebang and create wrapper function
				const scriptSource = Module.wrap(content.replace(/^#!.*/, ''));

				// create script
				const recorder = moduleManager.getRecorder();
				const cachedDataPath = that._getCachedDataPath(nodeCachedData, filename);
				const options: INodeVMScriptOptions = { filename };
				let hashData: Buffer | undefined;
				try {
					const data = that._fs.readFileSync(cachedDataPath);
					hashData = data.slice(0, 16);
					options.cachedData = data.slice(16);
					recorder.record(LoaderEventType.CachedDataFound, cachedDataPath);
				} catch (_e) {
					recorder.record(LoaderEventType.CachedDataMissed, cachedDataPath);
				}
				const script = new that._vm.Script(scriptSource, options);
				const compileWrapper = script.runInThisContext(options);

				// run script
				const dirname = that._path.dirname(filename);
				const require = makeRequireFunction(this);
				const args = [this.exports, require, this, filename, dirname, process, globalThis, Buffer];
				const result = compileWrapper.apply(this.exports, args);

				// cached data aftermath
				that._handleCachedData(script, scriptSource, cachedDataPath, !options.cachedData, moduleManager);
				that._verifyCachedData(script, scriptSource, cachedDataPath!, hashData, moduleManager);

				return result;
			}
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			const opts = moduleManager.getConfig().getOptionsLiteral();
			const nodeRequire = ensureRecordedNodeRequire(moduleManager.getRecorder(), (opts.nodeRequire || globalThis.nodeRequire));
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
				const normalizedScriptSrc = this._path.normalize(scriptSrc);
				const vmScriptPathOrUri = this._getElectronRendererScriptPathOrUri(normalizedScriptSrc);
				const wantsCachedData = Boolean(opts.nodeCachedData);
				const cachedDataPath = wantsCachedData ? this._getCachedDataPath(opts.nodeCachedData!, scriptSrc) : undefined;

				this._readSourceAndCachedData(normalizedScriptSrc, cachedDataPath, recorder, (err: any, data: string, cachedData: Buffer, hashData: Buffer) => {
					if (err) {
						errorback(err);
						return;
					}

					let scriptSource: string;
					if (data.charCodeAt(0) === NodeScriptLoader._BOM) {
						scriptSource = NodeScriptLoader._PREFIX + data.substring(1) + NodeScriptLoader._SUFFIX;
					} else {
						scriptSource = NodeScriptLoader._PREFIX + data + NodeScriptLoader._SUFFIX;
					}

					scriptSource = nodeInstrumenter(scriptSource, normalizedScriptSrc);
					const scriptOpts: INodeVMScriptOptions = { filename: vmScriptPathOrUri, cachedData };
					const script = this._createAndEvalScript(moduleManager, scriptSource, scriptOpts, callback, errorback);

					this._handleCachedData(script, scriptSource, cachedDataPath!, wantsCachedData && !cachedData, moduleManager);
					this._verifyCachedData(script, scriptSource, cachedDataPath!, hashData, moduleManager);
				});
			}
		}

		private _createAndEvalScript(moduleManager: IModuleManager, contents: string, options: INodeVMScriptOptions, callback: () => void, errorback: (err: any) => void): INodeVMScript {
			const recorder = moduleManager.getRecorder();
			recorder.record(LoaderEventType.NodeBeginEvaluatingScript, options.filename);

			const script = new this._vm.Script(contents, options);
			const ret = script.runInThisContext(options);

			const globalDefineFunc = moduleManager.getGlobalAMDDefineFunc();
			let receivedDefineCall = false;
			const localDefineFunc: IDefineFunc = <any>function () {
				receivedDefineCall = true;
				return globalDefineFunc.apply(null, arguments);
			};
			localDefineFunc.amd = globalDefineFunc.amd;

			ret.call(globalThis, moduleManager.getGlobalAMDRequireFunc(), localDefineFunc, options.filename, this._path.dirname(options.filename));

			recorder.record(LoaderEventType.NodeEndEvaluatingScript, options.filename);

			if (receivedDefineCall) {
				callback();
			} else {
				errorback(new Error(`Didn't receive define call in ${options.filename}!`));
			}

			return script;
		}

		private _getElectronRendererScriptPathOrUri(path: string) {
			if (!this._env.isElectronRenderer) {
				return path;
			}
			let driveLetterMatch = path.match(/^([a-z])\:(.*)/i);
			if (driveLetterMatch) {
				// windows
				return `file:///${(driveLetterMatch[1].toUpperCase() + ':' + driveLetterMatch[2]).replace(/\\/g, '/')}`;
			} else {
				// nix
				return `file://${path}`;
			}
		}

		private _getCachedDataPath(config: INodeCachedDataConfiguration, filename: string): string {
			const hash = this._crypto.createHash('md5').update(filename, 'utf8').update(config.seed!, 'utf8').update(process.arch, '').digest('hex');
			const basename = this._path.basename(filename).replace(/\.js$/, '');
			return this._path.join(config.path, `${basename}-${hash}.code`);
		}

		private _handleCachedData(script: INodeVMScript, scriptSource: string, cachedDataPath: string, createCachedData: boolean, moduleManager: IModuleManager): void {
			if (script.cachedDataRejected) {
				// cached data got rejected -> delete and re-create
				this._fs.unlink(cachedDataPath, err => {
					moduleManager.getRecorder().record(LoaderEventType.CachedDataRejected, cachedDataPath);
					this._createAndWriteCachedData(script, scriptSource, cachedDataPath, moduleManager);
					if (err) {
						moduleManager.getConfig().onError(err)
					}
				});
			} else if (createCachedData) {
				// no cached data, but wanted
				this._createAndWriteCachedData(script, scriptSource, cachedDataPath, moduleManager);
			}
		}

		// Cached data format: | SOURCE_HASH | V8_CACHED_DATA |
		// -SOURCE_HASH is the md5 hash of the JS source (always 16 bytes)
		// -V8_CACHED_DATA is what v8 produces

		private _createAndWriteCachedData(script: INodeVMScript, scriptSource: string, cachedDataPath: string, moduleManager: IModuleManager): void {

			let timeout: number = Math.ceil(moduleManager.getConfig().getOptionsLiteral().nodeCachedData!.writeDelay! * (1 + Math.random()));
			let lastSize: number = -1;
			let iteration: number = 0;
			let hashData: Buffer | undefined = undefined;

			const createLoop = () => {
				setTimeout(() => {

					if (!hashData) {
						hashData = this._crypto.createHash('md5').update(scriptSource, 'utf8').digest();
					}

					const cachedData = script.createCachedData();
					if (cachedData.length === 0 || cachedData.length === lastSize || iteration >= 5) {
						// done
						return;
					}

					if (cachedData.length < lastSize) {
						// less data than before: skip, try again next round
						createLoop();
						return;
					}

					lastSize = cachedData.length;
					this._fs.writeFile(cachedDataPath, Buffer.concat([hashData, cachedData]), err => {
						if (err) {
							moduleManager.getConfig().onError(err);
						}
						moduleManager.getRecorder().record(LoaderEventType.CachedDataCreated, cachedDataPath);
						createLoop();
					});
				}, timeout * (4 ** iteration++));
			};

			// with some delay (`timeout`) create cached data
			// and repeat that (with backoff delay) until the
			// data seems to be not changing anymore
			createLoop();
		}

		private _readSourceAndCachedData(sourcePath: string, cachedDataPath: string | undefined, recorder: ILoaderEventRecorder, callback: (err?: any, source?: string, cachedData?: Buffer, hashData?: Buffer) => any): void {

			if (!cachedDataPath) {
				// no cached data case
				this._fs.readFile(sourcePath, { encoding: 'utf8' }, callback);

			} else {
				// cached data case: read both files in parallel
				let source: string | undefined = undefined;
				let cachedData: Buffer | undefined = undefined;
				let hashData: Buffer | undefined = undefined;
				let steps = 2;

				const step = (err?: any) => {
					if (err) {
						callback(err);

					} else if (--steps === 0) {
						callback(undefined, source, cachedData, hashData);
					}
				}

				this._fs.readFile(sourcePath, { encoding: 'utf8' }, (err: any, data: string) => {
					source = data;
					step(err);
				});

				this._fs.readFile(cachedDataPath, (err: any, data: Buffer) => {
					if (!err && data && data.length > 0) {
						hashData = data.slice(0, 16);
						cachedData = data.slice(16);
						recorder.record(LoaderEventType.CachedDataFound, cachedDataPath);

					} else {
						recorder.record(LoaderEventType.CachedDataMissed, cachedDataPath);
					}
					step(); // ignored: cached data is optional
				});
			}
		}

		private _verifyCachedData(script: INodeVMScript, scriptSource: string, cachedDataPath: string, hashData: Buffer | undefined, moduleManager: IModuleManager): void {
			if (!hashData) {
				// nothing to do
				return;
			}
			if (script.cachedDataRejected) {
				// invalid anyways
				return;
			}
			setTimeout(() => {
				// check source hash - the contract is that file paths change when file content
				// change (e.g use the commit or version id as cache path). this check is
				// for violations of this contract.
				const hashDataNow = this._crypto.createHash('md5').update(scriptSource, 'utf8').digest();
				if (!hashData.equals(hashDataNow)) {
					moduleManager.getConfig().onError(<any>new Error(`FAILED TO VERIFY CACHED DATA, deleting stale '${cachedDataPath}' now, but a RESTART IS REQUIRED`));
					this._fs.unlink(cachedDataPath!, err => {
						if (err) {
							moduleManager.getConfig().onError(err);
						}
					});
				}

			}, Math.ceil(5000 * (1 + Math.random())));
		}
	}

	export function ensureRecordedNodeRequire(recorder: ILoaderEventRecorder, _nodeRequire: (nodeModule: string) => any): (nodeModule: string) => any {
		if ((<any>_nodeRequire).__$__isRecorded) {
			// it is already recorded
			return _nodeRequire;
		}

		const nodeRequire = function nodeRequire(what) {
			recorder.record(LoaderEventType.NodeBeginNativeRequire, what);
			try {
				return _nodeRequire(what);
			} finally {
				recorder.record(LoaderEventType.NodeEndNativeRequire, what);
			}
		};
		(<any>nodeRequire).__$__isRecorded = true;
		return nodeRequire;
	}

	export function createScriptLoader(env: Environment): IScriptLoader {
		return new OnlyOnceScriptLoader(env);
	}
}
