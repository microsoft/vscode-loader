
config({
	baseUrl: '.',
	paths:{'doublefoo':['doublefoo0', 'doublefoo1', 'doublefoo2']}
});
go( ["_reporter", "doublefoo"],
	function (amdJS, doublefoo) {
		amdJS.assert("doublefoo2" === doublefoo.name, "fallback_double_fallback: doublefoo.name:"+ doublefoo.name);
		amdJS.print("DONE", "done");
	});
