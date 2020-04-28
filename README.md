# HoloPlayCore.js

[![npm version](https://badge.fury.io/js/holoplay-core.svg)](https://badge.fury.io/js/holoplay-core)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/holoplay-core)
![npm](https://img.shields.io/npm/dm/holoplay-core)

This is a Javascript library to communicate with Looking Glass HoloPlay Service.

[NPM Package](https://www.npmjs.com/package/holoplay-core) — [Documentation](https://docs.lookingglassfactory.com/)
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
```Javascript
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
