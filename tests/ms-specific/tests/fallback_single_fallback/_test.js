
config({
	baseUrl: '.',
	paths:{'a':['foonothere', 'foofallback']}
});
go( ["_reporter", "a"],
	function (amdJS, foonothere) {
		amdJS.assert("foofallback" === foonothere.name, "fallback_single_fallback: foonothere.name:" + foonothere.name);
		amdJS.print("DONE", "done");
	});
