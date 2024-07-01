/**
 * This files defines the HoloPlayClient class and Message class.
 *
 * Copyright (c) [2024] [Looking Glass Factory]
 *
 * @link    https://lookingglassfactory.com/
 * @file    This files defines the HoloPlayClient class and Message class.
 * @author  Looking Glass Factory.
 * @version 0.0.11
 * @license SEE LICENSE IN LICENSE.txt
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

//turn the shader into valid glsl
function glslifyNumbers(strings, ...values) {
  let s = strings[0];
  for (let i = 1; i < strings.length; ++i) {
    const v = values[i - 1];
    s += typeof v === 'number' ? v.toPrecision(10) : v;
    s += strings[i];
  }
  return s;
}

// export the shader for use in WebXR // cfg is defined in @lookingglass/webxr
export function Shader(cfg) {

  const pitch = glslifyNumbers`${cfg.pitch}`
  const slope = glslifyNumbers`${cfg.tilt}`
  const center = glslifyNumbers`${cfg.calibration.center.value}`
  const subp = glslifyNumbers`${cfg.subp}`
  const tileCount = glslifyNumbers`${cfg.numViews}`
  const tilesX = glslifyNumbers`${cfg.quiltWidth}`
  const tilesY = glslifyNumbers`${cfg.quiltHeight}`
  const subpixelCellCount =`${Math.round(cfg.calibration.subpixelCells.length)}`
  const cellPatternType = `${Math.round(cfg.subpixelMode)}`
  const framebufferWidth = glslifyNumbers`${cfg.framebufferWidth}`
  const framebufferHeight = glslifyNumbers`${cfg.framebufferHeight}`
  const tileHeight = glslifyNumbers`${cfg.tileHeight}`
  const tileWidth = glslifyNumbers`${cfg.tileWidth}`
  const quiltWidth = glslifyNumbers`${cfg.quiltWidth}`
  const quiltHeight = glslifyNumbers`${cfg.quiltHeight}`
  const screenWidth = glslifyNumbers`${cfg.calibration.screenW.value}`
  const screenHeight = glslifyNumbers`${cfg.calibration.screenH.value}`
  const filterMode = `${Math.round(cfg.filterMode)}`
  const gaussianSigma = glslifyNumbers`${cfg.gaussianSigma}`

  return (

    `#version 300 es
    precision mediump float;

    uniform int u_viewType;
    uniform sampler2D u_texture;
    in vec2 v_texcoord;

    const int MAX_SUBPIXELS = 60;
    uniform float subpixelData[MAX_SUBPIXELS];

    const int subpixelCellCount = ${subpixelCellCount};
    const int cellPatternType = ${cellPatternType};
    const int filter_mode = ${filterMode};
    const float gaussian_sigma = ${gaussianSigma};
    const float tileCount = ${tileCount};
    const float focus = 0.0;

    const vec2 quiltViewPortion = vec2(
      ${(quiltWidth * tileWidth) / framebufferWidth},
      ${(quiltHeight * tileHeight) / framebufferHeight});

    int GetCellForPixel(vec2 screen_uv)
    {
        int xPos = int(screen_uv.x * ${screenWidth});
        int yPos = int(screen_uv.y * ${screenHeight});
        int cell;
    
        if(cellPatternType == 0)
        {
            cell = 0;
        }
        else if(cellPatternType == 1)
        {
            // Checkerboard pattern AB
            //                      BA
            if ((yPos % 2 == 0 && xPos % 2 == 0) || (yPos % 2 != 0 && xPos % 2 != 0)) {
                cell = 0;
            } else {
                cell = 1;
            }
        }
        else if(cellPatternType == 2)
        {
            cell = xPos % 2;
        }
        else if(cellPatternType == 3)
        {
            int offset = (xPos % 2) * 2;
            cell = ((yPos + offset) % 4);
        }
        else if(cellPatternType == 4)
        {
            cell = yPos % 2;
        }
    
        return cell % subpixelCellCount;
    }

    vec2 GetQuiltCoordinates(vec2 tile_uv, int viewIndex)
    {
        float totalTiles = tileCount;
        float floaty = float(viewIndex);
        float view = clamp(floaty, 0.0, totalTiles);
        // on some platforms this is required to fix some precision issue???
        float tx = ${tilesX} - 0.00001; // just an incredibly dumb bugfix
        float tileXIndex = mod(view, tx);
        float tileYIndex = floor(view / tx);
    
        float quiltCoordU = ((tileXIndex + tile_uv.x) / tx) * quiltViewPortion.x;
        float quiltCoordV = ((tileYIndex + tile_uv.y) / ${tilesY}) * quiltViewPortion.y;
    
        vec2 quilt_uv = vec2(quiltCoordU, quiltCoordV);
    
        return quilt_uv;
    }

    float GetPixelShift(float val, int subPixel, int axis, int cell)
    {
        int index = cell * 6 + subPixel * 2 + axis;
        float offset = subpixelData[index];

        return val + offset;
    }

    vec3 GetSubpixelViews(vec2 screen_uv) {
        vec3 views = vec3(0.0);

        // calculate x contribution for each cell
        if(subpixelCellCount <= 0)
        {
            views[0] = screen_uv.x + ${subp} * 0.0;
            views[1] = screen_uv.x + ${subp} * 1.0;
            views[2] = screen_uv.x + ${subp} * 2.0;
                
    
            // calculate y contribution for each cell
            views[0] += screen_uv.y * ${slope};
            views[1] += screen_uv.y * ${slope};
            views[2] += screen_uv.y * ${slope};
        } else {
            // get the cell type for this screen space pixel
            int cell = GetCellForPixel(screen_uv);
    
            // calculate x contribution for each cell
            views[0]  = GetPixelShift(screen_uv.x, 0, 0, cell);
            views[1]  = GetPixelShift(screen_uv.x, 1, 0, cell);
            views[2]  = GetPixelShift(screen_uv.x, 2, 0, cell);
    
            // calculate y contribution for each cell
            views[0] += GetPixelShift(screen_uv.y, 0, 1, cell) * ${slope};
            views[1] += GetPixelShift(screen_uv.y, 1, 1, cell) * ${slope};
            views[2] += GetPixelShift(screen_uv.y, 2, 1, cell) * ${slope};
        }

        views *= vec3(${pitch});
        views -= vec3(${center});
        views = vec3(1.0) - fract(views);

        views = clamp(views, vec3(0.00001), vec3(0.999999));
    
        return views;
    }
    
    // this is the simplest sampling mode where we just cast the viewIndex to int and take the color from that tile.
    vec4 GetViewsColors(vec2 tile_uv, vec3 views)
    {
        vec4 color = vec4(0, 0, 0, 1);
    
        for(int channel = 0; channel < 3; channel++)
        {
            int viewIndex = int(views[channel] * tileCount);
    
            float viewDir = views[channel] * 2.0 - 1.0;
            vec2 focused_uv = tile_uv;
            focused_uv.x += viewDir * focus;
    
            vec2 quilt_uv = GetQuiltCoordinates(focused_uv, viewIndex);
            color[channel] = texture(u_texture, quilt_uv)[channel];
        }
    
        return color;
    }

    //view filtering

    vec4 OldViewFiltering(vec2 tile_uv, vec3 views)
    {
        vec3 viewIndicies = views * tileCount;
        float viewSpaceTileSize = 1.0 / tileCount;
    
        // the idea here is to sample the closest two views and lerp between them
        vec3 leftViews = views;
        vec3 rightViews = leftViews + viewSpaceTileSize;
    
        vec4 leftColor = GetViewsColors(tile_uv, leftViews);
        vec4 rightColor = GetViewsColors(tile_uv, rightViews);
    
        vec3 leftRightLerp = viewIndicies - floor(viewIndicies);
    
        return vec4(
            mix(leftColor.x, rightColor.x, leftRightLerp.x),
            mix(leftColor.y, rightColor.y, leftRightLerp.y),
            mix(leftColor.z, rightColor.z, leftRightLerp.z),
            1.0
        );
    }

    vec4 GaussianViewFiltering(vec2 tile_uv, vec3 views)
    {
        vec3 viewIndicies = views * tileCount;
        float viewSpaceTileSize = 1.0 / tileCount;
    
        // this is just sampling a center view and the left and right view
        vec3 centerViews = views;
        vec3 leftViews = centerViews - viewSpaceTileSize;
        vec3 rightViews = centerViews + viewSpaceTileSize;
    
        vec4 centerColor = GetViewsColors(tile_uv, centerViews);
        vec4 leftColor   = GetViewsColors(tile_uv, leftViews);
        vec4 rightColor  = GetViewsColors(tile_uv, rightViews);
    
        // Calculate the effective discrete view directions based on the tileCount
        vec3 centerSnappedViews = floor(centerViews * tileCount) / tileCount;
        vec3 leftSnappedViews = floor(leftViews * tileCount) / tileCount;
        vec3 rightSnappedViews = floor(rightViews * tileCount) / tileCount;
    
        // Gaussian weighting
        float sigma = gaussian_sigma;
        float multiplier = 2.0 * sigma * sigma;
    
        vec3 centerDiff = views - centerSnappedViews;
        vec3 leftDiff = views - leftSnappedViews;
        vec3 rightDiff = views - rightSnappedViews;
    
        vec3 centerWeight = exp(-centerDiff * centerDiff / multiplier);
        vec3 leftWeight = exp(-leftDiff * leftDiff / multiplier);
        vec3 rightWeight = exp(-rightDiff * rightDiff / multiplier);
    
        // Normalize the weights so they sum to 1 for each channel
        vec3 totalWeight = centerWeight + leftWeight + rightWeight;
        centerWeight /= totalWeight;
        leftWeight /= totalWeight;
        rightWeight /= totalWeight;
    
        // Weighted averaging based on Gaussian weighting for each channel
        vec4 outputColor = vec4(
            centerColor.r * centerWeight.x + leftColor.r * leftWeight.x + rightColor.r * rightWeight.x,
            centerColor.g * centerWeight.y + leftColor.g * leftWeight.y + rightColor.g * rightWeight.y,
            centerColor.b * centerWeight.z + leftColor.b * leftWeight.z + rightColor.b * rightWeight.z,
            1.0
        );
    
        return outputColor;
    }

    vec4 NGaussianViewFiltering(vec2 tile_uv, vec3 views, int n)
    {
        vec3 viewIndicies = views * tileCount;
        float viewSpaceTileSize = 1.0 / tileCount;
    
        float sigma = gaussian_sigma;  // Adjust as needed
        float multiplier = 2.0 * sigma * sigma;
    
        vec4 outputColor = vec4(0.0);
    
        for(int i = -n; i <= n; i++)
        {
            float offset = float(i) * viewSpaceTileSize;
            vec3 offsetViews = views + offset;
    
            vec4 sampleColor = GetViewsColors(tile_uv, offsetViews);
    
            // Calculate the effective discrete view directions based on the tileCount
            vec3 snappedViews = floor(offsetViews * tileCount) / tileCount;
    
            // Calculate Gaussian weights
            vec3 diff = views - snappedViews;
            vec3 weight = exp(-diff * diff / multiplier);
    
            // Accumulate color
            outputColor.rgb += sampleColor.rgb * weight;
        }
        // Normalize the color
        vec3 totalWeight = vec3(0.0);
        for(int i = -n; i <= n; i++)
        {
            float offset = float(i) * viewSpaceTileSize;
            vec3 offsetViews = views + offset;
    
            // Calculate the effective discrete view directions based on the tileCount
            vec3 snappedViews = floor(offsetViews * tileCount) / tileCount;
    
            // Calculate Gaussian weights
            vec3 diff = views - snappedViews;
            vec3 weight = exp(-diff * diff / multiplier);
    
            totalWeight += weight;
        }
    
        outputColor.rgb /= totalWeight;
        outputColor.a = 1.0;
    
        return outputColor;
    }

    float remap(float value, float from1, float to1, float from2, float to2) {
      return (value - from1) / (to1 - from1) * (to2 - from2) + from2;
    }

    out vec4 color;

    void main() {
      if (u_viewType == 2) { // "quilt" view
        color = texture(u_texture, v_texcoord);
        return;
      }
      if (u_viewType == 1) { // middle view
        color = texture(u_texture, GetQuiltCoordinates(v_texcoord.xy, ${Math.round(tileCount / 2)}));
        return;
      }

    vec3 views = GetSubpixelViews(v_texcoord);

    if(filter_mode == 0)
        {
            color = GetViewsColors(v_texcoord, views);
        }
        else if(filter_mode == 1)
        {
            color = OldViewFiltering(v_texcoord, views);
        }
        else if(filter_mode == 2)
        {
            color = GaussianViewFiltering(v_texcoord, views);
        }
        else if(filter_mode == 3)
        {
            color = NGaussianViewFiltering(v_texcoord, views, 10);
        }
    }
  `)
}
