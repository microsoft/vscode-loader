/// <reference path="qunit/qunit.d.ts" />
/// <reference path="../src/loader.ts" />

import loader = AMDLoader;

QUnit.module('ConfigurationOptionsUtil');

/**
 * Assert that two configuration options are equal and disregard `onError`
 */
function assertConfigurationIs(actual:loader.IConfigurationOptions, expected:loader.IConfigurationOptions): void {
	var actualOnError = actual.onError;
	var expectedOnError = expected.onError;

	actual.onError = null;
	expected.onError = null;
	QUnit.deepEqual(actual, expected, 'Configuration options are equal');
	actual.onError = actualOnError;
	expected.onError = expectedOnError;
}

QUnit.test('Default configuration', () => {
	var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions();
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: false,
		ignoreDuplicateModules: [],
		isBuild: false,
		paths: {},
		bundles: [],
		shim: {},
		config: {},
		urlArgs: ''
	});
});

function createSimpleKnownConfigurationOptions(): loader.IConfigurationOptions {
	return loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		baseUrl: 'myBaseUrl',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		shim: { 'c': {} },
		config: { 'd': {} },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		urlArgs: 'myUrlArgs'
	});
}

QUnit.test('Simple known configuration options', () => {
	var result = createSimpleKnownConfigurationOptions();
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});
});

QUnit.test('Overwriting known configuration options', () => {
	// Overwrite baseUrl 1
	var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		baseUrl: ''
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Overwrite baseUrl 2
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		baseUrl: '/'
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: '/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Overwrite catchError
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		catchError: false
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: false,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Contribute additional ignoreDuplicateModules
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		ignoreDuplicateModules: [ 'b' ]
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a', 'b' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Contribute additional bundles
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		bundles: [{ location: 'x/y/z.js', modules: [ 'x', 'y' ] }]
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [
			{ location: 'a/b/c.js', modules: [ 'a', 'b' ] },
			{ location: 'x/y/z.js', modules: [ 'x', 'y' ] }
		],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Contribute additional bundles through AMD API
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		bundles: { 'x/y/z.js': [ 'x', 'y' ] }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [
			{ location: 'a/b/c.js', modules: [ 'a', 'b' ] },
			{ location: 'x/y/z.js', modules: [ 'x', 'y' ] }
		],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});



	// Change defined paths
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		paths: { 'a': 'c' }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'c' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Contribute additional shims
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		shim: { 'e': {} }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': {}, 'e': {} },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Change defined shims
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		shim: { 'c': { 'a': 'a' } }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: [ 'a' ],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: [ 'a', 'b' ] }],
		shim: { 'c': { 'a': 'a' } },
		config: { 'd': {} },
		urlArgs: 'myUrlArgs'
	});

	// Contribute additional module configs
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		config: { 'e': {} }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: ['a'],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: ['a', 'b'] }],
		shim: { 'c': {} },
		config: { 'd': {}, 'e': {} },
		urlArgs: 'myUrlArgs'
	});

	// Change defined module configs
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		config: { 'd': { 'a': 'a' } }
	}, createSimpleKnownConfigurationOptions());
	assertConfigurationIs(result, {
		baseUrl: 'myBaseUrl/',
		catchError: true,
		ignoreDuplicateModules: ['a'],
		isBuild: false,
		paths: { 'a': 'b' },
		bundles: [{ location: 'a/b/c.js', modules: ['a', 'b'] }],
		shim: { 'c': {} },
		config: { 'd': { 'a': 'a' } },
		urlArgs: 'myUrlArgs'
	});
});

QUnit.test('Overwriting unknown configuration options', () => {
	var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions();
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: false,
		ignoreDuplicateModules: [],
		isBuild: false,
		paths: {},
		bundles: [],
		shim: {},
		config: {},
		urlArgs: ''
	});

	// Adding unknown key
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		unknownKey1: 'value1'
	}, result);
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: false,
		ignoreDuplicateModules: [],
		isBuild: false,
		paths: {},
		bundles: [],
		shim: {},
		config: {},
		urlArgs: '',
		unknownKey1: 'value1'
	});

	// Adding another unknown key
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		unknownKey2: 'value2'
	}, result);
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: false,
		ignoreDuplicateModules: [],
		isBuild: false,
		paths: {},
		bundles: [],
		shim: {},
		config: {},
		urlArgs: '',
		unknownKey1: 'value1',
		unknownKey2: 'value2'
	});

	// Overwriting unknown key
	result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
		unknownKey2: 'new-value2'
	}, result);
	assertConfigurationIs(result, {
		baseUrl: '',
		catchError: false,
		ignoreDuplicateModules: [],
		isBuild: false,
		paths: {},
		bundles: [],
		shim: {},
		config: {},
		urlArgs: '',
		unknownKey1: 'value1',
		unknownKey2: 'new-value2'
	});
});

QUnit.module('Configuration');

QUnit.test('moduleIdToPath', () => {
	var config = new loader.Configuration({
		baseUrl: 'prefix',
		urlArgs: 'suffix',
		paths: {
			'a' : 'newa',
			'knockout': 'http://ajax.aspnetcdn.com/ajax/knockout/knockout-2.2.1.js',
			'editor': '/src/editor'
		},
		bundles: [
			{
				location: 'redirect/bundlejs?v=12345',
				modules: [ 'x' , 'z' ]
			},
			{
				location: '/redirect/other?v=34523452345',
				modules: [ 'y' , 'z' ]
			}
		]
	});

	// baseUrl is applied
	QUnit.equal(config.moduleIdToPaths('b/c/d'), 'prefix/b/c/d.js?suffix');

	// paths rules are applied
	QUnit.equal(config.moduleIdToPaths('a'), 'prefix/newa.js?suffix');
	QUnit.equal(config.moduleIdToPaths('a/b/c/d'), 'prefix/newa/b/c/d.js?suffix');

	// paths rules check if value is an absolute path
	QUnit.equal(config.moduleIdToPaths('knockout'), 'http://ajax.aspnetcdn.com/ajax/knockout/knockout-2.2.1.js?suffix');

	// modules ending in .js skip baseUrl + paths rules
	QUnit.equal(config.moduleIdToPaths('b/c/d.js'), 'b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('a/b/c/d.js'), 'a/b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('a.js'), 'a.js?suffix');

	// modules redirected to / still get .js appended
	QUnit.equal(config.moduleIdToPaths('editor/x'), '/src/editor/x.js?suffix');

	// modules starting with / skip baseUrl + paths rules
	QUnit.equal(config.moduleIdToPaths('/b/c/d'), '/b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('/a/b/c/d'), '/a/b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('/a'), '/a.js?suffix');

	// modules starting with http:// or https:// skip baseUrl + paths rules
	QUnit.equal(config.moduleIdToPaths('file:///c:/a/b/c'), 'file:///c:/a/b/c.js?suffix');
	QUnit.equal(config.moduleIdToPaths('http://b/c/d'), 'http://b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('http://a/b/c/d'), 'http://a/b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('http://a'), 'http://a.js?suffix');
	QUnit.equal(config.moduleIdToPaths('https://b/c/d'), 'https://b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('https://a/b/c/d'), 'https://a/b/c/d.js?suffix');
	QUnit.equal(config.moduleIdToPaths('https://a'), 'https://a.js?suffix');

	// bundles
	QUnit.equal(config.moduleIdToPaths('x'), 'prefix/redirect/bundlejs?v=12345&suffix');
	QUnit.equal(config.moduleIdToPaths('x/y'), 'prefix/x/y.js?suffix');
	QUnit.equal(config.moduleIdToPaths('z'), '/redirect/other?v=34523452345&suffix');
	QUnit.equal(config.moduleIdToPaths('z/t'), 'prefix/z/t.js?suffix');
	QUnit.equal(config.moduleIdToPaths('y'), '/redirect/other?v=34523452345&suffix');

});

QUnit.test('requireToUrl', () => {
	var config = new loader.Configuration({
		baseUrl: 'prefix',
		urlArgs: 'suffix',
		paths: {
			'a' : 'newa'
		}
	});

	// baseUrl is applied
	QUnit.equal(config.requireToUrl('b/c/d'), 'prefix/b/c/d?suffix');
	QUnit.equal(config.requireToUrl('../a/b/c/d'), 'prefix/../a/b/c/d?suffix');

	// paths rules are applied
	QUnit.equal(config.requireToUrl('a'), 'prefix/newa?suffix');
	QUnit.equal(config.requireToUrl('a/b/c/d'), 'prefix/newa/b/c/d?suffix');

	// urls ending in .js get no special treatment
	QUnit.equal(config.requireToUrl('b/c/d.js'), 'prefix/b/c/d.js?suffix');
	QUnit.equal(config.requireToUrl('a/b/c/d.js'), 'prefix/newa/b/c/d.js?suffix');
	QUnit.equal(config.requireToUrl('a.js'), 'prefix/newa.js?suffix');

	// requireToUrl does not append .js
	QUnit.equal(config.requireToUrl('b/c/d.png'), 'prefix/b/c/d.png?suffix');
	QUnit.equal(config.requireToUrl('a/b/c/d.png'), 'prefix/newa/b/c/d.png?suffix');
	QUnit.equal(config.requireToUrl('a.png'), 'prefix/newa.png?suffix');

	// urls starting with / skip baseUrl + paths rules
	QUnit.equal(config.requireToUrl('/b/c/d'), '/b/c/d?suffix');
	QUnit.equal(config.requireToUrl('/a/b/c/d'), '/a/b/c/d?suffix');
	QUnit.equal(config.requireToUrl('/a'), '/a?suffix');

	// urls starting with http:// or https:// skip baseUrl + paths rules
	QUnit.equal(config.requireToUrl('http://b/c/d'), 'http://b/c/d?suffix');
	QUnit.equal(config.requireToUrl('http://a/b/c/d'), 'http://a/b/c/d?suffix');
	QUnit.equal(config.requireToUrl('http://a'), 'http://a?suffix');
	QUnit.equal(config.requireToUrl('https://b/c/d'), 'https://b/c/d?suffix');
	QUnit.equal(config.requireToUrl('https://a/b/c/d'), 'https://a/b/c/d?suffix');
	QUnit.equal(config.requireToUrl('https://a'), 'https://a?suffix');
});

QUnit.test('ignoreDuplicateModules', () => {
	var config = new loader.Configuration({
		ignoreDuplicateModules: ['a1', 'a2', 'a/b/c']
	});

	QUnit.equal(config.isDuplicateMessageIgnoredFor('a1'), true);
	QUnit.equal(config.isDuplicateMessageIgnoredFor('a2'), true);
	QUnit.equal(config.isDuplicateMessageIgnoredFor('a/b/c'), true);
	QUnit.equal(config.isDuplicateMessageIgnoredFor('a'), false);
});

QUnit.test('shim', () => {
	(<any>window).shim_export_value = 3;
	var config = new loader.Configuration({
		shim: {
			'a': {
				deps: ['a1', 'a2'],
				exports: function() {
					return 'a';
				}
			},
			'b': {
				exports: function() {
					return 'b';
				}
			},
			'c': {
				exports: 'shim_export_value'
			},
			'd': {
				exports: {
					d: 'd'
				}
			}
		}
	});

	QUnit.equal(config.isShimmed('a'), true);
	QUnit.equal(config.isShimmed('b'), true);
	QUnit.equal(config.isShimmed('c'), true);

	var a = config.getShimmedModuleDefine('a');
	QUnit.deepEqual(a.dependencies, ['a1', 'a2']);
	QUnit.deepEqual(a.callback(), 'a');

	var b = config.getShimmedModuleDefine('b');
	QUnit.deepEqual(b.dependencies, []);
	QUnit.deepEqual(b.callback(), 'b');

	var c = config.getShimmedModuleDefine('c');
	QUnit.deepEqual(c.dependencies, []);
	QUnit.deepEqual(c.callback(), 3);

	var d = config.getShimmedModuleDefine('d');
	QUnit.deepEqual(d.dependencies, []);
});

QUnit.module('ModuleIdResolver');

QUnit.test('resolveModule', () => {
	var resolver = new loader.ModuleIdResolver(null, 'a/b/c/d');

	// normal modules
	QUnit.equal(resolver.resolveModule('e/f/g'), 'e/f/g');
	QUnit.equal(resolver.resolveModule('e/f/../f/g'), 'e/f/../f/g');

	// normal modules ending in .js
	QUnit.equal(resolver.resolveModule('e/f/g.js'), 'e/f/g.js');

	// relative modules
	QUnit.equal(resolver.resolveModule('./e/f/g'), 'a/b/c/e/f/g');
	QUnit.equal(resolver.resolveModule('../e/f/g'), 'a/b/e/f/g');
	QUnit.equal(resolver.resolveModule('../../e/f/g'), 'a/e/f/g');
	QUnit.equal(resolver.resolveModule('../../../e/f/g'), 'e/f/g');
	QUnit.equal(resolver.resolveModule('../../../../e/f/g'), '../e/f/g');
	QUnit.equal(resolver.resolveModule('../b/../c/d'), 'a/b/c/d');

	// relative modules ending in .js
	QUnit.equal(resolver.resolveModule('./e/f/g.js'), 'a/b/c/e/f/g.js');
	QUnit.equal(resolver.resolveModule('../e/f/g.js'), 'a/b/e/f/g.js');
	QUnit.equal(resolver.resolveModule('../../e/f/g.js'), 'a/e/f/g.js');
	QUnit.equal(resolver.resolveModule('../../../e/f/g.js'), 'e/f/g.js');
	QUnit.equal(resolver.resolveModule('../../../../e/f/g.js'), '../e/f/g.js');

	// modules starting with /
	QUnit.equal(resolver.resolveModule('/b/c/d'), '/b/c/d');
	QUnit.equal(resolver.resolveModule('/a'), '/a');
	QUnit.equal(resolver.resolveModule('/a/b/c/d.js'), '/a/b/c/d.js');
	QUnit.equal(resolver.resolveModule('/../a/b/c'), '/../a/b/c');

	// modules starting with http:// or https://
	QUnit.equal(resolver.resolveModule('http://b/c/d'), 'http://b/c/d');
	QUnit.equal(resolver.resolveModule('http://a'), 'http://a');
	QUnit.equal(resolver.resolveModule('http://a/b/c/d.js'), 'http://a/b/c/d.js');
	QUnit.equal(resolver.resolveModule('https://b/c/d'), 'https://b/c/d');
	QUnit.equal(resolver.resolveModule('https://a'), 'https://a');
	QUnit.equal(resolver.resolveModule('https://a/b/c/d.js'), 'https://a/b/c/d.js');

	// modules starting with file://
	QUnit.equal(resolver.resolveModule('file://b/c/d'), 'file://b/c/d');
	QUnit.equal(resolver.resolveModule('file://a'), 'file://a');
	QUnit.equal(resolver.resolveModule('file://a/b/c/d.js'), 'file://a/b/c/d.js');

	QUnit.equal(loader.ModuleIdResolver._normalizeModuleId('./a'), 'a');
	QUnit.equal(loader.ModuleIdResolver._normalizeModuleId('./././a'), 'a');
	QUnit.equal(loader.ModuleIdResolver._normalizeModuleId('a/b/c/d/../../../../../e/f/g/h'), '../e/f/g/h');
	QUnit.equal(loader.ModuleIdResolver._normalizeModuleId('file:///c:/a/b/c/d/e.f.g/h/./j'), 'file:///c:/a/b/c/d/e.f.g/h/j');
	QUnit.equal(loader.ModuleIdResolver._normalizeModuleId('../../ab/../a'), '../../a');
});

QUnit.module('Module');

QUnit.test('Basic dependencies', () => {
	var moduleIdResolver = new loader.ModuleIdResolver(new loader.Configuration(), 'a/b/c/d');
	var config: AMDLoader.IModuleConfiguration = {};
	var depsValues:any[] = null;
	function factory(): string {
		depsValues = Array.prototype.slice.call(arguments, 0);
		return 'exports';
	}

	// No dependencies
	depsValues = null;
	var m = new loader.Module('a/b/c/d', [], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	QUnit.deepEqual(m.getDependencies(), []);
	QUnit.equal(m.getExports(), 'exports');
	QUnit.equal(m.getId(), 'a/b/c/d');
	QUnit.equal(m.isComplete(), true);
	QUnit.deepEqual(depsValues, []);

	// Basic dependencies
	depsValues = null;
	m = new loader.Module('a/b/c/d', ['exports', 'module'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	QUnit.equal(m.isComplete(), true);
	m = new loader.Module('a/b/c/d', ['exports', 'module'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver, config);
	QUnit.equal(m.isComplete(), true);
	QUnit.equal(depsValues.length, 2);
	QUnit.equal(typeof depsValues[1].config, "function");
	QUnit.deepEqual(depsValues[1].config(), config);
	delete depsValues[1]["config"];
	QUnit.deepEqual(depsValues, [ {}, { id: 'a/b/c/d' } ]);

	// Relative dependency

});

QUnit.test('Relative dependency, renamed and resolved', () => {
	var moduleIdResolver = new loader.ModuleIdResolver(new loader.Configuration(), 'a/b/c/d');
	var depsValues:any[] = null;
	function factory(): string {
		depsValues = Array.prototype.slice.call(arguments, 0);
		return 'exports';
	}

	var m = new loader.Module('a/b/c/d', ['./e'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	QUnit.deepEqual(m.getDependencies(), [ 'a/b/c/e' ]);
	QUnit.equal(m.isComplete(), false);

	m.renameDependency('a/b/c/e', 'a/b/c/f');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('a/b/c/f', 'v');
	QUnit.equal(m.isComplete(), true);
	QUnit.deepEqual(depsValues, [ 'v' ]);
});

QUnit.test('Plugin dependency, renamed and resolved', () => {
	var moduleIdResolver = new loader.ModuleIdResolver(new loader.Configuration(), 'a/b/c/d');
	var depsValues:any[] = null;
	function factory(): string {
		depsValues = Array.prototype.slice.call(arguments, 0);
		return 'exports';
	}

	var m = new loader.Module('a/b/c/d', ['../e!../x/y/z'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	QUnit.deepEqual(m.getDependencies(), [ 'a/b/e!../x/y/z' ]);
	QUnit.equal(m.isComplete(), false);

	m.renameDependency('a/b/e!../x/y/z', 'a/b/e!xyz');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('a/b/e!xyz', 'v');
	QUnit.equal(m.isComplete(), true);
	QUnit.deepEqual(depsValues, [ 'v' ]);
});

QUnit.test('More dependencies, many interactions', () => {
	var moduleIdResolver = new loader.ModuleIdResolver(new loader.Configuration(), 'a/b/c/d');
	var config: AMDLoader.IModuleConfiguration = {};
	var depsValues:any[] = null;
	function factory(): void {
		depsValues = Array.prototype.slice.call(arguments, 0);
		depsValues[0].a = 'my-exports';
	}

	var m = new loader.Module('a/b/c/d', ['exports', 'module', 'require', 'f' ,'g/h', '../e!../x/y/z'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver, config);
	QUnit.deepEqual(m.getDependencies(), [ 'require', 'f', 'g/h', 'a/b/e!../x/y/z' ]);
	QUnit.equal(m.isComplete(), false);

	m.renameDependency('a/b/e!../x/y/z', 'a/b/e!xyz');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('a/b/e!xyz', 'v1');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('f', 'v2');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('g/h', 'v3');
	QUnit.equal(m.isComplete(), false);

	m.resolveDependency('require', 'v4');
	QUnit.equal(m.isComplete(), true);
	QUnit.equal(depsValues.length, 6);
	QUnit.equal(typeof depsValues[1].config, "function");
	QUnit.deepEqual(depsValues[1].config(), {});
	delete depsValues[1].config;
	QUnit.deepEqual(depsValues, [
		{ a: 'my-exports' },
		{ id: 'a/b/c/d' },
		'v4',
		'v2',
		'v3',
		'v1' ]);

	m.cleanUp();
	QUnit.equal(m.isComplete(), true);
	QUnit.deepEqual(m.getExports(), { a: 'my-exports' });
});

QUnit.test('Duplicate dependencies', () => {
	var moduleIdResolver = new loader.ModuleIdResolver(new loader.Configuration(), 'a/b/c/d');
	var depsValues:any[] = null;
	function factory(): void {
		depsValues = Array.prototype.slice.call(arguments, 0);
		depsValues[0].a = 'my-exports';
	}

	QUnit.throws(()=>{
		var m = new loader.Module('a/b/c/d', ['exports', 'module', 'require', 'f' ,'g/h', 'f'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	});

	QUnit.throws(()=>{
		var m = new loader.Module('a/b/c/d', ['exports', 'module', 'require', 'a/b/c/f' ,'g/h', './f'], factory, null, loader.NullLoaderEventRecorder.INSTANCE, moduleIdResolver);
	});
});

QUnit.module('ModuleManager');

QUnit.test('Loading 3 simple modules', () => {
	QUnit.expect(3);

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void) => {
			if (scriptPath === 'a1.js') {
				mm.enqueueDefineAnonymousModule([], 'a1');
				loadCallback();
			} else if (scriptPath === 'a2.js') {
				mm.enqueueDefineModule('a2', [], 'a2');
				loadCallback();
			} else {
				QUnit.ok(false);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	mm.defineModule('a', ['a1', 'a2'], (a1:string, a2:string) => {
		QUnit.equal(a1, 'a1');
		QUnit.equal(a2, 'a2');
		return 'a';
	}, null, null);

	QUnit.equal(mm.synchronousRequire('a'), 'a');
});

QUnit.test('Loading a plugin dependency', () => {
	QUnit.expect(5);

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'plugin.js') {
				mm.enqueueDefineAnonymousModule([], {
					normalize: (pluginParam:string, normalize:(moduleId:string)=>string) => {
						return normalize(pluginParam);
					},
					load: (pluginParam:string, parentRequire:loader.IRelativeRequire, loadCallback:loader.IPluginLoadCallback, options:loader.IConfigurationOptions) => {
						parentRequire([pluginParam], (v:any) => loadCallback(v));
					}
				});
				loadCallback();
			} else if (scriptPath === 'a/b/d.js') {
				mm.enqueueDefineAnonymousModule([], 'r');
				loadCallback();
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	mm.defineModule('a/b/c', ['../../plugin!./d', 'require'], (r:any, req:any) => {
		QUnit.equal(r, 'r');
		QUnit.equal(req.toUrl('./d.txt'), 'a/b/d.txt');
		return 'a/b/c';
	}, null, null);

	QUnit.equal(mm.synchronousRequire('a/b/c'), 'a/b/c');

	mm.defineModule('a2', ['./plugin!a/b/d'], (r:any) => {
		QUnit.equal(r, 'r');
		return 'a2';
	}, null, null);

	QUnit.equal(mm.synchronousRequire('a2'), 'a2');
});

QUnit.test('Loading a shimmed dependency', () => {
	QUnit.expect(2);

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'a/b/shim.js') {
				loadCallback();
			} else if (scriptPath === 'a/b/shim1.js') {
				mm.enqueueDefineModule('a/b/shim1', [], 'shim1');
				loadCallback();
			} else if (scriptPath === 'a/b/shim2.js') {
				mm.enqueueDefineAnonymousModule([], 'shim2');
				loadCallback();
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.configure({
		shim: {
			'a/b/shim': {
				deps: ['a/b/shim1', 'a/b/shim2'],
				exports: function() {
					return 'shimValue';
				}
			}
		}
	}, false);

	mm.defineModule('a/b/c', ['./shim'], (r:any) => {
		QUnit.equal(r, 'shimValue');
		return 'a/b/c';
	}, null, null);

	QUnit.equal(mm.synchronousRequire('a/b/c'), 'a/b/c');
});

QUnit.test('Loading a dependency cycle', () => {
	QUnit.expect(6);

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'b.js') {
				mm.enqueueDefineAnonymousModule(['c'], (c:any) => {
					QUnit.equal(c, 'c');
					return 'b';
				});
				loadCallback();
			} else if (scriptPath === 'c.js') {
				mm.enqueueDefineAnonymousModule(['a'], (a:any) => {
					// This is how the cycle is broken. One of the modules receives undefined as the argument value
					QUnit.ok(typeof a === 'undefined');
					return 'c';
				});
				loadCallback();
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.defineModule('a', ['b'], (b:any) => {
		QUnit.equal(b, 'b');
		return 'a';
	}, null, null);

	QUnit.equal(mm.synchronousRequire('a'), 'a');
	QUnit.equal(mm.synchronousRequire('b'), 'b');
	QUnit.equal(mm.synchronousRequire('c'), 'c');
});

QUnit.test('Using a local error handler immediate script loading failure', () => {
	QUnit.expect(1);

	// a -> b and b fails to load

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'b.js') {
				errorCallback('b.js not found');
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.defineModule('a', ['b'], (b:any) => {
		QUnit.equal(b, 'b');
		return 'a';
	}, (err) => {
		QUnit.equal(err.detail, 'b.js not found');
	}, null);

});

QUnit.test('Using a local error handler secondary script loading failure', () => {
	QUnit.expect(1);

	// a -> b -> c and c fails to load

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'b.js') {
				mm.enqueueDefineAnonymousModule(['c'], (c:any) => {
					QUnit.equal(c, 'c');
					return 'b';
				});
				loadCallback();
			} else if (scriptPath === 'c.js') {
				errorCallback('c.js not found');
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.defineModule('a', ['b'], (b:any) => {
		QUnit.ok(false);
	}, (err) => {
		QUnit.equal(err.detail, 'c.js not found');
	}, null);
});

QUnit.module('FallBack Tests');

QUnit.test('No path config', () => {
	QUnit.expect(1);

	var scriptLoader: loader.IScriptLoader = {
		load: (scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void) => {
			if (scriptPath === 'a.js') {
				errorCallback('a.js not found');
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.defineModule('first', ['a'], () => {
		QUnit.ok(false, 'a should not be found');
	}, (err) => {
		QUnit.ok(true, 'a should not be found');
	}, null);
});

QUnit.test('With path config', () => {
	QUnit.expect(1);

	var scriptLoader: loader.IScriptLoader = {
		load: (scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void) => {
			if (scriptPath === 'alocation.js') {
				errorCallback('alocation.js not found');
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);
	mm.configure({
		paths: {
			a: 'alocation.js'
		}
	}, false);
	mm.defineModule('first', ['a'], () => {
		QUnit.ok(false, 'a should not be found');
	}, (err) => {
		QUnit.ok(true, 'a should not be found');
	}, null);
});

QUnit.test('With one fallback', () => {
	QUnit.expect(1);

	var scriptLoader: loader.IScriptLoader = {
		load: (scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void) => {
			if (scriptPath === 'alocation.js') {
				errorCallback('alocation.js not found');
			} else if (scriptPath === 'afallback.js') {
				mm.enqueueDefineAnonymousModule([], () => {
					return 'a';
				});
				loadCallback();
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	mm.configure({
		paths: {
			a: ['alocation.js', 'afallback.js']
		}
	}, false);

	mm.defineModule('first', ['a'], () => {
		QUnit.ok(true, 'a was found');
	}, (err) => {
		QUnit.ok(false, 'a was not found');
	}, null);
});

QUnit.test('With two fallbacks', () => {
	QUnit.expect(1);

	var scriptLoader: loader.IScriptLoader = {
		load: (scriptPath: string, loadCallback: () => void, errorCallback: (err: any) => void) => {
			if (scriptPath === 'alocation.js') {
				errorCallback('alocation.js not found');
			} else if (scriptPath === 'afallback.js') {
				errorCallback('afallback.js not found');
			} else if (scriptPath === 'anotherfallback.js') {
				mm.enqueueDefineAnonymousModule([], () => {
					return 'a';
				});
				loadCallback();
			}else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	mm.configure({
		paths: {
			a: ['alocation.js', 'afallback.js', 'anotherfallback.js']
		}
	}, false);

	mm.defineModule('first', ['a'], () => {
		QUnit.ok(true, 'a was found');
	}, (err) => {
		QUnit.ok(false, 'a was not found');
	}, null);
});

QUnit.module('Bugs');

QUnit.test('Bug #11710: [loader] Loader can enter a stale-mate when the last dependency to resolve is a (missing) plugin dependency', () => {
	QUnit.expect(3);

	// A script loader that captures the load request for 'plugin.js'
	var pluginJSCallback:()=>void = null;
	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			if (scriptPath === 'plugin.js') {
				pluginJSCallback = loadCallback;
			} else {
				QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
			}
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	// Define the resolved plugin value
	mm.defineModule('plugin!pluginParam', [], () => {
		return {
			value: 5
		};
	}, (err) => {
		QUnit.ok(false);
	}, null);

	// Ask for the plugin
	mm.defineModule('a', ['plugin!pluginParam'], (b:any) => {
		QUnit.equal(b.value, 5);
		return {
			value: b.value * 2
		};
	}, (err) => {
		QUnit.ok(false);
	}, null);

	// Depend on a module that asks for the plugin
	mm.defineModule('b', ['a'], (a:any) => {
		QUnit.equal(a.value, 10);
	}, (err) => {
		QUnit.ok(false);
	}, null);

	QUnit.ok(pluginJSCallback, 'Loader asked for plugin.js');

	// Define the plugin
	mm.enqueueDefineAnonymousModule([], () => {
		return {
			load: (name:string, req:AMDLoader.IRelativeRequire, load:AMDLoader.IPluginLoadCallback, config:AMDLoader.IConfigurationOptions) => {
				QUnit.ok(false, 'Plugin.load should not be called');
			}
		};
	});
	pluginJSCallback();
});

QUnit.test('Bug #12024: [loader] Should not append .js to URLs containing query string', () => {
	var config = new loader.Configuration({
		baseUrl: 'prefix',
		paths: {
			'searchBoxJss': 'http://services.social.microsoft.com/search/Widgets/SearchBox.jss?boxid=HeaderSearchTextBox&btnid=HeaderSearchButton&brand=Msdn&loc=en-us&Refinement=198,234&focusOnInit=false&iroot=vscom&emptyWatermark=true&searchButtonTooltip=Search here'
		}
	});

	// No .js is appended
	QUnit.equal(config.moduleIdToPaths('searchBoxJss'), 'http://services.social.microsoft.com/search/Widgets/SearchBox.jss?boxid=HeaderSearchTextBox&btnid=HeaderSearchButton&brand=Msdn&loc=en-us&Refinement=198,234&focusOnInit=false&iroot=vscom&emptyWatermark=true&searchButtonTooltip=Search here');
});

QUnit.test('Bug #12020: [loader] relative (synchronous) require does not normalize plugin argument that follows "!"', () => {
	QUnit.expect(3);

	var scriptLoader:loader.IScriptLoader = {
		load: (scriptPath:string, loadCallback:()=>void, errorCallback:(err:any)=>void) => {
			QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
		},
		setModuleManager: (moduleManager:loader.ModuleManager) => { /**/ }
	};

	var mm = new loader.ModuleManager(scriptLoader);

	mm.defineModule('plugin!a/b/c', [], () => {
		QUnit.ok(true);
		return 'plugin!a/b/c';
	}, null, null);

	mm.defineModule('a/b/d', ['require'], (relativeRequire) => {
		QUnit.ok(true);
		QUnit.equal(relativeRequire('plugin!./c'), 'plugin!a/b/c');
		return 'a/b/d';
	}, null, null);
});

QUnit.test('Utilities.fileUriToFilePath', () => {
	var test = (input:string, expected:string) => {
		QUnit.equal(loader.Utilities.fileUriToFilePath(input), expected, 'Result for ' + input);
	};
	test('file:///c:/alex.txt', 'c:/alex.txt');
	test('file://monacotools/isi.txt', '//monacotools/isi.txt');
	test('file://monacotools1/certificates/SSL/', '//monacotools1/certificates/SSL/');
});