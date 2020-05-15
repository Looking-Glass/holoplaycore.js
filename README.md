# HoloPlayCore.js

[![npm version](https://badge.fury.io/js/holoplay-core.svg)](https://badge.fury.io/js/holoplay-core)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/holoplay-core)
![npm](https://img.shields.io/npm/dm/holoplay-core)

The HoloPlay Core SDK unlocks the ability to integrate your existing 3D software with Looking Glass displays, making the Looking Glass a holographic second monitor.
This JavaScript version is ideal for web front-end and Node development. 
There's also a [native dynamic library version](https://github.com/Looking-Glass/HoloPlayCoreSDK) for Windows, Mac, and Linux.

[NPM Package](https://www.npmjs.com/package/holoplay-core) — [Documentation](http://docs.lookingglassfactory.com/HoloPlayCore/)
— [Forum](https://forum.lookingglassfactory.com/) — [Discord](https://discord.gg/d49u8J) — [Official Site](https://lookingglassfactory.com/)

## Installation

From npm:
```
npm install --save holoplay-core 
```

From CDN:
```
<script src="https://unpkg.com/holoplay-core"></script>
```

## Usage

Include in html with script tag: (use holoplaycore.min.js for the minified version)
```Javascript
<script src="./node_modules/holoplay-core/dist/holoplaycore.js"></script>
<script>
  const client = new HoloPlayCore.Client(
      (msg) => {
        console.log('Calibration values:', msg);
      },
      (err) => {
        console.error('Error creating HoloPlay client:', err);
      });
</script>
```
or skip the script tag and import the ES6 module (note the different filename!):
```JavaScript
<script type="module">
  import * as HoloPlayCore from './node_modules/holoplay-core/dist/holoplaycore.module.js';
  const client = new HoloPlayCore.Client(
      (msg) => {
        console.log('Calibration values:', msg);
      },
      (err) => {
        console.error('Error creating HoloPlay client:', err);
      });
</script>
```

or in node:
```Javascript
const HoloPlayCore = require('holoplay-core');
const client = new HoloPlayCore.Client(
      (msg) => {
        console.log('Calibration values:', msg);
      },
      (err) => {
        console.error('Error creating HoloPlay client:', err);
      });
```

## Build

If you're developing HoloPlayCore.js and want to rebuild the dist version of this library, see [BUILD.md](./BUILD.md).
