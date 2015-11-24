var path = require('path');
var fs = require('fs');
var control = require('./node-specific/_control');
var loader = require('./node-specific/_loader');

var ROOT_DIR = path.join(__dirname, 'node-specific');

// Discover tests
var entries = fs.readdirSync(ROOT_DIR);

entries = entries.filter(function(entry) {
	var fullPath = path.join(ROOT_DIR, entry);
	return fs.statSync(fullPath).isDirectory();
});

var currentTest = null;

var colors = (function() {

	var _colors = {
		black: "30",
		red: "31",
		green: "32",
		yellow: "33",
		blue: "34",
		magenta: "35",
		cyan: "36",
		white: "37",
	};


	var r = {};

	Object.keys(_colors).forEach(function(colorName) {
		var colorCode = _colors[colorName];
		r[colorName] = function(str) {
			return '\x1b[' + colorCode + 'm' + str + '\x1b[0m';
		}
	});

	return r;
})();

var okCnt = 0, totalCnt = entries.length;

function runTest(err) {
	if (currentTest) {
		if (err) {
			console.log(colors.red('[ERROR   ] ' + currentTest + ': \n'), err);
		} else {
			okCnt++;
			console.log(colors.green('[PASSED  ] ' + currentTest + '.'));
		}
	}

	if (entries.length > 0) {
		currentTest = entries.shift();
		var testModulePath = path.join(ROOT_DIR, currentTest, '_test');
		loader.reset();
		try {
			require(testModulePath);
		} catch (err) {
			runTest(err);
			return;
		}
	} else {
		var str = '[FINISHED] ' + okCnt + '/' + totalCnt + ' passed.';
		if (okCnt !== totalCnt) {
			str = colors.red(str);
		} else {
			str = colors.green(str);
		}
		console.log(str);
	}
}

control.setContinuation(runTest);
runTest(null);
