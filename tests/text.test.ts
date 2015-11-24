/// <reference path="qunit/qunit.d.ts" />
/// <reference path="../src/text.ts" />

import textPlugin = TextLoaderPlugin;

QUnit.module('TextPlugin');

QUnit.test('Utilities.escapeText', () => {
	function mytest(input:string, output:string) {
		QUnit.equal(textPlugin.Utilities.escapeText(input), output);
	}
	
	mytest('asdfg', 'asdfg');
	mytest('\b', '\\b');
	mytest('\f', '\\f');
	mytest('\n', '\\n');
	mytest('\0', '\\0');
	mytest('\r', '\\r');
	mytest('\t', '\\t');
	mytest('\v', '\\v');
	mytest('\\', '\\\\');
	mytest('\"', '\\"');
	
	mytest('\b\f\n\0\r\t\v\\\"', '\\b\\f\\n\\0\\r\\t\\v\\\\\\"');
	mytest('a\bb\fc\nd\0e\rf\tg\vh\\i\"j', 'a\\bb\\fc\\nd\\0e\\rf\\tg\\vh\\\\i\\"j');
});