var loader = require('../_loader');
var control = require('../_control');

loader.config({
	nodeRequire: require,
	baseUrl: __dirname
});

loader(['a'], function(a) {
	if (typeof a === 'function') {
		control.ok();
	} else {
		control.err('Unexpected dependencies values');
	}
}, function(err) {
	control.err(err);
});