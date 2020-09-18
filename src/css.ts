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

'use strict';

module CSSLoaderPlugin {

	/**
	 * Known issue:
	 * - In IE there is no way to know if the CSS file loaded successfully or not.
	 */
	class BrowserCSSLoader {

		private _pendingLoads: number;

		constructor() {
			this._pendingLoads = 0;
		}

		public attachListeners(name: string, linkNode: HTMLLinkElement, callback: () => void, errorback: (err: any) => void): void {
			var unbind = () => {
				linkNode.removeEventListener('load', loadEventListener);
				linkNode.removeEventListener('error', errorEventListener);
			};

			var loadEventListener = (e: any) => {
				unbind();
				callback();
			};

			var errorEventListener = (e: any) => {
				unbind();
				errorback(e);
			};

			linkNode.addEventListener('load', loadEventListener);
			linkNode.addEventListener('error', errorEventListener);
		}

		public _onLoad(name: string, callback: () => void): void {
			this._pendingLoads--;
			callback();
		}

		public _onLoadError(name: string, errorback: (err: any) => void, err: any): void {
			this._pendingLoads--;
			errorback(err);
		}

		public _insertLinkNode(linkNode: HTMLLinkElement): void {
			this._pendingLoads++;
			var head = document.head || document.getElementsByTagName('head')[0];
			var other: HTMLCollectionOf<HTMLElement> = head.getElementsByTagName('link') || head.getElementsByTagName('script');
			if (other.length > 0) {
				head.insertBefore(linkNode, other[other.length - 1]);
			} else {
				head.appendChild(linkNode);
			}
		}

		public createLinkTag(name: string, cssUrl: string, externalCallback: () => void, externalErrorback: (err: any) => void): HTMLLinkElement {
			var linkNode = document.createElement('link');
			linkNode.setAttribute('rel', 'stylesheet');
			linkNode.setAttribute('type', 'text/css');
			linkNode.setAttribute('data-name', name);

			var callback = () => this._onLoad(name, externalCallback);
			var errorback = (err: any) => this._onLoadError(name, externalErrorback, err);

			this.attachListeners(name, linkNode, callback, errorback);
			linkNode.setAttribute('href', cssUrl);

			return linkNode;
		}

		public _linkTagExists(name: string, cssUrl: string): boolean {

			var i: number,
				len: number,
				nameAttr: string,
				hrefAttr: string,
				links = document.getElementsByTagName('link');

			for (i = 0, len = links.length; i < len; i++) {
				nameAttr = links[i].getAttribute('data-name');
				hrefAttr = links[i].getAttribute('href');
				if (nameAttr === name || hrefAttr === cssUrl) {
					return true;
				}
			}
			return false;
		}

		public load(name: string, cssUrl: string, externalCallback: (contents?: string) => void, externalErrorback: (err: any) => void): void {
			if (this._linkTagExists(name, cssUrl)) {
				externalCallback();
				return;
			}
			var linkNode = this.createLinkTag(name, cssUrl, externalCallback, externalErrorback);
			this._insertLinkNode(linkNode);
		}
	}

	// ------------------------------ Finally, the plugin

	export class CSSPlugin implements AMDLoader.ILoaderPlugin {

		private _cssLoader = new BrowserCSSLoader();

		public load(name: string, req: AMDLoader.IRelativeRequire, load: AMDLoader.IPluginLoadCallback, config: AMDLoader.IConfigurationOptions): void {
			config = config || {};
			const cssConfig = config['vs/css'] || {};
			if (cssConfig.disabled) {
				// the plugin is asked to not create any style sheets
				load({});
				return;
			}

			const cssUrl = req.toUrl(name + '.css');
			this._cssLoader.load(name, cssUrl, (contents?: string) => {
				load({});
			}, (err: any) => {
				if (typeof load.error === 'function') {
					load.error('Could not find ' + cssUrl + ' or it was empty');
				}
			});
		}
	}

	define('vs/css', new CSSPlugin());
}
