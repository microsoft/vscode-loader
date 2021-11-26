# VSCode Loader

An universal [Asynchronous Module Definition (AMD)](https://github.com/amdjs/amdjs-api/wiki/AMD) Loader developed primarily to load VSCode's sources.

## Supported environments
* Edge, Firefox, Chrome, Safari
* nodejs
* electron (renderer & browser processes)
In nodejs and electron, when loading a module, if it cannot be found with the AMD rules, it delegates loading them to the native `require`.

## Features

* Runs factory methods as soon as dependencies are resolved.
* Contains a CSS loader (`vs/css`).
* Contains a natural language strings loader (`vs/nls`).

## Using

* In a browser environment:
```html
<script type="text/javascript" src="loader.js"></script>
<script>
	require.config({
		// ...
	});
	require(['an/amd/module'], function(value) {
		// code is loaded here
	});
</script>
```
* In a node environment:
```javascript
var loader = require('loader');
loader.config({
	// ...
});
loader(['an/amd/module'], function(value) {
	// code is loaded here
});
```
* Supported config options:
 * `baseUrl` - The prefix that will be aplied to all modules when they are resolved to a location
 * `paths` - Redirect rules for modules. The redirect rules will affect the module ids themselves
 * `config` - Per-module configuration
 * `catchError` - Catch errors when invoking the module factories
 * `recordStats` - Record statistics
 * `urlArgs` - The suffix that will be aplied to all modules when they are resolved to a location
 * `onError` - Callback that will be called when errors are encountered
 * `ignoreDuplicateModules` - The loader will issue warnings when duplicate modules are encountered. This list will inhibit those warnings if duplicate modules are expected.
 * `isBuild` - Flag to indicate if current execution is as part of a build.
 * `cspNonce` - Allows setting a Content Security Policy nonce value on script tags created by the loader.
 * `nodeRequire` - The main entry point node's require
 * `nodeInstrumenter` - An optional transformation applied to the source before it is loaded in node's vm

## Custom features

* Recording loading statistics for detailed script loading times:
```javascript
require.config({
	recordStats: true
});
// ...
console.log(require.getRecorder().getEvents());
```

* Extracting loading metadata for a bundler:
```javascript
var loader = require('loader');
loader.config({
	isBuild: true
});
// ...
console.log(loader.getBuildInfo());
```

## Testing

To run the tests:
* code loading in node: `npm run test`
* amd spec tests, unit tests & code loading in browser:
  * `npm run simpleserver`
  * open `http://localhost:9999/tests/run-tests.htm`

The project uses as a submodule the [AMD compliance tests](https://github.com/amdjs/amdjs-tests). The goal is to support as many tests without adding `eval()` or an equivalent. It is also not a goal to support loading CommonJS code:

* Basic AMD Functionality (basic)
* The Basic require() Method (require)
* Anonymous Module Support (anon)
* ~~CommonJS Compatibility (funcString)~~
* ~~CommonJS Compatibility with Named Modules (namedWrap)~~
* AMD Loader Plugins (plugins)
* ~~Dynamic Plugins (pluginsDynamic)~~
* ~~Common Config: Packages~~
* ~~Common Config: Map~~
* ~~Common Config: Module~~
* Common Config: Path
* ~~Common Config: Shim~~

## Developing

* Clone the repository
* Run `git submodule init`
* Run `git submodule update`
* Run `npm install`
* Compile in the background with `npm run watch1` and `npm run watch2`

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License
[MIT](https://github.com/microsoft/vscode-loader/blob/master/License.txt)
