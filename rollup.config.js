import babel from 'rollup-plugin-babel'
import flow from 'rollup-plugin-flow'
import nodeResolve from 'rollup-plugin-node-resolve'

export default {
  input: 'lib/index.js',
  output: [
    {
      file: 'dist/basic-parser.js',
      format: 'es',
      exports: 'named',
    },
    {
      file: 'dist/basic-parser.umd.js',
      format: 'umd',
      exports: 'named',
      name: 'basicParser',
    },
  ],
  plugins: [
    flow(),
    babel({
      exclude: 'node_modules/**',
      presets: ['es2015-rollup', 'stage-0'],
    }),
    nodeResolve(),
  ],
}
