# VSCode Loader

An universal [Asynchronous Module Definition (AMD)](https://github.com/amdjs/amdjs-api/wiki/AMD) Loader.

## Supported environments
* IE (9, 10, 11), Edge, Firefox, Chrome, Safari, Opera
* nodejs
* electron

## Features

* Runs factory methods as soon as dependencies are resolved.
* Contains a CSS loader (`vs/css`).
* Contains a text resource loader (`vs/text`).
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
* [code loading in node]: `npm run test`
* [amd spec tests, unit tests & code loading in browser]:
 * Run `scripts/simpleserver`
 * Open `http://localhost:8888/tests/run-tests.htm`

The project uses as a submodule the [AMD compliance tests](https://github.com/amdjs/amdjs-tests). The goal is to support as many tests without adding `eval()` or an equivalent. It is also not a goal to support loading CommonJS code:

* Basic AMD Functionality (basic)
* The Basic require() Method (require)
* Anonymous Module Support (anon)
* ~~CommonJS Compatibility (funcString)~~
* ~~CommonJS Compatibility with Named Modules (namedWrap)~~
* AMD Loader Plugins (plugins)
* Dynamic Plugins (pluginsDynamic)
* ~~Common Config: Packages~~
* ~~Common Config: Map~~
* ~~Common Config: Module~~
* Common Config: Path
* Common Config: Shim

## Developing

* Clone the repository
* Run `git submodule init`
* Run `git submodule update`
* Run `npm install`
* Compile in the background with `npm run watch`

## License
[MIT](https://github.com/Microsoft/vscode-loader/blob/master/License.txt)

