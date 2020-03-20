const HoloPlayCore = require('../../dist/holoplaycore.js');

const client = new HoloPlayCore.Client(
    (msg) => {
      console.log('Calibration loaded', msg);
      process.exit();
    },
    (err) => {
      console.error('Error while creating client.', err);
      process.exit();
    });
