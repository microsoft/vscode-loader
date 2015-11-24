
// if a module appears in the array of modules of a bundle
// baseUrl + bundle.path

config({
	baseUrl: '.',
	bundles: {
		'bundles/bundle1.js?queryparam=abcdef': ['a/b/c', 'a/b/d', 'a/b/e']
	}
});
go(     ["_reporter", "a/b/c", "a/b/d", "a/b/e", "a/b/c/foo" ],
function (amdJS,       abc,     abd,    abe,      abcfoo) {
	amdJS.assert(1 === window.bundle1_load_count, "tfs_scenario: bundle1 is loaded only once");
	window.bundle1_load_count = 0;
	amdJS.assert("abc" === abc.name, "tfs_scenario: abc.name");
	amdJS.assert("abd" === abd.name, "tfs_scenario: abd.name");
	amdJS.assert("abe" === abe.name, "tfs_scenario: abe.name");
	amdJS.assert("abc" === abe.abcName, "tfs_scenario: abc.name via abe");
	amdJS.assert("foo" === abcfoo.name, "tfs_scenario: foo.name");
	amdJS.print("DONE", "done");
});
