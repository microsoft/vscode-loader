/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// Limitation: To load jquery through the loader, always require 'jquery' and add a path for it in the loader configuration

var define;

namespace AMDLoader {

	let moduleManager: ModuleManager;
	let loaderAvailableTimestamp: number;

	export class DefineFunc {

		constructor(id: any, dependencies: any, callback: any) {
			if (typeof id !== 'string') {
				callback = dependencies;
				dependencies = id;
				id = null;
			}
			if (typeof dependencies !== 'object' || !Array.isArray(dependencies)) {
				callback = dependencies;
				dependencies = null;
			}
			if (!dependencies) {
				dependencies = ['require', 'exports', 'module'];
			}

			if (id) {
				moduleManager.defineModule(id, dependencies, callback, null, null);
			} else {
				moduleManager.enqueueDefineAnonymousModule(dependencies, callback);
			}
		}

		public static amd = {
			jQuery: true
		};
	}

	export class RequireFunc {

		constructor() {
			if (arguments.length === 1) {
				if ((arguments[0] instanceof Object) && !Array.isArray(arguments[0])) {
					RequireFunc.config(arguments[0]);
					return;
				}
				if (typeof arguments[0] === 'string') {
					return moduleManager.synchronousRequire(arguments[0]);
				}
			}
			if (arguments.length === 2 || arguments.length === 3) {
				if (Array.isArray(arguments[0])) {
					moduleManager.defineModule(Utilities.generateAnonymousModule(), arguments[0], arguments[1], arguments[2], null);
					return;
				}
			}
			throw new Error('Unrecognized require call');
		}

		public static config(params: IConfigurationOptions, shouldOverwrite: boolean = false): void {
			moduleManager.configure(params, shouldOverwrite);
		}

		public static getConfig(): IConfigurationOptions {
			return moduleManager.getConfig().getOptionsLiteral();
		}

		/**
		 * Non standard extension to reset completely the loader state. This is used for running amdjs tests
		 */
		public static reset(): void {
			moduleManager = new ModuleManager(_env, scriptLoader, loaderAvailableTimestamp);
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
	}

	function init(env: Environment): void {
		moduleManager = new ModuleManager(env, scriptLoader, loaderAvailableTimestamp);

		if (env.isNode) {
			var _nodeRequire = (global.require || require);
			var nodeRequire = function (what) {
				moduleManager.getRecorder().record(LoaderEventType.NodeBeginNativeRequire, what);
				try {
					return _nodeRequire(what);
				} finally {
					moduleManager.getRecorder().record(LoaderEventType.NodeEndNativeRequire, what);
				}
			};

			global.nodeRequire = nodeRequire;
			(<any>RequireFunc).nodeRequire = nodeRequire;
		}

		if (env.isNode && !isElectronRenderer) {
			module.exports = RequireFunc;
			// These two defs are fore the local closure defined in node in the case that the loader is concatenated
			define = function () {
				DefineFunc.apply(null, arguments);
			};
			require = <any>RequireFunc;
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
		init(_env);
		loaderAvailableTimestamp = getHighPerformanceTimestamp();
	}

}
