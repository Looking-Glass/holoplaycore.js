/**
 * This files defines the HoloPlayClient class and Message class.
 *
 * Copyright (c) [2019] [Looking Glass Factory]
 *
 * @link    https://lookingglassfactory.com/
 * @file    This files defines the HoloPlayClient class and Message class.
 * @author  Looking Glass Factory.
 * @version 0.0.8
 * @license SEE LICENSE IN LICENSE.md
 */

import CBOR from 'cbor-js';

// Polyfill WebSocket for nodejs applications.
const WebSocket =
    typeof window === 'undefined' ? require('ws') : window.WebSocket;

/** Class representing a client to communicates with the HoloPlayService. */
export class Client {
  /**
   * Establish a client to talk to HoloPlayService.
   * @constructor
   * @param {function} initCallback - optional; a function to trigger when
   *     response is received
   * @param {function} errCallback - optional; a function to trigger when there
   *     is a connection error
   * @param {function} closeCallback - optional; a function to trigger when the
   *     socket is closed
   * @param {boolean} debug - optional; default is false
   * @param {string}  appId - optional
   * @param {boolean} isGreedy - optional
   * @param {string}  oncloseBehavior - optional, can be 'wipe', 'hide', 'none'
   */
  constructor(
      initCallback, errCallback, closeCallback, debug = false, appId, isGreedy,
      oncloseBehavior) {
    this.reqs = [];
    this.reps = [];
    this.requestId = this.getRequestId();
    this.debug = debug;
    this.isGreedy = isGreedy;
    this.errCallback = errCallback;
    this.closeCallback = closeCallback;
    this.alwaysdebug = false;
    this.isConnected = false;
    let initCmd = null;
    if (appId || isGreedy || oncloseBehavior) {
      initCmd = new InitMessage(appId, isGreedy, oncloseBehavior, this.debug);
    } else {
      if (debug) this.alwaysdebug = true;
      if (typeof initCallback == 'function') initCmd = new InfoMessage();
    }
    this.openWebsocket(initCmd, initCallback);
  }
  /**
   * Send a message over the websocket to HoloPlayService.
   * @public
   * @param {Message} msg - message object
   * @param {integer} timeoutSecs - optional, default is 60 seconds
   */
  sendMessage(msg, timeoutSecs = 60) {
    if (this.alwaysdebug) msg.cmd.debug = true;
    let cborData = msg.toCbor();
    return this.sendRequestObj(cborData, timeoutSecs);
  }
  /**
   * Disconnects from the web socket.
   * @public
   */
  disconnect() {
    this.ws.close();
  }
  /**
   * Open a websocket and set handlers
   * @private
   */
  openWebsocket(firstCmd = null, initCallback = null) {
    this.ws =
        new WebSocket('ws://localhost:11222/driver', ['rep.sp.nanomsg.org']);
    this.ws.parent = this;
    this.ws.binaryType = 'arraybuffer';
    this.ws.onmessage = this.messageHandler;
    this.ws.onopen = (() => {
      this.isConnected = true;
      if (this.debug) {
        console.log('socket open');
      }
      if (firstCmd != null) {
        this.sendMessage(firstCmd).then(initCallback);
      }
    });
    this.ws.onerror = this.onSocketError;
    this.ws.onclose = this.onClose;
  }
  /**
   * Send a request object over websocket
   * @private
   */
  sendRequestObj(data, timeoutSecs) {
    return new Promise((resolve, reject) => {
      let reqObj = {
        id: this.requestId++,
        parent: this,
        payload: data,
        success: resolve,
        error: reject,
        send: function() {
          if (this.debug)
            console.log('attemtping to send request with ID ' + this.id);
          this.timeout = setTimeout(reqObj.send.bind(this), timeoutSecs * 1000);
          let tmp = new Uint8Array(data.byteLength + 4);
          let view = new DataView(tmp.buffer);
          view.setUint32(0, this.id);
          tmp.set(new Uint8Array(this.payload), 4);
          this.parent.ws.send(tmp.buffer);
        }
      };
      this.reqs.push(reqObj);
      reqObj.send();
    });
  }
  /**
   * Handles a message when received
   * @private
   */
  messageHandler(event) {
    console.log('message');
    let data = event.data;
    if (data.byteLength < 4) return;
    let view = new DataView(data);
    let replyId = view.getUint32(0);
    if (replyId < 0x80000000) {
      this.parent.err('bad nng header');
      return;
    }
    let i = this.parent.findReqIndex(replyId);
    if (i == -1) {
      this.parent.err('got reply that doesn\'t match known request!');
      return;
    }
    let rep = {id: replyId, payload: CBOR.decode(data.slice(4))};
    if (rep.payload.error == 0) {
      this.parent.reqs[i].success(rep.payload);
    } else {
      this.parent.reqs[i].error(rep.payload);
    }
    clearTimeout(this.parent.reqs[i].timeout);
    this.parent.reqs.splice(i, 1);
    this.parent.reps.push(rep);
    if (this.debug) {
      console.log(rep.payload);
    }
  }
  getRequestId() {
    return Math.floor(this.prng() * (0x7fffffff)) + 0x80000000;
  }
  onClose(event) {
    this.parent.isConnected = false;
    if (this.parent.debug) {
      console.log('socket closed');
    }
    if (typeof this.parent.closeCallback == 'function')
      this.parent.closeCallback(event);
  }
  onSocketError(error) {
    if (this.parent.debug) {
      console.log(error);
    }
    if (typeof this.parent.errCallback == 'function') {
      this.parent.errCallback(error);
    }
  }
  err(errorMsg) {
    if (this.debug) {
      console.log('[DRIVER ERROR]' + errorMsg);
    }
    // TODO : make this return an event obj rather than a string
    // if (typeof this.errCallback == 'function')
    //   this.errCallback(errorMsg);
  }
  findReqIndex(replyId) {
    let i = 0;
    for (; i < this.reqs.length; i++) {
      if (this.reqs[i].id == replyId) {
        return i;
      }
    }
    return -1;
  }
  prng() {
    if (this.rng == undefined) {
      this.rng = generateRng();
    }
    return this.rng();
  }
}

/** A class to represent messages being sent over to HoloPlay Service */
export class Message {
  /**
   * Construct a barebone message.
   * @constructor
   */
  constructor(cmd, bin) {
    this.cmd = cmd;
    this.bin = bin;
  }
  /**
   * Convert the class instance to the CBOR format
   * @public
   * @returns {CBOR} - cbor object of the message
   */
  toCbor() {
    return CBOR.encode(this);
  }
}
/** Message to init. Extends the base Message class. */
export class InitMessage extends Message {
  /**
   * @constructor
   * @param {string}  appId - a unique id for app
   * @param {boolean} isGreedy - will it take over screen
   * @param {string}  oncloseBehavior - can be 'wipe', 'hide', 'none'
   */
  constructor(appId = '', isGreedy = false, onclose = '', debug = false) {
    let cmd = {'init': {}};
    if (appId != '') cmd['init'].appid = appId;
    if (onclose != '') cmd['init'].onclose = onclose;
    if (isGreedy) cmd['init'].greedy = true;
    if (debug) cmd['init'].debug = true;
    super(cmd, null);
  }
}
/** Delete a quilt from HoloPlayService. Extends the base Message class. */
export class DeleteMessage extends Message {
  /**
   * @constructor
   * @param {string} name - name of the quilt
   */
  constructor(name = '') {
    let cmd = {'delete': {'name': name}};
    super(cmd, null);
  }
}
/** Check if a quilt exist in cache. Extends the base Message class. */
export class CheckMessage extends Message {
  /**
   * @constructor
   * @param {string} name - name of the quilt
   */
  constructor(name = '') {
    let cmd = {'check': {'name': name}};
    super(cmd, null);
  }
}
/** Wipes the image in Looking Glass and displays the background image */
export class WipeMessage extends Message {
  /**
   * @constructor
   * @param {number} targetDisplay - optional, if not provided, default is 0
   */
  constructor(targetDisplay = null) {
    let cmd = {'wipe': {}};
    if (targetDisplay != null) cmd['wipe'].targetDisplay = targetDisplay;
    super(cmd, null);
  }
}
/** Get info from the HoloPlayService */
export class InfoMessage extends Message {
  /**
   * @constructor
   */
  constructor() {
    let cmd = {'info': {}};
    super(cmd, null);
  }
}
/** Get shader uniforms from HoloPlayService */
export class UniformsMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor() {
    let cmd = {'uniforms': {}};
    super(cmd, bindata);
  }
}
/** Get GLSL shader code from HoloPlayService */
export class ShaderMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor() {
    let cmd = {'shader': {}};
    super(cmd, bindata);
  }
}
/** Show a quilt in the Looking Glass with the binary data of quilt provided */
export class ShowMessage extends Message {
  /**
   * @constructor
   * @param {object}
   */
  constructor(
      settings = {vx: 5, vy: 9, aspect: 1.6}, bindata = '',
      targetDisplay = null) {
    let cmd = {
      'show': {
        'source': 'bindata',
        'quilt': {'type': 'image', 'settings': settings}
      }
    };
    if (targetDisplay != null) cmd['show']['targetDisplay'] = targetDisplay;
    super(cmd, bindata);
  }
}
/** extends the base Message class */
export class CacheMessage extends Message {
  constructor(
      name, settings = {vx: 5, vy: 9, aspect: 1.6}, bindata = '',
      show = false) {
    let cmd = {
      'cache': {
        'show': show,
        'quilt': {
          'name': name,
          'type': 'image',
          'settings': settings,
        }
      }
    };
    super(cmd, bindata);
  }
}

export class ShowCachedMessage extends Message {
  constructor(name, targetDisplay = null, settings = null) {
    let cmd = {'show': {'source': 'cache', 'quilt': {'name': name}}};
    if (targetDisplay != null) cmd['show']['targetDisplay'] = targetDisplay;
    if (settings != null) cmd['show']['quilt'].settings = settings;
    super(cmd, null);
  }
}
/* helper function */
function generateRng() {
  function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353), h = h << 13 | h >>> 19;
    return function() {
      h = Math.imul(h ^ h >>> 16, 2246822507);
      h = Math.imul(h ^ h >>> 13, 3266489909);
      return (h ^= h >>> 16) >>> 0;
    }
  }
  function xoshiro128ss(a, b, c, d) {
    return (() => {
      var t = b << 9, r = a * 5;
      r = (r << 7 | r >>> 25) * 9;
      c ^= a;
      d ^= b;
      b ^= c;
      a ^= d;
      c ^= t;
      d = d << 11 | d >>> 21;
      return (r >>> 0) / 4294967296;
    })
  };
  var state = Date.now();
  var seed = xmur3(state.toString());
  return xoshiro128ss(seed(), seed(), seed(), seed());
}
