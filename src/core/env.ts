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

const _amdLoaderGlobal = this;

declare var module: {
	exports: any;
};
declare var process: {
	platform: string;
	type: string;
	mainModule: string;
	argv: string[];
	versions: {
		node: string;
		electron: string;
	}
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
	// not supported on IE11:
	// entries(): IterableIterator<[K, V]>;
	// keys(): IterableIterator<K>;
	// values(): IterableIterator<V>;
	// [Symbol.iterator]():IterableIterator<[K,V]>;
	// [Symbol.toStringTag]: string;
}
interface MapConstructor {
	new <K, V>(): Map<K, V>;
	prototype: Map<any, any>;
	// not supported on IE11:
	// new <K, V>(iterable: Iterable<[K, V]>): Map<K, V>;
}
declare var Map: MapConstructor;

namespace AMDLoader {
	export const global: any = _amdLoaderGlobal
	export const isNode = (typeof module !== 'undefined' && !!module.exports);
	export const isWindows = (function _isWindows() {
		if (typeof navigator !== 'undefined') {
			if (navigator.userAgent && navigator.userAgent.indexOf('Windows') >= 0) {
				return true;
			}
		}
		if (typeof process !== 'undefined') {
			return (process.platform === 'win32');
		}
		return false;
	})();
	export const isWebWorker = (typeof global.importScripts === 'function');
	export const isElectronRenderer = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined' && process.type === 'renderer');
	export const isElectronMain = (typeof process !== 'undefined' && typeof process.versions !== 'undefined' && typeof process.versions.electron !== 'undefined' && process.type === 'browser');
	export const hasPerformanceNow = (global.performance && typeof global.performance.now === 'function');
}
