/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export interface IModuleManager {
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

		private actualScriptLoader: IScriptLoader;
		private callbackMap: { [scriptSrc: string]: IScriptCallbacks[]; };

		constructor(actualScriptLoader: IScriptLoader) {
			this.actualScriptLoader = actualScriptLoader;
			this.callbackMap = {};
		}

		public load(moduleManager: IModuleManager, scriptSrc: string, callback: () => void, errorback: (err: any) => void): void {
			let scriptCallbacks: IScriptCallbacks = {
				callback: callback,
				errorback: errorback
			};
			if (this.callbackMap.hasOwnProperty(scriptSrc)) {
				this.callbackMap[scriptSrc].push(scriptCallbacks);
				return;
			}
			this.callbackMap[scriptSrc] = [scriptCallbacks];
			this.actualScriptLoader.load(moduleManager, scriptSrc, () => this.triggerCallback(scriptSrc), (err: any) => this.triggerErrorback(scriptSrc, err));
		}

		private triggerCallback(scriptSrc: string): void {
			let scriptCallbacks = this.callbackMap[scriptSrc];
			delete this.callbackMap[scriptSrc];

			for (let i = 0; i < scriptCallbacks.length; i++) {
				scriptCallbacks[i].callback();
			}
		}

		private triggerErrorback(scriptSrc: string, err: any): void {
			let scriptCallbacks = this.callbackMap[scriptSrc];
			delete this.callbackMap[scriptSrc];

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
		produceCachedData?: boolean;
		cachedData?: Buffer;
	}

	interface INodeVMScript {
		cachedData: Buffer;
		cachedDataProduced: boolean;
		cachedDataRejected: boolean;
		runInThisContext(options: INodeVMScriptOptions);
	}

	interface INodeVM {
		Script: { new (contents: string, options: INodeVMScriptOptions): INodeVMScript }
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
		private _jsflags: string;
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

			// js-flags have an impact on cached data
			this._jsflags = '';
			for (const arg of process.argv) {
				if (arg.indexOf('--js-flags=') === 0) {
					this._jsflags = arg;
					break;
				}
			}
		}

		// patch require-function of nodejs such that we can manually create a script
		// from cached data. this is done by overriding the `Module._compile` function
		private _initNodeRequire(nodeRequire: INodeRequire, moduleManager: IModuleManager): void {

			const {nodeCachedDataDir} = moduleManager.getConfig().getOptionsLiteral();
			if (!nodeCachedDataDir || this._didPatchNodeRequire) {
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

				const cachedDataPath = that._getCachedDataPath(nodeCachedDataDir, filename);
				const options: INodeVMScriptOptions = { filename };
				try {
					options.cachedData = that._fs.readFileSync(cachedDataPath)
				} catch (e) {
					options.produceCachedData = true;
				}
				const script = new that._vm.Script(wrapper, options);
				const compileWrapper = script.runInThisContext(options);

				const dirname = that._path.dirname(filename);
				const require = makeRequireFunction(this);
				const args = [this.exports, require, this, filename, dirname, process, global, Buffer];
				const result = compileWrapper.apply(this.exports, args);

				that._processCachedData(moduleManager, script, cachedDataPath);
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
					if (isElectronRenderer) {
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

					if (!opts.nodeCachedDataDir) {

						this._loadAndEvalScript(scriptSrc, vmScriptSrc, contents, { filename: vmScriptSrc }, recorder);
						callback();

					} else {

						const cachedDataPath = this._getCachedDataPath(opts.nodeCachedDataDir, scriptSrc);
						this._fs.readFile(cachedDataPath, (err, cachedData) => {
							// create script options
							const options: INodeVMScriptOptions = {
								filename: vmScriptSrc,
								produceCachedData: typeof cachedData === 'undefined',
								cachedData
							};
							const script = this._loadAndEvalScript(scriptSrc, vmScriptSrc, contents, options, recorder);
							callback();
							this._processCachedData(moduleManager, script, cachedDataPath);
						});
					}
				});
			}
		}

		private _loadAndEvalScript(scriptSrc: string, vmScriptSrc: string, contents: string, options: INodeVMScriptOptions, recorder: ILoaderEventRecorder): INodeVMScript {

			// create script, run script
			recorder.record(LoaderEventType.NodeBeginEvaluatingScript, scriptSrc);

			const script = new this._vm.Script(contents, options);

			const r = script.runInThisContext(options);
			r.call(global, RequireFunc, DefineFunc, vmScriptSrc, this._path.dirname(scriptSrc));

			// signal done
			recorder.record(LoaderEventType.NodeEndEvaluatingScript, scriptSrc);

			return script;
		}

		private _getCachedDataPath(basedir: string, filename: string): string {
			const hash = this._crypto.createHash('md5').update(filename, 'utf8').update(this._jsflags, 'utf8').digest('hex');
			const basename = this._path.basename(filename).replace(/\.js$/, '');
			return this._path.join(basedir, `${basename}-${hash}.code`);
		}

		private _processCachedData(moduleManager: IModuleManager, script: INodeVMScript, cachedDataPath: string): void {

			if (script.cachedDataRejected) {
				// data rejected => delete cache file
				moduleManager.getConfig().getOptionsLiteral().onNodeCachedData({
					errorCode: 'cachedDataRejected',
					path: cachedDataPath
				});

				NodeScriptLoader._runSoon(() => this._fs.unlink(cachedDataPath, err => {
					if (err) {
						moduleManager.getConfig().getOptionsLiteral().onNodeCachedData({
							errorCode: 'unlink',
							path: cachedDataPath,
							detail: err
						});
					}
				}), moduleManager.getConfig().getOptionsLiteral().nodeCachedDataWriteDelay);

			} else if (script.cachedDataProduced) {

				// data produced => tell outside world
				moduleManager.getConfig().getOptionsLiteral().onNodeCachedData(undefined, {
					path: cachedDataPath,
					length: script.cachedData.length
				});

				// data produced => write cache file
				NodeScriptLoader._runSoon(() => this._fs.writeFile(cachedDataPath, script.cachedData, err => {
					if (err) {
						moduleManager.getConfig().getOptionsLiteral().onNodeCachedData({
							errorCode: 'writeFile',
							path: cachedDataPath,
							detail: err
						});
					}
				}), moduleManager.getConfig().getOptionsLiteral().nodeCachedDataWriteDelay);
			}
		}

		private static _runSoon(callback: Function, minTimeout: number): void {
			const timeout = minTimeout + Math.ceil(Math.random() * minTimeout);
			setTimeout(callback, timeout);
		}
	}

	export const scriptLoader: IScriptLoader = new OnlyOnceScriptLoader(
		isWebWorker ?
			new WorkerScriptLoader()
			: _env.isNode ?
				new NodeScriptLoader(_env)
				: new BrowserScriptLoader()
	);
}
