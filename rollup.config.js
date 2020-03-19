export default [
  {
    input: 'src/HoloPlayCore.js',
    output: {
      file: 'dist/holoplaycore.js',
      format: 'umd',
      name: 'HoloPlay.Core',
    },
  },
  {
    input: 'src/HoloPlayCore.js',
    output: {
      file: 'dist/holoplaycore.module.js',
      format: 'esm',
    }
  },
]
