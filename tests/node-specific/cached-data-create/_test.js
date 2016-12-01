var fs = require('fs');
var path = require('path');
var loader = require('../_loader');
var control = require('../_control');

var nodeCachedDataDir = path.join(__dirname, 'cache-dir');
var aFile = path.join(__dirname, 'a.js');

loader.config({
	nodeRequire: require,
	nodeMain: module.filename,
	nodeCachedDataDir,
	nodeCachedDataWriteDelay: 0
});


loader(['a'], function (a) {

	setTimeout(() => {

		var cachePath = path.join(nodeCachedDataDir, aFile.replace(/\\|\//g, '') + '.code');
		if (fs.existsSync(cachePath)) {
			control.ok();
		} else {
			control.err('Expected file: ' + cachePath);
		}
		fs.unlinkSync(cachePath);

	}, 100);
});
