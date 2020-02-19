const gulp = require('gulp');
const rollup = require('gulp-better-rollup');
const babel = require('rollup-plugin-babel');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const builtins = require('rollup-plugin-node-builtins')

gulp.task('build', () => {
  return gulp.src('src/index.js')
    .pipe(rollup({ plugins: [babel(), resolve(), commonjs(), builtins()] }, 'umd'))
    .pipe(gulp.dest('dist/'));
});