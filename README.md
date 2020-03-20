# HoloPlayCore.js

This is a Javascript library to communicate with Looking Glass HoloPlay Service.

## Installation

```
npm install --save holoplay-core 
```

## Usage

Include in html with script tag: (use holoplaycore.min.js for the minified version)
```
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
```
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
or load from a CDN:
```
<script src="https://unpkg.com/holoplay-core"></script>
```
or in node:
```
const HoloPlayCore = require('holoplay-core');
const client = new HoloPlayCore.Client(
      (msg) => {
        console.log('Calibration values:', msg);
      },
      (err) => {
        console.error('Error creating HoloPlay client:', err);
      });
```

## Building the HoloPlayCore library

The build script will output to the "dist" folder.
```
git clone https://github.com/Looking-Glass/holoplaycore.js
cd holoplaycore.js
npm install
npm run-script build
```
