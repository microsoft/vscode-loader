var loader = require('../_loader');
var control = require('../_control');

loader.config({
	nodeRequire: require,
	baseUrl: __dirname,
	catchError: true,
	onError: function (err) {
		control.ok();
	}
});

loader(['./a'], function(a) { /* onError above will continue the test runner */ });