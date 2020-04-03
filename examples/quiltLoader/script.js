var client;
var rawData;

document.getElementById('show-quilt')
    .addEventListener('click', sendShowCommand);
document.getElementById('reset').addEventListener('click', resetValue);
document.getElementById('files').addEventListener(
    'change', handleFileSelect, false);
var quilts = document.getElementsByClassName('example-img');
for (var i = 0; i < quilts.length; i++) {
  quilts[i].addEventListener('click', selectQuilt);
}

client = new HoloPlayCore.Client();

function handleFileSelect(evt) {
  var f = evt.target.files[0];
  if (!f.type.match('image.*')) {
    return;
  }
  var reader = new FileReader();
  reader.onload = (function(theFile) {
    return function(e) {
      document.getElementById('info').innerHTML +=
          'Custom file loading done.<br>';
      rawData = new Uint8Array(reader.result);
    };
  })(f);
  reader.readAsArrayBuffer(f);
}

function sendShowCommand() {
  if (rawData == undefined) {
    alert('You haven\'t selected or upload any image!');
    return;
  }
  var x = document.getElementsByName('vx')[0].value;
  var y = document.getElementsByName('vy')[0].value;
  var total = document.getElementsByName('vtotal')[0].value;
  var aspect = document.getElementsByName('aspect')[0].value;

  var showCmd =
      new HoloPlayCore.ShowMessage({vx: x, vy: y, vtotal: total, aspect: aspect}, rawData);
  client.sendMessage(showCmd)
      .then(function() {
        document.getElementById('info').innerHTML += 'Quilt displayed.<br>';
      })
      .catch(function(err) {
        console.log(err);
      });
}

function selectQuilt(e) {
  let quiltName = e.target.name;
  let url = exampleQuilts[quiltName][1];
  loadExampleQuilt(url);
}

function resetValue() {
  document.getElementsByName('vx')[0].value = 5;
  document.getElementsByName('vy')[0].value = 9;
  document.getElementsByName('vtotal')[0].value = 45;
  document.getElementsByName('aspect')[0].value = 1.6;
}

let exampleQuilts = {
  'missy': [
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2Fmissythumbnail.png?v=1570475282485',
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2Fbearbrick.jpeg?v=1570475011853'
  ],
  'knife': [
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2Fknife-thumbnail.jpg?v=1570475612945',
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2FSwissArmy.jpg?v=1570475612344'
  ],
  'assassin': [
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2Fassassinthumb.png?v=1570475736268',
    'https://cdn.glitch.com/56625e09-c2b3-4171-96a8-c2f27991ffd4%2Fassasinscreed.jpeg?v=1570475738759'
  ]
};

function loadExampleQuilt(quiltUrl) {
  var xhttp = new XMLHttpRequest();
  xhttp.responseType = 'arraybuffer';
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
      if (this.status == 200) {
        rawData = new Uint8Array(this.response);
        document.getElementById('info').innerHTML += 'Image loading done. Press the "Send Quilt to Looking Glass" button now.<br>';
      } else {
        console.log('Could not load ' + quiltUrl + '.');
      }
    }
  };
  xhttp.open('GET', quiltUrl, true);
  xhttp.send();
}
