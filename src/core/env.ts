/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 * Please make sure to make edits in the .ts file at https://github.com/microsoft/vscode-loader/
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *---------------------------------------------------------------------------------------------
 *--------------------------------------------------------------------------------------------*/

const _amdLoaderGlobal = this;

declare var module: {
	exports: any;
};
declare var process: {
	platform: string;
	type: string;
	mainModule: string;
	arch: string
	argv: string[];
	versions: {
		node: string;
		electron: string;
	}
};
declare var require: {
	nodeRequire(module: string): any;
};
declare var global: object;
const _commonjsGlobal = typeof global === 'object' ? global : {};

namespace AMDLoader {
	export const global: any = _amdLoaderGlobal

	export class Environment {

		private _detected: boolean;
		private _isWindows: boolean;
		private _isNode: boolean;
		private _isElectronRenderer: boolean;
		private _isWebWorker: boolean;
		private _isElectronNodeIntegrationWebWorker;

		public get isWindows(): boolean {
			this._detect();
			return this._isWindows;
		}
		public get isNode(): boolean {
			this._detect();
			return this._isNode;
		}
		public get isElectronRenderer(): boolean {
			this._detect();
			return this._isElectronRenderer;
		}
		public get isWebWorker(): boolean {
			this._detect();
			return this._isWebWorker;
		}
		public get isElectronNodeIntegrationWebWorker(): boolean {
			this._detect();
			return this._isElectronNodeIntegrationWebWorker;
		}

		constructor() {
			this._detected = false;
			this._isWindows = false;
			this._isNode = false;
			this._isElectronRenderer = false;
			this._isWebWorker = false;
			this._isElectronNodeIntegrationWebWorker = false;
		}

		private _detect(): void {
			if (this._detected) {
				return;
			}
			this._detected = true;
			this._isWindows = Environment._isWindows();
			this._isNode = (typeof module !== 'undefined' && !!module.exports);
			this._isElectronRenderer = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined' && process.type === 'renderer');
			this._isWebWorker = (typeof global.importScripts === 'function');
			this._isElectronNodeIntegrationWebWorker = this._isWebWorker && (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined' && process.type === 'worker');
		}

		private static _isWindows(): boolean {
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
	}
}
