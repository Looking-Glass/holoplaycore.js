import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'src/HoloPlayCore.js',
    output: {
      file: 'dist/holoplaycore.js',
      format: 'umd',
      name: 'HoloPlayCore',
    },
    plugins: [resolve(), commonjs()],
  },
  {
    input: 'src/HoloPlayCore.js',
    output: {
      file: 'dist/holoplaycore.module.js',
      format: 'esm',
    },
    plugins: [resolve(), commonjs()],
  },
]
