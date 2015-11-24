var tsc = require('gulp-typescript');
var gulp = require('gulp');

gulp.task('compile', function() {
	return (
		gulp.src([
			'**/*.ts',
			'!node_modules/**',
		])
		.pipe(tsc({
			target: 'es5'
		}))
		.js
		.pipe(gulp.dest('.'))
	)
});

gulp.task('watch', function() {
	gulp.watch([
		'src/**/*.ts',
		'tests/**/*.ts'
	], ['compile']);
});
