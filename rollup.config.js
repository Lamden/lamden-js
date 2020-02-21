import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import globals from 'rollup-plugin-node-globals';

module.exports = {
    input: 'src/index.js',
    output: {
      	file: 'dist/lamden.js',
      	format: 'cjs'
    },
    plugins: [
		resolve({preferBuiltins: true}),
		commonjs(),
		globals(),
		builtins()
	]
};