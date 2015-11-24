
config({
	baseUrl: '.',
	paths:{'a':['a', 'alt']}
});
go( ["_reporter", "a"],
	function (amdJS, a) {
		amdJS.assert("a" === a.name, "fallback_original_works: a.name:"+ a.name);
		amdJS.print("DONE", "done");
	});
