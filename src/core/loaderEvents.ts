/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

namespace AMDLoader {

	export const enum LoaderEventType {
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
		CachedDataCreated = 63,
	}

	export class LoaderEvent {
		public type: LoaderEventType;
		public timestamp: number;
		public detail: string;

		constructor(type: LoaderEventType, detail: string, timestamp: number) {
			this.type = type;
			this.detail = detail;
			this.timestamp = timestamp;
		}
	}

	export interface ILoaderEventRecorder {
		record(type: LoaderEventType, detail: string): void;
		getEvents(): LoaderEvent[];
	}

	export class LoaderEventRecorder implements ILoaderEventRecorder {
		private _events: LoaderEvent[];

		constructor(loaderAvailableTimestamp: number) {
			this._events = [new LoaderEvent(LoaderEventType.LoaderAvailable, '', loaderAvailableTimestamp)];
		}

		public record(type: LoaderEventType, detail: string): void {
			this._events.push(new LoaderEvent(type, detail, Utilities.getHighPerformanceTimestamp()));
		}

		public getEvents(): LoaderEvent[] {
			return this._events;
		}
	}

	export class NullLoaderEventRecorder implements ILoaderEventRecorder {
		public static INSTANCE = new NullLoaderEventRecorder();

		public record(type: LoaderEventType, detail: string): void {
			// Nothing to do
		}

		public getEvents(): LoaderEvent[] {
			return [];
		}
	}

}
