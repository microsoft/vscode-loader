/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export class Utilities {
		/**
		 * This method does not take care of / vs \
		 */
		public static fileUriToFilePath(isWindows: boolean, uri: string): string {
			uri = decodeURI(uri).replace(/%23/g, '#');
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

		public static startsWith(haystack: string, needle: string): boolean {
			return haystack.length >= needle.length && haystack.substr(0, needle.length) === needle;
		}

		public static endsWith(haystack: string, needle: string): boolean {
			return haystack.length >= needle.length && haystack.substr(haystack.length - needle.length) === needle;
		}

		// only check for "?" before "#" to ensure that there is a real Query-String
		public static containsQueryString(url: string): boolean {
			return /^[^\#]*\?/gi.test(url);
		}

		/**
		 * Does `url` start with http:// or https:// or file:// or / ?
		 */
		public static isAbsolutePath(url: string): boolean {
			return /^((http:\/\/)|(https:\/\/)|(file:\/\/)|(\/))/.test(url);
		}

		public static forEachProperty(obj: any, callback: (key: string, value: any) => void): void {
			if (obj) {
				let key: string;
				for (key in obj) {
					if (obj.hasOwnProperty(key)) {
						callback(key, obj[key]);
					}
				}
			}
		}

		public static isEmpty(obj: any): boolean {
			let isEmpty = true;
			Utilities.forEachProperty(obj, () => {
				isEmpty = false;
			});
			return isEmpty;
		}

		public static recursiveClone(obj: any): any {
			if (!obj || typeof obj !== 'object') {
				return obj;
			}
			let result = Array.isArray(obj) ? [] : {};
			Utilities.forEachProperty(obj, (key: string, value: any) => {
				if (value && typeof value === 'object') {
					result[key] = Utilities.recursiveClone(value);
				} else {
					result[key] = value;
				}
			});
			return result;
		}


		private static NEXT_ANONYMOUS_ID = 1;

		public static generateAnonymousModule(): string {
			return '===anonymous' + (Utilities.NEXT_ANONYMOUS_ID++) + '===';
		}

		public static isAnonymousModule(id: string): boolean {
			return Utilities.startsWith(id, '===anonymous');
		}

		private static PERFORMANCE_NOW_PROBED = false;
		private static HAS_PERFORMANCE_NOW = false;

		public static getHighPerformanceTimestamp(): number {
			if (!this.PERFORMANCE_NOW_PROBED) {
				this.PERFORMANCE_NOW_PROBED = true;
				this.HAS_PERFORMANCE_NOW = (global.performance && typeof global.performance.now === 'function');
			}
			return (this.HAS_PERFORMANCE_NOW ? global.performance.now() : Date.now());
		}
	}
}
