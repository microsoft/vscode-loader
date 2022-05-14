/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var loader = AMDLoader;
QUnit.module('ConfigurationOptionsUtil');
/**
 * Assert that two configuration options are equal and disregard `onError`
 */
function assertConfigurationIs(actual, expected) {
    actual.onError = null;
    actual.nodeCachedData = null;
    expected.onError = null;
    expected.nodeCachedData = null;
    QUnit.deepEqual(actual, expected, 'Configuration options are equal');
}
QUnit.test('Default configuration', function () {
    var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions();
    assertConfigurationIs(result, {
        baseUrl: '',
        catchError: false,
        ignoreDuplicateModules: [],
        isBuild: false,
        paths: {},
        config: {},
        urlArgs: '',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
});
function createSimpleKnownConfigurationOptions() {
    return loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        baseUrl: 'myBaseUrl',
        catchError: true,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
}
QUnit.test('Simple known configuration options', function () {
    var result = createSimpleKnownConfigurationOptions();
    assertConfigurationIs(result, {
        baseUrl: 'myBaseUrl/',
        catchError: true,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
});
QUnit.test('Overwriting known configuration options', function () {
    // Overwrite baseUrl 1
    var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        baseUrl: ''
    }, createSimpleKnownConfigurationOptions());
    assertConfigurationIs(result, {
        baseUrl: '',
        catchError: true,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
    // Overwrite baseUrl 2
    result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        baseUrl: '/'
    }, createSimpleKnownConfigurationOptions());
    assertConfigurationIs(result, {
        baseUrl: '/',
        catchError: true,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
    // Overwrite catchError
    result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        catchError: false
    }, createSimpleKnownConfigurationOptions());
    assertConfigurationIs(result, {
        baseUrl: 'myBaseUrl/',
        catchError: false,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
    // Contribute additional ignoreDuplicateModules
    result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        ignoreDuplicateModules: ['b']
    }, createSimpleKnownConfigurationOptions());
    assertConfigurationIs(result, {
        baseUrl: 'myBaseUrl/',
        catchError: true,
        ignoreDuplicateModules: ['a', 'b'],
        isBuild: false,
        paths: { 'a': 'b' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
    // Change defined paths
    result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions({
        paths: { 'a': 'c' }
    }, createSimpleKnownConfigurationOptions());
    assertConfigurationIs(result, {
        baseUrl: 'myBaseUrl/',
        catchError: true,
        ignoreDuplicateModules: ['a'],
        isBuild: false,
        paths: { 'a': 'c' },
        config: { 'd': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
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
        config: { 'd': {}, 'e': {} },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
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
        config: { 'd': { 'a': 'a' } },
        urlArgs: 'myUrlArgs',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
    });
});
QUnit.test('Overwriting unknown configuration options', function () {
    var result = loader.ConfigurationOptionsUtil.mergeConfigurationOptions();
    assertConfigurationIs(result, {
        baseUrl: '',
        catchError: false,
        ignoreDuplicateModules: [],
        isBuild: false,
        paths: {},
        config: {},
        urlArgs: '',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        nodeModules: []
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
        config: {},
        urlArgs: '',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        unknownKey1: 'value1',
        nodeModules: []
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
        config: {},
        urlArgs: '',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        unknownKey1: 'value1',
        unknownKey2: 'value2',
        nodeModules: []
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
        config: {},
        urlArgs: '',
        cspNonce: '',
        preferScriptTags: false,
        recordStats: false,
        unknownKey1: 'value1',
        unknownKey2: 'new-value2',
        nodeModules: []
    });
});
QUnit.module('Configuration');
QUnit.test('moduleIdToPath', function () {
    var config = new loader.Configuration(new loader.Environment(), {
        baseUrl: 'prefix',
        urlArgs: 'suffix',
        paths: {
            'a': 'newa',
            'knockout': 'http://ajax.aspnetcdn.com/ajax/knockout/knockout-2.2.1.js',
            'editor': '/src/editor'
        }
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
});
QUnit.test('requireToUrl', function () {
    var config = new loader.Configuration(new loader.Environment(), {
        baseUrl: 'prefix',
        urlArgs: 'suffix',
        paths: {
            'a': 'newa'
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
QUnit.test('ignoreDuplicateModules', function () {
    var config = new loader.Configuration(new loader.Environment(), {
        ignoreDuplicateModules: ['a1', 'a2', 'a/b/c']
    });
    QUnit.equal(config.isDuplicateMessageIgnoredFor('a1'), true);
    QUnit.equal(config.isDuplicateMessageIgnoredFor('a2'), true);
    QUnit.equal(config.isDuplicateMessageIgnoredFor('a/b/c'), true);
    QUnit.equal(config.isDuplicateMessageIgnoredFor('a'), false);
});
QUnit.module('ModuleIdResolver');
QUnit.test('resolveModule', function () {
    var resolver = new loader.ModuleIdResolver('a/b/c/d');
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
QUnit.module('ModuleManager');
QUnit.test('Loading 3 simple modules', function () {
    QUnit.expect(3);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'a1.js') {
                mm.enqueueDefineAnonymousModule([], 'a1');
                loadCallback();
            }
            else if (scriptPath === 'a2.js') {
                mm.defineModule('a2', [], 'a2', null, null);
                loadCallback();
            }
            else {
                QUnit.ok(false);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a', ['a1', 'a2'], function (a1, a2) {
        QUnit.equal(a1, 'a1');
        QUnit.equal(a2, 'a2');
        return 'a';
    }, null, null);
    QUnit.equal(mm.synchronousRequire('a'), 'a');
});
QUnit.test('Loading a plugin dependency', function () {
    QUnit.expect(5);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'plugin.js') {
                mm.enqueueDefineAnonymousModule([], {
                    normalize: function (pluginParam, normalize) {
                        return normalize(pluginParam);
                    },
                    load: function (pluginParam, parentRequire, loadCallback, options) {
                        parentRequire([pluginParam], function (v) { return loadCallback(v); });
                    }
                });
                loadCallback();
            }
            else if (scriptPath === 'a/b/d.js') {
                mm.enqueueDefineAnonymousModule([], 'r');
                loadCallback();
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a/b/c', ['../../plugin!./d', 'require'], function (r, req) {
        QUnit.equal(r, 'r');
        QUnit.equal(req.toUrl('./d.txt'), 'a/b/d.txt');
        return 'a/b/c';
    }, null, null);
    QUnit.equal(mm.synchronousRequire('a/b/c'), 'a/b/c');
    mm.defineModule('a2', ['./plugin!a/b/d'], function (r) {
        QUnit.equal(r, 'r');
        return 'a2';
    }, null, null);
    QUnit.equal(mm.synchronousRequire('a2'), 'a2');
});
QUnit.test('Loading a dependency cycle', function () {
    QUnit.expect(6);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'b.js') {
                mm.enqueueDefineAnonymousModule(['c'], function (c) {
                    // This is how the cycle is broken. One of the modules receives undefined as the argument value
                    QUnit.equal(c, 'c');
                    return 'b';
                });
                loadCallback();
            }
            else if (scriptPath === 'c.js') {
                mm.enqueueDefineAnonymousModule(['a'], function (a) {
                    // This is how the cycle is broken. One of the modules receives undefined as the argument value
                    QUnit.deepEqual(a, {});
                    // QUnit.ok(typeof a === 'undefined');
                    return 'c';
                });
                loadCallback();
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a', ['b'], function (b) {
        QUnit.equal(b, 'b');
        return 'a';
    }, null, null);
    QUnit.equal(mm.synchronousRequire('a'), 'a');
    QUnit.equal(mm.synchronousRequire('b'), 'b');
    QUnit.equal(mm.synchronousRequire('c'), 'c');
});
QUnit.test('Using a local error handler immediate script loading failure', function () {
    QUnit.expect(1);
    // a -> b and b fails to load
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'b.js') {
                errorCallback('b.js not found');
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a', ['b'], function (b) {
        QUnit.equal(b, 'b');
        return 'a';
    }, function (err) {
        QUnit.equal(err.message, 'b.js not found');
    }, null);
});
QUnit.test('Using a local error handler secondary script loading failure', function () {
    QUnit.expect(1);
    // a -> b -> c and c fails to load
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'b.js') {
                mm.enqueueDefineAnonymousModule(['c'], function (c) {
                    QUnit.equal(c, 'c');
                    return 'b';
                });
                loadCallback();
            }
            else if (scriptPath === 'c.js') {
                errorCallback('c.js not found');
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a', ['b'], function (b) {
        QUnit.ok(false);
    }, function (err) {
        QUnit.equal(err.message, 'c.js not found');
    }, null);
});
QUnit.test('RelativeRequire error handler', function () {
    QUnit.expect(1);
    var dne = 'Does not exist';
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            errorCallback(new Error(dne));
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('a/b/d', ['require'], function (relativeRequire) {
        relativeRequire(['doesnotexist'], undefined, function (err) {
            QUnit.deepEqual(err.message, dne);
        });
        return 'a/b/d';
    }, null, null);
});
QUnit.module('FallBack Tests');
QUnit.test('No path config', function () {
    QUnit.expect(1);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'a.js') {
                errorCallback('a.js not found');
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('first', ['a'], function () {
        QUnit.ok(false, 'a should not be found');
    }, function (err) {
        QUnit.ok(true, 'a should not be found');
    }, null);
});
QUnit.test('With path config', function () {
    QUnit.expect(1);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'alocation.js') {
                errorCallback('alocation.js not found');
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.configure({
        paths: {
            a: 'alocation.js'
        }
    }, false);
    mm.defineModule('first', ['a'], function () {
        QUnit.ok(false, 'a should not be found');
    }, function (err) {
        QUnit.ok(true, 'a should not be found');
    }, null);
});
QUnit.test('With one fallback', function () {
    QUnit.expect(1);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'alocation.js') {
                errorCallback('alocation.js not found');
            }
            else if (scriptPath === 'afallback.js') {
                mm.enqueueDefineAnonymousModule([], function () {
                    return 'a';
                });
                loadCallback();
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.configure({
        paths: {
            a: ['alocation.js', 'afallback.js']
        }
    }, false);
    mm.defineModule('first', ['a'], function () {
        QUnit.ok(true, 'a was found');
    }, function (err) {
        QUnit.ok(false, 'a was not found');
    }, null);
});
QUnit.test('With two fallbacks', function () {
    QUnit.expect(1);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            if (scriptPath === 'alocation.js') {
                errorCallback('alocation.js not found');
            }
            else if (scriptPath === 'afallback.js') {
                errorCallback('afallback.js not found');
            }
            else if (scriptPath === 'anotherfallback.js') {
                mm.enqueueDefineAnonymousModule([], function () {
                    return 'a';
                });
                loadCallback();
            }
            else {
                QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
            }
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.configure({
        paths: {
            a: ['alocation.js', 'afallback.js', 'anotherfallback.js']
        }
    }, false);
    mm.defineModule('first', ['a'], function () {
        QUnit.ok(true, 'a was found');
    }, function (err) {
        QUnit.ok(false, 'a was not found');
    }, null);
});
QUnit.module('Bugs');
QUnit.test('Bug #11710: [loader] Loader can enter a stale-mate when the last dependency to resolve is a (missing) plugin dependency', function () {
    QUnit.expect(2);
    // A script loader that captures the load request for 'plugin.js'
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    // Define the resolved plugin value
    mm.defineModule('plugin!pluginParam', [], function () {
        return {
            value: 5
        };
    }, function (err) {
        QUnit.ok(false);
    }, null);
    // Ask for the plugin
    mm.defineModule('a', ['plugin!pluginParam'], function (b) {
        QUnit.equal(b.value, 5);
        return {
            value: b.value * 2
        };
    }, function (err) {
        QUnit.ok(false);
    }, null);
    // Depend on a module that asks for the plugin
    mm.defineModule('b', ['a'], function (a) {
        QUnit.equal(a.value, 10);
    }, function (err) {
        QUnit.ok(false);
    }, null);
});
QUnit.test('Bug #12024: [loader] Should not append .js to URLs containing query string', function () {
    var config = new loader.Configuration(new loader.Environment(), {
        baseUrl: 'prefix',
        paths: {
            'searchBoxJss': 'http://services.social.microsoft.com/search/Widgets/SearchBox.jss?boxid=HeaderSearchTextBox&btnid=HeaderSearchButton&brand=Msdn&loc=en-us&Refinement=198,234&focusOnInit=false&iroot=vscom&emptyWatermark=true&searchButtonTooltip=Search here'
        }
    });
    // No .js is appended
    QUnit.equal(config.moduleIdToPaths('searchBoxJss'), 'http://services.social.microsoft.com/search/Widgets/SearchBox.jss?boxid=HeaderSearchTextBox&btnid=HeaderSearchButton&brand=Msdn&loc=en-us&Refinement=198,234&focusOnInit=false&iroot=vscom&emptyWatermark=true&searchButtonTooltip=Search here');
});
QUnit.test('Bug #12020: [loader] relative (synchronous) require does not normalize plugin argument that follows "!"', function () {
    QUnit.expect(3);
    var scriptLoader = {
        load: function (moduleManager, scriptPath, loadCallback, errorCallback) {
            QUnit.ok(false, 'Unexpected scriptPath: ' + scriptPath);
        },
    };
    var mm = new loader.ModuleManager(new loader.Environment(), scriptLoader, null, null);
    mm.defineModule('plugin!a/b/c', [], function () {
        QUnit.ok(true);
        return 'plugin!a/b/c';
    }, null, null);
    mm.defineModule('a/b/d', ['require'], function (relativeRequire) {
        QUnit.ok(true);
        QUnit.equal(relativeRequire('plugin!./c'), 'plugin!a/b/c');
        return 'a/b/d';
    }, null, null);
});
QUnit.test('Utilities.fileUriToFilePath', function () {
    var test = function (isWindows, input, expected) {
        QUnit.equal(loader.Utilities.fileUriToFilePath(isWindows, input), expected, 'Result for ' + input);
    };
    test(true, 'file:///c:/alex.txt', 'c:/alex.txt');
    test(true, 'file://monacotools/isi.txt', '//monacotools/isi.txt');
    test(true, 'file://monacotools1/certificates/SSL/', '//monacotools1/certificates/SSL/');
    test(false, 'file:///c:/alex.txt', '/c:/alex.txt');
    test(false, 'file://monacotools/isi.txt', 'monacotools/isi.txt');
    test(false, 'file://monacotools1/certificates/SSL/', 'monacotools1/certificates/SSL/');
});
QUnit.test('Utilities.containsQueryString', function () {
    var test = function (input, expected) {
        QUnit.equal(loader.Utilities.containsQueryString(input), expected, 'Result for ' + input);
    };
    test('http://www.microsoft.com/something?q=123&r=345#bangbang', true);
    test('http://www.microsoft.com/something#bangbang', false);
    test('http://www.microsoft.com/something#bangbang?asd=3', false);
    test('http://www.microsoft.com/something#?asd=3', false);
});
