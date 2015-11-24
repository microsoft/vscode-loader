window.bundle1_load_count = window.bundle1_load_count || 0;
window.bundle1_load_count++;
define("a/b/c", function() {
	return {
		name: "abc"
	}
});
define("a/b/d", function() {
	return {
		name: "abd"
	}
});
define("a/b/e", ["a/b/c"], function(abc) {
	return {
		name: "abe",
		abcName: abc.name
	}
});