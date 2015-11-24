var loader = require('../_loader');
var control = require('../_control');

loader.config({
	nodeRequire: require,
	nodeMain: module.filename
});

loader(['./folder/foo', 'fs'], function(foo, fs) {
	if (foo.foo === 5 && typeof fs.readFileSync === 'function') {
		control.ok();
	} else {
		control.err('Unexpected dependencies values');
	}
}, function(err) {
	control.err(err);
});