
declare var require;
declare var process;
declare var define;

// IE specific definitions
interface HTMLLinkElement {
	readyState: string;
}

interface HTMLScriptElement {
	readyState: string;
	attachEvent(type: string, callback: (e: any) => void);
	detachEvent(type: string, callback: (e: any) => void);
}
