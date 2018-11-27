var fs = require('fs');
var path = require('path');
var loader = require('../_loader');
var control = require('../_control');

var nodeCachedDataDir = path.join(__dirname, 'cache-dir');

loader.config({
	nodeRequire: require,
	nodeMain: module.filename,
	nodeCachedData: {
		path: nodeCachedDataDir,
		seed: 'foo',
		writeDelay: 0
	}
});


loader(['a'], function (a) {

	setTimeout(() => {

		const files = fs.readdirSync(nodeCachedDataDir).filter(p => /\.code$/.test(p));
		if (files.length === 1) {
			control.ok();
		} else {
			control.err('Unexpected .code-files' + files.join(', '));
		}
		for (const f of files) {
			fs.unlinkSync(path.join(nodeCachedDataDir, f));
		}

	}, 100);
});
