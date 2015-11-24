
var continuation = function() {
	console.error('Control misconfigured, needs continuation function');
};

exports.setContinuation = function(_continuation) {
	continuation = _continuation;
}

exports.ok = function() {
	continuation(null);
}

exports.err = function(err) {
	continuation(err ? err : new Error('Unknown error'));
}