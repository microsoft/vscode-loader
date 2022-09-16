var loader = require('../_loader');
var control = require('../_control');

loader.config({
	nodeRequire: require,
	baseUrl: __dirname
});

loader(['./a'], function(a) {
	if (typeof a.dirname !== 'string' || typeof a.filename !== 'string') {
		control.err('Expected strings...');
		return;
	}
	if (a.dirname.length === 0 || a.filename.length === 0) {
		control.err('Expected non empty strings...');
		return;
	}

	if (a.filename.lastIndexOf('a.js') !== a.filename.length - 4) {
		control.err('Expected filename ending in a.js');
		return;
	}

	if (a.filename.indexOf(a.dirname) !== 0) {
		control.err('Expected dirname to be prefix of filename');
		return;
	}

	control.ok();

}, function(err) {
	control.err(err);
});