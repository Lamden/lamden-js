'use strict';

var global$1 = (typeof global !== "undefined" ? global :
            typeof self !== "undefined" ? self :
            typeof window !== "undefined" ? window : {});

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init () {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}

function toByteArray (b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders);

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len;

  var L = 0;

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = (tmp >> 16) & 0xFF;
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var output = '';
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[(tmp << 4) & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    output += lookup[tmp >> 10];
    output += lookup[(tmp >> 4) & 0x3F];
    output += lookup[(tmp << 2) & 0x3F];
    output += '=';
  }

  parts.push(output);

  return parts.join('')
}

function read (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
}

var toString = {}.toString;

var isArray = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

var INSPECT_MAX_BYTES = 50;

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
  ? global$1.TYPED_ARRAY_SUPPORT
  : true;

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192; // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype;
  return arr
};

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
};

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
};

function allocUnsafe (that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
};

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);

  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }
  return that
}

function fromObject (that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len);
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;

function slowToString (encoding, start, end) {
  var loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true;

function swap (b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer.prototype.toString = function toString () {
  var length = this.length | 0;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer.prototype.equals = function equals (b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
};

Buffer.prototype.inspect = function inspect () {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>'
};

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);

  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];

  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4)
};

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4)
};

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8)
};

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = (value & 0xff);
  return offset + 1
};

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24);
    this[offset + 2] = (value >>> 16);
    this[offset + 1] = (value >>> 8);
    this[offset] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
    this[offset + 2] = (value >>> 16);
    this[offset + 3] = (value >>> 24);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}


function base64ToBytes (str) {
  return toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}


// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
}

function isFastBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

function __param(paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
}

function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

function __exportStar(m, exports) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}

function __values(o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
}

function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
}

function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}

function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}
function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}

function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
}

function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
}

function __asyncValues(o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
}

function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
}
function __importStar(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result.default = mod;
    return result;
}

function __importDefault(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
}

var tslib_es6 = /*#__PURE__*/Object.freeze({
            __proto__: null,
            __extends: __extends,
            get __assign () { return __assign; },
            __rest: __rest,
            __decorate: __decorate,
            __param: __param,
            __metadata: __metadata,
            __awaiter: __awaiter,
            __generator: __generator,
            __exportStar: __exportStar,
            __values: __values,
            __read: __read,
            __spread: __spread,
            __spreadArrays: __spreadArrays,
            __await: __await,
            __asyncGenerator: __asyncGenerator,
            __asyncDelegator: __asyncDelegator,
            __asyncValues: __asyncValues,
            __makeTemplateObject: __makeTemplateObject,
            __importStar: __importStar,
            __importDefault: __importDefault
});

var mask = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });
function _makePrimitiveMaskFn(byteLength, setter) {
    return function (x) {
        var dv = new DataView(new ArrayBuffer(byteLength));
        setter.call(dv, 0, x, true);
        return dv;
    };
}
/* tslint:disable:no-unsafe-any */
exports.getFloat32Mask = _makePrimitiveMaskFn(4, DataView.prototype.setFloat32);
exports.getFloat64Mask = _makePrimitiveMaskFn(8, DataView.prototype.setFloat64);
exports.getInt16Mask = _makePrimitiveMaskFn(2, DataView.prototype.setInt16);
exports.getInt32Mask = _makePrimitiveMaskFn(4, DataView.prototype.setInt32);
exports.getInt8Mask = _makePrimitiveMaskFn(1, DataView.prototype.setInt8);
exports.getUint16Mask = _makePrimitiveMaskFn(2, DataView.prototype.setUint16);
exports.getUint32Mask = _makePrimitiveMaskFn(4, DataView.prototype.setUint32);
exports.getUint8Mask = _makePrimitiveMaskFn(1, DataView.prototype.setUint8);
/* tslint:enable:no-unsafe-any */
function getBitMask(value, bitOffset) {
    var dv = new DataView(new ArrayBuffer(1));
    if (!value)
        return dv;
    dv.setUint8(0, 1 << bitOffset % 8);
    return dv;
}
exports.getBitMask = getBitMask;
function getInt64Mask(x) {
    return x.toDataView();
}
exports.getInt64Mask = getInt64Mask;
function getUint64Mask(x) {
    return x.toDataView();
}
exports.getUint64Mask = getUint64Mask;


});

unwrapExports(mask);
var mask_1 = mask.getFloat32Mask;
var mask_2 = mask.getFloat64Mask;
var mask_3 = mask.getInt16Mask;
var mask_4 = mask.getInt32Mask;
var mask_5 = mask.getInt8Mask;
var mask_6 = mask.getUint16Mask;
var mask_7 = mask.getUint32Mask;
var mask_8 = mask.getUint8Mask;
var mask_9 = mask.getBitMask;
var mask_10 = mask.getInt64Mask;
var mask_11 = mask.getUint64Mask;

var listElementSize = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });
var ListElementSize;
(function (ListElementSize) {
    ListElementSize[ListElementSize["VOID"] = 0] = "VOID";
    ListElementSize[ListElementSize["BIT"] = 1] = "BIT";
    ListElementSize[ListElementSize["BYTE"] = 2] = "BYTE";
    ListElementSize[ListElementSize["BYTE_2"] = 3] = "BYTE_2";
    ListElementSize[ListElementSize["BYTE_4"] = 4] = "BYTE_4";
    ListElementSize[ListElementSize["BYTE_8"] = 5] = "BYTE_8";
    ListElementSize[ListElementSize["POINTER"] = 6] = "POINTER";
    ListElementSize[ListElementSize["COMPOSITE"] = 7] = "COMPOSITE";
})(ListElementSize = exports.ListElementSize || (exports.ListElementSize = {}));
exports.ListElementOffset = [
    0,
    0.125,
    1,
    2,
    4,
    8,
    8,
    NaN // composite
];


});

unwrapExports(listElementSize);
var listElementSize_1 = listElementSize.ListElementSize;
var listElementSize_2 = listElementSize.ListElementOffset;

// shim for using process in browser
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
if (typeof global$1.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof global$1.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}

function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser = true;
var env = {};
var argv = [];
var version = ''; // empty string to avoid regexp issues
var versions = {};
var release = {};
var config = {};

function noop() {}

var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;

function binding(name) {
    throw new Error('process.binding is not supported');
}

function cwd () { return '/' }
function chdir (dir) {
    throw new Error('process.chdir is not supported');
}function umask() { return 0; }

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = global$1.performance || {};
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)*1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor((clocktime%1)*1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds<0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds,nanoseconds]
}

var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1000;
}

var process = {
  nextTick: nextTick,
  title: title,
  browser: browser,
  env: env,
  argv: argv,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config,
  uptime: uptime
};

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

var ms = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

var debug = createCommonjsModule(function (module, exports) {
/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = ms;

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}
});
var debug_1 = debug.coerce;
var debug_2 = debug.disable;
var debug_3 = debug.enable;
var debug_4 = debug.enabled;
var debug_5 = debug.humanize;
var debug_6 = debug.names;
var debug_7 = debug.skips;
var debug_8 = debug.formatters;

var browser$1 = createCommonjsModule(function (module, exports) {
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit');

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}
});
var browser_1 = browser$1.log;
var browser_2 = browser$1.formatArgs;
var browser_3 = browser$1.save;
var browser_4 = browser$1.load;
var browser_5 = browser$1.useColors;
var browser_6 = browser$1.storage;
var browser_7 = browser$1.colors;

// MIT lisence
// from https://github.com/substack/tty-browserify/blob/1ba769a6429d242f36226538835b4034bf6b7886/index.js

function isatty() {
  return false;
}

function ReadStream() {
  throw new Error('tty.ReadStream is not implemented');
}

function WriteStream() {
  throw new Error('tty.ReadStream is not implemented');
}

var tty = {
  isatty: isatty,
  ReadStream: ReadStream,
  WriteStream: WriteStream
};

var inherits;
if (typeof Object.create === 'function'){
  inherits = function inherits(ctor, superCtor) {
    // implementation from standard node.js 'util' module
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  inherits = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
var inherits$1 = inherits;

var formatRegExp = /%[sdj%]/g;
function format(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
}

// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
function deprecate(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global$1.process)) {
    return function() {
      return deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

var debugs = {};
var debugEnviron;
function debuglog(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = 0;
      debugs[set] = function() {
        var msg = format.apply(null, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
}

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    _extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray$1(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var length = output.reduce(function(prev, cur) {
    if (cur.indexOf('\n') >= 0) ;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray$1(ar) {
  return Array.isArray(ar);
}

function isBoolean(arg) {
  return typeof arg === 'boolean';
}

function isNull(arg) {
  return arg === null;
}

function isNullOrUndefined(arg) {
  return arg == null;
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isString(arg) {
  return typeof arg === 'string';
}

function isSymbol(arg) {
  return typeof arg === 'symbol';
}

function isUndefined(arg) {
  return arg === void 0;
}

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}

function isFunction(arg) {
  return typeof arg === 'function';
}

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}

function isBuffer$1(maybeBuf) {
  return isBuffer(maybeBuf);
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
function log() {
  console.log('%s - %s', timestamp(), format.apply(null, arguments));
}

function _extend(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
}
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

var util = {
  inherits: inherits$1,
  _extend: _extend,
  log: log,
  isBuffer: isBuffer$1,
  isPrimitive: isPrimitive,
  isFunction: isFunction,
  isError: isError,
  isDate: isDate,
  isObject: isObject,
  isRegExp: isRegExp,
  isUndefined: isUndefined,
  isSymbol: isSymbol,
  isString: isString,
  isNumber: isNumber,
  isNullOrUndefined: isNullOrUndefined,
  isNull: isNull,
  isBoolean: isBoolean,
  isArray: isArray$1,
  inspect: inspect,
  deprecate: deprecate,
  format: format,
  debuglog: debuglog
};

var require$$2 = {};

var node = createCommonjsModule(function (module, exports) {
/**
 * Module dependencies.
 */




/**
 * This is the Node.js implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^debug_/i.test(key);
}).reduce(function (obj, key) {
  // camel-case
  var prop = key
    .substring(6)
    .toLowerCase()
    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

  // coerce string value into JS value
  var val = process.env[key];
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
  else if (val === 'null') val = null;
  else val = Number(val);

  obj[prop] = val;
  return obj;
}, {});

/**
 * The file descriptor to write the `debug()` calls to.
 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
 *
 *   $ DEBUG_FD=3 node script.js 3>debug.log
 */

var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

if (1 !== fd && 2 !== fd) {
  util.deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')();
}

var stream = 1 === fd ? process.stdout :
             2 === fd ? process.stderr :
             createWritableStdioStream(fd);

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts
    ? Boolean(exports.inspectOpts.colors)
    : tty.isatty(fd);
}

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

exports.formatters.o = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts)
    .split('\n').map(function(str) {
      return str.trim()
    }).join(' ');
};

/**
 * Map %o to `util.inspect()`, allowing multiple lines if needed.
 */

exports.formatters.O = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var name = this.namespace;
  var useColors = this.useColors;

  if (useColors) {
    var c = this.color;
    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
  } else {
    args[0] = new Date().toUTCString()
      + ' ' + name + ' ' + args[0];
  }
}

/**
 * Invokes `util.format()` with the specified arguments and writes to `stream`.
 */

function log() {
  return stream.write(util.format.apply(util, arguments) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG;
}

/**
 * Copied from `node/src/node.js`.
 *
 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
 */

function createWritableStdioStream (fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      stream = new tty.WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = require$$2;
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = require$$2;
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init (debug) {
  debug.inspectOpts = {};

  var keys = Object.keys(exports.inspectOpts);
  for (var i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  }
}

/**
 * Enable namespaces listed in `process.env.DEBUG` initially.
 */

exports.enable(load());
});
var node_1 = node.init;
var node_2 = node.log;
var node_3 = node.formatArgs;
var node_4 = node.save;
var node_5 = node.load;
var node_6 = node.useColors;
var node_7 = node.colors;
var node_8 = node.inspectOpts;

var src = createCommonjsModule(function (module) {
/**
 * Detect Electron renderer process, which is node, but we should
 * treat as a browser.
 */

if (typeof process !== 'undefined' && process.type === 'renderer') {
  module.exports = browser$1;
} else {
  module.exports = node;
}
});

var constants = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Perform some bit gymnastics to determine the native endian format.
var tmpWord = new DataView(new ArrayBuffer(8));
new Uint16Array(tmpWord.buffer)[0] = 0x0102;
/** Default size (in bytes) for newly allocated segments. */
exports.DEFAULT_BUFFER_SIZE = 4096;
exports.DEFAULT_DECODE_LIMIT = 64 << 20; // 64 MiB
/**
 * Limit to how deeply nested pointers are allowed to be. The root struct of a message will start at this value, and it
 * is decremented as pointers are dereferenced.
 */
exports.DEFAULT_DEPTH_LIMIT = 64;
/**
 * Limit to the number of **bytes** that can be traversed in a single message. This is necessary to prevent certain
 * classes of DoS attacks where maliciously crafted data can be self-referencing in a way that wouldn't trigger the
 * depth limit.
 *
 * For this reason, it is advised to cache pointers into variables and not constantly dereference them since the
 * message's traversal limit gets decremented each time.
 */
exports.DEFAULT_TRAVERSE_LIMIT = 64 << 20; // 64 MiB
/**
 * When allocating array buffers dynamically (while packing or in certain Arena implementations) the previous buffer's
 * size is multiplied by this number to determine the next buffer's size. This is chosen to keep both time spent
 * reallocating and wasted memory to a minimum.
 *
 * Smaller numbers would save memory at the expense of CPU time.
 */
exports.GROWTH_FACTOR = 1.5;
/** A bitmask applied to obtain the size of a list pointer. */
exports.LIST_SIZE_MASK = 0x00000007;
/** Maximum number of bytes to dump at once when dumping array buffers to string. */
exports.MAX_BUFFER_DUMP_BYTES = 8192;
/** The maximum value for a 32-bit integer. */
exports.MAX_INT32 = 0x7fffffff;
/** The maximum value for a 32-bit unsigned integer. */
exports.MAX_UINT32 = 0xffffffff;
/** The largest integer that can be precisely represented in JavaScript. */
exports.MAX_SAFE_INTEGER = 9007199254740991;
/** Maximum limit on the number of segments in a message stream. */
exports.MAX_STREAM_SEGMENTS = 512;
/** The smallest integer that can be precisely represented in JavaScript. */
exports.MIN_SAFE_INTEGER = -9007199254740991;
/** Minimum growth increment for a SingleSegmentArena. */
exports.MIN_SINGLE_SEGMENT_GROWTH = 4096;
/**
 * This will be `true` if the machine running this code stores numbers natively in little-endian format. This is useful
 * for some numeric type conversions when the endianness does not affect the output. Using the native endianness for
 * these operations is _slightly_ faster.
 */
exports.NATIVE_LITTLE_ENDIAN = tmpWord.getUint8(0) === 0x02;
/**
 * When packing a message, this is the number of zero bytes required after a SPAN (0xff) tag is written to the packed
 * message before the span is terminated.
 *
 * This little detail is left up to the implementation because it can be tuned for performance. Setting this to a higher
 * value may help with messages that contain a ton of text/data.
 *
 * It is imperative to never set this below 1 or else BAD THINGS. You have been warned.
 */
exports.PACK_SPAN_THRESHOLD = 2;
/**
 * How far to travel into a nested pointer structure during a deep copy; when this limit is exhausted the copy
 * operation will throw an error.
 */
exports.POINTER_COPY_LIMIT = 32;
/** A bitmask for looking up the double-far flag on a far pointer. */
exports.POINTER_DOUBLE_FAR_MASK = 0x00000004;
/** A bitmask for looking up the pointer type. */
exports.POINTER_TYPE_MASK = 0x00000003;
/** Used for some 64-bit conversions, equal to Math.pow(2, 32). */
exports.VAL32 = 0x100000000;
/** The maximum value allowed for depth traversal limits. */
exports.MAX_DEPTH = exports.MAX_INT32;
/** The maximum byte length for a single segment. */
exports.MAX_SEGMENT_LENGTH = exports.MAX_UINT32;


});

unwrapExports(constants);
var constants_1 = constants.DEFAULT_BUFFER_SIZE;
var constants_2 = constants.DEFAULT_DECODE_LIMIT;
var constants_3 = constants.DEFAULT_DEPTH_LIMIT;
var constants_4 = constants.DEFAULT_TRAVERSE_LIMIT;
var constants_5 = constants.GROWTH_FACTOR;
var constants_6 = constants.LIST_SIZE_MASK;
var constants_7 = constants.MAX_BUFFER_DUMP_BYTES;
var constants_8 = constants.MAX_INT32;
var constants_9 = constants.MAX_UINT32;
var constants_10 = constants.MAX_SAFE_INTEGER;
var constants_11 = constants.MAX_STREAM_SEGMENTS;
var constants_12 = constants.MIN_SAFE_INTEGER;
var constants_13 = constants.MIN_SINGLE_SEGMENT_GROWTH;
var constants_14 = constants.NATIVE_LITTLE_ENDIAN;
var constants_15 = constants.PACK_SPAN_THRESHOLD;
var constants_16 = constants.POINTER_COPY_LIMIT;
var constants_17 = constants.POINTER_DOUBLE_FAR_MASK;
var constants_18 = constants.POINTER_TYPE_MASK;
var constants_19 = constants.VAL32;
var constants_20 = constants.MAX_DEPTH;
var constants_21 = constants.MAX_SEGMENT_LENGTH;

var errors = createCommonjsModule(function (module, exports) {
/**
 * This file contains all the error strings used in the library. Also contains silliness.
 *
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


var trace = src.default("capnp:errors");
trace("load");
// Invariant violations (sometimes known as "precondition failed").
//
// All right, hold up the brakes. This is a serious 1 === 0 WHAT THE FAILURE moment here. Tell the SO's you won't be
// home for dinner.
exports.INVARIANT_UNREACHABLE_CODE = "CAPNP-TS000 Unreachable code detected.";
function assertNever(n) {
    throw new Error(exports.INVARIANT_UNREACHABLE_CODE + (" (never block hit with: " + n + ")"));
}
exports.assertNever = assertNever;
// Message errors.
//
// Now who told you it would be a good idea to fuzz the inputs? You just made the program sad.
exports.MSG_INVALID_FRAME_HEADER = "CAPNP-TS001 Attempted to parse an invalid message frame header; are you sure this is a Cap'n Proto message?";
exports.MSG_NO_SEGMENTS_IN_ARENA = "CAPNP-TS002 Attempted to preallocate a message with no segments in the arena.";
exports.MSG_PACK_NOT_WORD_ALIGNED = "CAPNP-TS003 Attempted to pack a message that was not word-aligned.";
exports.MSG_SEGMENT_OUT_OF_BOUNDS = "CAPNP-TS004 Segment ID %X is out of bounds for message %s.";
exports.MSG_SEGMENT_TOO_SMALL = "CAPNP-TS005 First segment must have at least enough room to hold the root pointer (8 bytes).";
// Used for methods that are not yet implemented.
//
// My bad. I'll get to it. Eventually.
exports.NOT_IMPLEMENTED = "CAPNP-TS006 %s is not implemented.";
// Pointer-related errors.
//
// Look, this is probably the hardest part of the code. Cut some slack here! You probably found a bug.
exports.PTR_ADOPT_COMPOSITE_STRUCT = "CAPNP-TS007 Attempted to adopt a struct into a composite list (%s).";
exports.PTR_ADOPT_WRONG_MESSAGE = "CAPNP-TS008 Attempted to adopt %s into a pointer in a different message %s.";
exports.PTR_ALREADY_ADOPTED = "CAPNP-TS009 Attempted to adopt %s more than once.";
exports.PTR_COMPOSITE_SIZE_UNDEFINED = "CAPNP-TS010 Attempted to set a composite list without providing a composite element size.";
exports.PTR_DEPTH_LIMIT_EXCEEDED = "CAPNP-TS011 Nesting depth limit exceeded for %s.";
exports.PTR_DISOWN_COMPOSITE_STRUCT = "CAPNP-TS012 Attempted to disown a struct member from a composite list (%s).";
exports.PTR_INIT_COMPOSITE_STRUCT = "CAPNP-TS013 Attempted to initialize a struct member from a composite list (%s).";
exports.PTR_INIT_NON_GROUP = "CAPNP-TS014 Attempted to initialize a group field with a non-group struct class.";
exports.PTR_INVALID_FAR_TARGET = "CAPNP-TS015 Target of a far pointer (%s) is another far pointer.";
exports.PTR_INVALID_LIST_SIZE = "CAPNP-TS016 Invalid list element size: %x.";
exports.PTR_INVALID_POINTER_TYPE = "CAPNP-TS017 Invalid pointer type: %x.";
exports.PTR_INVALID_UNION_ACCESS = "CAPNP-TS018 Attempted to access getter on %s for union field %s that is not currently set (wanted: %d, found: %d).";
exports.PTR_OFFSET_OUT_OF_BOUNDS = "CAPNP-TS019 Pointer offset %a is out of bounds for underlying buffer.";
exports.PTR_STRUCT_DATA_OUT_OF_BOUNDS = "CAPNP-TS020 Attempted to access out-of-bounds struct data (struct: %s, %d bytes at %a, data words: %d).";
exports.PTR_STRUCT_POINTER_OUT_OF_BOUNDS = "CAPNP-TS021 Attempted to access out-of-bounds struct pointer (%s, index: %d, length: %d).";
exports.PTR_TRAVERSAL_LIMIT_EXCEEDED = "CAPNP-TS022 Traversal limit exceeded! Slow down! %s";
exports.PTR_WRONG_LIST_TYPE = "CAPNP-TS023 Cannot convert %s to a %s list.";
exports.PTR_WRONG_POINTER_TYPE = "CAPNP-TS024 Attempted to convert pointer %s to a %s type.";
exports.PTR_WRONG_COMPOSITE_DATA_SIZE = "CAPNP-TS025 Attempted to convert %s to a composite list with the wrong data size (found: %d).";
exports.PTR_WRONG_COMPOSITE_PTR_SIZE = "CAPNP-TS026 Attempted to convert %s to a composite list with the wrong pointer size (found: %d).";
exports.PTR_WRONG_STRUCT_DATA_SIZE = "CAPNP-TS027 Attempted to convert %s to a struct with the wrong data size (found: %d).";
exports.PTR_WRONG_STRUCT_PTR_SIZE = "CAPNP-TS028 Attempted to convert %s to a struct with the wrong pointer size (found: %d).";
// Custom error messages for the built-in `RangeError` class.
//
// You don't get a witty comment with these.
exports.RANGE_INT32_OVERFLOW = "CAPNP-TS029 32-bit signed integer overflow detected.";
exports.RANGE_INT64_UNDERFLOW = "CAPNP-TS030 Buffer is not large enough to hold a word.";
exports.RANGE_INVALID_UTF8 = "CAPNP-TS031 Invalid UTF-8 code sequence detected.";
exports.RANGE_SIZE_OVERFLOW = "CAPNP-TS032 Size %x exceeds maximum " + constants.MAX_SEGMENT_LENGTH.toString(16) + ".";
exports.RANGE_UINT32_OVERFLOW = "CAPNP-TS033 32-bit unsigned integer overflow detected.";
// Segment-related errors.
//
// These suck. Deal with it.
exports.SEG_BUFFER_NOT_ALLOCATED = "CAPNP-TS034 allocate() needs to be called at least once before getting a buffer.";
exports.SEG_GET_NON_ZERO_SINGLE = "CAPNP-TS035 Attempted to get a segment other than 0 (%d) from a single segment arena.";
exports.SEG_ID_OUT_OF_BOUNDS = "CAPNP-TS036 Attempted to get an out-of-bounds segment (%d).";
exports.SEG_NOT_WORD_ALIGNED = "CAPNP-TS037 Segment buffer length %d is not a multiple of 8.";
exports.SEG_REPLACEMENT_BUFFER_TOO_SMALL = "CAPNP-TS038 Attempted to replace a segment buffer with one that is smaller than the allocated space.";
exports.SEG_SIZE_OVERFLOW = "CAPNP-TS039 Requested size %x exceeds maximum value (" + constants.MAX_SEGMENT_LENGTH + ").";
// Custom error messages for the built-in `TypeError` class.
//
// If it looks like a duck, quacks like an elephant, and has hooves for feet, it's probably JavaScript.
exports.TYPE_COMPOSITE_SIZE_UNDEFINED = "CAPNP-TS040 Must provide a composite element size for composite list pointers.";
exports.TYPE_GET_GENERIC_LIST = "CAPNP-TS041 Attempted to call get() on a generic list.";
exports.TYPE_SET_GENERIC_LIST = "CAPNP-TS042 Attempted to call set() on a generic list.";
exports.PTR_WRITE_CONST_LIST = "CAPNP-TS043 Attempted to write to a const list.";
exports.PTR_WRITE_CONST_STRUCT = "CAPNP-TS044 Attempted to write to a const struct.";


});

unwrapExports(errors);
var errors_1 = errors.INVARIANT_UNREACHABLE_CODE;
var errors_2 = errors.assertNever;
var errors_3 = errors.MSG_INVALID_FRAME_HEADER;
var errors_4 = errors.MSG_NO_SEGMENTS_IN_ARENA;
var errors_5 = errors.MSG_PACK_NOT_WORD_ALIGNED;
var errors_6 = errors.MSG_SEGMENT_OUT_OF_BOUNDS;
var errors_7 = errors.MSG_SEGMENT_TOO_SMALL;
var errors_8 = errors.NOT_IMPLEMENTED;
var errors_9 = errors.PTR_ADOPT_COMPOSITE_STRUCT;
var errors_10 = errors.PTR_ADOPT_WRONG_MESSAGE;
var errors_11 = errors.PTR_ALREADY_ADOPTED;
var errors_12 = errors.PTR_COMPOSITE_SIZE_UNDEFINED;
var errors_13 = errors.PTR_DEPTH_LIMIT_EXCEEDED;
var errors_14 = errors.PTR_DISOWN_COMPOSITE_STRUCT;
var errors_15 = errors.PTR_INIT_COMPOSITE_STRUCT;
var errors_16 = errors.PTR_INIT_NON_GROUP;
var errors_17 = errors.PTR_INVALID_FAR_TARGET;
var errors_18 = errors.PTR_INVALID_LIST_SIZE;
var errors_19 = errors.PTR_INVALID_POINTER_TYPE;
var errors_20 = errors.PTR_INVALID_UNION_ACCESS;
var errors_21 = errors.PTR_OFFSET_OUT_OF_BOUNDS;
var errors_22 = errors.PTR_STRUCT_DATA_OUT_OF_BOUNDS;
var errors_23 = errors.PTR_STRUCT_POINTER_OUT_OF_BOUNDS;
var errors_24 = errors.PTR_TRAVERSAL_LIMIT_EXCEEDED;
var errors_25 = errors.PTR_WRONG_LIST_TYPE;
var errors_26 = errors.PTR_WRONG_POINTER_TYPE;
var errors_27 = errors.PTR_WRONG_COMPOSITE_DATA_SIZE;
var errors_28 = errors.PTR_WRONG_COMPOSITE_PTR_SIZE;
var errors_29 = errors.PTR_WRONG_STRUCT_DATA_SIZE;
var errors_30 = errors.PTR_WRONG_STRUCT_PTR_SIZE;
var errors_31 = errors.RANGE_INT32_OVERFLOW;
var errors_32 = errors.RANGE_INT64_UNDERFLOW;
var errors_33 = errors.RANGE_INVALID_UTF8;
var errors_34 = errors.RANGE_SIZE_OVERFLOW;
var errors_35 = errors.RANGE_UINT32_OVERFLOW;
var errors_36 = errors.SEG_BUFFER_NOT_ALLOCATED;
var errors_37 = errors.SEG_GET_NON_ZERO_SINGLE;
var errors_38 = errors.SEG_ID_OUT_OF_BOUNDS;
var errors_39 = errors.SEG_NOT_WORD_ALIGNED;
var errors_40 = errors.SEG_REPLACEMENT_BUFFER_TOO_SMALL;
var errors_41 = errors.SEG_SIZE_OVERFLOW;
var errors_42 = errors.TYPE_COMPOSITE_SIZE_UNDEFINED;
var errors_43 = errors.TYPE_GET_GENERIC_LIST;
var errors_44 = errors.TYPE_SET_GENERIC_LIST;
var errors_45 = errors.PTR_WRITE_CONST_LIST;
var errors_46 = errors.PTR_WRITE_CONST_STRUCT;

var util$1 = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });
// LINT: a lot of the util functions need the any type.
/* tslint:disable:no-any no-unsafe-any */



var trace = src.default("capnp:util");
trace("load");
/**
 * Dump a hex string from the given buffer.
 *
 * @export
 * @param {ArrayBuffer} buffer The buffer to convert.
 * @returns {string} A hexadecimal string representing the buffer.
 */
function bufferToHex(buffer) {
    var a = new Uint8Array(buffer);
    var h = [];
    for (var i = 0; i < a.byteLength; i++)
        h.push(pad(a[i].toString(16), 2));
    return "[" + h.join(" ") + "]";
}
exports.bufferToHex = bufferToHex;
/**
 * Throw an error if the provided value cannot be represented as a 32-bit integer.
 *
 * @export
 * @param {number} value The number to check.
 * @returns {number} The same number if it is valid.
 */
function checkInt32(value) {
    if (value > constants.MAX_INT32 || value < -constants.MAX_INT32) {
        throw new RangeError(errors.RANGE_INT32_OVERFLOW);
    }
    return value;
}
exports.checkInt32 = checkInt32;
function checkUint32(value) {
    if (value < 0 || value > constants.MAX_UINT32) {
        throw new RangeError(errors.RANGE_UINT32_OVERFLOW);
    }
    return value;
}
exports.checkUint32 = checkUint32;
/**
 * Decode a UTF-8 encoded byte array into a JavaScript string (UCS-2).
 *
 * @export
 * @param {Uint8Array} src A utf-8 encoded byte array.
 * @returns {string} A string representation of the byte array.
 */
function decodeUtf8(src) {
    // This ain't for the faint of heart, kids. If you suffer from seizures, heart palpitations, or have had a history of
    // stroke you may want to look away now.
    var l = src.byteLength;
    var dst = "";
    var i = 0;
    var cp = 0;
    var a = 0;
    var b = 0;
    var c = 0;
    var d = 0;
    while (i < l) {
        a = src[i++];
        if ((a & 128) === 0) {
            cp = a;
        }
        else if ((a & 224) === 192) {
            if (i >= l)
                throw new RangeError(errors.RANGE_INVALID_UTF8);
            b = src[i++];
            cp = ((a & 31) << 6) | (b & 63);
        }
        else if ((a & 240) === 224) {
            if (i + 1 >= l)
                throw new RangeError(errors.RANGE_INVALID_UTF8);
            b = src[i++];
            c = src[i++];
            cp =
                ((a & 15) << 12) | ((b & 63) << 6) | (c & 63);
        }
        else if ((a & 248) === 240) {
            if (i + 2 >= l)
                throw new RangeError(errors.RANGE_INVALID_UTF8);
            b = src[i++];
            c = src[i++];
            d = src[i++];
            cp =
                ((a & 7) << 18) |
                    ((b & 63) << 12) |
                    ((c & 63) << 6) |
                    (d & 63);
        }
        else {
            throw new RangeError(errors.RANGE_INVALID_UTF8);
        }
        if (cp <= 0xd7ff || (cp >= 0xe000 && cp <= 0xffff)) {
            dst += String.fromCharCode(cp);
        }
        else {
            // We must reach into the astral plane and construct the surrogate pair!
            cp -= 0x00010000;
            var hi = (cp >>> 10) + 0xd800;
            var lo = (cp & 0x03ff) + 0xdc00;
            if (hi < 0xd800 || hi > 0xdbff)
                throw new RangeError(errors.RANGE_INVALID_UTF8);
            dst += String.fromCharCode(hi, lo);
        }
    }
    return dst;
}
exports.decodeUtf8 = decodeUtf8;
function dumpBuffer(buffer) {
    var b = buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var byteLength = Math.min(b.byteLength, constants.MAX_BUFFER_DUMP_BYTES);
    var r = format("\n=== buffer[%d] ===", byteLength);
    for (var j = 0; j < byteLength; j += 16) {
        r += "\n" + pad(j.toString(16), 8) + ": ";
        var s = "";
        var k = void 0;
        for (k = 0; k < 16 && j + k < b.byteLength; k++) {
            var v = b[j + k];
            r += pad(v.toString(16), 2) + " ";
            // Printable ASCII range.
            s += v > 31 && v < 255 ? String.fromCharCode(v) : "·";
            if (k === 7)
                r += " ";
        }
        r += "" + repeat((17 - k) * 3, " ") + s;
    }
    r += "\n";
    if (byteLength !== b.byteLength) {
        r += format("=== (truncated %d bytes) ===\n", b.byteLength - byteLength);
    }
    return r;
}
exports.dumpBuffer = dumpBuffer;
/**
 * Encode a JavaScript string (UCS-2) to a UTF-8 encoded string inside a Uint8Array.
 *
 * Note that the underlying buffer for the array will likely be larger than the actual contents; ignore the extra bytes.
 *
 * @export
 * @param {string} src The input string.
 * @returns {Uint8Array} A UTF-8 encoded buffer with the string's contents.
 */
function encodeUtf8(src) {
    var l = src.length;
    var dst = new Uint8Array(new ArrayBuffer(l * 4));
    var j = 0;
    for (var i = 0; i < l; i++) {
        var c = src.charCodeAt(i);
        if (c <= 0x7f) {
            dst[j++] = c;
        }
        else if (c <= 0x07ff) {
            dst[j++] = 192 | (c >>> 6);
            dst[j++] = 128 | ((c >>> 0) & 63);
        }
        else if (c <= 0xd7ff || c >= 0xe000) {
            dst[j++] = 224 | (c >>> 12);
            dst[j++] = 128 | ((c >>> 6) & 63);
            dst[j++] = 128 | ((c >>> 0) & 63);
        }
        else {
            // Make sure the surrogate pair is complete.
            /* istanbul ignore next */
            if (i + 1 >= l)
                throw new RangeError(errors.RANGE_INVALID_UTF8);
            // I cast thee back into the astral plane.
            var hi = c - 0xd800;
            var lo = src.charCodeAt(++i) - 0xdc00;
            var cp = ((hi << 10) | lo) + 0x00010000;
            dst[j++] = 240 | (cp >>> 18);
            dst[j++] = 128 | ((cp >>> 12) & 63);
            dst[j++] = 128 | ((cp >>> 6) & 63);
            dst[j++] = 128 | ((cp >>> 0) & 63);
        }
    }
    return dst.subarray(0, j);
}
exports.encodeUtf8 = encodeUtf8;
/**
 * Produce a `printf`-style string. Nice for providing arguments to `assert` without paying the cost for string
 * concatenation up front. Precision is supported for floating point numbers.
 *
 * @param {string} s The format string. Supported format specifiers: b, c, d, f, j, o, s, x, and X.
 * @param {...any} args Values to be formatted in the string. Arguments beyond what are consumed by the format string
 * are ignored.
 * @returns {string} The formatted string.
 */
function format(s) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var n = s.length;
    var arg;
    var argIndex = 0;
    var c;
    var escaped = false;
    var i = 0;
    var leadingZero = false;
    var precision;
    var result = "";
    function nextArg() {
        return args[argIndex++];
    }
    function slurpNumber() {
        var digits = "";
        while (/\d/.test(s[i])) {
            digits += s[i++];
            c = s[i];
        }
        return digits.length > 0 ? parseInt(digits, 10) : null;
    }
    for (; i < n; ++i) {
        c = s[i];
        if (escaped) {
            escaped = false;
            if (c === ".") {
                leadingZero = false;
                c = s[++i];
            }
            else if (c === "0" && s[i + 1] === ".") {
                leadingZero = true;
                i += 2;
                c = s[i];
            }
            else {
                leadingZero = true;
            }
            precision = slurpNumber();
            switch (c) {
                case "a": // number in hex with padding
                    result += "0x" + pad(parseInt(nextArg(), 10).toString(16), 8);
                    break;
                case "b": // number in binary
                    result += parseInt(nextArg(), 10).toString(2);
                    break;
                case "c": // character
                    arg = nextArg();
                    if (typeof arg === "string" || arg instanceof String) {
                        result += arg;
                    }
                    else {
                        result += String.fromCharCode(parseInt(arg, 10));
                    }
                    break;
                case "d": // number in decimal
                    result += parseInt(nextArg(), 10);
                    break;
                case "f": // floating point number
                    var tmp = String(parseFloat(nextArg()).toFixed(precision || 6));
                    result += leadingZero ? tmp : tmp.replace(/^0/, "");
                    break;
                case "j": // JSON
                    result += JSON.stringify(nextArg());
                    break;
                case "o": // number in octal
                    result += "0" + parseInt(nextArg(), 10).toString(8);
                    break;
                case "s": // string
                    result += nextArg();
                    break;
                case "x": // lowercase hexadecimal
                    result += "0x" + parseInt(nextArg(), 10).toString(16);
                    break;
                case "X": // uppercase hexadecimal
                    result +=
                        "0x" +
                            parseInt(nextArg(), 10)
                                .toString(16)
                                .toUpperCase();
                    break;
                default:
                    result += c;
                    break;
            }
        }
        else if (c === "%") {
            escaped = true;
        }
        else {
            result += c;
        }
    }
    return result;
}
exports.format = format;
/**
 * Return the thing that was passed in. Yaaaaawn.
 *
 * @export
 * @template T
 * @param {T} x A thing.
 * @returns {T} The same thing.
 */
function identity(x) {
    return x;
}
exports.identity = identity;
function pad(v, width, pad) {
    if (pad === void 0) { pad = "0"; }
    return v.length >= width ? v : new Array(width - v.length + 1).join(pad) + v;
}
exports.pad = pad;
/**
 * Add padding to a number to make it divisible by 8. Typically used to pad byte sizes so they align to a word boundary.
 *
 * @export
 * @param {number} size The number to pad.
 * @returns {number} The padded number.
 */
function padToWord(size) {
    return (size + 7) & ~7;
}
exports.padToWord = padToWord;
/**
 * Repeat a string n times. Shamelessly copied from lodash.repeat.
 *
 * @param {number} times Number of times to repeat.
 * @param {string} str The string to repeat.
 * @returns {string} The repeated string.
 */
function repeat(times, str) {
    var out = "";
    var n = times;
    var s = str;
    if (n < 1 || n > Number.MAX_VALUE)
        return out;
    // https://en.wikipedia.org/wiki/Exponentiation_by_squaring
    do {
        if (n % 2)
            out += s;
        n = Math.floor(n / 2);
        if (n)
            s += s;
    } while (n);
    return out;
}
exports.repeat = repeat;
// Set up custom debug formatters.
/* tslint:disable:no-string-literal */
/* istanbul ignore next */
src.default.formatters["h"] = function (v) { return v.toString("hex"); };
/* istanbul ignore next */
src.default.formatters["x"] = function (v) { return "0x" + v.toString(16); };
/* istanbul ignore next */
src.default.formatters["a"] = function (v) { return "0x" + pad(v.toString(16), 8); };
/* istanbul ignore next */
src.default.formatters["X"] = function (v) { return "0x" + v.toString(16).toUpperCase(); };
/* tslint:enable:no-string-literal */


});

unwrapExports(util$1);
var util_1 = util$1.bufferToHex;
var util_2 = util$1.checkInt32;
var util_3 = util$1.checkUint32;
var util_4 = util$1.decodeUtf8;
var util_5 = util$1.dumpBuffer;
var util_6 = util$1.encodeUtf8;
var util_7 = util$1.format;
var util_8 = util$1.identity;
var util_9 = util$1.pad;
var util_10 = util$1.padToWord;
var util_11 = util$1.repeat;

var arenaKind = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
var ArenaKind;
(function (ArenaKind) {
    ArenaKind[ArenaKind["SINGLE_SEGMENT"] = 0] = "SINGLE_SEGMENT";
    ArenaKind[ArenaKind["MULTI_SEGMENT"] = 1] = "MULTI_SEGMENT";
})(ArenaKind = exports.ArenaKind || (exports.ArenaKind = {}));


});

unwrapExports(arenaKind);
var arenaKind_1 = arenaKind.ArenaKind;

var arenaAllocationResult = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

var trace = src.default("capnp:serialization:arena:arena-allocation-result");
trace("load");
var ArenaAllocationResult = /** @class */ (function () {
    function ArenaAllocationResult(id, buffer) {
        this.id = id;
        this.buffer = buffer;
        trace("new", this);
    }
    return ArenaAllocationResult;
}());
exports.ArenaAllocationResult = ArenaAllocationResult;


});

unwrapExports(arenaAllocationResult);
var arenaAllocationResult_1 = arenaAllocationResult.ArenaAllocationResult;

var multiSegmentArena = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });






var trace = src.default("capnp:arena:multi");
trace("load");
var MultiSegmentArena = /** @class */ (function () {
    function MultiSegmentArena(buffers) {
        if (buffers === void 0) { buffers = []; }
        this.kind = arenaKind.ArenaKind.MULTI_SEGMENT;
        this.buffers = buffers;
        trace("new %s", this);
    }
    MultiSegmentArena.prototype.toString = function () {
        return util$1.format("MultiSegmentArena_segments:%d", getNumSegments(this));
    };
    MultiSegmentArena.allocate = allocate;
    MultiSegmentArena.getBuffer = getBuffer;
    MultiSegmentArena.getNumSegments = getNumSegments;
    return MultiSegmentArena;
}());
exports.MultiSegmentArena = MultiSegmentArena;
function allocate(minSize, m) {
    var b = new ArrayBuffer(util$1.padToWord(Math.max(minSize, constants.DEFAULT_BUFFER_SIZE)));
    m.buffers.push(b);
    return new arenaAllocationResult.ArenaAllocationResult(m.buffers.length - 1, b);
}
exports.allocate = allocate;
function getBuffer(id, m) {
    if (id < 0 || id >= m.buffers.length) {
        throw new Error(util$1.format(errors.SEG_ID_OUT_OF_BOUNDS, id));
    }
    return m.buffers[id];
}
exports.getBuffer = getBuffer;
function getNumSegments(m) {
    return m.buffers.length;
}
exports.getNumSegments = getNumSegments;


});

unwrapExports(multiSegmentArena);
var multiSegmentArena_1 = multiSegmentArena.MultiSegmentArena;
var multiSegmentArena_2 = multiSegmentArena.allocate;
var multiSegmentArena_3 = multiSegmentArena.getBuffer;
var multiSegmentArena_4 = multiSegmentArena.getNumSegments;

var singleSegmentArena = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });






var trace = src.default("capnp:arena:single");
trace("load");
var SingleSegmentArena = /** @class */ (function () {
    function SingleSegmentArena(buffer) {
        if (buffer === void 0) { buffer = new ArrayBuffer(constants.DEFAULT_BUFFER_SIZE); }
        this.kind = arenaKind.ArenaKind.SINGLE_SEGMENT;
        if ((buffer.byteLength & 7) !== 0) {
            throw new Error(util$1.format(errors.SEG_NOT_WORD_ALIGNED, buffer.byteLength));
        }
        this.buffer = buffer;
        trace("new %s", this);
    }
    SingleSegmentArena.prototype.toString = function () {
        return util$1.format("SingleSegmentArena_len:%x", this.buffer.byteLength);
    };
    SingleSegmentArena.allocate = allocate;
    SingleSegmentArena.getBuffer = getBuffer;
    SingleSegmentArena.getNumSegments = getNumSegments;
    return SingleSegmentArena;
}());
exports.SingleSegmentArena = SingleSegmentArena;
function allocate(minSize, segments, s) {
    trace("Allocating %x bytes for segment 0 in %s.", minSize, s);
    var srcBuffer = segments.length > 0 ? segments[0].buffer : s.buffer;
    if (minSize < constants.MIN_SINGLE_SEGMENT_GROWTH) {
        minSize = constants.MIN_SINGLE_SEGMENT_GROWTH;
    }
    else {
        minSize = util$1.padToWord(minSize);
    }
    s.buffer = new ArrayBuffer(srcBuffer.byteLength + minSize);
    // PERF: Assume that the source and destination buffers are word-aligned and use Float64Array to copy them one word
    // at a time.
    new Float64Array(s.buffer).set(new Float64Array(srcBuffer));
    return new arenaAllocationResult.ArenaAllocationResult(0, s.buffer);
}
exports.allocate = allocate;
function getBuffer(id, s) {
    if (id !== 0)
        throw new Error(util$1.format(errors.SEG_GET_NON_ZERO_SINGLE, id));
    return s.buffer;
}
exports.getBuffer = getBuffer;
function getNumSegments() {
    return 1;
}
exports.getNumSegments = getNumSegments;


});

unwrapExports(singleSegmentArena);
var singleSegmentArena_1 = singleSegmentArena.SingleSegmentArena;
var singleSegmentArena_2 = singleSegmentArena.allocate;
var singleSegmentArena_3 = singleSegmentArena.getBuffer;
var singleSegmentArena_4 = singleSegmentArena.getNumSegments;

var arena = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:arena");
trace("load");
var Arena = /** @class */ (function () {
    function Arena() {
    }
    Arena.allocate = allocate;
    Arena.getBuffer = getBuffer;
    Arena.getNumSegments = getNumSegments;
    return Arena;
}());
exports.Arena = Arena;
function allocate(minSize, segments, a) {
    switch (a.kind) {
        case arenaKind.ArenaKind.MULTI_SEGMENT:
            return multiSegmentArena.MultiSegmentArena.allocate(minSize, a);
        case arenaKind.ArenaKind.SINGLE_SEGMENT:
            return singleSegmentArena.SingleSegmentArena.allocate(minSize, segments, a);
        default:
            return errors.assertNever(a);
    }
}
exports.allocate = allocate;
function getBuffer(id, a) {
    switch (a.kind) {
        case arenaKind.ArenaKind.MULTI_SEGMENT:
            return multiSegmentArena.MultiSegmentArena.getBuffer(id, a);
        case arenaKind.ArenaKind.SINGLE_SEGMENT:
            return singleSegmentArena.SingleSegmentArena.getBuffer(id, a);
        default:
            return errors.assertNever(a);
    }
}
exports.getBuffer = getBuffer;
function getNumSegments(a) {
    switch (a.kind) {
        case arenaKind.ArenaKind.MULTI_SEGMENT:
            return multiSegmentArena.MultiSegmentArena.getNumSegments(a);
        case arenaKind.ArenaKind.SINGLE_SEGMENT:
            return singleSegmentArena.SingleSegmentArena.getNumSegments();
        default:
            return errors.assertNever(a);
    }
}
exports.getNumSegments = getNumSegments;


});

unwrapExports(arena);
var arena_1 = arena.Arena;
var arena_2 = arena.allocate;
var arena_3 = arena.getBuffer;
var arena_4 = arena.getNumSegments;

var arena$1 = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.Arena = arena.Arena;

exports.ArenaKind = arenaKind.ArenaKind;

exports.MultiSegmentArena = multiSegmentArena.MultiSegmentArena;

exports.SingleSegmentArena = singleSegmentArena.SingleSegmentArena;


});

unwrapExports(arena$1);
var arena_2$1 = arena$1.Arena;
var arena_3$1 = arena$1.ArenaKind;
var arena_4$1 = arena$1.MultiSegmentArena;
var arena_5 = arena$1.SingleSegmentArena;

var packing = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


/**
 * Compute the Hamming weight (number of bits set to 1) of a number. Used to figure out how many bytes follow a tag byte
 * while computing the size of a packed message.
 *
 * WARNING: Using this with floating point numbers will void your warranty.
 *
 * @param {number} x A real integer.
 * @returns {number} The hamming weight (integer).
 */
function getHammingWeight(x) {
    // Thanks, HACKMEM!
    var w = x - ((x >> 1) & 0x55555555);
    w = (w & 0x33333333) + ((w >> 2) & 0x33333333);
    return (((w + (w >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}
exports.getHammingWeight = getHammingWeight;
/**
 * Compute the tag byte from the 8 bytes of a 64-bit word.
 *
 * @param {byte} a The first byte.
 * @param {byte} b The second byte.
 * @param {byte} c The third byte.
 * @param {byte} d The fourth byte.
 * @param {byte} e The fifth byte.
 * @param {byte} f The sixth byte.
 * @param {byte} g The seventh byte.
 * @param {byte} h The eighth byte (phew!).
 * @returns {number} The tag byte.
 */
function getTagByte(a, b, c, d, e, f, g, h) {
    // Yes, it's pretty. Don't touch it.
    return ((a === 0 ? 0 : 1) |
        (b === 0 ? 0 : 2) |
        (c === 0 ? 0 : 4) |
        (d === 0 ? 0 : 8) |
        (e === 0 ? 0 : 16) |
        (f === 0 ? 0 : 32) |
        (g === 0 ? 0 : 64) |
        (h === 0 ? 0 : 128));
}
exports.getTagByte = getTagByte;
/**
 * Efficiently calculate the length of a packed Cap'n Proto message.
 *
 * @export
 * @param {ArrayBuffer} packed The packed message.
 * @returns {number} The length of the unpacked message in bytes.
 */
function getUnpackedByteLength(packed) {
    var p = new Uint8Array(packed);
    var wordLength = 0;
    var lastTag = 0x77;
    for (var i = 0; i < p.byteLength;) {
        var tag = p[i];
        if (lastTag === 0 /* ZERO */) {
            wordLength += tag;
            i++;
            lastTag = 0x77;
        }
        else if (lastTag === 255 /* SPAN */) {
            wordLength += tag;
            i += tag * 8 + 1;
            lastTag = 0x77;
        }
        else {
            wordLength++;
            i += getHammingWeight(tag) + 1;
            lastTag = tag;
        }
    }
    return wordLength * 8;
}
exports.getUnpackedByteLength = getUnpackedByteLength;
/**
 * Compute the number of zero bytes that occur in a given 64-bit word, provided as eight separate bytes.
 *
 * @param {byte} a The first byte.
 * @param {byte} b The second byte.
 * @param {byte} c The third byte.
 * @param {byte} d The fourth byte.
 * @param {byte} e The fifth byte.
 * @param {byte} f The sixth byte.
 * @param {byte} g The seventh byte.
 * @param {byte} h The eighth byte (phew!).
 * @returns {number} The number of these bytes that are zero.
 */
function getZeroByteCount(a, b, c, d, e, f, g, h) {
    return ((a === 0 ? 1 : 0) +
        (b === 0 ? 1 : 0) +
        (c === 0 ? 1 : 0) +
        (d === 0 ? 1 : 0) +
        (e === 0 ? 1 : 0) +
        (f === 0 ? 1 : 0) +
        (g === 0 ? 1 : 0) +
        (h === 0 ? 1 : 0));
}
exports.getZeroByteCount = getZeroByteCount;
/**
 * Pack a section of a Cap'n Proto message into a compressed format. This will efficiently compress zero bytes (which
 * are common in idiomatic Cap'n Proto messages) into a compact form.
 *
 * For stream-framed messages this is called once for the frame header and once again for each segment in the message.
 *
 * The returned array buffer is trimmed to the exact size of the packed message with a single copy operation at the end.
 * This should be decent on CPU time but does require quite a lot of memory (a normal array is filled up with each
 * packed byte until the packing is complete).
 *
 * @export
 * @param {ArrayBuffer} unpacked The message to pack.
 * @param {number} [byteOffset] Starting byte offset to read bytes from, defaults to 0.
 * @param {number} [byteLength] Total number of bytes to read, defaults to the remainder of the buffer contents.
 * @returns {ArrayBuffer} A packed version of the message.
 */
function pack(unpacked, byteOffset, byteLength) {
    if (byteOffset === void 0) { byteOffset = 0; }
    if (unpacked.byteLength % 8 !== 0)
        throw new Error(errors.MSG_PACK_NOT_WORD_ALIGNED);
    var src = new Uint8Array(unpacked, byteOffset, byteLength);
    // TODO: Maybe we should do this with buffers? This costs more than 8x the final compressed size in temporary RAM.
    var dst = [];
    /* Just have to be sure it's neither ZERO nor SPAN. */
    var lastTag = 0x77;
    /** This is where we need to remember to write the SPAN tag (0xff). */
    var spanTagOffset = NaN;
    /** How many words have been copied during the current span. */
    var spanWordLength = 0;
    /**
     * When this hits zero, we've had PACK_SPAN_THRESHOLD zero bytes pass by and it's time to bail from the span.
     */
    var spanThreshold = constants.PACK_SPAN_THRESHOLD;
    for (var srcByteOffset = 0; srcByteOffset < src.byteLength; srcByteOffset += 8) {
        /** Read in the entire word. Yes, this feels silly but it's fast! */
        var a = src[srcByteOffset];
        var b = src[srcByteOffset + 1];
        var c = src[srcByteOffset + 2];
        var d = src[srcByteOffset + 3];
        var e = src[srcByteOffset + 4];
        var f = src[srcByteOffset + 5];
        var g = src[srcByteOffset + 6];
        var h = src[srcByteOffset + 7];
        var tag = getTagByte(a, b, c, d, e, f, g, h);
        /** If this is true we'll skip the normal word write logic after the switch statement. */
        var skipWriteWord = true;
        switch (lastTag) {
            case 0 /* ZERO */:
                // We're writing a span of words with all zeroes in them. See if we need to bail out of the fast path.
                if (tag !== 0 /* ZERO */ || spanWordLength >= 0xff) {
                    // There's a bit in there or we got too many zeroes. Damn, we need to bail.
                    dst.push(spanWordLength);
                    spanWordLength = 0;
                    skipWriteWord = false;
                }
                else {
                    // Kay, let's quickly inc this and go.
                    spanWordLength++;
                }
                break;
            case 255 /* SPAN */:
                // We're writing a span of nonzero words.
                var zeroCount = getZeroByteCount(a, b, c, d, e, f, g, h);
                // See if we need to bail now.
                spanThreshold -= zeroCount;
                if (spanThreshold <= 0 || spanWordLength >= 0xff) {
                    // Alright, time to get packing again. Write the number of words we skipped to the beginning of the span.
                    dst[spanTagOffset] = spanWordLength;
                    spanWordLength = 0;
                    spanThreshold = constants.PACK_SPAN_THRESHOLD;
                    // We have to write this word normally.
                    skipWriteWord = false;
                }
                else {
                    // Just write this word verbatim.
                    dst.push(a, b, c, d, e, f, g, h);
                    spanWordLength++;
                }
                break;
            default:
                // Didn't get a special tag last time, let's write this as normal.
                skipWriteWord = false;
                break;
        }
        // A goto is fast, idk why people keep hatin'.
        if (skipWriteWord)
            continue;
        dst.push(tag);
        lastTag = tag;
        if (a !== 0)
            dst.push(a);
        if (b !== 0)
            dst.push(b);
        if (c !== 0)
            dst.push(c);
        if (d !== 0)
            dst.push(d);
        if (e !== 0)
            dst.push(e);
        if (f !== 0)
            dst.push(f);
        if (g !== 0)
            dst.push(g);
        if (h !== 0)
            dst.push(h);
        // Record the span tag offset if needed, making sure to actually leave room for it.
        if (tag === 255 /* SPAN */) {
            spanTagOffset = dst.length;
            dst.push(0);
        }
    }
    // We're done. If we were writing a span let's finish it.
    if (lastTag === 0 /* ZERO */) {
        dst.push(spanWordLength);
    }
    else if (lastTag === 255 /* SPAN */) {
        dst[spanTagOffset] = spanWordLength;
    }
    return new Uint8Array(dst).buffer;
}
exports.pack = pack;
/**
 * Unpack a compressed Cap'n Proto message into a new ArrayBuffer.
 *
 * Unlike the `pack` function, this is able to efficiently determine the exact size needed for the output buffer and
 * runs considerably more efficiently.
 *
 * @export
 * @param {ArrayBuffer} packed An array buffer containing the packed message.
 * @returns {ArrayBuffer} The unpacked message.
 */
function unpack(packed) {
    // We have no choice but to read the packed buffer one byte at a time.
    var src = new Uint8Array(packed);
    var dst = new Uint8Array(new ArrayBuffer(getUnpackedByteLength(packed)));
    /** The last tag byte that we've seen - it starts at a "neutral" value. */
    var lastTag = 0x77;
    for (var srcByteOffset = 0, dstByteOffset = 0; srcByteOffset < src.byteLength;) {
        var tag = src[srcByteOffset];
        if (lastTag === 0 /* ZERO */) {
            // We have a span of zeroes. New array buffers are guaranteed to be initialized to zero so we just seek ahead.
            dstByteOffset += tag * 8;
            srcByteOffset++;
            lastTag = 0x77;
        }
        else if (lastTag === 255 /* SPAN */) {
            // We have a span of unpacked bytes. Copy them verbatim from the source buffer.
            var spanByteLength = tag * 8;
            dst.set(src.subarray(srcByteOffset + 1, srcByteOffset + 1 + spanByteLength), dstByteOffset);
            dstByteOffset += spanByteLength;
            srcByteOffset += 1 + spanByteLength;
            lastTag = 0x77;
        }
        else {
            // Okay, a normal tag. Let's read past the tag and copy bytes that have a bit set in the tag.
            srcByteOffset++;
            for (var i = 1; i <= 128; i <<= 1) {
                // We only need to actually touch `dst` if there's a nonzero byte (it's already initialized to zeroes).
                if ((tag & i) !== 0)
                    dst[dstByteOffset] = src[srcByteOffset++];
                dstByteOffset++;
            }
            lastTag = tag;
        }
    }
    return dst.buffer;
}
exports.unpack = unpack;


});

unwrapExports(packing);
var packing_1 = packing.getHammingWeight;
var packing_2 = packing.getTagByte;
var packing_3 = packing.getUnpackedByteLength;
var packing_4 = packing.getZeroByteCount;
var packing_5 = packing.pack;
var packing_6 = packing.unpack;

var objectSize = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


var trace = src.default("capnp:object-size");
trace("load");
/**
 * A simple object that describes the size of a struct.
 *
 * @export
 * @class ObjectSize
 */
var ObjectSize = /** @class */ (function () {
    function ObjectSize(dataByteLength, pointerCount) {
        this.dataByteLength = dataByteLength;
        this.pointerLength = pointerCount;
    }
    ObjectSize.prototype.toString = function () {
        return util$1.format("ObjectSize_dw:%d,pc:%d", getDataWordLength(this), this.pointerLength);
    };
    return ObjectSize;
}());
exports.ObjectSize = ObjectSize;
function getByteLength(o) {
    return o.dataByteLength + o.pointerLength * 8;
}
exports.getByteLength = getByteLength;
function getDataWordLength(o) {
    return o.dataByteLength / 8;
}
exports.getDataWordLength = getDataWordLength;
function getWordLength(o) {
    return o.dataByteLength / 8 + o.pointerLength;
}
exports.getWordLength = getWordLength;
function padToWord(o) {
    return new ObjectSize(util$1.padToWord(o.dataByteLength), o.pointerLength);
}
exports.padToWord = padToWord;


});

unwrapExports(objectSize);
var objectSize_1 = objectSize.ObjectSize;
var objectSize_2 = objectSize.getByteLength;
var objectSize_3 = objectSize.getDataWordLength;
var objectSize_4 = objectSize.getWordLength;
var objectSize_5 = objectSize.padToWord;

var pointerType = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });
var PointerType;
(function (PointerType) {
    PointerType[PointerType["STRUCT"] = 0] = "STRUCT";
    PointerType[PointerType["LIST"] = 1] = "LIST";
    PointerType[PointerType["FAR"] = 2] = "FAR";
    PointerType[PointerType["OTHER"] = 3] = "OTHER";
})(PointerType = exports.PointerType || (exports.PointerType = {}));


});

unwrapExports(pointerType);
var pointerType_1 = pointerType.PointerType;

var orphan = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });







var trace = src.default("capnp:orphan");
trace("load");
// Technically speaking this class doesn't need to be generic, but the extra type checking enforced by this helps to
// make sure you don't accidentally adopt a pointer of the wrong type.
/**
 * An orphaned pointer. This object itself is technically a pointer to the original pointer's content, which was left
 * untouched in its original message. The original pointer data is encoded as attributes on the Orphan object, ready to
 * be reconstructed once another pointer is ready to adopt it.
 *
 * @export
 * @class Orphan
 * @extends {Pointer}
 * @template T
 */
var Orphan = /** @class */ (function () {
    function Orphan(src) {
        var c = pointer.getContent(src);
        this.segment = c.segment;
        this.byteOffset = c.byteOffset;
        this._capnp = {};
        // Read vital info from the src pointer so we can reconstruct it during adoption.
        this._capnp.type = pointer.getTargetPointerType(src);
        switch (this._capnp.type) {
            case pointerType.PointerType.STRUCT:
                this._capnp.size = pointer.getTargetStructSize(src);
                break;
            case pointerType.PointerType.LIST:
                this._capnp.length = pointer.getTargetListLength(src);
                this._capnp.elementSize = pointer.getTargetListElementSize(src);
                if (this._capnp.elementSize === listElementSize.ListElementSize.COMPOSITE) {
                    this._capnp.size = pointer.getTargetCompositeListSize(src);
                }
                break;
            case pointerType.PointerType.OTHER:
                this._capnp.capId = pointer.getCapabilityId(src);
                break;
            default:
                // COVERAGE: Unreachable code.
                /* istanbul ignore next */
                throw new Error(errors.PTR_INVALID_POINTER_TYPE);
        }
        // Zero out the source pointer (but not the contents!).
        pointer.erasePointer(src);
    }
    /**
     * Adopt (move) this orphan into the target pointer location. This will allocate far pointers in `dst` as needed.
     *
     * @param {T} dst The destination pointer.
     * @returns {void}
     */
    Orphan.prototype._moveTo = function (dst) {
        if (this._capnp === undefined) {
            throw new Error(util$1.format(errors.PTR_ALREADY_ADOPTED, this));
        }
        // TODO: Implement copy semantics when this happens.
        if (this.segment.message !== dst.segment.message) {
            throw new Error(util$1.format(errors.PTR_ADOPT_WRONG_MESSAGE, this, dst));
        }
        // Recursively wipe out the destination pointer first.
        pointer.erase(dst);
        var res = pointer.initPointer(this.segment, this.byteOffset, dst);
        switch (this._capnp.type) {
            case pointerType.PointerType.STRUCT:
                pointer.setStructPointer(res.offsetWords, this._capnp.size, res.pointer);
                break;
            case pointerType.PointerType.LIST:
                var offsetWords = res.offsetWords;
                if (this._capnp.elementSize === listElementSize.ListElementSize.COMPOSITE) {
                    offsetWords--; // The tag word gets skipped.
                }
                pointer.setListPointer(offsetWords, this._capnp.elementSize, this._capnp.length, res.pointer, this._capnp.size);
                break;
            case pointerType.PointerType.OTHER:
                pointer.setInterfacePointer(this._capnp.capId, res.pointer);
                break;
            /* istanbul ignore next */
            default:
                throw new Error(errors.PTR_INVALID_POINTER_TYPE);
        }
        this._capnp = undefined;
    };
    Orphan.prototype.dispose = function () {
        // FIXME: Should this throw?
        if (this._capnp === undefined) {
            trace("not disposing an already disposed orphan", this);
            return;
        }
        switch (this._capnp.type) {
            case pointerType.PointerType.STRUCT:
                this.segment.fillZeroWords(this.byteOffset, objectSize.getWordLength(this._capnp.size));
                break;
            case pointerType.PointerType.LIST:
                var byteLength = pointer.getListByteLength(this._capnp.elementSize, this._capnp.length, this._capnp.size);
                this.segment.fillZeroWords(this.byteOffset, byteLength);
                break;
        }
        this._capnp = undefined;
    };
    Orphan.prototype.toString = function () {
        return util$1.format("Orphan_%d@%a,type:%s", this.segment.id, this.byteOffset, this._capnp && this._capnp.type);
    };
    return Orphan;
}());
exports.Orphan = Orphan;


});

unwrapExports(orphan);
var orphan_1 = orphan.Orphan;

var pointerAllocationResult = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

var trace = src.default("capnp:pointer-allocation-result");
trace("load");
/**
 * This is used as the return value for `Pointer.prototype.initPointer`. Turns out using a class in V8 for multiple
 * return values is faster than using an array or anonymous object.
 *
 * http://jsben.ch/#/zTdbD
 *
 * @export
 * @class PointerAllocationResult
 */
var PointerAllocationResult = /** @class */ (function () {
    function PointerAllocationResult(pointer, offsetWords) {
        this.pointer = pointer;
        this.offsetWords = offsetWords;
    }
    return PointerAllocationResult;
}());
exports.PointerAllocationResult = PointerAllocationResult;


});

unwrapExports(pointerAllocationResult);
var pointerAllocationResult_1 = pointerAllocationResult.PointerAllocationResult;

var pointer = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });









var trace = src.default("capnp:pointer");
trace("load");
/**
 * A pointer referencing a single byte location in a segment. This is typically used for Cap'n Proto pointers, but is
 * also sometimes used to reference an offset to a pointer's content or tag words.
 *
 * @export
 * @class Pointer
 */
var Pointer = /** @class */ (function () {
    function Pointer(segment, byteOffset, depthLimit) {
        if (depthLimit === void 0) { depthLimit = constants.MAX_DEPTH; }
        this._capnp = { compositeList: false, depthLimit: depthLimit };
        this.segment = segment;
        this.byteOffset = byteOffset;
        if (depthLimit === 0) {
            throw new Error(util$1.format(errors.PTR_DEPTH_LIMIT_EXCEEDED, this));
        }
        // Make sure we keep track of all pointer allocations; there's a limit per message (prevent DoS).
        trackPointerAllocation(segment.message, this);
        // NOTE: It's okay to have a pointer to the end of the segment; you'll see this when creating pointers to the
        // beginning of the content of a newly-allocated composite list with zero elements. Unlike other language
        // implementations buffer over/underflows are not a big issue since all buffer access is bounds checked in native
        // code anyway.
        if (byteOffset < 0 || byteOffset > segment.byteLength) {
            throw new Error(util$1.format(errors.PTR_OFFSET_OUT_OF_BOUNDS, byteOffset));
        }
        trace("new %s", this);
    }
    Pointer.prototype.toString = function () {
        return util$1.format("Pointer_%d@%a,%s,limit:%x", this.segment.id, this.byteOffset, dump(this), this._capnp.depthLimit);
    };
    Pointer.adopt = adopt;
    Pointer.copyFrom = copyFrom;
    Pointer.disown = disown;
    Pointer.dump = dump;
    Pointer.isNull = isNull;
    Pointer._capnp = {
        displayName: "Pointer"
    };
    return Pointer;
}());
exports.Pointer = Pointer;
/**
 * Adopt an orphaned pointer, making the pointer point to the orphaned content without copying it.
 *
 * @param {Orphan<Pointer>} src The orphan to adopt.
 * @param {Pointer} p The the pointer to adopt into.
 * @returns {void}
 */
function adopt(src, p) {
    src._moveTo(p);
}
exports.adopt = adopt;
/**
 * Convert a pointer to an Orphan, zeroing out the pointer and leaving its content untouched. If the content is no
 * longer needed, call `disown()` on the orphaned pointer to erase the contents as well.
 *
 * Call `adopt()` on the orphan with the new target pointer location to move it back into the message; the orphan
 * object is then invalidated after adoption (can only adopt once!).
 *
 * @param {T} p The pointer to turn into an Orphan.
 * @returns {Orphan<T>} An orphaned pointer.
 */
function disown(p) {
    return new orphan.Orphan(p);
}
exports.disown = disown;
function dump(p) {
    return util$1.bufferToHex(p.segment.buffer.slice(p.byteOffset, p.byteOffset + 8));
}
exports.dump = dump;
/**
 * Get the total number of bytes required to hold a list of the provided size with the given length, rounded up to the
 * nearest word.
 *
 * @param {ListElementSize} elementSize A number describing the size of the list elements.
 * @param {number} length The length of the list.
 * @param {ObjectSize} [compositeSize] The size of each element in a composite list; required if
 * `elementSize === ListElementSize.COMPOSITE`.
 * @returns {number} The number of bytes required to hold an element of that size, or `NaN` if that is undefined.
 */
function getListByteLength(elementSize, length, compositeSize) {
    switch (elementSize) {
        case listElementSize.ListElementSize.BIT:
            return util$1.padToWord((length + 7) >>> 3);
        case listElementSize.ListElementSize.BYTE:
        case listElementSize.ListElementSize.BYTE_2:
        case listElementSize.ListElementSize.BYTE_4:
        case listElementSize.ListElementSize.BYTE_8:
        case listElementSize.ListElementSize.POINTER:
        case listElementSize.ListElementSize.VOID:
            return util$1.padToWord(getListElementByteLength(elementSize) * length);
        /* istanbul ignore next */
        case listElementSize.ListElementSize.COMPOSITE:
            if (compositeSize === undefined) {
                throw new Error(util$1.format(errors.PTR_INVALID_LIST_SIZE, NaN));
            }
            return length * util$1.padToWord(objectSize.getByteLength(compositeSize));
        /* istanbul ignore next */
        default:
            throw new Error(errors.PTR_INVALID_LIST_SIZE);
    }
}
exports.getListByteLength = getListByteLength;
/**
 * Get the number of bytes required to hold a list element of the provided size. `COMPOSITE` elements do not have a
 * fixed size, and `BIT` elements are packed into exactly a single bit, so these both return `NaN`.
 *
 * @param {ListElementSize} elementSize A number describing the size of the list elements.
 * @returns {number} The number of bytes required to hold an element of that size, or `NaN` if that is undefined.
 */
function getListElementByteLength(elementSize) {
    switch (elementSize) {
        /* istanbul ignore next */
        case listElementSize.ListElementSize.BIT:
            return NaN;
        case listElementSize.ListElementSize.BYTE:
            return 1;
        case listElementSize.ListElementSize.BYTE_2:
            return 2;
        case listElementSize.ListElementSize.BYTE_4:
            return 4;
        case listElementSize.ListElementSize.BYTE_8:
        case listElementSize.ListElementSize.POINTER:
            return 8;
        /* istanbul ignore next */
        case listElementSize.ListElementSize.COMPOSITE:
            // Caller has to figure it out based on the tag word.
            return NaN;
        /* istanbul ignore next */
        case listElementSize.ListElementSize.VOID:
            return 0;
        /* istanbul ignore next */
        default:
            throw new Error(util$1.format(errors.PTR_INVALID_LIST_SIZE, elementSize));
    }
}
exports.getListElementByteLength = getListElementByteLength;
/**
 * Add an offset to the pointer's offset and return a new Pointer for that address.
 *
 * @param {number} offset The number of bytes to add to the offset.
 * @param {Pointer} p The pointer to add from.
 * @returns {Pointer} A new pointer to the address.
 */
function add(offset, p) {
    return new Pointer(p.segment, p.byteOffset + offset, p._capnp.depthLimit);
}
exports.add = add;
/**
 * Replace a pointer with a deep copy of the pointer at `src` and all of its contents.
 *
 * @param {Pointer} src The pointer to copy.
 * @param {Pointer} p The pointer to copy into.
 * @returns {void}
 */
function copyFrom(src, p) {
    // If the pointer is the same then this is a noop.
    if (p.segment === src.segment && p.byteOffset === src.byteOffset) {
        trace("ignoring copy operation from identical pointer %s", src);
        return;
    }
    // Make sure we erase this pointer's contents before moving on. If src is null, that's all we do.
    erase(p); // noop if null
    if (isNull(src))
        return;
    switch (getTargetPointerType(src)) {
        case pointerType.PointerType.STRUCT:
            copyFromStruct(src, p);
            break;
        case pointerType.PointerType.LIST:
            copyFromList(src, p);
            break;
        /* istanbul ignore next */
        default:
            throw new Error(util$1.format(errors.PTR_INVALID_POINTER_TYPE, getTargetPointerType(p)));
    }
}
exports.copyFrom = copyFrom;
/**
 * Recursively erase a pointer, any far pointers/landing pads/tag words, and the content it points to.
 *
 * Note that this will leave "holes" of zeroes in the message, since the space cannot be reclaimed. With packing this
 * will have a negligible effect on the final message size.
 *
 * FIXME: This may need protection against infinite recursion...
 *
 * @param {Pointer} p The pointer to erase.
 * @returns {void}
 */
function erase(p) {
    if (isNull(p))
        return;
    // First deal with the contents.
    var c;
    switch (getTargetPointerType(p)) {
        case pointerType.PointerType.STRUCT:
            var size = getTargetStructSize(p);
            c = getContent(p);
            // Wipe the data section.
            c.segment.fillZeroWords(c.byteOffset, size.dataByteLength / 8);
            // Iterate over all the pointers and nuke them.
            for (var i = 0; i < size.pointerLength; i++) {
                erase(add(i * 8, c));
            }
            break;
        case pointerType.PointerType.LIST:
            var elementSize = getTargetListElementSize(p);
            var length = getTargetListLength(p);
            var contentWords = util$1.padToWord(length * getListElementByteLength(elementSize));
            c = getContent(p);
            if (elementSize === listElementSize.ListElementSize.POINTER) {
                for (var i = 0; i < length; i++) {
                    erase(new Pointer(c.segment, c.byteOffset + i * 8, p._capnp.depthLimit - 1));
                }
                // Calling erase on each pointer takes care of the content, nothing left to do here.
                break;
            }
            else if (elementSize === listElementSize.ListElementSize.COMPOSITE) {
                // Read some stuff from the tag word.
                var tag = add(-8, c);
                var compositeSize = getStructSize(tag);
                var compositeByteLength = objectSize.getByteLength(compositeSize);
                contentWords = getOffsetWords(tag);
                // Kill the tag word.
                c.segment.setWordZero(c.byteOffset - 8);
                // Recursively erase each pointer.
                for (var i = 0; i < length; i++) {
                    for (var j = 0; j < compositeSize.pointerLength; j++) {
                        erase(new Pointer(c.segment, c.byteOffset + i * compositeByteLength + j * 8, p._capnp.depthLimit - 1));
                    }
                }
            }
            c.segment.fillZeroWords(c.byteOffset, contentWords);
            break;
        case pointerType.PointerType.OTHER:
            // No content.
            break;
        default:
            throw new Error(util$1.format(errors.PTR_INVALID_POINTER_TYPE, getTargetPointerType(p)));
    }
    erasePointer(p);
}
exports.erase = erase;
/**
 * Set the pointer (and far pointer landing pads, if applicable) to zero. Does not touch the pointer's content.
 *
 * @param {Pointer} p The pointer to erase.
 * @returns {void}
 */
function erasePointer(p) {
    if (getPointerType(p) === pointerType.PointerType.FAR) {
        var landingPad = followFar(p);
        if (isDoubleFar(p)) {
            // Kill the double-far tag word.
            landingPad.segment.setWordZero(landingPad.byteOffset + 8);
        }
        // Kill the landing pad.
        landingPad.segment.setWordZero(landingPad.byteOffset);
    }
    // Finally! Kill the pointer itself...
    p.segment.setWordZero(p.byteOffset);
}
exports.erasePointer = erasePointer;
/**
 * Interpret the pointer as a far pointer, returning its target segment and offset.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {Pointer} A pointer to the far target.
 */
function followFar(p) {
    var targetSegment = p.segment.message.getSegment(p.segment.getUint32(p.byteOffset + 4));
    var targetWordOffset = p.segment.getUint32(p.byteOffset) >>> 3;
    return new Pointer(targetSegment, targetWordOffset * 8, p._capnp.depthLimit - 1);
}
exports.followFar = followFar;
/**
 * If the pointer address references a far pointer, follow it to the location where the actual pointer data is written.
 * Otherwise, returns the pointer unmodified.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {Pointer} A new pointer representing the target location, or `p` if it is not a far pointer.
 */
function followFars(p) {
    if (getPointerType(p) === pointerType.PointerType.FAR) {
        var landingPad = followFar(p);
        if (isDoubleFar(p))
            landingPad.byteOffset += 8;
        return landingPad;
    }
    return p;
}
exports.followFars = followFars;
function getCapabilityId(p) {
    return p.segment.getUint32(p.byteOffset + 4);
}
exports.getCapabilityId = getCapabilityId;
function isCompositeList(p) {
    return (getTargetPointerType(p) === pointerType.PointerType.LIST &&
        getTargetListElementSize(p) === listElementSize.ListElementSize.COMPOSITE);
}
/**
 * Obtain the location of the pointer's content, following far pointers as needed.
 * If the pointer is a struct pointer and `compositeIndex` is set, it will be offset by a multiple of the struct's size.
 *
 * @param {Pointer} p The pointer to read from.
 * @param {boolean} [ignoreCompositeIndex] If true, will not follow the composite struct pointer's composite index and
 * instead return a pointer to the parent list's contents (also the beginning of the first struct).
 * @returns {Pointer} A pointer to the beginning of the pointer's content.
 */
function getContent(p, ignoreCompositeIndex) {
    var c;
    if (isDoubleFar(p)) {
        var landingPad = followFar(p);
        c = new Pointer(p.segment.message.getSegment(getFarSegmentId(landingPad)), getOffsetWords(landingPad) * 8);
    }
    else {
        var target = followFars(p);
        c = new Pointer(target.segment, target.byteOffset + 8 + getOffsetWords(target) * 8);
    }
    if (isCompositeList(p))
        c.byteOffset += 8;
    if (!ignoreCompositeIndex && p._capnp.compositeIndex !== undefined) {
        // Seek backwards by one word so we can read the struct size off the tag word.
        c.byteOffset -= 8;
        // Seek ahead by `compositeIndex` multiples of the struct's total size.
        c.byteOffset +=
            8 +
                p._capnp.compositeIndex *
                    objectSize.getByteLength(objectSize.padToWord(getStructSize(c)));
    }
    return c;
}
exports.getContent = getContent;
/**
 * Read the target segment ID from a far pointer.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The target segment ID.
 */
function getFarSegmentId(p) {
    return p.segment.getUint32(p.byteOffset + 4);
}
exports.getFarSegmentId = getFarSegmentId;
/**
 * Get a number indicating the size of the list's elements.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {ListElementSize} The size of the list's elements.
 */
function getListElementSize(p) {
    return p.segment.getUint32(p.byteOffset + 4) & constants.LIST_SIZE_MASK;
}
exports.getListElementSize = getListElementSize;
/**
 * Get the number of elements in a list pointer. For composite lists, it instead represents the total number of words in
 * the list (not counting the tag word).
 *
 * This method does **not** attempt to distinguish between composite and non-composite lists. To get the correct
 * length for composite lists use `getTargetListLength()` instead.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The length of the list, or total number of words for composite lists.
 */
function getListLength(p) {
    return p.segment.getUint32(p.byteOffset + 4) >>> 3;
}
exports.getListLength = getListLength;
/**
 * Get the offset (in words) from the end of a pointer to the start of its content. For struct pointers, this is the
 * beginning of the data section, and for list pointers it is the location of the first element. The value should
 * always be zero for interface pointers.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The offset, in words, from the end of the pointer to the start of the data section.
 */
function getOffsetWords(p) {
    var o = p.segment.getInt32(p.byteOffset);
    // Far pointers only have 29 offset bits.
    return o & 2 ? o >> 3 : o >> 2;
}
exports.getOffsetWords = getOffsetWords;
/**
 * Look up the pointer's type.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {PointerType} The type of pointer.
 */
function getPointerType(p) {
    return p.segment.getUint32(p.byteOffset) & constants.POINTER_TYPE_MASK;
}
exports.getPointerType = getPointerType;
/**
 * Read the number of data words from this struct pointer.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The number of data words in the struct.
 */
function getStructDataWords(p) {
    return p.segment.getUint16(p.byteOffset + 4);
}
exports.getStructDataWords = getStructDataWords;
/**
 * Read the number of pointers contained in this struct pointer.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The number of pointers in this struct.
 */
function getStructPointerLength(p) {
    return p.segment.getUint16(p.byteOffset + 6);
}
exports.getStructPointerLength = getStructPointerLength;
/**
 * Get an object describing this struct pointer's size.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {ObjectSize} The size of the struct.
 */
function getStructSize(p) {
    return new objectSize.ObjectSize(getStructDataWords(p) * 8, getStructPointerLength(p));
}
exports.getStructSize = getStructSize;
/**
 * Get a pointer to this pointer's composite list tag word, following far pointers as needed.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {Pointer} A pointer to the list's composite tag word.
 */
function getTargetCompositeListTag(p) {
    var c = getContent(p);
    // The composite list tag is always one word before the content.
    c.byteOffset -= 8;
    return c;
}
exports.getTargetCompositeListTag = getTargetCompositeListTag;
/**
 * Get the object size for the target composite list, following far pointers as needed.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {ObjectSize} An object describing the size of each struct in the list.
 */
function getTargetCompositeListSize(p) {
    return getStructSize(getTargetCompositeListTag(p));
}
exports.getTargetCompositeListSize = getTargetCompositeListSize;
/**
 * Get the size of the list elements referenced by this pointer, following far pointers if necessary.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {ListElementSize} The size of the elements in the list.
 */
function getTargetListElementSize(p) {
    return getListElementSize(followFars(p));
}
exports.getTargetListElementSize = getTargetListElementSize;
/**
 * Get the length of the list referenced by this pointer, following far pointers if necessary. If the list is a
 * composite list, it will look up the tag word and read the length from there.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {number} The number of elements in the list.
 */
function getTargetListLength(p) {
    var t = followFars(p);
    if (getListElementSize(t) === listElementSize.ListElementSize.COMPOSITE) {
        // The content is prefixed by a tag word; it's a struct pointer whose offset contains the list's length.
        return getOffsetWords(getTargetCompositeListTag(p));
    }
    return getListLength(t);
}
exports.getTargetListLength = getTargetListLength;
/**
 * Get the type of a pointer, following far pointers if necessary. For non-far pointers this is equivalent to calling
 * `getPointerType()`.
 *
 * The target of a far pointer can never be another far pointer, and this method will throw if such a situation is
 * encountered.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {PointerType} The type of pointer referenced by this pointer.
 */
function getTargetPointerType(p) {
    var t = getPointerType(followFars(p));
    if (t === pointerType.PointerType.FAR)
        throw new Error(util$1.format(errors.PTR_INVALID_FAR_TARGET, p));
    return t;
}
exports.getTargetPointerType = getTargetPointerType;
/**
 * Get the size of the struct referenced by a pointer, following far pointers if necessary.
 *
 * @param {Pointer} p The poiner to read from.
 * @returns {ObjectSize} The size of the struct referenced by this pointer.
 */
function getTargetStructSize(p) {
    return getStructSize(followFars(p));
}
exports.getTargetStructSize = getTargetStructSize;
/**
 * Initialize a pointer to point at the data in the content segment. If the content segment is not the same as the
 * pointer's segment, this will allocate and write far pointers as needed. Nothing is written otherwise.
 *
 * The return value includes a pointer to write the pointer's actual data to (the eventual far target), and the offset
 * value (in words) to use for that pointer. In the case of double-far pointers this offset will always be zero.
 *
 * @param {Segment} contentSegment The segment containing this pointer's content.
 * @param {number} contentOffset The offset within the content segment for the beginning of this pointer's content.
 * @param {Pointer} p The pointer to initialize.
 * @returns {PointerAllocationResult} An object containing a pointer (where the pointer data should be written), and
 * the value to use as the offset for that pointer.
 */
function initPointer(contentSegment, contentOffset, p) {
    if (p.segment !== contentSegment) {
        // Need a far pointer.
        trace("Initializing far pointer %s -> %s.", p, contentSegment);
        if (!contentSegment.hasCapacity(8)) {
            // GAH! Not enough space in the content segment for a landing pad so we need a double far pointer.
            var landingPad_1 = p.segment.allocate(16);
            trace("GAH! Initializing double-far pointer in %s from %s -> %s.", p, contentSegment, landingPad_1);
            setFarPointer(true, landingPad_1.byteOffset / 8, landingPad_1.segment.id, p);
            setFarPointer(false, contentOffset / 8, contentSegment.id, landingPad_1);
            landingPad_1.byteOffset += 8;
            return new pointerAllocationResult.PointerAllocationResult(landingPad_1, 0);
        }
        // Allocate a far pointer landing pad in the target segment.
        var landingPad = contentSegment.allocate(8);
        if (landingPad.segment.id !== contentSegment.id) {
            throw new Error(errors.INVARIANT_UNREACHABLE_CODE);
        }
        setFarPointer(false, landingPad.byteOffset / 8, landingPad.segment.id, p);
        return new pointerAllocationResult.PointerAllocationResult(landingPad, (contentOffset - landingPad.byteOffset - 8) / 8);
    }
    trace("Initializing intra-segment pointer %s -> %a.", p, contentOffset);
    return new pointerAllocationResult.PointerAllocationResult(p, (contentOffset - p.byteOffset - 8) / 8);
}
exports.initPointer = initPointer;
/**
 * Check if the pointer is a double-far pointer.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {boolean} `true` if it is a double-far pointer, `false` otherwise.
 */
function isDoubleFar(p) {
    return (getPointerType(p) === pointerType.PointerType.FAR &&
        (p.segment.getUint32(p.byteOffset) & constants.POINTER_DOUBLE_FAR_MASK) !== 0);
}
exports.isDoubleFar = isDoubleFar;
/**
 * Quickly check to see if the pointer is "null". A "null" pointer is a zero word, equivalent to an empty struct
 * pointer.
 *
 * @param {Pointer} p The pointer to read from.
 * @returns {boolean} `true` if the pointer is "null".
 */
function isNull(p) {
    return p.segment.isWordZero(p.byteOffset);
}
exports.isNull = isNull;
/**
 * Relocate a pointer to the given destination, ensuring that it points to the same content. This will create far
 * pointers as needed if the content is in a different segment than the destination. After the relocation the source
 * pointer will be erased and is no longer valid.
 *
 * @param {Pointer} dst The desired location for the `src` pointer. Any existing contents will be erased before
 * relocating!
 * @param {Pointer} src The pointer to relocate.
 * @returns {void}
 */
function relocateTo(dst, src) {
    var t = followFars(src);
    var lo = t.segment.getUint8(t.byteOffset) & 0x03; // discard the offset
    var hi = t.segment.getUint32(t.byteOffset + 4);
    // Make sure anything dst was pointing to is wiped out.
    erase(dst);
    var res = initPointer(t.segment, t.byteOffset + 8 + getOffsetWords(t) * 8, dst);
    // Keep the low 2 bits and write the new offset.
    res.pointer.segment.setUint32(res.pointer.byteOffset, lo | (res.offsetWords << 2));
    // Keep the high 32 bits intact.
    res.pointer.segment.setUint32(res.pointer.byteOffset + 4, hi);
    erasePointer(src);
}
exports.relocateTo = relocateTo;
/**
 * Write a far pointer.
 *
 * @param {boolean} doubleFar Set to `true` if this is a double far pointer.
 * @param {number} offsetWords The offset, in words, to the target pointer.
 * @param {number} segmentId The segment the target pointer is located in.
 * @param {Pointer} p The pointer to write to.
 * @returns {void}
 */
function setFarPointer(doubleFar, offsetWords, segmentId, p) {
    var A = pointerType.PointerType.FAR;
    var B = doubleFar ? 1 : 0;
    var C = offsetWords;
    var D = segmentId;
    p.segment.setUint32(p.byteOffset, A | (B << 2) | (C << 3));
    p.segment.setUint32(p.byteOffset + 4, D);
}
exports.setFarPointer = setFarPointer;
/**
 * Write a raw interface pointer.
 *
 * @param {number} capId The capability ID.
 * @param {Pointer} p The pointer to write to.
 * @returns {void}
 */
function setInterfacePointer(capId, p) {
    p.segment.setUint32(p.byteOffset, pointerType.PointerType.OTHER);
    p.segment.setUint32(p.byteOffset + 4, capId);
}
exports.setInterfacePointer = setInterfacePointer;
/**
 * Write a raw list pointer.
 *
 * @param {number} offsetWords The number of words from the end of this pointer to the beginning of the list content.
 * @param {ListElementSize} size The size of each element in the list.
 * @param {number} length The number of elements in the list.
 * @param {Pointer} p The pointer to write to.
 * @param {ObjectSize} [compositeSize] For composite lists this describes the size of each element in this list. This
 * is required for composite lists.
 * @returns {void}
 */
function setListPointer(offsetWords, size, length, p, compositeSize) {
    var A = pointerType.PointerType.LIST;
    var B = offsetWords;
    var C = size;
    var D = length;
    if (size === listElementSize.ListElementSize.COMPOSITE) {
        if (compositeSize === undefined) {
            throw new TypeError(errors.TYPE_COMPOSITE_SIZE_UNDEFINED);
        }
        D *= objectSize.getWordLength(compositeSize);
    }
    p.segment.setUint32(p.byteOffset, A | (B << 2));
    p.segment.setUint32(p.byteOffset + 4, C | (D << 3));
}
exports.setListPointer = setListPointer;
/**
 * Write a raw struct pointer.
 *
 * @param {number} offsetWords The number of words from the end of this pointer to the beginning of the struct's data
 * section.
 * @param {ObjectSize} size An object describing the size of the struct.
 * @param {Pointer} p The pointer to write to.
 * @returns {void}
 */
function setStructPointer(offsetWords, size, p) {
    var A = pointerType.PointerType.STRUCT;
    var B = offsetWords;
    var C = objectSize.getDataWordLength(size);
    var D = size.pointerLength;
    p.segment.setUint32(p.byteOffset, A | (B << 2));
    p.segment.setUint16(p.byteOffset + 4, C);
    p.segment.setUint16(p.byteOffset + 6, D);
}
exports.setStructPointer = setStructPointer;
/**
 * Read some bits off a pointer to make sure it has the right pointer data.
 *
 * @param {PointerType} pointerType The expected pointer type.
 * @param {Pointer} p The pointer to validate.
 * @param {ListElementSize} [elementSize] For list pointers, the expected element size. Leave this
 * undefined for struct pointers.
 * @returns {void}
 */
function validate(pointerType, p, elementSize) {
    if (isNull(p))
        return;
    var t = followFars(p);
    // Check the pointer type.
    var A = t.segment.getUint32(t.byteOffset) & constants.POINTER_TYPE_MASK;
    if (A !== pointerType) {
        throw new Error(util$1.format(errors.PTR_WRONG_POINTER_TYPE, p, pointerType));
    }
    // Check the list element size, if provided.
    if (elementSize !== undefined) {
        var C = t.segment.getUint32(t.byteOffset + 4) & constants.LIST_SIZE_MASK;
        if (C !== elementSize) {
            throw new Error(util$1.format(errors.PTR_WRONG_LIST_TYPE, p, listElementSize.ListElementSize[elementSize]));
        }
    }
}
exports.validate = validate;
function copyFromList(src, dst) {
    if (dst._capnp.depthLimit <= 0)
        throw new Error(errors.PTR_DEPTH_LIMIT_EXCEEDED);
    var srcContent = getContent(src);
    var srcElementSize = getTargetListElementSize(src);
    var srcLength = getTargetListLength(src);
    var srcCompositeSize;
    var srcStructByteLength;
    var dstContent;
    if (srcElementSize === listElementSize.ListElementSize.POINTER) {
        dstContent = dst.segment.allocate(srcLength << 3);
        // Recursively copy each pointer in the list.
        for (var i = 0; i < srcLength; i++) {
            var srcPtr = new Pointer(srcContent.segment, srcContent.byteOffset + (i << 3), src._capnp.depthLimit - 1);
            var dstPtr = new Pointer(dstContent.segment, dstContent.byteOffset + (i << 3), dst._capnp.depthLimit - 1);
            copyFrom(srcPtr, dstPtr);
        }
    }
    else if (srcElementSize === listElementSize.ListElementSize.COMPOSITE) {
        srcCompositeSize = objectSize.padToWord(getTargetCompositeListSize(src));
        srcStructByteLength = objectSize.getByteLength(srcCompositeSize);
        dstContent = dst.segment.allocate(objectSize.getByteLength(srcCompositeSize) * srcLength + 8);
        // Copy the tag word.
        dstContent.segment.copyWord(dstContent.byteOffset, srcContent.segment, srcContent.byteOffset - 8);
        // Copy the entire contents, including all pointers. This should be more efficient than making `srcLength`
        // copies to skip the pointer sections, and we're about to rewrite all those pointers anyway.
        // PERF: Skip this step if the composite struct only contains pointers.
        if (srcCompositeSize.dataByteLength > 0) {
            var wordLength = objectSize.getWordLength(srcCompositeSize) * srcLength;
            dstContent.segment.copyWords(dstContent.byteOffset + 8, srcContent.segment, srcContent.byteOffset, wordLength);
        }
        // Recursively copy all the pointers in each struct.
        for (var i = 0; i < srcLength; i++) {
            for (var j = 0; j < srcCompositeSize.pointerLength; j++) {
                var offset = i * srcStructByteLength + srcCompositeSize.dataByteLength + (j << 3);
                var srcPtr = new Pointer(srcContent.segment, srcContent.byteOffset + offset, src._capnp.depthLimit - 1);
                var dstPtr = new Pointer(dstContent.segment, dstContent.byteOffset + offset + 8, dst._capnp.depthLimit - 1);
                copyFrom(srcPtr, dstPtr);
            }
        }
    }
    else {
        var byteLength = util$1.padToWord(srcElementSize === listElementSize.ListElementSize.BIT
            ? (srcLength + 7) >>> 3
            : getListElementByteLength(srcElementSize) * srcLength);
        var wordLength = byteLength >>> 3;
        dstContent = dst.segment.allocate(byteLength);
        // Copy all of the list contents word-by-word.
        dstContent.segment.copyWords(dstContent.byteOffset, srcContent.segment, srcContent.byteOffset, wordLength);
    }
    // Initialize the list pointer.
    var res = initPointer(dstContent.segment, dstContent.byteOffset, dst);
    setListPointer(res.offsetWords, srcElementSize, srcLength, res.pointer, srcCompositeSize);
}
exports.copyFromList = copyFromList;
function copyFromStruct(src, dst) {
    if (dst._capnp.depthLimit <= 0)
        throw new Error(errors.PTR_DEPTH_LIMIT_EXCEEDED);
    var srcContent = getContent(src);
    var srcSize = getTargetStructSize(src);
    var srcDataWordLength = objectSize.getDataWordLength(srcSize);
    // Allocate space for the destination content.
    var dstContent = dst.segment.allocate(objectSize.getByteLength(srcSize));
    // Copy the data section.
    dstContent.segment.copyWords(dstContent.byteOffset, srcContent.segment, srcContent.byteOffset, srcDataWordLength);
    // Copy the pointer section.
    for (var i = 0; i < srcSize.pointerLength; i++) {
        var offset = srcSize.dataByteLength + i * 8;
        var srcPtr = new Pointer(srcContent.segment, srcContent.byteOffset + offset, src._capnp.depthLimit - 1);
        var dstPtr = new Pointer(dstContent.segment, dstContent.byteOffset + offset, dst._capnp.depthLimit - 1);
        copyFrom(srcPtr, dstPtr);
    }
    // Don't touch dst if it's already initialized as a composite list pointer. With composite struct pointers there's
    // no pointer to copy here and we've already copied the contents.
    if (dst._capnp.compositeList)
        return;
    // Initialize the struct pointer.
    var res = initPointer(dstContent.segment, dstContent.byteOffset, dst);
    setStructPointer(res.offsetWords, srcSize, res.pointer);
}
exports.copyFromStruct = copyFromStruct;
/**
 * Track the allocation of a new Pointer object.
 *
 * This will decrement an internal counter tracking how many bytes have been traversed in the message so far. After
 * a certain limit, this method will throw an error in order to prevent a certain class of DoS attacks.
 *
 * @param {Message} message The message the pointer belongs to.
 * @param {Pointer} p The pointer being allocated.
 * @returns {void}
 */
function trackPointerAllocation(message, p) {
    message._capnp.traversalLimit -= 8;
    if (message._capnp.traversalLimit <= 0) {
        throw new Error(util$1.format(errors.PTR_TRAVERSAL_LIMIT_EXCEEDED, p));
    }
}
exports.trackPointerAllocation = trackPointerAllocation;


});

unwrapExports(pointer);
var pointer_1 = pointer.Pointer;
var pointer_2 = pointer.adopt;
var pointer_3 = pointer.disown;
var pointer_4 = pointer.dump;
var pointer_5 = pointer.getListByteLength;
var pointer_6 = pointer.getListElementByteLength;
var pointer_7 = pointer.add;
var pointer_8 = pointer.copyFrom;
var pointer_9 = pointer.erase;
var pointer_10 = pointer.erasePointer;
var pointer_11 = pointer.followFar;
var pointer_12 = pointer.followFars;
var pointer_13 = pointer.getCapabilityId;
var pointer_14 = pointer.getContent;
var pointer_15 = pointer.getFarSegmentId;
var pointer_16 = pointer.getListElementSize;
var pointer_17 = pointer.getListLength;
var pointer_18 = pointer.getOffsetWords;
var pointer_19 = pointer.getPointerType;
var pointer_20 = pointer.getStructDataWords;
var pointer_21 = pointer.getStructPointerLength;
var pointer_22 = pointer.getStructSize;
var pointer_23 = pointer.getTargetCompositeListTag;
var pointer_24 = pointer.getTargetCompositeListSize;
var pointer_25 = pointer.getTargetListElementSize;
var pointer_26 = pointer.getTargetListLength;
var pointer_27 = pointer.getTargetPointerType;
var pointer_28 = pointer.getTargetStructSize;
var pointer_29 = pointer.initPointer;
var pointer_30 = pointer.isDoubleFar;
var pointer_31 = pointer.isNull;
var pointer_32 = pointer.relocateTo;
var pointer_33 = pointer.setFarPointer;
var pointer_34 = pointer.setInterfacePointer;
var pointer_35 = pointer.setListPointer;
var pointer_36 = pointer.setStructPointer;
var pointer_37 = pointer.validate;
var pointer_38 = pointer.copyFromList;
var pointer_39 = pointer.copyFromStruct;
var pointer_40 = pointer.trackPointerAllocation;

var list = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });







var trace = src.default("capnp:list");
trace("load");
/**
 * A generic list class. Implements Filterable,
 */
var List = /** @class */ (function (_super) {
    tslib_es6.__extends(List, _super);
    function List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    List.toString = function () {
        return this._capnp.displayName;
    };
    List.prototype.all = function (callbackfn) {
        var length = this.getLength();
        for (var i = 0; i < length; i++) {
            if (!callbackfn(this.get(i), i))
                return false;
        }
        return true;
    };
    List.prototype.any = function (callbackfn) {
        var length = this.getLength();
        for (var i = 0; i < length; i++) {
            if (callbackfn(this.get(i), i))
                return true;
        }
        return false;
    };
    List.prototype.ap = function (callbackfns) {
        var _this = this;
        var length = this.getLength();
        var res = [];
        var _loop_1 = function (i) {
            res.push.apply(res, callbackfns.map(function (f) { return f(_this.get(i), i); }));
        };
        for (var i = 0; i < length; i++) {
            _loop_1(i);
        }
        return res;
    };
    List.prototype.concat = function (other) {
        var length = this.getLength();
        var otherLength = other.getLength();
        var res = new Array(length + otherLength);
        for (var i = 0; i < length; i++)
            res[i] = this.get(i);
        for (var i = 0; i < otherLength; i++)
            res[i + length] = other.get(i);
        return res;
    };
    List.prototype.drop = function (n) {
        var length = this.getLength();
        var res = new Array(length);
        for (var i = n; i < length; i++)
            res[i] = this.get(i);
        return res;
    };
    List.prototype.dropWhile = function (callbackfn) {
        var length = this.getLength();
        var res = [];
        var drop = true;
        for (var i = 0; i < length; i++) {
            var v = this.get(i);
            if (drop)
                drop = callbackfn(v, i);
            if (!drop)
                res.push(v);
        }
        return res;
    };
    List.prototype.empty = function () {
        return [];
    };
    List.prototype.every = function (callbackfn) {
        return this.all(callbackfn);
    };
    List.prototype.filter = function (callbackfn) {
        var length = this.getLength();
        var res = [];
        for (var i = 0; i < length; i++) {
            var value = this.get(i);
            if (callbackfn(value, i))
                res.push(value);
        }
        return res;
    };
    List.prototype.find = function (callbackfn) {
        var length = this.getLength();
        for (var i = 0; i < length; i++) {
            var value = this.get(i);
            if (callbackfn(value, i))
                return value;
        }
        return undefined;
    };
    List.prototype.findIndex = function (callbackfn) {
        var length = this.getLength();
        for (var i = 0; i < length; i++) {
            var value = this.get(i);
            if (callbackfn(value, i))
                return i;
        }
        return -1;
    };
    List.prototype.forEach = function (callbackfn) {
        var length = this.getLength();
        for (var i = 0; i < length; i++)
            callbackfn(this.get(i), i);
    };
    List.prototype.get = function (_index) {
        return get();
    };
    /**
     * Get the length of this list.
     *
     * @returns {number} The number of elements in this list.
     */
    List.prototype.getLength = function () {
        return pointer.getTargetListLength(this);
    };
    List.prototype.groupBy = function (callbackfn) {
        var length = this.getLength();
        var res = {};
        for (var i = 0; i < length; i++) {
            var v = this.get(i);
            res[callbackfn(v, i)] = v;
        }
        return res;
    };
    List.prototype.intersperse = function (sep) {
        var length = this.getLength();
        var res = new Array(length);
        for (var i = 0; i < length; i++) {
            if (i > 0)
                res.push(sep);
            res.push(this.get(i));
        }
        return res;
    };
    List.prototype.map = function (callbackfn) {
        var length = this.getLength();
        var res = new Array(length);
        for (var i = 0; i < length; i++)
            res[i] = callbackfn(this.get(i), i);
        return res;
    };
    List.prototype.reduce = function (callbackfn, initialValue) {
        var i = 0;
        var res;
        if (initialValue === undefined) {
            // LINT: It's okay, I know what I'm doing here.
            /* tslint:disable-next-line:no-any */
            res = this.get(0);
            i++;
        }
        else {
            res = initialValue;
        }
        for (; i < this.getLength(); i++)
            res = callbackfn(res, this.get(i), i);
        return res;
    };
    List.prototype.set = function (_index, _value) {
        set();
    };
    List.prototype.slice = function (start, end) {
        if (start === void 0) { start = 0; }
        var length = end ? Math.min(this.getLength(), end) : this.getLength();
        var res = new Array(length - start);
        for (var i = start; i < length; i++)
            res[i] = this.get(i);
        return res;
    };
    List.prototype.some = function (callbackfn) {
        return this.any(callbackfn);
    };
    List.prototype.take = function (n) {
        var length = Math.min(this.getLength(), n);
        var res = new Array(length);
        for (var i = 0; i < length; i++)
            res[i] = this.get(i);
        return res;
    };
    List.prototype.takeWhile = function (callbackfn) {
        var length = this.getLength();
        var res = [];
        var take;
        for (var i = 0; i < length; i++) {
            var v = this.get(i);
            take = callbackfn(v, i);
            if (!take)
                return res;
            res.push(v);
        }
        return res;
    };
    List.prototype.toArray = function () {
        return this.map(util$1.identity);
    };
    List.prototype.toString = function () {
        return "List_" + _super.prototype.toString.call(this);
    };
    List._capnp = {
        displayName: "List<Generic>",
        size: listElementSize.ListElementSize.VOID
    };
    List.get = get;
    List.initList = initList;
    List.set = set;
    return List;
}(pointer.Pointer));
exports.List = List;
/**
 * Initialize the list with the given element size and length. This will allocate new space for the list, ideally in
 * the same segment as this pointer.
 *
 * @param {ListElementSize} elementSize The size of each element in the list.
 * @param {number} length The number of elements in the list.
 * @param {List<T>} l The list to initialize.
 * @param {ObjectSize} [compositeSize] The size of each element in a composite list. This value is required for
 * composite lists.
 * @returns {void}
 */
function initList(elementSize, length, l, compositeSize) {
    var c;
    switch (elementSize) {
        case listElementSize.ListElementSize.BIT:
            c = l.segment.allocate(Math.ceil(length / 8));
            break;
        case listElementSize.ListElementSize.BYTE:
        case listElementSize.ListElementSize.BYTE_2:
        case listElementSize.ListElementSize.BYTE_4:
        case listElementSize.ListElementSize.BYTE_8:
        case listElementSize.ListElementSize.POINTER:
            c = l.segment.allocate(length * pointer.getListElementByteLength(elementSize));
            break;
        case listElementSize.ListElementSize.COMPOSITE:
            if (compositeSize === undefined) {
                throw new Error(util$1.format(errors.PTR_COMPOSITE_SIZE_UNDEFINED));
            }
            compositeSize = objectSize.padToWord(compositeSize);
            var byteLength = objectSize.getByteLength(compositeSize) * length;
            // We need to allocate an extra 8 bytes for the tag word, then make sure we write the length to it. We advance
            // the content pointer by 8 bytes so that it then points to the first list element as intended. Everything
            // starts off zeroed out so these nested structs don't need to be initialized in any way.
            c = l.segment.allocate(byteLength + 8);
            pointer.setStructPointer(length, compositeSize, c);
            trace("Wrote composite tag word %s for %s.", c, l);
            break;
        case listElementSize.ListElementSize.VOID:
            // No need to allocate anything, we can write the list pointer right here.
            pointer.setListPointer(0, elementSize, length, l);
            return;
        default:
            throw new Error(util$1.format(errors.PTR_INVALID_LIST_SIZE, elementSize));
    }
    var res = pointer.initPointer(c.segment, c.byteOffset, l);
    pointer.setListPointer(res.offsetWords, elementSize, length, res.pointer, compositeSize);
}
exports.initList = initList;
function get(_index, _l) {
    throw new TypeError();
}
exports.get = get;
function set(_index, _value, _l) {
    throw new TypeError();
}
exports.set = set;


});

unwrapExports(list);
var list_1 = list.List;
var list_2 = list.initList;
var list_3 = list.get;
var list_4 = list.set;

var pointerList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
function PointerList(PointerClass) {
    var _a;
    return _a = /** @class */ (function (_super) {
            tslib_es6.__extends(class_1, _super);
            function class_1() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            class_1.prototype.get = function (index) {
                var c = pointer.getContent(this);
                return new PointerClass(c.segment, c.byteOffset + index * 8, this._capnp.depthLimit - 1);
            };
            class_1.prototype.set = function (index, value) {
                pointer.copyFrom(value, this.get(index));
            };
            class_1.prototype.toString = function () {
                return "Pointer_" + _super.prototype.toString.call(this) + ",cls:" + PointerClass.toString();
            };
            return class_1;
        }(list.List)),
        _a._capnp = {
            displayName: "List<" + PointerClass._capnp.displayName + ">",
            size: listElementSize.ListElementSize.POINTER
        },
        _a;
}
exports.PointerList = PointerList;


});

unwrapExports(pointerList);
var pointerList_1 = pointerList.PointerList;

var anyPointerList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


exports.AnyPointerList = pointerList.PointerList(pointer.Pointer);


});

unwrapExports(anyPointerList);
var anyPointerList_1 = anyPointerList.AnyPointerList;

var boolList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var BoolList = /** @class */ (function (_super) {
    tslib_es6.__extends(BoolList, _super);
    function BoolList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BoolList.prototype.get = function (index) {
        var bitMask = 1 << index % 8;
        var byteOffset = index >>> 3;
        var c = pointer.getContent(this);
        var v = c.segment.getUint8(c.byteOffset + byteOffset);
        return (v & bitMask) !== 0;
    };
    BoolList.prototype.set = function (index, value) {
        var bitMask = 1 << index % 8;
        var c = pointer.getContent(this);
        var byteOffset = c.byteOffset + (index >>> 3);
        var v = c.segment.getUint8(byteOffset);
        c.segment.setUint8(byteOffset, value ? v | bitMask : v & ~bitMask);
    };
    BoolList.prototype.toString = function () {
        return "Bool_" + _super.prototype.toString.call(this);
    };
    BoolList._capnp = {
        displayName: "List<boolean>",
        size: listElementSize.ListElementSize.BIT
    };
    return BoolList;
}(list.List));
exports.BoolList = BoolList;


});

unwrapExports(boolList);
var boolList_1 = boolList.BoolList;

var compositeList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
function CompositeList(CompositeClass) {
    var _a;
    return _a = /** @class */ (function (_super) {
            tslib_es6.__extends(class_1, _super);
            function class_1() {
                return _super !== null && _super.apply(this, arguments) || this;
            }
            class_1.prototype.get = function (index) {
                return new CompositeClass(this.segment, this.byteOffset, this._capnp.depthLimit - 1, index);
            };
            class_1.prototype.set = function (index, value) {
                pointer.copyFrom(value, this.get(index));
            };
            class_1.prototype.toString = function () {
                return "Composite_" + _super.prototype.toString.call(this) + ",cls:" + CompositeClass.toString();
            };
            return class_1;
        }(list.List)),
        _a._capnp = {
            compositeSize: CompositeClass._capnp.size,
            displayName: "List<" + CompositeClass._capnp.displayName + ">",
            size: listElementSize.ListElementSize.COMPOSITE
        },
        _a;
}
exports.CompositeList = CompositeList;


});

unwrapExports(compositeList);
var compositeList_1 = compositeList.CompositeList;

var data = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });






var trace = src.default("capnp:data");
trace("load");
/**
 * A generic blob of bytes. Can be converted to a DataView or Uint8Array to access its contents using `toDataView()` and
 * `toUint8Array()`. Use `copyBuffer()` to copy an entire buffer at once.
 *
 * @export
 * @class Data
 * @extends {List<number>}
 */
var Data = /** @class */ (function (_super) {
    tslib_es6.__extends(Data, _super);
    function Data() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Data.fromPointer = function (pointer$1) {
        pointer.validate(pointerType.PointerType.LIST, pointer$1, listElementSize.ListElementSize.BYTE);
        return this._fromPointerUnchecked(pointer$1);
    };
    Data._fromPointerUnchecked = function (pointer) {
        return new this(pointer.segment, pointer.byteOffset, pointer._capnp.depthLimit);
    };
    /**
     * Copy the contents of `src` into this Data pointer. If `src` is smaller than the length of this pointer then the
     * remaining bytes will be zeroed out. Extra bytes in `src` are ignored.
     *
     * @param {(ArrayBuffer | ArrayBufferView)} src The source buffer.
     * @returns {void}
     */
    // TODO: Would be nice to have a way to zero-copy a buffer by allocating a new segment into the message with that
    // buffer data.
    Data.prototype.copyBuffer = function (src) {
        var c = pointer.getContent(this);
        var dstLength = this.getLength();
        var srcLength = src.byteLength;
        var i = src instanceof ArrayBuffer
            ? new Uint8Array(src)
            : new Uint8Array(src.buffer, src.byteOffset, Math.min(dstLength, srcLength));
        var o = new Uint8Array(c.segment.buffer, c.byteOffset, this.getLength());
        o.set(i);
        if (dstLength > srcLength) {
            trace("Zeroing out remaining %d bytes after copy into %s.", dstLength - srcLength, this);
            o.fill(0, srcLength, dstLength);
        }
        else if (dstLength < srcLength) {
            trace("Truncated %d bytes from source buffer while copying to %s.", srcLength - dstLength, this);
        }
    };
    /**
     * Read a byte from the specified offset.
     *
     * @param {number} byteOffset The byte offset to read.
     * @returns {number} The byte value.
     */
    Data.prototype.get = function (byteOffset) {
        var c = pointer.getContent(this);
        return c.segment.getUint8(c.byteOffset + byteOffset);
    };
    /**
     * Write a byte at the specified offset.
     *
     * @param {number} byteOffset The byte offset to set.
     * @param {number} value The byte value to set.
     * @returns {void}
     */
    Data.prototype.set = function (byteOffset, value) {
        var c = pointer.getContent(this);
        c.segment.setUint8(c.byteOffset + byteOffset, value);
    };
    /**
     * Creates a **copy** of the underlying buffer data and returns it as an ArrayBuffer.
     *
     * To obtain a reference to the underlying buffer instead, use `toUint8Array()` or `toDataView()`.
     *
     * @returns {ArrayBuffer} A copy of this data buffer.
     */
    Data.prototype.toArrayBuffer = function () {
        var c = pointer.getContent(this);
        return c.segment.buffer.slice(c.byteOffset, c.byteOffset + this.getLength());
    };
    /**
     * Convert this Data pointer to a DataView representing the pointer's contents.
     *
     * WARNING: The DataView references memory from a message segment, so do not venture outside the bounds of the
     * DataView or else BAD THINGS.
     *
     * @returns {DataView} A live reference to the underlying buffer.
     */
    Data.prototype.toDataView = function () {
        var c = pointer.getContent(this);
        return new DataView(c.segment.buffer, c.byteOffset, this.getLength());
    };
    Data.prototype.toString = function () {
        return "Data_" + _super.prototype.toString.call(this);
    };
    /**
     * Convert this Data pointer to a Uint8Array representing the pointer's contents.
     *
     * WARNING: The Uint8Array references memory from a message segment, so do not venture outside the bounds of the
     * Uint8Array or else BAD THINGS.
     *
     * @returns {DataView} A live reference to the underlying buffer.
     */
    Data.prototype.toUint8Array = function () {
        var c = pointer.getContent(this);
        return new Uint8Array(c.segment.buffer, c.byteOffset, this.getLength());
    };
    return Data;
}(list.List));
exports.Data = Data;


});

unwrapExports(data);
var data_1 = data.Data;

var dataList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


exports.DataList = pointerList.PointerList(data.Data);


});

unwrapExports(dataList);
var dataList_1 = dataList.DataList;

var float32List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Float32List = /** @class */ (function (_super) {
    tslib_es6.__extends(Float32List, _super);
    function Float32List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Float32List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getFloat32(c.byteOffset + index * 4);
    };
    Float32List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setFloat32(c.byteOffset + index * 4, value);
    };
    Float32List.prototype.toString = function () {
        return "Float32_" + _super.prototype.toString.call(this);
    };
    Float32List._capnp = {
        displayName: "List<Float32>",
        size: listElementSize.ListElementSize.BYTE_4
    };
    return Float32List;
}(list.List));
exports.Float32List = Float32List;


});

unwrapExports(float32List);
var float32List_1 = float32List.Float32List;

var float64List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Float64List = /** @class */ (function (_super) {
    tslib_es6.__extends(Float64List, _super);
    function Float64List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Float64List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getFloat64(c.byteOffset + index * 8);
    };
    Float64List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setFloat64(c.byteOffset + index * 8, value);
    };
    Float64List.prototype.toString = function () {
        return "Float64_" + _super.prototype.toString.call(this);
    };
    Float64List._capnp = {
        displayName: "List<Float64>",
        size: listElementSize.ListElementSize.BYTE_8
    };
    return Float64List;
}(list.List));
exports.Float64List = Float64List;


});

unwrapExports(float64List);
var float64List_1 = float64List.Float64List;

var int8List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Int8List = /** @class */ (function (_super) {
    tslib_es6.__extends(Int8List, _super);
    function Int8List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Int8List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getInt8(c.byteOffset + index);
    };
    Int8List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setInt8(c.byteOffset + index, value);
    };
    Int8List.prototype.toString = function () {
        return "Int8_" + _super.prototype.toString.call(this);
    };
    Int8List._capnp = {
        displayName: "List<Int8>",
        size: listElementSize.ListElementSize.BYTE
    };
    return Int8List;
}(list.List));
exports.Int8List = Int8List;


});

unwrapExports(int8List);
var int8List_1 = int8List.Int8List;

var int16List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Int16List = /** @class */ (function (_super) {
    tslib_es6.__extends(Int16List, _super);
    function Int16List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Int16List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getInt16(c.byteOffset + index * 2);
    };
    Int16List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setInt16(c.byteOffset + index * 2, value);
    };
    Int16List.prototype.toString = function () {
        return "Int16_" + _super.prototype.toString.call(this);
    };
    Int16List._capnp = {
        displayName: "List<Int16>",
        size: listElementSize.ListElementSize.BYTE_2
    };
    return Int16List;
}(list.List));
exports.Int16List = Int16List;


});

unwrapExports(int16List);
var int16List_1 = int16List.Int16List;

var int32List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Int32List = /** @class */ (function (_super) {
    tslib_es6.__extends(Int32List, _super);
    function Int32List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Int32List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getInt32(c.byteOffset + index * 4);
    };
    Int32List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setInt32(c.byteOffset + index * 4, value);
    };
    Int32List.prototype.toString = function () {
        return "Int32_" + _super.prototype.toString.call(this);
    };
    Int32List._capnp = {
        displayName: "List<Int32>",
        size: listElementSize.ListElementSize.BYTE_4
    };
    return Int32List;
}(list.List));
exports.Int32List = Int32List;


});

unwrapExports(int32List);
var int32List_1 = int32List.Int32List;

var int64List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Int64List = /** @class */ (function (_super) {
    tslib_es6.__extends(Int64List, _super);
    function Int64List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Int64List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getInt64(c.byteOffset + index * 8);
    };
    Int64List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setInt64(c.byteOffset + index * 8, value);
    };
    Int64List.prototype.toString = function () {
        return "Int64_" + _super.prototype.toString.call(this);
    };
    Int64List._capnp = {
        displayName: "List<Int64>",
        size: listElementSize.ListElementSize.BYTE_8
    };
    return Int64List;
}(list.List));
exports.Int64List = Int64List;


});

unwrapExports(int64List);
var int64List_1 = int64List.Int64List;

var _interface = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var Interface = /** @class */ (function (_super) {
    tslib_es6.__extends(Interface, _super);
    function Interface(segment, byteOffset, depthLimit) {
        if (depthLimit === void 0) { depthLimit = constants.MAX_DEPTH; }
        var _this = _super.call(this, segment, byteOffset, depthLimit) || this;
        throw new Error(util$1.format(errors.NOT_IMPLEMENTED, "new Interface"));
    }
    return Interface;
}(pointer.Pointer));
exports.Interface = Interface;


});

unwrapExports(_interface);
var _interface_1 = _interface.Interface;

var interfaceList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


exports.InterfaceList = pointerList.PointerList(_interface.Interface);


});

unwrapExports(interfaceList);
var interfaceList_1 = interfaceList.InterfaceList;

var uint64 = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });




var trace = src.default("capnp:uint64");
trace("load");
/**
 * Represents an unsigned 64-bit integer stored using a Uint8Array in little-endian format. It's a little bit faster
 * than int64 because we don't need to keep track of the sign bit or perform two's compliment operations on set.
 *
 * You may convert this to a primitive number by calling `toNumber()` but be wary of precision loss!
 *
 * Note that overflow is not implemented, so negative numbers passed into `setValue()` will be negated first.
 *
 * The value passed in as the source buffer is expected to be in little-endian format.
 */
var Uint64 = /** @class */ (function () {
    /**
     * Creates a new instance; this is a no-frills constructor for speed. Use the factory methods if you need to convert
     * from other types or use a different offset into the buffer.
     *
     * Will throw if the buffer is not at least 8 bytes long.
     *
     * @constructor
     * @param {Uint8Array} buffer The buffer to use for this 64-bit word; the bytes must be in little-endian order.
     */
    function Uint64(buffer) {
        if (buffer.byteLength < 8)
            throw new RangeError(errors.RANGE_INT64_UNDERFLOW);
        this.buffer = buffer;
    }
    Uint64.fromArrayBuffer = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy)
            return new this(new Uint8Array(source, offset, 8));
        return new this(new Uint8Array(source.slice(offset, offset + 8)));
    };
    Uint64.fromDataView = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy) {
            return new this(new Uint8Array(source.buffer, source.byteOffset + offset, 8));
        }
        return new this(new Uint8Array(source.buffer.slice(source.byteOffset + offset, source.byteLength + offset + 8)));
    };
    /**
     * Parse a hexadecimal string in **big endian format** as a Uint64 value.
     *
     * @static
     * @param {string} source The source string.
     * @returns {Uint64} The string parsed as a 64-bit unsigned integer.
     */
    Uint64.fromHexString = function (source) {
        if (source.substr(0, 2) === "0x")
            source = source.substr(2);
        if (source.length < 1)
            return Uint64.fromNumber(0);
        if (source[0] === "-")
            throw new RangeError("Source must not be negative.");
        source = util$1.pad(source, 16);
        if (source.length !== 16) {
            throw new RangeError("Source string must contain at most 16 hexadecimal digits.");
        }
        var bytes = source.toLowerCase().replace(/[^\da-f]/g, "");
        var buf = new Uint8Array(new ArrayBuffer(8));
        for (var i = 0; i < 8; i++) {
            buf[7 - i] = parseInt(bytes.substr(i * 2, 2), 16);
        }
        return new Uint64(buf);
    };
    Uint64.fromNumber = function (source) {
        var ret = new this(new Uint8Array(8));
        ret.setValue(source);
        return ret;
    };
    Uint64.fromUint8Array = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy)
            return new this(source.subarray(offset, offset + 8));
        return new this(new Uint8Array(source.buffer.slice(source.byteOffset + offset, source.byteOffset + offset + 8)));
    };
    Uint64.prototype.equals = function (other) {
        for (var i = 0; i < 8; i++) {
            if (this.buffer[i] !== other.buffer[i])
                return false;
        }
        return true;
    };
    Uint64.prototype.inspect = function () {
        return "[Uint64 " + this.toString(10) + " 0x" + this.toHexString() + "]";
    };
    /**
     * Faster way to check for zero values without converting to a number first.
     *
     * @returns {boolean} `true` if the contained value is zero.
     * @memberOf Uint64
     */
    Uint64.prototype.isZero = function () {
        for (var i = 0; i < 8; i++) {
            if (this.buffer[i] !== 0)
                return false;
        }
        return true;
    };
    Uint64.prototype.setValue = function (loWord, hiWord) {
        var lo = loWord;
        var hi = hiWord;
        if (hi === undefined) {
            hi = lo;
            hi = Math.abs(hi);
            lo = hi % constants.VAL32;
            hi = hi / constants.VAL32;
            if (hi > constants.VAL32)
                throw new RangeError(loWord + " is outside Uint64 range");
            hi = hi >>> 0;
        }
        for (var i = 0; i < 8; i++) {
            this.buffer[i] = lo & 0xff;
            lo = i === 3 ? hi : lo >>> 8;
        }
    };
    /**
     * Convert to a native javascript number.
     *
     * WARNING: do not expect this number to be accurate to integer precision for large (positive or negative) numbers!
     *
     * @param {boolean} allowImprecise If `true`, no check is performed to verify the returned value is accurate;
     * otherwise out-of-range values are clamped to +Infinity.
     * @returns {number} A numeric representation of this integer.
     */
    Uint64.prototype.toNumber = function (allowImprecise) {
        var b = this.buffer;
        var x = 0;
        var i = 0;
        var m = 1;
        while (i < 8) {
            var v = b[i];
            x += v * m;
            m *= 256;
            i++;
        }
        if (!allowImprecise && x >= constants.MAX_SAFE_INTEGER) {
            trace("Coercing out of range value %d to Infinity.", x);
            return Infinity;
        }
        return x;
    };
    Uint64.prototype.valueOf = function () {
        return this.toNumber(false);
    };
    Uint64.prototype.toArrayBuffer = function () {
        return this.buffer.buffer;
    };
    Uint64.prototype.toDataView = function () {
        return new DataView(this.buffer.buffer);
    };
    Uint64.prototype.toHexString = function () {
        var hex = "";
        for (var i = 7; i >= 0; i--) {
            var v = this.buffer[i].toString(16);
            if (v.length === 1)
                v = "0" + v;
            hex += v;
        }
        return hex;
    };
    Uint64.prototype.toString = function (radix) {
        return this.toNumber(true).toString(radix);
    };
    Uint64.prototype.toUint8Array = function () {
        return this.buffer;
    };
    return Uint64;
}());
exports.Uint64 = Uint64;


});

unwrapExports(uint64);
var uint64_1 = uint64.Uint64;

var int64 = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:int64");
trace("load");
/**
 * Represents a signed 64-bit integer stored using a Uint8Array in little-endian format.
 *
 * You may convert this to a primitive number by calling `toNumber()` but be wary of precision loss!
 *
 * The value passed in as the source buffer is expected to be in little-endian format.
 */
var Int64 = /** @class */ (function (_super) {
    tslib_es6.__extends(Int64, _super);
    function Int64() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Int64.fromArrayBuffer = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy)
            return new this(new Uint8Array(source, offset, 8));
        return new this(new Uint8Array(source.slice(offset, offset + 8)));
    };
    Int64.fromDataView = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy) {
            return new this(new Uint8Array(source.buffer, source.byteOffset + offset, 8));
        }
        return new this(new Uint8Array(source.buffer.slice(source.byteOffset + offset, source.byteLength + offset + 8)));
    };
    Int64.fromNumber = function (source) {
        var ret = new this(new Uint8Array(8));
        ret.setValue(source);
        return ret;
    };
    /**
     * Parse a hexadecimal string in **big endian format** as an Int64 value.
     *
     * The value will be negative if the string is either preceded with a `-` sign, or already in the negative 2's
     * complement form.
     *
     * @static
     * @param {string} source The source string.
     * @returns {Int64} The string parsed as a 64-bit signed integer.
     */
    Int64.fromHexString = function (source) {
        if (source.substr(0, 2) === "0x")
            source = source.substr(2);
        if (source.length < 1)
            return Int64.fromNumber(0);
        var neg = source[0] === "-";
        if (neg)
            source = source.substr(1);
        source = util$1.pad(source, 16);
        if (source.length !== 16) {
            throw new RangeError("Source string must contain at most 16 hexadecimal digits.");
        }
        var bytes = source.toLowerCase().replace(/[^\da-f]/g, "");
        var buf = new Uint8Array(new ArrayBuffer(8));
        for (var i = 0; i < 8; i++) {
            buf[7 - i] = parseInt(bytes.substr(i * 2, 2), 16);
        }
        var val = new Int64(buf);
        if (neg)
            val.negate();
        return val;
    };
    Int64.fromUint8Array = function (source, offset, noCopy) {
        if (offset === void 0) { offset = 0; }
        if (noCopy === void 0) { noCopy = false; }
        if (noCopy)
            return new this(source.subarray(offset, offset + 8));
        return new this(new Uint8Array(source.buffer.slice(source.byteOffset + offset, source.byteOffset + offset + 8)));
    };
    Int64.prototype.equals = function (other) {
        return _super.prototype.equals.call(this, other);
    };
    Int64.prototype.inspect = function () {
        return "[Int64 " + this.toString(10) + " 0x" + this.toHexString() + "]";
    };
    Int64.prototype.negate = function () {
        for (var b = this.buffer, carry = 1, i = 0; i < 8; i++) {
            var v = (b[i] ^ 0xff) + carry;
            b[i] = v & 0xff;
            carry = v >> 8;
        }
    };
    Int64.prototype.setValue = function (loWord, hiWord) {
        var negate = false;
        var lo = loWord;
        var hi = hiWord;
        if (hi === undefined) {
            hi = lo;
            negate = hi < 0;
            hi = Math.abs(hi);
            lo = hi % constants.VAL32;
            hi = hi / constants.VAL32;
            if (hi > constants.VAL32)
                throw new RangeError(loWord + " is outside Int64 range");
            hi = hi >>> 0;
        }
        for (var i = 0; i < 8; i++) {
            this.buffer[i] = lo & 0xff;
            lo = i === 3 ? hi : lo >>> 8;
        }
        if (negate)
            this.negate();
    };
    Int64.prototype.toHexString = function () {
        var b = this.buffer;
        var negate = b[7] & 0x80;
        if (negate)
            this.negate();
        var hex = "";
        for (var i = 7; i >= 0; i--) {
            var v = b[i].toString(16);
            if (v.length === 1)
                v = "0" + v;
            hex += v;
        }
        if (negate) {
            this.negate();
            hex = "-" + hex;
        }
        return hex;
    };
    /**
     * Convert to a native javascript number.
     *
     * WARNING: do not expect this number to be accurate to integer precision for large (positive or negative) numbers!
     *
     * @param {boolean} allowImprecise If `true`, no check is performed to verify the returned value is accurate;
     * otherwise out-of-range values are clamped to +/-Infinity.
     * @returns {number} A numeric representation of this integer.
     */
    Int64.prototype.toNumber = function (allowImprecise) {
        var b = this.buffer;
        var negate = b[7] & 0x80;
        var x = 0;
        var carry = 1;
        var i = 0;
        var m = 1;
        while (i < 8) {
            var v = b[i];
            if (negate) {
                v = (v ^ 0xff) + carry;
                carry = v >> 8;
                v = v & 0xff;
            }
            x += v * m;
            m *= 256;
            i++;
        }
        if (!allowImprecise && x >= constants.MAX_SAFE_INTEGER) {
            trace("Coercing out of range value %d to Infinity.", x);
            return negate ? -Infinity : Infinity;
        }
        return negate ? -x : x;
    };
    return Int64;
}(uint64.Uint64));
exports.Int64 = Int64;


});

unwrapExports(int64);
var int64_1 = int64.Int64;

var types = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.Int64 = int64.Int64;

exports.Uint64 = uint64.Uint64;


});

unwrapExports(types);
var types_1 = types.Int64;
var types_2 = types.Uint64;

var text = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });







var trace = src.default("capnp:text");
trace("load");
var Text = /** @class */ (function (_super) {
    tslib_es6.__extends(Text, _super);
    function Text() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Text.fromPointer = function (pointer$1) {
        pointer.validate(pointerType.PointerType.LIST, pointer$1, listElementSize.ListElementSize.BYTE);
        return textFromPointerUnchecked(pointer$1);
    };
    /**
     * Read a utf-8 encoded string value from this pointer.
     *
     * @param {number} [index] The index at which to start reading; defaults to zero.
     * @returns {string} The string value.
     */
    Text.prototype.get = function (index) {
        if (index === void 0) { index = 0; }
        if (index !== 0) {
            trace("Called get() on %s with a strange index (%d).", this, index);
        }
        if (pointer.isNull(this))
            return "";
        var c = pointer.getContent(this);
        // Remember to exclude the NUL byte.
        return util$1.decodeUtf8(new Uint8Array(c.segment.buffer, c.byteOffset + index, this.getLength() - index));
    };
    /**
     * Get the number of utf-8 encoded bytes in this text. This does **not** include the NUL byte.
     *
     * @returns {number} The number of bytes allocated for the text.
     */
    Text.prototype.getLength = function () {
        return _super.prototype.getLength.call(this) - 1;
    };
    /**
     * Write a utf-8 encoded string value starting at the specified index.
     *
     * @param {number} index The index at which to start copying the string. Note that if this is not zero the bytes
     * before `index` will be left as-is. All bytes after `index` will be overwritten.
     * @param {string} value The string value to set.
     * @returns {void}
     */
    Text.prototype.set = function (index, value) {
        if (index !== 0) {
            trace("Called set() on %s with a strange index (%d).", this, index);
        }
        var src = util$1.encodeUtf8(value);
        var dstLength = src.byteLength + index;
        var c;
        var original;
        // TODO: Consider reusing existing space if list is already initialized and there's enough room for the value.
        if (!pointer.isNull(this)) {
            c = pointer.getContent(this);
            // Only copy bytes that will remain after copying. Everything after `index` should end up truncated.
            var originalLength = this.getLength();
            if (originalLength >= index) {
                originalLength = index;
            }
            else {
                trace("%d byte gap exists between original text and new text in %s.", index - originalLength, this);
            }
            original = new Uint8Array(c.segment.buffer.slice(c.byteOffset, c.byteOffset + Math.min(originalLength, index)));
            pointer.erase(this);
        }
        // Always allocate an extra byte for the NUL byte.
        list.initList(listElementSize.ListElementSize.BYTE, dstLength + 1, this);
        c = pointer.getContent(this);
        var dst = new Uint8Array(c.segment.buffer, c.byteOffset, dstLength);
        if (original)
            dst.set(original);
        dst.set(src, index);
    };
    Text.prototype.toString = function () {
        return "Text_" + _super.prototype.toString.call(this);
    };
    return Text;
}(list.List));
exports.Text = Text;
function textFromPointerUnchecked(pointer) {
    return new Text(pointer.segment, pointer.byteOffset, pointer._capnp.depthLimit);
}


});

unwrapExports(text);
var text_1 = text.Text;

var struct = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });













var trace = src.default("capnp:struct");
trace("load");
// Used to apply bit masks (default values).
var TMP_WORD = new DataView(new ArrayBuffer(8));
var Struct = /** @class */ (function (_super) {
    tslib_es6.__extends(Struct, _super);
    /**
     * Create a new pointer to a struct.
     *
     * @constructor {Struct}
     * @param {Segment} segment The segment the pointer resides in.
     * @param {number} byteOffset The offset from the beginning of the segment to the beginning of the pointer data.
     * @param {any} [depthLimit=MAX_DEPTH] The nesting depth limit for this object.
     * @param {number} [compositeIndex] If set, then this pointer is actually a reference to a composite list
     * (`this._getPointerTargetType() === PointerType.LIST`), and this number is used as the index of the struct within
     * the list. It is not valid to call `initStruct()` on a composite struct – the struct contents are initialized when
     * the list pointer is initialized.
     */
    function Struct(segment, byteOffset, depthLimit, compositeIndex) {
        if (depthLimit === void 0) { depthLimit = constants.MAX_DEPTH; }
        var _this = _super.call(this, segment, byteOffset, depthLimit) || this;
        _this._capnp.compositeIndex = compositeIndex;
        _this._capnp.compositeList = compositeIndex !== undefined;
        return _this;
    }
    Struct.toString = function () {
        return this._capnp.displayName;
    };
    Struct.prototype.toString = function () {
        return ("Struct_" + _super.prototype.toString.call(this) +
            ("" + (this._capnp.compositeIndex === undefined
                ? ""
                : ",ci:" + this._capnp.compositeIndex)));
    };
    Struct._capnp = {
        displayName: "Struct"
    };
    Struct.getAs = getAs;
    Struct.getBit = getBit;
    Struct.getData = getData;
    Struct.getFloat32 = getFloat32;
    Struct.getFloat64 = getFloat64;
    Struct.getUint8 = getUint8;
    Struct.getUint16 = getUint16;
    Struct.getUint32 = getUint32;
    Struct.getUint64 = getUint64;
    Struct.getInt8 = getInt8;
    Struct.getInt16 = getInt16;
    Struct.getInt32 = getInt32;
    Struct.getInt64 = getInt64;
    Struct.getList = getList;
    Struct.getPointer = getPointer;
    Struct.getPointerAs = getPointerAs;
    Struct.getStruct = getStruct;
    Struct.getText = getText;
    Struct.initData = initData;
    Struct.initList = initList;
    Struct.initStruct = initStruct;
    Struct.initStructAt = initStructAt;
    Struct.setBit = setBit;
    Struct.setFloat32 = setFloat32;
    Struct.setFloat64 = setFloat64;
    Struct.setUint8 = setUint8;
    Struct.setUint16 = setUint16;
    Struct.setUint32 = setUint32;
    Struct.setUint64 = setUint64;
    Struct.setInt8 = setInt8;
    Struct.setInt16 = setInt16;
    Struct.setInt32 = setInt32;
    Struct.setInt64 = setInt64;
    Struct.setText = setText;
    Struct.testWhich = testWhich;
    return Struct;
}(pointer.Pointer));
exports.Struct = Struct;
/**
 * Initialize a struct with the provided object size. This will allocate new space for the struct contents, ideally in
 * the same segment as this pointer.
 *
 * @param {ObjectSize} size An object describing the size of the struct's data and pointer sections.
 * @param {Struct} s The struct to initialize.
 * @returns {void}
 */
function initStruct(size, s) {
    if (s._capnp.compositeIndex !== undefined) {
        throw new Error(util$1.format(errors.PTR_INIT_COMPOSITE_STRUCT, s));
    }
    // Make sure to clear existing contents before overwriting the pointer data (erase is a noop if already empty).
    pointer.erase(s);
    var c = s.segment.allocate(objectSize.getByteLength(size));
    var res = pointer.initPointer(c.segment, c.byteOffset, s);
    pointer.setStructPointer(res.offsetWords, size, res.pointer);
}
exports.initStruct = initStruct;
function initStructAt(index, StructClass, p) {
    var s = getPointerAs(index, StructClass, p);
    initStruct(StructClass._capnp.size, s);
    return s;
}
exports.initStructAt = initStructAt;
/**
 * Make a shallow copy of a struct's contents and update the pointer to point to the new content. The data and pointer
 * sections will be resized to the provided size.
 *
 * WARNING: This method can cause data loss if `dstSize` is smaller than the original size!
 *
 * @param {ObjectSize} dstSize The desired size for the struct contents.
 * @param {Struct} s The struct to resize.
 * @returns {void}
 */
function resize(dstSize, s) {
    var srcSize = getSize(s);
    var srcContent = pointer.getContent(s);
    var dstContent = s.segment.allocate(objectSize.getByteLength(dstSize));
    // Only copy the data section for now. The pointer section will need to be rewritten.
    dstContent.segment.copyWords(dstContent.byteOffset, srcContent.segment, srcContent.byteOffset, Math.min(objectSize.getDataWordLength(srcSize), objectSize.getDataWordLength(dstSize)));
    var res = pointer.initPointer(dstContent.segment, dstContent.byteOffset, s);
    pointer.setStructPointer(res.offsetWords, dstSize, res.pointer);
    // Iterate through the new pointer section and update the offsets so they point to the right place. This is a bit
    // more complicated than it appears due to the fact that the original pointers could have been far pointers, and
    // the new pointers might need to be allocated as far pointers if the segment is full.
    for (var i = 0; i < Math.min(srcSize.pointerLength, dstSize.pointerLength); i++) {
        var srcPtr = new pointer.Pointer(srcContent.segment, srcContent.byteOffset + srcSize.dataByteLength + i * 8);
        if (pointer.isNull(srcPtr)) {
            // If source pointer is null, leave the destination pointer as default null.
            continue;
        }
        var srcPtrTarget = pointer.followFars(srcPtr);
        var srcPtrContent = pointer.getContent(srcPtr);
        var dstPtr = new pointer.Pointer(dstContent.segment, dstContent.byteOffset + dstSize.dataByteLength + i * 8);
        // For composite lists the offset needs to point to the tag word, not the first element which is what getContent
        // returns.
        if (pointer.getTargetPointerType(srcPtr) === pointerType.PointerType.LIST &&
            pointer.getTargetListElementSize(srcPtr) === listElementSize.ListElementSize.COMPOSITE) {
            srcPtrContent.byteOffset -= 8;
        }
        var r = pointer.initPointer(srcPtrContent.segment, srcPtrContent.byteOffset, dstPtr);
        // Read the old pointer data, but discard the original offset.
        var a = srcPtrTarget.segment.getUint8(srcPtrTarget.byteOffset) & 0x03;
        var b = srcPtrTarget.segment.getUint32(srcPtrTarget.byteOffset + 4);
        r.pointer.segment.setUint32(r.pointer.byteOffset, a | (r.offsetWords << 2));
        r.pointer.segment.setUint32(r.pointer.byteOffset + 4, b);
    }
    // Zero out the old data and pointer sections.
    srcContent.segment.fillZeroWords(srcContent.byteOffset, objectSize.getWordLength(srcSize));
}
exports.resize = resize;
function adopt(src, s) {
    if (s._capnp.compositeIndex !== undefined) {
        throw new Error(util$1.format(errors.PTR_ADOPT_COMPOSITE_STRUCT, s));
    }
    pointer.Pointer.adopt(src, s);
}
exports.adopt = adopt;
function disown(s) {
    if (s._capnp.compositeIndex !== undefined) {
        throw new Error(util$1.format(errors.PTR_DISOWN_COMPOSITE_STRUCT, s));
    }
    return pointer.Pointer.disown(s);
}
exports.disown = disown;
/**
 * Convert a struct to a struct of the provided class. Particularly useful when casting to nested group types.
 *
 * @protected
 * @template T
 * @param {StructCtor<T>} StructClass The struct class to convert to. Not particularly useful if `Struct`.
 * @param {Struct} s The struct to convert.
 * @returns {T} A new instance of the desired struct class pointing to the same location.
 */
function getAs(StructClass, s) {
    return new StructClass(s.segment, s.byteOffset, s._capnp.depthLimit, s._capnp.compositeIndex);
}
exports.getAs = getAs;
/**
 * Read a boolean (bit) value out of a struct.
 *
 * @protected
 * @param {number} bitOffset The offset in **bits** from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {boolean} The value.
 */
function getBit(bitOffset, s, defaultMask) {
    var byteOffset = Math.floor(bitOffset / 8);
    var bitMask = 1 << bitOffset % 8;
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    var v = ds.segment.getUint8(ds.byteOffset + byteOffset);
    if (defaultMask === undefined)
        return (v & bitMask) !== 0;
    var defaultValue = defaultMask.getUint8(0);
    return ((v ^ defaultValue) & bitMask) !== 0;
}
exports.getBit = getBit;
function getData(index, s, defaultValue) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    var l = new data.Data(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
    if (pointer.isNull(l)) {
        if (defaultValue) {
            pointer.Pointer.copyFrom(defaultValue, l);
        }
        else {
            list.List.initList(listElementSize.ListElementSize.BYTE, 0, l);
        }
    }
    return l;
}
exports.getData = getData;
function getDataSection(s) {
    return pointer.getContent(s);
}
exports.getDataSection = getDataSection;
/**
 * Read a float32 value out of a struct.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getFloat32(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getFloat32(ds.byteOffset + byteOffset);
    }
    var v = ds.segment.getUint32(ds.byteOffset + byteOffset) ^
        defaultMask.getUint32(0, true);
    TMP_WORD.setUint32(0, v, constants.NATIVE_LITTLE_ENDIAN);
    return TMP_WORD.getFloat32(0, constants.NATIVE_LITTLE_ENDIAN);
}
exports.getFloat32 = getFloat32;
/**
 * Read a float64 value out of this segment.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getFloat64(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        var lo = ds.segment.getUint32(ds.byteOffset + byteOffset) ^
            defaultMask.getUint32(0, true);
        var hi = ds.segment.getUint32(ds.byteOffset + byteOffset + 4) ^
            defaultMask.getUint32(4, true);
        TMP_WORD.setUint32(0, lo, constants.NATIVE_LITTLE_ENDIAN);
        TMP_WORD.setUint32(4, hi, constants.NATIVE_LITTLE_ENDIAN);
        return TMP_WORD.getFloat64(0, constants.NATIVE_LITTLE_ENDIAN);
    }
    return ds.segment.getFloat64(ds.byteOffset + byteOffset);
}
exports.getFloat64 = getFloat64;
/**
 * Read an int16 value out of this segment.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getInt16(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 2, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getInt16(ds.byteOffset + byteOffset);
    }
    var v = ds.segment.getUint16(ds.byteOffset + byteOffset) ^
        defaultMask.getUint16(0, true);
    TMP_WORD.setUint16(0, v, constants.NATIVE_LITTLE_ENDIAN);
    return TMP_WORD.getInt16(0, constants.NATIVE_LITTLE_ENDIAN);
}
exports.getInt16 = getInt16;
/**
 * Read an int32 value out of this segment.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getInt32(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getInt32(ds.byteOffset + byteOffset);
    }
    var v = ds.segment.getUint32(ds.byteOffset + byteOffset) ^
        defaultMask.getUint16(0, true);
    TMP_WORD.setUint32(0, v, constants.NATIVE_LITTLE_ENDIAN);
    return TMP_WORD.getInt32(0, constants.NATIVE_LITTLE_ENDIAN);
}
exports.getInt32 = getInt32;
/**
 * Read an int64 value out of this segment.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getInt64(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getInt64(ds.byteOffset + byteOffset);
    }
    var lo = ds.segment.getUint32(ds.byteOffset + byteOffset) ^
        defaultMask.getUint32(0, true);
    var hi = ds.segment.getUint32(ds.byteOffset + byteOffset + 4) ^
        defaultMask.getUint32(4, true);
    TMP_WORD.setUint32(0, lo, constants.NATIVE_LITTLE_ENDIAN);
    TMP_WORD.setUint32(4, hi, constants.NATIVE_LITTLE_ENDIAN);
    return new types.Int64(new Uint8Array(TMP_WORD.buffer.slice(0)));
}
exports.getInt64 = getInt64;
/**
 * Read an int8 value out of this segment.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getInt8(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getInt8(ds.byteOffset + byteOffset);
    }
    var v = ds.segment.getUint8(ds.byteOffset + byteOffset) ^ defaultMask.getUint8(0);
    TMP_WORD.setUint8(0, v);
    return TMP_WORD.getInt8(0);
}
exports.getInt8 = getInt8;
function getList(index, ListClass, s, defaultValue) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    var l = new ListClass(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
    if (pointer.isNull(l)) {
        if (defaultValue) {
            pointer.Pointer.copyFrom(defaultValue, l);
        }
        else {
            list.List.initList(ListClass._capnp.size, 0, l, ListClass._capnp.compositeSize);
        }
    }
    else if (ListClass._capnp.compositeSize !== undefined) {
        // If this is a composite list we need to be sure the composite elements are big enough to hold everything as
        // specified in the schema. If the new schema has added fields we'll need to "resize" (shallow-copy) the list so
        // it has room for the new fields.
        var srcSize = pointer.getTargetCompositeListSize(l);
        var dstSize = ListClass._capnp.compositeSize;
        if (dstSize.dataByteLength > srcSize.dataByteLength ||
            dstSize.pointerLength > srcSize.pointerLength) {
            var srcContent = pointer.getContent(l);
            var srcLength = pointer.getTargetListLength(l);
            trace("resizing composite list %s due to protocol upgrade, new size: %d", l, objectSize.getByteLength(dstSize) * srcLength);
            // Allocate an extra 8 bytes for the tag.
            var dstContent = l.segment.allocate(objectSize.getByteLength(dstSize) * srcLength + 8);
            var res = pointer.initPointer(dstContent.segment, dstContent.byteOffset, l);
            pointer.setListPointer(res.offsetWords, ListClass._capnp.size, srcLength, res.pointer, dstSize);
            // Write the new tag word.
            pointer.setStructPointer(srcLength, dstSize, dstContent);
            // Seek ahead past the tag word before copying the content.
            dstContent.byteOffset += 8;
            for (var i = 0; i < srcLength; i++) {
                var srcElementOffset = srcContent.byteOffset + i * objectSize.getByteLength(srcSize);
                var dstElementOffset = dstContent.byteOffset + i * objectSize.getByteLength(dstSize);
                // Copy the data section.
                dstContent.segment.copyWords(dstElementOffset, srcContent.segment, srcElementOffset, objectSize.getWordLength(srcSize));
                // Iterate through the pointers and update the offsets so they point to the right place.
                for (var j = 0; j < srcSize.pointerLength; j++) {
                    var srcPtr = new pointer.Pointer(srcContent.segment, srcElementOffset + srcSize.dataByteLength + j * 8);
                    var dstPtr = new pointer.Pointer(dstContent.segment, dstElementOffset + dstSize.dataByteLength + j * 8);
                    var srcPtrTarget = pointer.followFars(srcPtr);
                    var srcPtrContent = pointer.getContent(srcPtr);
                    if (pointer.getTargetPointerType(srcPtr) === pointerType.PointerType.LIST &&
                        pointer.getTargetListElementSize(srcPtr) === listElementSize.ListElementSize.COMPOSITE) {
                        srcPtrContent.byteOffset -= 8;
                    }
                    var r = pointer.initPointer(srcPtrContent.segment, srcPtrContent.byteOffset, dstPtr);
                    // Read the old pointer data, but discard the original offset.
                    var a = srcPtrTarget.segment.getUint8(srcPtrTarget.byteOffset) & 0x03;
                    var b = srcPtrTarget.segment.getUint32(srcPtrTarget.byteOffset + 4);
                    r.pointer.segment.setUint32(r.pointer.byteOffset, a | (r.offsetWords << 2));
                    r.pointer.segment.setUint32(r.pointer.byteOffset + 4, b);
                }
            }
            // Zero out the old content.
            srcContent.segment.fillZeroWords(srcContent.byteOffset, objectSize.getWordLength(srcSize) * srcLength);
        }
    }
    return l;
}
exports.getList = getList;
function getPointer(index, s) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    return new pointer.Pointer(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
}
exports.getPointer = getPointer;
function getPointerAs(index, PointerClass, s) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    return new PointerClass(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
}
exports.getPointerAs = getPointerAs;
function getPointerSection(s) {
    var ps = pointer.getContent(s);
    ps.byteOffset += util$1.padToWord(getSize(s).dataByteLength);
    return ps;
}
exports.getPointerSection = getPointerSection;
function getSize(s) {
    if (s._capnp.compositeIndex !== undefined) {
        // For composite lists the object size is stored in a tag word right before the content.
        var c = pointer.getContent(s, true);
        c.byteOffset -= 8;
        return pointer.getStructSize(c);
    }
    return pointer.getTargetStructSize(s);
}
exports.getSize = getSize;
function getStruct(index, StructClass, s, defaultValue) {
    var t = getPointerAs(index, StructClass, s);
    if (pointer.isNull(t)) {
        if (defaultValue) {
            pointer.Pointer.copyFrom(defaultValue, t);
        }
        else {
            initStruct(StructClass._capnp.size, t);
        }
    }
    else {
        pointer.validate(pointerType.PointerType.STRUCT, t);
        var ts = pointer.getTargetStructSize(t);
        // This can happen when reading a struct that was constructed with an older version of the same schema, and new
        // fields were added to the struct. A shallow copy of the struct will be made so that there's enough room for the
        // data and pointer sections. This will unfortunately leave a "hole" of zeroes in the message, but that hole will
        // at least compress well.
        if (ts.dataByteLength < StructClass._capnp.size.dataByteLength ||
            ts.pointerLength < StructClass._capnp.size.pointerLength) {
            trace("need to resize child struct %s", t);
            resize(StructClass._capnp.size, t);
        }
    }
    return t;
}
exports.getStruct = getStruct;
function getText(index, s, defaultValue) {
    var t = text.Text.fromPointer(getPointer(index, s));
    // FIXME: This will perform an unnecessary string<>ArrayBuffer roundtrip.
    if (pointer.isNull(t) && defaultValue)
        t.set(0, defaultValue);
    return t.get(0);
}
exports.getText = getText;
/**
 * Read an uint16 value out of a struct..
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getUint16(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 2, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getUint16(ds.byteOffset + byteOffset);
    }
    return (ds.segment.getUint16(ds.byteOffset + byteOffset) ^
        defaultMask.getUint16(0, true));
}
exports.getUint16 = getUint16;
/**
 * Read an uint32 value out of a struct.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getUint32(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getUint32(ds.byteOffset + byteOffset);
    }
    return (ds.segment.getUint32(ds.byteOffset + byteOffset) ^
        defaultMask.getUint32(0, true));
}
exports.getUint32 = getUint32;
/**
 * Read an uint64 value out of a struct.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getUint64(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getUint64(ds.byteOffset + byteOffset);
    }
    var lo = ds.segment.getUint32(ds.byteOffset + byteOffset) ^
        defaultMask.getUint32(0, true);
    var hi = ds.segment.getUint32(ds.byteOffset + byteOffset + 4) ^
        defaultMask.getUint32(4, true);
    TMP_WORD.setUint32(0, lo, constants.NATIVE_LITTLE_ENDIAN);
    TMP_WORD.setUint32(4, hi, constants.NATIVE_LITTLE_ENDIAN);
    return new types.Uint64(new Uint8Array(TMP_WORD.buffer.slice(0)));
}
exports.getUint64 = getUint64;
/**
 * Read an uint8 value out of a struct.
 *
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {Struct} s The struct to read from.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {number} The value.
 */
function getUint8(byteOffset, s, defaultMask) {
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    if (defaultMask === undefined) {
        return ds.segment.getUint8(ds.byteOffset + byteOffset);
    }
    return (ds.segment.getUint8(ds.byteOffset + byteOffset) ^ defaultMask.getUint8(0));
}
exports.getUint8 = getUint8;
function initData(index, length, s) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    var l = new data.Data(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
    pointer.erase(l);
    list.List.initList(listElementSize.ListElementSize.BYTE, length, l);
    return l;
}
exports.initData = initData;
function initList(index, ListClass, length, s) {
    checkPointerBounds(index, s);
    var ps = getPointerSection(s);
    ps.byteOffset += index * 8;
    var l = new ListClass(ps.segment, ps.byteOffset, s._capnp.depthLimit - 1);
    pointer.erase(l);
    list.List.initList(ListClass._capnp.size, length, l, ListClass._capnp.compositeSize);
    return l;
}
exports.initList = initList;
/**
 * Write a boolean (bit) value to the struct.
 *
 * @protected
 * @param {number} bitOffset The offset in **bits** from the start of the data section.
 * @param {boolean} value The value to write (writes a 0 for `false`, 1 for `true`).
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setBit(bitOffset, value, s, defaultMask) {
    var byteOffset = Math.floor(bitOffset / 8);
    var bitMask = 1 << bitOffset % 8;
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    var b = ds.segment.getUint8(ds.byteOffset + byteOffset);
    // If the default mask bit is set, that means `true` values are actually written as `0`.
    if (defaultMask !== undefined) {
        value = (defaultMask.getUint8(0) & bitMask) !== 0 ? !value : value;
    }
    ds.segment.setUint8(ds.byteOffset + byteOffset, value ? b | bitMask : b & ~bitMask);
}
exports.setBit = setBit;
/**
 * Write a primitive float32 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setFloat32(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        TMP_WORD.setFloat32(0, value, constants.NATIVE_LITTLE_ENDIAN);
        var v = TMP_WORD.getUint32(0, constants.NATIVE_LITTLE_ENDIAN) ^
            defaultMask.getUint32(0, true);
        ds.segment.setUint32(ds.byteOffset + byteOffset, v);
        return;
    }
    ds.segment.setFloat32(ds.byteOffset + byteOffset, value);
}
exports.setFloat32 = setFloat32;
/**
 * Write a primitive float64 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setFloat64(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        TMP_WORD.setFloat64(0, value, constants.NATIVE_LITTLE_ENDIAN);
        var lo = TMP_WORD.getUint32(0, constants.NATIVE_LITTLE_ENDIAN) ^
            defaultMask.getUint32(0, true);
        var hi = TMP_WORD.getUint32(4, constants.NATIVE_LITTLE_ENDIAN) ^
            defaultMask.getUint32(4, true);
        ds.segment.setUint32(ds.byteOffset + byteOffset, lo);
        ds.segment.setUint32(ds.byteOffset + byteOffset + 4, hi);
        return;
    }
    ds.segment.setFloat64(ds.byteOffset + byteOffset, value);
}
exports.setFloat64 = setFloat64;
/**
 * Write a primitive int16 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setInt16(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 2, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        TMP_WORD.setInt16(0, value, constants.NATIVE_LITTLE_ENDIAN);
        var v = TMP_WORD.getUint16(0, constants.NATIVE_LITTLE_ENDIAN) ^
            defaultMask.getUint16(0, true);
        ds.segment.setUint16(ds.byteOffset + byteOffset, v);
        return;
    }
    ds.segment.setInt16(ds.byteOffset + byteOffset, value);
}
exports.setInt16 = setInt16;
/**
 * Write a primitive int32 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setInt32(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        TMP_WORD.setInt32(0, value, constants.NATIVE_LITTLE_ENDIAN);
        var v = TMP_WORD.getUint32(0, constants.NATIVE_LITTLE_ENDIAN) ^
            defaultMask.getUint32(0, true);
        ds.segment.setUint32(ds.byteOffset + byteOffset, v);
        return;
    }
    ds.segment.setInt32(ds.byteOffset + byteOffset, value);
}
exports.setInt32 = setInt32;
/**
 * Write a primitive int64 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setInt64(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        // PERF: We could cast the Int64 to a DataView to apply the mask using four 32-bit reads, but we already have a
        // typed array so avoiding the object allocation turns out to be slightly faster. Int64 is guaranteed to be in
        // little-endian format by design.
        for (var i = 0; i < 8; i++) {
            ds.segment.setUint8(ds.byteOffset + byteOffset + i, value.buffer[i] ^ defaultMask.getUint8(i));
        }
        return;
    }
    ds.segment.setInt64(ds.byteOffset + byteOffset, value);
}
exports.setInt64 = setInt64;
/**
 * Write a primitive int8 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setInt8(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        TMP_WORD.setInt8(0, value);
        var v = TMP_WORD.getUint8(0) ^ defaultMask.getUint8(0);
        ds.segment.setUint8(ds.byteOffset + byteOffset, v);
        return;
    }
    ds.segment.setInt8(ds.byteOffset + byteOffset, value);
}
exports.setInt8 = setInt8;
function setPointer(index, value, s) {
    pointer.copyFrom(value, getPointer(index, s));
}
exports.setPointer = setPointer;
function setText(index, value, s) {
    text.Text.fromPointer(getPointer(index, s)).set(0, value);
}
exports.setText = setText;
/**
 * Write a primitive uint16 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setUint16(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 2, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined)
        value ^= defaultMask.getUint16(0, true);
    ds.segment.setUint16(ds.byteOffset + byteOffset, value);
}
exports.setUint16 = setUint16;
/**
 * Write a primitive uint32 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setUint32(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 4, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined)
        value ^= defaultMask.getUint32(0, true);
    ds.segment.setUint32(ds.byteOffset + byteOffset, value);
}
exports.setUint32 = setUint32;
/**
 * Write a primitive uint64 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setUint64(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 8, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined) {
        // PERF: We could cast the Uint64 to a DataView to apply the mask using four 32-bit reads, but we already have a
        // typed array so avoiding the object allocation turns out to be slightly faster. Uint64 is guaranteed to be in
        // little-endian format by design.
        for (var i = 0; i < 8; i++) {
            ds.segment.setUint8(ds.byteOffset + byteOffset + i, value.buffer[i] ^ defaultMask.getUint8(i));
        }
        return;
    }
    ds.segment.setUint64(ds.byteOffset + byteOffset, value);
}
exports.setUint64 = setUint64;
/**
 * Write a primitive uint8 value to the struct.
 *
 * @protected
 * @param {number} byteOffset The offset in bytes from the start of the data section.
 * @param {number} value The value to write.
 * @param {Struct} s The struct to write to.
 * @param {DataView} [defaultMask] The default value as a DataView.
 * @returns {void}
 */
function setUint8(byteOffset, value, s, defaultMask) {
    checkDataBounds(byteOffset, 1, s);
    var ds = getDataSection(s);
    if (defaultMask !== undefined)
        value ^= defaultMask.getUint8(0);
    ds.segment.setUint8(ds.byteOffset + byteOffset, value);
}
exports.setUint8 = setUint8;
function testWhich(name, found, wanted, s) {
    if (found !== wanted) {
        throw new Error(util$1.format(errors.PTR_INVALID_UNION_ACCESS, s, name, found, wanted));
    }
}
exports.testWhich = testWhich;
function checkDataBounds(byteOffset, byteLength, s) {
    var dataByteLength = getSize(s).dataByteLength;
    if (byteOffset < 0 ||
        byteLength < 0 ||
        byteOffset + byteLength > dataByteLength) {
        throw new Error(util$1.format(errors.PTR_STRUCT_DATA_OUT_OF_BOUNDS, s, byteLength, byteOffset, dataByteLength));
    }
}
exports.checkDataBounds = checkDataBounds;
function checkPointerBounds(index, s) {
    var pointerLength = getSize(s).pointerLength;
    if (index < 0 || index >= pointerLength) {
        throw new Error(util$1.format(errors.PTR_STRUCT_POINTER_OUT_OF_BOUNDS, s, index, pointerLength));
    }
}
exports.checkPointerBounds = checkPointerBounds;


});

unwrapExports(struct);
var struct_1 = struct.Struct;
var struct_2 = struct.initStruct;
var struct_3 = struct.initStructAt;
var struct_4 = struct.resize;
var struct_5 = struct.adopt;
var struct_6 = struct.disown;
var struct_7 = struct.getAs;
var struct_8 = struct.getBit;
var struct_9 = struct.getData;
var struct_10 = struct.getDataSection;
var struct_11 = struct.getFloat32;
var struct_12 = struct.getFloat64;
var struct_13 = struct.getInt16;
var struct_14 = struct.getInt32;
var struct_15 = struct.getInt64;
var struct_16 = struct.getInt8;
var struct_17 = struct.getList;
var struct_18 = struct.getPointer;
var struct_19 = struct.getPointerAs;
var struct_20 = struct.getPointerSection;
var struct_21 = struct.getSize;
var struct_22 = struct.getStruct;
var struct_23 = struct.getText;
var struct_24 = struct.getUint16;
var struct_25 = struct.getUint32;
var struct_26 = struct.getUint64;
var struct_27 = struct.getUint8;
var struct_28 = struct.initData;
var struct_29 = struct.initList;
var struct_30 = struct.setBit;
var struct_31 = struct.setFloat32;
var struct_32 = struct.setFloat64;
var struct_33 = struct.setInt16;
var struct_34 = struct.setInt32;
var struct_35 = struct.setInt64;
var struct_36 = struct.setInt8;
var struct_37 = struct.setPointer;
var struct_38 = struct.setText;
var struct_39 = struct.setUint16;
var struct_40 = struct.setUint32;
var struct_41 = struct.setUint64;
var struct_42 = struct.setUint8;
var struct_43 = struct.testWhich;
var struct_44 = struct.checkDataBounds;
var struct_45 = struct.checkPointerBounds;

var textList = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });






var trace = src.default("capnp:list:composite");
trace("load");
var TextList = /** @class */ (function (_super) {
    tslib_es6.__extends(TextList, _super);
    function TextList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TextList.prototype.get = function (index) {
        var c = pointer.getContent(this);
        c.byteOffset += index * 8;
        return text.Text.fromPointer(c).get(0);
    };
    TextList.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.byteOffset += index * 8;
        text.Text.fromPointer(c).set(0, value);
    };
    TextList.prototype.toString = function () {
        return "Text_" + _super.prototype.toString.call(this);
    };
    TextList._capnp = {
        displayName: "List<Text>",
        size: listElementSize.ListElementSize.POINTER
    };
    return TextList;
}(list.List));
exports.TextList = TextList;


});

unwrapExports(textList);
var textList_1 = textList.TextList;

var uint8List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Uint8List = /** @class */ (function (_super) {
    tslib_es6.__extends(Uint8List, _super);
    function Uint8List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Uint8List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getUint8(c.byteOffset + index);
    };
    Uint8List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setUint8(c.byteOffset + index, value);
    };
    Uint8List.prototype.toString = function () {
        return "Uint8_" + _super.prototype.toString.call(this);
    };
    Uint8List._capnp = {
        displayName: "List<Uint8>",
        size: listElementSize.ListElementSize.BYTE
    };
    return Uint8List;
}(list.List));
exports.Uint8List = Uint8List;


});

unwrapExports(uint8List);
var uint8List_1 = uint8List.Uint8List;

var uint16List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Uint16List = /** @class */ (function (_super) {
    tslib_es6.__extends(Uint16List, _super);
    function Uint16List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Uint16List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getUint16(c.byteOffset + index * 2);
    };
    Uint16List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setUint16(c.byteOffset + index * 2, value);
    };
    Uint16List.prototype.toString = function () {
        return "Uint16_" + _super.prototype.toString.call(this);
    };
    Uint16List._capnp = {
        displayName: "List<Uint16>",
        size: listElementSize.ListElementSize.BYTE_2
    };
    return Uint16List;
}(list.List));
exports.Uint16List = Uint16List;


});

unwrapExports(uint16List);
var uint16List_1 = uint16List.Uint16List;

var uint32List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Uint32List = /** @class */ (function (_super) {
    tslib_es6.__extends(Uint32List, _super);
    function Uint32List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Uint32List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getUint32(c.byteOffset + index * 4);
    };
    Uint32List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setUint32(c.byteOffset + index * 4, value);
    };
    Uint32List.prototype.toString = function () {
        return "Uint32_" + _super.prototype.toString.call(this);
    };
    Uint32List._capnp = {
        displayName: "List<Uint32>",
        size: listElementSize.ListElementSize.BYTE_4
    };
    return Uint32List;
}(list.List));
exports.Uint32List = Uint32List;


});

unwrapExports(uint32List);
var uint32List_1 = uint32List.Uint32List;

var uint64List = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });





var trace = src.default("capnp:list:composite");
trace("load");
var Uint64List = /** @class */ (function (_super) {
    tslib_es6.__extends(Uint64List, _super);
    function Uint64List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Uint64List.prototype.get = function (index) {
        var c = pointer.getContent(this);
        return c.segment.getUint64(c.byteOffset + index * 8);
    };
    Uint64List.prototype.set = function (index, value) {
        var c = pointer.getContent(this);
        c.segment.setUint64(c.byteOffset + index * 8, value);
    };
    Uint64List.prototype.toString = function () {
        return "Uint64_" + _super.prototype.toString.call(this);
    };
    Uint64List._capnp = {
        displayName: "List<Uint64>",
        size: listElementSize.ListElementSize.BYTE_8
    };
    return Uint64List;
}(list.List));
exports.Uint64List = Uint64List;


});

unwrapExports(uint64List);
var uint64List_1 = uint64List.Uint64List;

var _void = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });



var Void = /** @class */ (function (_super) {
    tslib_es6.__extends(Void, _super);
    function Void() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Void._capnp = {
        displayName: "Void",
        id: "0",
        size: new objectSize.ObjectSize(0, 0)
    };
    return Void;
}(struct.Struct));
exports.Void = Void;
// This following line makes a mysterious "whooshing" sound when it runs.
exports.VOID = undefined;


});

unwrapExports(_void);
var _void_1 = _void.Void;
var _void_2 = _void.VOID;

var voidList = createCommonjsModule(function (module, exports) {
/**
 * Why would anyone **SANE** ever use this!?
 *
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });


exports.VoidList = pointerList.PointerList(_void.Void);


});

unwrapExports(voidList);
var voidList_1 = voidList.VoidList;

var pointers = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.AnyPointerList = anyPointerList.AnyPointerList;

exports.BoolList = boolList.BoolList;

exports.CompositeList = compositeList.CompositeList;

exports.Data = data.Data;

exports.DataList = dataList.DataList;

exports.Float32List = float32List.Float32List;

exports.Float64List = float64List.Float64List;

exports.Int8List = int8List.Int8List;

exports.Int16List = int16List.Int16List;

exports.Int32List = int32List.Int32List;

exports.Int64List = int64List.Int64List;

exports.Interface = _interface.Interface;

exports.InterfaceList = interfaceList.InterfaceList;

exports.List = list.List;

exports.Orphan = orphan.Orphan;

exports.PointerList = pointerList.PointerList;

exports.PointerType = pointerType.PointerType;

exports.Pointer = pointer.Pointer;

exports.Struct = struct.Struct;

exports.Text = text.Text;

exports.TextList = textList.TextList;

exports.Uint8List = uint8List.Uint8List;

exports.Uint16List = uint16List.Uint16List;

exports.Uint32List = uint32List.Uint32List;

exports.Uint64List = uint64List.Uint64List;

exports.Void = _void.Void;
exports.VOID = _void.VOID;

exports.VoidList = voidList.VoidList;


});

unwrapExports(pointers);
var pointers_1 = pointers.AnyPointerList;
var pointers_2 = pointers.BoolList;
var pointers_3 = pointers.CompositeList;
var pointers_4 = pointers.Data;
var pointers_5 = pointers.DataList;
var pointers_6 = pointers.Float32List;
var pointers_7 = pointers.Float64List;
var pointers_8 = pointers.Int8List;
var pointers_9 = pointers.Int16List;
var pointers_10 = pointers.Int32List;
var pointers_11 = pointers.Int64List;
var pointers_12 = pointers.Interface;
var pointers_13 = pointers.InterfaceList;
var pointers_14 = pointers.List;
var pointers_15 = pointers.Orphan;
var pointers_16 = pointers.PointerList;
var pointers_17 = pointers.PointerType;
var pointers_18 = pointers.Pointer;
var pointers_19 = pointers.Struct;
var pointers_20 = pointers.Text;
var pointers_21 = pointers.TextList;
var pointers_22 = pointers.Uint8List;
var pointers_23 = pointers.Uint16List;
var pointers_24 = pointers.Uint32List;
var pointers_25 = pointers.Uint64List;
var pointers_26 = pointers.Void;
var pointers_27 = pointers.VOID;
var pointers_28 = pointers.VoidList;

var segment = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });






var trace = src.default("capnp:segment");
trace("load");
var Segment = /** @class */ (function () {
    function Segment(id, message, buffer, byteLength) {
        if (byteLength === void 0) { byteLength = 0; }
        this[Symbol.toStringTag] = "Segment";
        this.id = id;
        this.message = message;
        this.buffer = buffer;
        this._dv = new DataView(buffer);
        this.byteOffset = 0;
        this.byteLength = byteLength;
    }
    /**
     * Attempt to allocate the requested number of bytes in this segment. If this segment is full this method will return
     * a pointer to freshly allocated space in another segment from the same message.
     *
     * @param {number} byteLength The number of bytes to allocate, will be rounded up to the nearest word.
     * @returns {Pointer} A pointer to the newly allocated space.
     */
    Segment.prototype.allocate = function (byteLength) {
        trace("allocate(%d)", byteLength);
        var segment = this;
        byteLength = util$1.padToWord(byteLength);
        if (byteLength > constants.MAX_SEGMENT_LENGTH - 8) {
            throw new Error(util$1.format(errors.SEG_SIZE_OVERFLOW, byteLength));
        }
        if (!segment.hasCapacity(byteLength)) {
            segment = segment.message.allocateSegment(byteLength);
        }
        var byteOffset = segment.byteLength;
        segment.byteLength = segment.byteLength + byteLength;
        trace("Allocated %x bytes in %s (requested segment: %s).", byteLength, this, segment);
        return new pointers.Pointer(segment, byteOffset);
    };
    /**
     * Quickly copy a word (8 bytes) from `srcSegment` into this one at the given offset.
     *
     * @param {number} byteOffset The offset to write the word to.
     * @param {Segment} srcSegment The segment to copy the word from.
     * @param {number} srcByteOffset The offset from the start of `srcSegment` to copy from.
     * @returns {void}
     */
    Segment.prototype.copyWord = function (byteOffset, srcSegment, srcByteOffset) {
        var value = srcSegment._dv.getFloat64(srcByteOffset, constants.NATIVE_LITTLE_ENDIAN);
        this._dv.setFloat64(byteOffset, value, constants.NATIVE_LITTLE_ENDIAN);
    };
    /**
     * Quickly copy words from `srcSegment` into this one.
     *
     * @param {number} byteOffset The offset to start copying into.
     * @param {Segment} srcSegment The segment to copy from.
     * @param {number} srcByteOffset The start offset to copy from.
     * @param {number} wordLength The number of words to copy.
     * @returns {void}
     */
    Segment.prototype.copyWords = function (byteOffset, srcSegment, srcByteOffset, wordLength) {
        var dst = new Float64Array(this.buffer, byteOffset, wordLength);
        var src = new Float64Array(srcSegment.buffer, srcByteOffset, wordLength);
        dst.set(src);
    };
    /**
     * Quickly fill a number of words in the buffer with zeroes.
     *
     * @param {number} byteOffset The first byte to set to zero.
     * @param {number} wordLength The number of words (not bytes!) to zero out.
     * @returns {void}
     */
    Segment.prototype.fillZeroWords = function (byteOffset, wordLength) {
        new Float64Array(this.buffer, byteOffset, wordLength).fill(0);
    };
    /**
     * Get the total number of bytes available in this segment (the size of its underlying buffer).
     *
     * @returns {number} The total number of bytes this segment can hold.
     */
    Segment.prototype.getCapacity = function () {
        return this.buffer.byteLength;
    };
    /**
     * Read a float32 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getFloat32 = function (byteOffset) {
        return this._dv.getFloat32(byteOffset, true);
    };
    /**
     * Read a float64 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getFloat64 = function (byteOffset) {
        return this._dv.getFloat64(byteOffset, true);
    };
    /**
     * Read an int16 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getInt16 = function (byteOffset) {
        return this._dv.getInt16(byteOffset, true);
    };
    /**
     * Read an int32 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getInt32 = function (byteOffset) {
        return this._dv.getInt32(byteOffset, true);
    };
    /**
     * Read an int64 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getInt64 = function (byteOffset) {
        return new types.Int64(new Uint8Array(this.buffer.slice(byteOffset, byteOffset + 8)));
    };
    /**
     * Read an int8 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getInt8 = function (byteOffset) {
        return this._dv.getInt8(byteOffset);
    };
    /**
     * Read a uint16 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getUint16 = function (byteOffset) {
        return this._dv.getUint16(byteOffset, true);
    };
    /**
     * Read a uint32 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getUint32 = function (byteOffset) {
        return this._dv.getUint32(byteOffset, true);
    };
    /**
     * Read a uint8 value out of this segment.
     * NOTE: this does not copy the memory region, so updates to the underlying buffer will affect the Uint64 value!
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getUint64 = function (byteOffset) {
        return new types.Uint64(new Uint8Array(this.buffer.slice(byteOffset, byteOffset + 8)));
    };
    /**
     * Read a uint8 value out of this segment.
     *
     * @param {number} byteOffset The offset in bytes to the value.
     * @returns {number} The value.
     */
    Segment.prototype.getUint8 = function (byteOffset) {
        return this._dv.getUint8(byteOffset);
    };
    Segment.prototype.hasCapacity = function (byteLength) {
        trace("hasCapacity(%d)", byteLength);
        // capacity - allocated >= requested
        return this.buffer.byteLength - this.byteLength >= byteLength;
    };
    /**
     * Quickly check the word at the given offset to see if it is equal to zero.
     *
     * PERF_V8: Fastest way to do this is by reading the whole word as a `number` (float64) in the _native_ endian format
     * and see if it's zero.
     *
     * Benchmark: http://jsben.ch/#/Pjooc
     *
     * @param {number} byteOffset The offset to the word.
     * @returns {boolean} `true` if the word is zero.
     */
    Segment.prototype.isWordZero = function (byteOffset) {
        return this._dv.getFloat64(byteOffset, constants.NATIVE_LITTLE_ENDIAN) === 0;
    };
    /**
     * Swap out this segment's underlying buffer with a new one. It's assumed that the new buffer has the same content but
     * more free space, otherwise all existing pointers to this segment will be hilariously broken.
     *
     * @param {ArrayBuffer} buffer The new buffer to use.
     * @returns {void}
     */
    Segment.prototype.replaceBuffer = function (buffer) {
        trace("replaceBuffer(%p)", buffer);
        if (this.buffer === buffer)
            return;
        if (buffer.byteLength < this.byteLength) {
            throw new Error(errors.SEG_REPLACEMENT_BUFFER_TOO_SMALL);
        }
        this._dv = new DataView(buffer);
        this.buffer = buffer;
    };
    /**
     * Write a float32 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setFloat32 = function (byteOffset, val) {
        this._dv.setFloat32(byteOffset, val, true);
    };
    /**
     * Write an float64 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setFloat64 = function (byteOffset, val) {
        this._dv.setFloat64(byteOffset, val, true);
    };
    /**
     * Write an int16 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setInt16 = function (byteOffset, val) {
        this._dv.setInt16(byteOffset, val, true);
    };
    /**
     * Write an int32 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setInt32 = function (byteOffset, val) {
        this._dv.setInt32(byteOffset, val, true);
    };
    /**
     * Write an int8 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setInt8 = function (byteOffset, val) {
        this._dv.setInt8(byteOffset, val);
    };
    /**
     * Write an int64 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {Int64} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setInt64 = function (byteOffset, val) {
        this._dv.setUint8(byteOffset, val.buffer[0]);
        this._dv.setUint8(byteOffset + 1, val.buffer[1]);
        this._dv.setUint8(byteOffset + 2, val.buffer[2]);
        this._dv.setUint8(byteOffset + 3, val.buffer[3]);
        this._dv.setUint8(byteOffset + 4, val.buffer[4]);
        this._dv.setUint8(byteOffset + 5, val.buffer[5]);
        this._dv.setUint8(byteOffset + 6, val.buffer[6]);
        this._dv.setUint8(byteOffset + 7, val.buffer[7]);
    };
    /**
     * Write a uint16 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setUint16 = function (byteOffset, val) {
        this._dv.setUint16(byteOffset, val, true);
    };
    /**
     * Write a uint32 value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setUint32 = function (byteOffset, val) {
        this._dv.setUint32(byteOffset, val, true);
    };
    /**
     * Write a uint64 value to the specified offset.
     * TODO: benchmark other ways to perform this write operation.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {Uint64} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setUint64 = function (byteOffset, val) {
        this._dv.setUint8(byteOffset + 0, val.buffer[0]);
        this._dv.setUint8(byteOffset + 1, val.buffer[1]);
        this._dv.setUint8(byteOffset + 2, val.buffer[2]);
        this._dv.setUint8(byteOffset + 3, val.buffer[3]);
        this._dv.setUint8(byteOffset + 4, val.buffer[4]);
        this._dv.setUint8(byteOffset + 5, val.buffer[5]);
        this._dv.setUint8(byteOffset + 6, val.buffer[6]);
        this._dv.setUint8(byteOffset + 7, val.buffer[7]);
    };
    /**
     * Write a uint8 (byte) value to the specified offset.
     *
     * @param {number} byteOffset The offset from the beginning of the buffer.
     * @param {number} val The value to store.
     * @returns {void}
     */
    Segment.prototype.setUint8 = function (byteOffset, val) {
        this._dv.setUint8(byteOffset, val);
    };
    /**
     * Write a zero word (8 bytes) to the specified offset. This is slightly faster than calling `setUint64` or
     * `setFloat64` with a zero value.
     *
     * Benchmark: http://jsben.ch/#/dUdPI
     *
     * @param {number} byteOffset The offset of the word to set to zero.
     * @returns {void}
     */
    Segment.prototype.setWordZero = function (byteOffset) {
        this._dv.setFloat64(byteOffset, 0, constants.NATIVE_LITTLE_ENDIAN);
    };
    Segment.prototype.toString = function () {
        return util$1.format("Segment_id:%d,off:%a,len:%a,cap:%a", this.id, this.byteLength, this.byteOffset, this.buffer.byteLength);
    };
    return Segment;
}());
exports.Segment = Segment;


});

unwrapExports(segment);
var segment_1 = segment.Segment;

var message = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });










var trace = src.default("capnp:message");
trace("load");
var Message = /** @class */ (function () {
    /**
     * A Cap'n Proto message.
     *
     * SECURITY WARNING: In nodejs do not pass a Buffer's internal array buffer into this constructor. Pass the buffer
     * directly and everything will be fine. If not, your message will potentially be initialized with random memory
     * contents!
     *
     * The constructor method creates a new Message, optionally using a provided arena for segment allocation, or a buffer
     * to read from.
     *
     * @constructor {Message}
     *
     * @param {AnyArena|ArrayBufferView|ArrayBuffer} [src] The source for the message.
     * A value of `undefined` will cause the message to initialize with a single segment arena only big enough for the
     * root pointer; it will expand as you go. This is a reasonable choice for most messages.
     *
     * Passing an arena will cause the message to use that arena for its segment allocation. Contents will be accepted
     * as-is.
     *
     * Passing an array buffer view (like `DataView`, `Uint8Array` or `Buffer`) will create a **copy** of the source
     * buffer; beware of the potential performance cost!
     *
     * @param {boolean} [packed] Whether or not the message is packed. If `true` (the default), the message will be
     * unpacked.
     *
     * @param {boolean} [singleSegment] If true, `src` will be treated as a message consisting of a single segment without
     * a framing header.
     *
     */
    function Message(src, packed, singleSegment) {
        if (packed === void 0) { packed = true; }
        if (singleSegment === void 0) { singleSegment = false; }
        this._capnp = initMessage(src, packed, singleSegment);
        if (src && !isAnyArena(src))
            preallocateSegments(this);
        trace("new %s", this);
    }
    Message.prototype.allocateSegment = function (byteLength) {
        return allocateSegment(byteLength, this);
    };
    /**
     * Create a pretty-printed string dump of this message; incredibly useful for debugging.
     *
     * WARNING: Do not call this method on large messages!
     *
     * @returns {string} A big steaming pile of pretty hex digits.
     */
    Message.prototype.dump = function () {
        return dump(this);
    };
    /**
     * Get a struct pointer for the root of this message. This is primarily used when reading a message; it will not
     * overwrite existing data.
     *
     * @template T
     * @param {StructCtor<T>} RootStruct The struct type to use as the root.
     * @returns {T} A struct representing the root of the message.
     */
    Message.prototype.getRoot = function (RootStruct) {
        return getRoot(RootStruct, this);
    };
    /**
     * Get a segment by its id.
     *
     * This will lazily allocate the first segment if it doesn't already exist.
     *
     * @param {number} id The segment id.
     * @returns {Segment} The requested segment.
     */
    Message.prototype.getSegment = function (id) {
        return getSegment(id, this);
    };
    /**
     * Initialize a new message using the provided struct type as the root.
     *
     * @template T
     * @param {StructCtor<T>} RootStruct The struct type to use as the root.
     * @returns {T} An initialized struct pointing to the root of the message.
     */
    Message.prototype.initRoot = function (RootStruct) {
        return initRoot(RootStruct, this);
    };
    /**
     * Set the root of the message to a copy of the given pointer. Used internally
     * to make copies of pointers for default values.
     *
     * @param {Pointer} src The source pointer to copy.
     * @returns {void}
     */
    Message.prototype.setRoot = function (src) {
        setRoot(src, this);
    };
    /**
     * Combine the contents of this message's segments into a single array buffer and prepend a stream framing header
     * containing information about the following segment data.
     *
     * @returns {ArrayBuffer} An ArrayBuffer with the contents of this message.
     */
    Message.prototype.toArrayBuffer = function () {
        return toArrayBuffer(this);
    };
    /**
     * Like `toArrayBuffer()`, but also applies the packing algorithm to the output. This is typically what you want to
     * use if you're sending the message over a network link or other slow I/O interface where size matters.
     *
     * @returns {ArrayBuffer} A packed message.
     */
    Message.prototype.toPackedArrayBuffer = function () {
        return toPackedArrayBuffer(this);
    };
    Message.prototype.toString = function () {
        return "Message_arena:" + this._capnp.arena;
    };
    Message.allocateSegment = allocateSegment;
    Message.dump = dump;
    Message.getRoot = getRoot;
    Message.getSegment = getSegment;
    Message.initRoot = initRoot;
    Message.readRawPointer = readRawPointer;
    Message.toArrayBuffer = toArrayBuffer;
    Message.toPackedArrayBuffer = toPackedArrayBuffer;
    return Message;
}());
exports.Message = Message;
function initMessage(src, packed, singleSegment) {
    if (packed === void 0) { packed = true; }
    if (singleSegment === void 0) { singleSegment = false; }
    if (src === undefined) {
        return {
            arena: new arena$1.SingleSegmentArena(),
            segments: [],
            traversalLimit: constants.DEFAULT_TRAVERSE_LIMIT
        };
    }
    if (isAnyArena(src)) {
        return { arena: src, segments: [], traversalLimit: constants.DEFAULT_TRAVERSE_LIMIT };
    }
    var buf = src;
    if (isArrayBufferView(buf)) {
        buf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    if (packed)
        buf = packing.unpack(buf);
    if (singleSegment) {
        return {
            arena: new arena$1.SingleSegmentArena(buf),
            segments: [],
            traversalLimit: constants.DEFAULT_TRAVERSE_LIMIT
        };
    }
    return {
        arena: new arena$1.MultiSegmentArena(getFramedSegments(buf)),
        segments: [],
        traversalLimit: constants.DEFAULT_TRAVERSE_LIMIT
    };
}
exports.initMessage = initMessage;
/**
 * Given an _unpacked_ message with a segment framing header, this will generate an ArrayBuffer for each segment in
 * the message.
 *
 * This method is not typically called directly, but can be useful in certain cases.
 *
 * @static
 * @param {ArrayBuffer} message An unpacked message with a framing header.
 * @returns {ArrayBuffer[]} An array of buffers containing the segment data.
 */
function getFramedSegments(message) {
    var dv = new DataView(message);
    var segmentCount = dv.getUint32(0, true) + 1;
    var segments = new Array(segmentCount);
    trace("reading %d framed segments from stream", segmentCount);
    var byteOffset = 4 + segmentCount * 4;
    byteOffset += byteOffset % 8;
    if (byteOffset + segmentCount * 4 > message.byteLength) {
        throw new Error(errors.MSG_INVALID_FRAME_HEADER);
    }
    for (var i = 0; i < segmentCount; i++) {
        var byteLength = dv.getUint32(4 + i * 4, true) * 8;
        if (byteOffset + byteLength > message.byteLength) {
            throw new Error(errors.MSG_INVALID_FRAME_HEADER);
        }
        segments[i] = message.slice(byteOffset, byteOffset + byteLength);
        byteOffset += byteLength;
    }
    return segments;
}
exports.getFramedSegments = getFramedSegments;
/**
 * This method is called on messages that were constructed with existing data to prepopulate the segments array with
 * everything we can find in the arena. Each segment will have it's `byteLength` set to the size of its buffer.
 *
 * Technically speaking, the message's segments will be "full" after calling this function. Calling this on your own
 * may void your warranty.
 *
 * @param {Message} m The message to allocate.
 * @returns {void}
 */
function preallocateSegments(m) {
    var numSegments = arena$1.Arena.getNumSegments(m._capnp.arena);
    if (numSegments < 1)
        throw new Error(errors.MSG_NO_SEGMENTS_IN_ARENA);
    m._capnp.segments = new Array(numSegments);
    for (var i = 0; i < numSegments; i++) {
        // Set up each segment so that they're fully allocated to the extents of the existing buffers.
        var buffer = arena$1.Arena.getBuffer(i, m._capnp.arena);
        var segment$1 = new segment.Segment(i, m, buffer, buffer.byteLength);
        m._capnp.segments[i] = segment$1;
    }
}
exports.preallocateSegments = preallocateSegments;
function isArrayBufferView(src) {
    return src.byteOffset !== undefined;
}
function isAnyArena(o) {
    return o.kind !== undefined;
}
function allocateSegment(byteLength, m) {
    trace("allocating %x bytes for %s", byteLength, m);
    var res = arena$1.Arena.allocate(byteLength, m._capnp.segments, m._capnp.arena);
    var s;
    if (res.id === m._capnp.segments.length) {
        // Note how we're only allowing new segments in if they're exactly the next one in the array. There is no logical
        // reason for segments to be created out of order.
        s = new segment.Segment(res.id, m, res.buffer);
        trace("adding new segment %s", s);
        m._capnp.segments.push(s);
    }
    else if (res.id < 0 || res.id > m._capnp.segments.length) {
        throw new Error(util$1.format(errors.MSG_SEGMENT_OUT_OF_BOUNDS, res.id, m));
    }
    else {
        s = m._capnp.segments[res.id];
        trace("replacing segment %s with buffer (len:%d)", s, res.buffer.byteLength);
        s.replaceBuffer(res.buffer);
    }
    return s;
}
exports.allocateSegment = allocateSegment;
function dump(m) {
    var r = "";
    if (m._capnp.segments.length === 0) {
        return "================\nNo Segments\n================\n";
    }
    for (var i = 0; i < m._capnp.segments.length; i++) {
        r += "================\nSegment #" + i + "\n================\n";
        var _a = m._capnp.segments[i], buffer = _a.buffer, byteLength = _a.byteLength;
        var b = new Uint8Array(buffer, 0, byteLength);
        r += util$1.dumpBuffer(b);
    }
    return r;
}
exports.dump = dump;
function getRoot(RootStruct, m) {
    var root = new RootStruct(m.getSegment(0), 0);
    pointer.validate(pointers.PointerType.STRUCT, root);
    var ts = pointer.getTargetStructSize(root);
    // Make sure the underlying pointer is actually big enough to hold the data and pointers as specified in the schema.
    // If not a shallow copy of the struct contents needs to be made before returning.
    if (ts.dataByteLength < RootStruct._capnp.size.dataByteLength ||
        ts.pointerLength < RootStruct._capnp.size.pointerLength) {
        trace("need to resize root struct %s", root);
        struct.resize(RootStruct._capnp.size, root);
    }
    return root;
}
exports.getRoot = getRoot;
function getSegment(id, m) {
    var segmentLength = m._capnp.segments.length;
    if (id === 0 && segmentLength === 0) {
        // Segment zero is special. If we have no segments in the arena we'll want to allocate a new one and leave room
        // for the root pointer.
        var arenaSegments = arena$1.Arena.getNumSegments(m._capnp.arena);
        if (arenaSegments === 0) {
            allocateSegment(constants.DEFAULT_BUFFER_SIZE, m);
        }
        else {
            // Okay, the arena already has a buffer we can use. This is totally fine.
            m._capnp.segments[0] = new segment.Segment(0, m, arena$1.Arena.getBuffer(0, m._capnp.arena));
        }
        if (!m._capnp.segments[0].hasCapacity(8)) {
            throw new Error(errors.MSG_SEGMENT_TOO_SMALL);
        }
        // This will leave room for the root pointer.
        m._capnp.segments[0].allocate(8);
        return m._capnp.segments[0];
    }
    if (id < 0 || id >= segmentLength) {
        throw new Error(util$1.format(errors.MSG_SEGMENT_OUT_OF_BOUNDS, id, m));
    }
    return m._capnp.segments[id];
}
exports.getSegment = getSegment;
function initRoot(RootStruct, m) {
    var root = new RootStruct(m.getSegment(0), 0);
    struct.initStruct(RootStruct._capnp.size, root);
    trace("Initialized root pointer %s for %s.", root, m);
    return root;
}
exports.initRoot = initRoot;
/**
 * Read a pointer in raw form (a packed message with framing headers). Does not
 * care or attempt to validate the input beyond parsing the message
 * segments.
 *
 * This is typically used by the compiler to load default values, but can be
 * useful to work with messages with an unknown schema.
 *
 * @param {ArrayBuffer} data The raw data to read.
 * @returns {Pointer} A root pointer.
 */
function readRawPointer(data) {
    return new pointers.Pointer(new Message(data).getSegment(0), 0);
}
exports.readRawPointer = readRawPointer;
function setRoot(src, m) {
    pointers.Pointer.copyFrom(src, new pointers.Pointer(m.getSegment(0), 0));
}
exports.setRoot = setRoot;
function toArrayBuffer(m) {
    var streamFrame = getStreamFrame(m);
    // Make sure the first segment is allocated.
    if (m._capnp.segments.length === 0)
        getSegment(0, m);
    var segments = m._capnp.segments;
    // Add space for the stream framing.
    var totalLength = streamFrame.byteLength +
        segments.reduce(function (l, s) { return l + util$1.padToWord(s.byteLength); }, 0);
    var out = new Uint8Array(new ArrayBuffer(totalLength));
    var o = streamFrame.byteLength;
    out.set(new Uint8Array(streamFrame));
    segments.forEach(function (s) {
        var segmentLength = util$1.padToWord(s.byteLength);
        out.set(new Uint8Array(s.buffer, 0, segmentLength), o);
        o += segmentLength;
    });
    return out.buffer;
}
exports.toArrayBuffer = toArrayBuffer;
function toPackedArrayBuffer(m) {
    var streamFrame = packing.pack(getStreamFrame(m));
    // Make sure the first segment is allocated.
    if (m._capnp.segments.length === 0)
        m.getSegment(0);
    // NOTE: A copy operation can be avoided here if we capture the intermediate array and use that directly in the copy
    // loop below, rather than have `pack()` copy it to an ArrayBuffer just to have to copy it again later. If the
    // intermediate array can be avoided altogether that's even better!
    var segments = m._capnp.segments.map(function (s) {
        return packing.pack(s.buffer, 0, util$1.padToWord(s.byteLength));
    });
    var totalLength = streamFrame.byteLength + segments.reduce(function (l, s) { return l + s.byteLength; }, 0);
    var out = new Uint8Array(new ArrayBuffer(totalLength));
    var o = streamFrame.byteLength;
    out.set(new Uint8Array(streamFrame));
    segments.forEach(function (s) {
        out.set(new Uint8Array(s), o);
        o += s.byteLength;
    });
    return out.buffer;
}
exports.toPackedArrayBuffer = toPackedArrayBuffer;
function getStreamFrame(m) {
    var length = m._capnp.segments.length;
    if (length === 0) {
        // Don't bother allocating the first segment, just return a single zero word for the frame header.
        return new Float64Array(1).buffer;
    }
    var frameLength = 4 + length * 4 + (1 - (length % 2)) * 4;
    var out = new DataView(new ArrayBuffer(frameLength));
    trace("Writing message stream frame with segment count: %d.", length);
    out.setUint32(0, length - 1, true);
    m._capnp.segments.forEach(function (s, i) {
        trace("Message segment %d word count: %d.", s.id, s.byteLength / 8);
        out.setUint32(i * 4 + 4, s.byteLength / 8, true);
    });
    return out.buffer;
}
exports.getStreamFrame = getStreamFrame;


});

unwrapExports(message);
var message_1 = message.Message;
var message_2 = message.initMessage;
var message_3 = message.getFramedSegments;
var message_4 = message.preallocateSegments;
var message_5 = message.allocateSegment;
var message_6 = message.dump;
var message_7 = message.getRoot;
var message_8 = message.getSegment;
var message_9 = message.initRoot;
var message_10 = message.readRawPointer;
var message_11 = message.setRoot;
var message_12 = message.toArrayBuffer;
var message_13 = message.toPackedArrayBuffer;
var message_14 = message.getStreamFrame;

var serialization = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

tslib_es6.__exportStar(mask, exports);

exports.ListElementSize = listElementSize.ListElementSize;

exports.Message = message.Message;
exports.readRawPointer = message.readRawPointer;

exports.ObjectSize = objectSize.ObjectSize;
tslib_es6.__exportStar(pointers, exports);


});

unwrapExports(serialization);
var serialization_1 = serialization.ListElementSize;
var serialization_2 = serialization.Message;
var serialization_3 = serialization.readRawPointer;
var serialization_4 = serialization.ObjectSize;

var lib = createCommonjsModule(function (module, exports) {
/**
 * @author jdiaz5513
 */
Object.defineProperty(exports, "__esModule", { value: true });

exports.ListElementSize = serialization.ListElementSize;
exports.Message = serialization.Message;
exports.ObjectSize = serialization.ObjectSize;
exports.readRawPointer = serialization.readRawPointer;
exports.AnyPointerList = serialization.AnyPointerList;
exports.BoolList = serialization.BoolList;
exports.CompositeList = serialization.CompositeList;
exports.Data = serialization.Data;
exports.DataList = serialization.DataList;
exports.Float32List = serialization.Float32List;
exports.Float64List = serialization.Float64List;
exports.Int16List = serialization.Int16List;
exports.Int32List = serialization.Int32List;
exports.Int64List = serialization.Int64List;
exports.Int8List = serialization.Int8List;
exports.Interface = serialization.Interface;
exports.InterfaceList = serialization.InterfaceList;
exports.List = serialization.List;
exports.Orphan = serialization.Orphan;
exports.PointerList = serialization.PointerList;
exports.PointerType = serialization.PointerType;
exports.Pointer = serialization.Pointer;
exports.Struct = serialization.Struct;
exports.Text = serialization.Text;
exports.TextList = serialization.TextList;
exports.Uint16List = serialization.Uint16List;
exports.Uint32List = serialization.Uint32List;
exports.Uint64List = serialization.Uint64List;
exports.Uint8List = serialization.Uint8List;
exports.VoidList = serialization.VoidList;
exports.Void = serialization.Void;
exports.getBitMask = serialization.getBitMask;
exports.getFloat32Mask = serialization.getFloat32Mask;
exports.getFloat64Mask = serialization.getFloat64Mask;
exports.getInt16Mask = serialization.getInt16Mask;
exports.getInt32Mask = serialization.getInt32Mask;
exports.getInt64Mask = serialization.getInt64Mask;
exports.getInt8Mask = serialization.getInt8Mask;
exports.getUint16Mask = serialization.getUint16Mask;
exports.getUint32Mask = serialization.getUint32Mask;
exports.getUint64Mask = serialization.getUint64Mask;
exports.getUint8Mask = serialization.getUint8Mask;

exports.Int64 = types.Int64;
exports.Uint64 = types.Uint64;


});

unwrapExports(lib);
var lib_1 = lib.ListElementSize;
var lib_2 = lib.Message;
var lib_3 = lib.ObjectSize;
var lib_4 = lib.readRawPointer;
var lib_5 = lib.AnyPointerList;
var lib_6 = lib.BoolList;
var lib_7 = lib.CompositeList;
var lib_8 = lib.Data;
var lib_9 = lib.DataList;
var lib_10 = lib.Float32List;
var lib_11 = lib.Float64List;
var lib_12 = lib.Int16List;
var lib_13 = lib.Int32List;
var lib_14 = lib.Int64List;
var lib_15 = lib.Int8List;
var lib_16 = lib.Interface;
var lib_17 = lib.InterfaceList;
var lib_18 = lib.List;
var lib_19 = lib.Orphan;
var lib_20 = lib.PointerList;
var lib_21 = lib.PointerType;
var lib_22 = lib.Pointer;
var lib_23 = lib.Struct;
var lib_24 = lib.Text;
var lib_25 = lib.TextList;
var lib_26 = lib.Uint16List;
var lib_27 = lib.Uint32List;
var lib_28 = lib.Uint64List;
var lib_29 = lib.Uint8List;
var lib_30 = lib.VoidList;
var lib_31 = lib.Void;
var lib_32 = lib.getBitMask;
var lib_33 = lib.getFloat32Mask;
var lib_34 = lib.getFloat64Mask;
var lib_35 = lib.getInt16Mask;
var lib_36 = lib.getInt32Mask;
var lib_37 = lib.getInt64Mask;
var lib_38 = lib.getInt8Mask;
var lib_39 = lib.getUint16Mask;
var lib_40 = lib.getUint32Mask;
var lib_41 = lib.getUint64Mask;
var lib_42 = lib.getUint8Mask;
var lib_43 = lib.Int64;
var lib_44 = lib.Uint64;

var values_capnp = createCommonjsModule(function (module, exports) {
/* tslint:disable */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

const capnp_ts_1 = lib;
exports._capnpFileId = "b06e5cc550bd0e32";
var Value_Which;
(function (Value_Which) {
    Value_Which[Value_Which["VOID"] = 0] = "VOID";
    Value_Which[Value_Which["BOOL"] = 1] = "BOOL";
    Value_Which[Value_Which["INT8"] = 2] = "INT8";
    Value_Which[Value_Which["INT16"] = 3] = "INT16";
    Value_Which[Value_Which["INT32"] = 4] = "INT32";
    Value_Which[Value_Which["INT64"] = 5] = "INT64";
    Value_Which[Value_Which["UINT8"] = 6] = "UINT8";
    Value_Which[Value_Which["UINT16"] = 7] = "UINT16";
    Value_Which[Value_Which["UINT32"] = 8] = "UINT32";
    Value_Which[Value_Which["UINT64"] = 9] = "UINT64";
    Value_Which[Value_Which["FIXED_POINT"] = 10] = "FIXED_POINT";
    Value_Which[Value_Which["FLOAT32"] = 11] = "FLOAT32";
    Value_Which[Value_Which["FLOAT64"] = 12] = "FLOAT64";
    Value_Which[Value_Which["TEXT"] = 13] = "TEXT";
    Value_Which[Value_Which["DATA"] = 14] = "DATA";
    Value_Which[Value_Which["LIST"] = 15] = "LIST";
    Value_Which[Value_Which["ENUM"] = 16] = "ENUM";
    Value_Which[Value_Which["STRUCT"] = 17] = "STRUCT";
    Value_Which[Value_Which["ANY_POINTER"] = 18] = "ANY_POINTER";
})(Value_Which = exports.Value_Which || (exports.Value_Which = {}));
class Value extends capnp_ts_1.Struct {
    isVoid() { return capnp_ts_1.Struct.getUint16(0, this) === 0; }
    setVoid() { capnp_ts_1.Struct.setUint16(0, 0, this); }
    getBool() {
        capnp_ts_1.Struct.testWhich("bool", capnp_ts_1.Struct.getUint16(0, this), 1, this);
        return capnp_ts_1.Struct.getBit(16, this);
    }
    isBool() { return capnp_ts_1.Struct.getUint16(0, this) === 1; }
    setBool(value) {
        capnp_ts_1.Struct.setUint16(0, 1, this);
        capnp_ts_1.Struct.setBit(16, value, this);
    }
    getInt8() {
        capnp_ts_1.Struct.testWhich("int8", capnp_ts_1.Struct.getUint16(0, this), 2, this);
        return capnp_ts_1.Struct.getInt8(2, this);
    }
    isInt8() { return capnp_ts_1.Struct.getUint16(0, this) === 2; }
    setInt8(value) {
        capnp_ts_1.Struct.setUint16(0, 2, this);
        capnp_ts_1.Struct.setInt8(2, value, this);
    }
    getInt16() {
        capnp_ts_1.Struct.testWhich("int16", capnp_ts_1.Struct.getUint16(0, this), 3, this);
        return capnp_ts_1.Struct.getInt16(2, this);
    }
    isInt16() { return capnp_ts_1.Struct.getUint16(0, this) === 3; }
    setInt16(value) {
        capnp_ts_1.Struct.setUint16(0, 3, this);
        capnp_ts_1.Struct.setInt16(2, value, this);
    }
    getInt32() {
        capnp_ts_1.Struct.testWhich("int32", capnp_ts_1.Struct.getUint16(0, this), 4, this);
        return capnp_ts_1.Struct.getInt32(4, this);
    }
    isInt32() { return capnp_ts_1.Struct.getUint16(0, this) === 4; }
    setInt32(value) {
        capnp_ts_1.Struct.setUint16(0, 4, this);
        capnp_ts_1.Struct.setInt32(4, value, this);
    }
    getInt64() {
        capnp_ts_1.Struct.testWhich("int64", capnp_ts_1.Struct.getUint16(0, this), 5, this);
        return capnp_ts_1.Struct.getInt64(8, this);
    }
    isInt64() { return capnp_ts_1.Struct.getUint16(0, this) === 5; }
    setInt64(value) {
        capnp_ts_1.Struct.setUint16(0, 5, this);
        capnp_ts_1.Struct.setInt64(8, value, this);
    }
    getUint8() {
        capnp_ts_1.Struct.testWhich("uint8", capnp_ts_1.Struct.getUint16(0, this), 6, this);
        return capnp_ts_1.Struct.getUint8(2, this);
    }
    isUint8() { return capnp_ts_1.Struct.getUint16(0, this) === 6; }
    setUint8(value) {
        capnp_ts_1.Struct.setUint16(0, 6, this);
        capnp_ts_1.Struct.setUint8(2, value, this);
    }
    getUint16() {
        capnp_ts_1.Struct.testWhich("uint16", capnp_ts_1.Struct.getUint16(0, this), 7, this);
        return capnp_ts_1.Struct.getUint16(2, this);
    }
    isUint16() { return capnp_ts_1.Struct.getUint16(0, this) === 7; }
    setUint16(value) {
        capnp_ts_1.Struct.setUint16(0, 7, this);
        capnp_ts_1.Struct.setUint16(2, value, this);
    }
    getUint32() {
        capnp_ts_1.Struct.testWhich("uint32", capnp_ts_1.Struct.getUint16(0, this), 8, this);
        return capnp_ts_1.Struct.getUint32(4, this);
    }
    isUint32() { return capnp_ts_1.Struct.getUint16(0, this) === 8; }
    setUint32(value) {
        capnp_ts_1.Struct.setUint16(0, 8, this);
        capnp_ts_1.Struct.setUint32(4, value, this);
    }
    getUint64() {
        capnp_ts_1.Struct.testWhich("uint64", capnp_ts_1.Struct.getUint16(0, this), 9, this);
        return capnp_ts_1.Struct.getUint64(8, this);
    }
    isUint64() { return capnp_ts_1.Struct.getUint16(0, this) === 9; }
    setUint64(value) {
        capnp_ts_1.Struct.setUint16(0, 9, this);
        capnp_ts_1.Struct.setUint64(8, value, this);
    }
    getFixedPoint() {
        capnp_ts_1.Struct.testWhich("fixedPoint", capnp_ts_1.Struct.getUint16(0, this), 10, this);
        return capnp_ts_1.Struct.getText(0, this);
    }
    isFixedPoint() { return capnp_ts_1.Struct.getUint16(0, this) === 10; }
    setFixedPoint(value) {
        capnp_ts_1.Struct.setUint16(0, 10, this);
        capnp_ts_1.Struct.setText(0, value, this);
    }
    getFloat32() {
        capnp_ts_1.Struct.testWhich("float32", capnp_ts_1.Struct.getUint16(0, this), 11, this);
        return capnp_ts_1.Struct.getFloat32(4, this);
    }
    isFloat32() { return capnp_ts_1.Struct.getUint16(0, this) === 11; }
    setFloat32(value) {
        capnp_ts_1.Struct.setUint16(0, 11, this);
        capnp_ts_1.Struct.setFloat32(4, value, this);
    }
    getFloat64() {
        capnp_ts_1.Struct.testWhich("float64", capnp_ts_1.Struct.getUint16(0, this), 12, this);
        return capnp_ts_1.Struct.getFloat64(8, this);
    }
    isFloat64() { return capnp_ts_1.Struct.getUint16(0, this) === 12; }
    setFloat64(value) {
        capnp_ts_1.Struct.setUint16(0, 12, this);
        capnp_ts_1.Struct.setFloat64(8, value, this);
    }
    getText() {
        capnp_ts_1.Struct.testWhich("text", capnp_ts_1.Struct.getUint16(0, this), 13, this);
        return capnp_ts_1.Struct.getText(0, this);
    }
    isText() { return capnp_ts_1.Struct.getUint16(0, this) === 13; }
    setText(value) {
        capnp_ts_1.Struct.setUint16(0, 13, this);
        capnp_ts_1.Struct.setText(0, value, this);
    }
    adoptData(value) {
        capnp_ts_1.Struct.setUint16(0, 14, this);
        capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    disownData() { return capnp_ts_1.Struct.disown(this.getData()); }
    getData() {
        capnp_ts_1.Struct.testWhich("data", capnp_ts_1.Struct.getUint16(0, this), 14, this);
        return capnp_ts_1.Struct.getData(0, this);
    }
    hasData() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initData(length) {
        capnp_ts_1.Struct.setUint16(0, 14, this);
        return capnp_ts_1.Struct.initData(0, length, this);
    }
    isData() { return capnp_ts_1.Struct.getUint16(0, this) === 14; }
    setData(value) {
        capnp_ts_1.Struct.setUint16(0, 14, this);
        capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    adoptList(value) {
        capnp_ts_1.Struct.setUint16(0, 15, this);
        capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    disownList() { return capnp_ts_1.Struct.disown(this.getList()); }
    getList() {
        capnp_ts_1.Struct.testWhich("list", capnp_ts_1.Struct.getUint16(0, this), 15, this);
        return capnp_ts_1.Struct.getPointer(0, this);
    }
    hasList() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    isList() { return capnp_ts_1.Struct.getUint16(0, this) === 15; }
    setList(value) {
        capnp_ts_1.Struct.setUint16(0, 15, this);
        capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    getEnum() {
        capnp_ts_1.Struct.testWhich("enum", capnp_ts_1.Struct.getUint16(0, this), 16, this);
        return capnp_ts_1.Struct.getUint16(2, this);
    }
    isEnum() { return capnp_ts_1.Struct.getUint16(0, this) === 16; }
    setEnum(value) {
        capnp_ts_1.Struct.setUint16(0, 16, this);
        capnp_ts_1.Struct.setUint16(2, value, this);
    }
    adoptStruct(value) {
        capnp_ts_1.Struct.setUint16(0, 17, this);
        capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    disownStruct() { return capnp_ts_1.Struct.disown(this.getStruct()); }
    getStruct() {
        capnp_ts_1.Struct.testWhich("struct", capnp_ts_1.Struct.getUint16(0, this), 17, this);
        return capnp_ts_1.Struct.getPointer(0, this);
    }
    hasStruct() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    isStruct() { return capnp_ts_1.Struct.getUint16(0, this) === 17; }
    setStruct(value) {
        capnp_ts_1.Struct.setUint16(0, 17, this);
        capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    adoptAnyPointer(value) {
        capnp_ts_1.Struct.setUint16(0, 18, this);
        capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    disownAnyPointer() { return capnp_ts_1.Struct.disown(this.getAnyPointer()); }
    getAnyPointer() {
        capnp_ts_1.Struct.testWhich("anyPointer", capnp_ts_1.Struct.getUint16(0, this), 18, this);
        return capnp_ts_1.Struct.getPointer(0, this);
    }
    hasAnyPointer() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    isAnyPointer() { return capnp_ts_1.Struct.getUint16(0, this) === 18; }
    setAnyPointer(value) {
        capnp_ts_1.Struct.setUint16(0, 18, this);
        capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this));
    }
    toString() { return "Value_" + super.toString(); }
    which() { return capnp_ts_1.Struct.getUint16(0, this); }
}
Value.VOID = Value_Which.VOID;
Value.BOOL = Value_Which.BOOL;
Value.INT8 = Value_Which.INT8;
Value.INT16 = Value_Which.INT16;
Value.INT32 = Value_Which.INT32;
Value.INT64 = Value_Which.INT64;
Value.UINT8 = Value_Which.UINT8;
Value.UINT16 = Value_Which.UINT16;
Value.UINT32 = Value_Which.UINT32;
Value.UINT64 = Value_Which.UINT64;
Value.FIXED_POINT = Value_Which.FIXED_POINT;
Value.FLOAT32 = Value_Which.FLOAT32;
Value.FLOAT64 = Value_Which.FLOAT64;
Value.TEXT = Value_Which.TEXT;
Value.DATA = Value_Which.DATA;
Value.LIST = Value_Which.LIST;
Value.ENUM = Value_Which.ENUM;
Value.STRUCT = Value_Which.STRUCT;
Value.ANY_POINTER = Value_Which.ANY_POINTER;
Value._capnp = { displayName: "Value", id: "eb2d33a1ada10a9b", size: new capnp_ts_1.ObjectSize(16, 1) };
exports.Value = Value;
class Map_Entry extends capnp_ts_1.Struct {
    adoptKey(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownKey() { return capnp_ts_1.Struct.disown(this.getKey()); }
    getKey() { return capnp_ts_1.Struct.getPointer(0, this); }
    hasKey() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    setKey(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptValue(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownValue() { return capnp_ts_1.Struct.disown(this.getValue()); }
    getValue() { return capnp_ts_1.Struct.getPointer(1, this); }
    hasValue() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    setValue(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    toString() { return "Map_Entry_" + super.toString(); }
}
Map_Entry._capnp = { displayName: "Entry", id: "e243243ac908507f", size: new capnp_ts_1.ObjectSize(0, 2) };
exports.Map_Entry = Map_Entry;
class Map extends capnp_ts_1.Struct {
    adoptEntries(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownEntries() { return capnp_ts_1.Struct.disown(this.getEntries()); }
    getEntries() { return capnp_ts_1.Struct.getList(0, Map._Entries, this); }
    hasEntries() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initEntries(length) { return capnp_ts_1.Struct.initList(0, Map._Entries, length, this); }
    setEntries(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    toString() { return "Map_" + super.toString(); }
}
Map.Entry = Map_Entry;
Map._capnp = { displayName: "Map", id: "e7e566cc912a6f7b", size: new capnp_ts_1.ObjectSize(0, 1) };
exports.Map = Map;
Map._Entries = lib.CompositeList(Map_Entry);
});

unwrapExports(values_capnp);
var values_capnp_1 = values_capnp._capnpFileId;
var values_capnp_2 = values_capnp.Value_Which;
var values_capnp_3 = values_capnp.Value;
var values_capnp_4 = values_capnp.Map_Entry;
var values_capnp_5 = values_capnp.Map;

var transaction_capnp = createCommonjsModule(function (module, exports) {
/* tslint:disable */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file has been automatically generated by the [capnpc-ts utility](https://github.com/jdiaz5513/capnp-ts).
 */

const capnp_ts_1 = lib;

exports._capnpFileId = "921d030365beff8c";
class Delta extends capnp_ts_1.Struct {
    adoptKey(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownKey() { return capnp_ts_1.Struct.disown(this.getKey()); }
    getKey() { return capnp_ts_1.Struct.getData(0, this); }
    hasKey() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initKey(length) { return capnp_ts_1.Struct.initData(0, length, this); }
    setKey(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptValue(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownValue() { return capnp_ts_1.Struct.disown(this.getValue()); }
    getValue() { return capnp_ts_1.Struct.getData(1, this); }
    hasValue() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initValue(length) { return capnp_ts_1.Struct.initData(1, length, this); }
    setValue(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    toString() { return "Delta_" + super.toString(); }
}
Delta._capnp = { displayName: "Delta", id: "b36956d6aca4a098", size: new capnp_ts_1.ObjectSize(0, 2) };
exports.Delta = Delta;
class MetaData extends capnp_ts_1.Struct {
    adoptProof(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownProof() { return capnp_ts_1.Struct.disown(this.getProof()); }
    getProof() { return capnp_ts_1.Struct.getData(0, this); }
    hasProof() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initProof(length) { return capnp_ts_1.Struct.initData(0, length, this); }
    setProof(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptSignature(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownSignature() { return capnp_ts_1.Struct.disown(this.getSignature()); }
    getSignature() { return capnp_ts_1.Struct.getData(1, this); }
    hasSignature() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initSignature(length) { return capnp_ts_1.Struct.initData(1, length, this); }
    setSignature(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    getTimestamp() { return capnp_ts_1.Struct.getFloat32(0, this); }
    setTimestamp(value) { capnp_ts_1.Struct.setFloat32(0, value, this); }
    toString() { return "MetaData_" + super.toString(); }
}
MetaData._capnp = { displayName: "MetaData", id: "a70e205986d03e12", size: new capnp_ts_1.ObjectSize(8, 2) };
exports.MetaData = MetaData;
class TransactionPayload extends capnp_ts_1.Struct {
    adoptSender(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownSender() { return capnp_ts_1.Struct.disown(this.getSender()); }
    getSender() { return capnp_ts_1.Struct.getData(0, this); }
    hasSender() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initSender(length) { return capnp_ts_1.Struct.initData(0, length, this); }
    setSender(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptProcessor(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownProcessor() { return capnp_ts_1.Struct.disown(this.getProcessor()); }
    getProcessor() { return capnp_ts_1.Struct.getData(1, this); }
    hasProcessor() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initProcessor(length) { return capnp_ts_1.Struct.initData(1, length, this); }
    setProcessor(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    getNonce() { return capnp_ts_1.Struct.getUint64(0, this); }
    setNonce(value) { capnp_ts_1.Struct.setUint64(0, value, this); }
    getStampsSupplied() { return capnp_ts_1.Struct.getUint64(8, this); }
    setStampsSupplied(value) { capnp_ts_1.Struct.setUint64(8, value, this); }
    getContractName() { return capnp_ts_1.Struct.getText(2, this); }
    setContractName(value) { capnp_ts_1.Struct.setText(2, value, this); }
    getFunctionName() { return capnp_ts_1.Struct.getText(3, this); }
    setFunctionName(value) { capnp_ts_1.Struct.setText(3, value, this); }
    adoptKwargs(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(4, this)); }
    disownKwargs() { return capnp_ts_1.Struct.disown(this.getKwargs()); }
    getKwargs() { return capnp_ts_1.Struct.getStruct(4, values_capnp.Map, this); }
    hasKwargs() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(4, this)); }
    initKwargs() { return capnp_ts_1.Struct.initStructAt(4, values_capnp.Map, this); }
    setKwargs(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(4, this)); }
    toString() { return "TransactionPayload_" + super.toString(); }
}
TransactionPayload._capnp = { displayName: "TransactionPayload", id: "9da7e0d2cce0cea1", size: new capnp_ts_1.ObjectSize(16, 5) };
exports.TransactionPayload = TransactionPayload;
class Transaction extends capnp_ts_1.Struct {
    adoptMetadata(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownMetadata() { return capnp_ts_1.Struct.disown(this.getMetadata()); }
    getMetadata() { return capnp_ts_1.Struct.getStruct(0, MetaData, this); }
    hasMetadata() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initMetadata() { return capnp_ts_1.Struct.initStructAt(0, MetaData, this); }
    setMetadata(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptPayload(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownPayload() { return capnp_ts_1.Struct.disown(this.getPayload()); }
    getPayload() { return capnp_ts_1.Struct.getStruct(1, TransactionPayload, this); }
    hasPayload() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initPayload() { return capnp_ts_1.Struct.initStructAt(1, TransactionPayload, this); }
    setPayload(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    toString() { return "Transaction_" + super.toString(); }
}
Transaction._capnp = { displayName: "Transaction", id: "f784dfdeb15a3120", size: new capnp_ts_1.ObjectSize(0, 2) };
exports.Transaction = Transaction;
class TransactionData extends capnp_ts_1.Struct {
    adoptTransaction(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownTransaction() { return capnp_ts_1.Struct.disown(this.getTransaction()); }
    getTransaction() { return capnp_ts_1.Struct.getStruct(0, NewTransaction, this); }
    hasTransaction() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initTransaction() { return capnp_ts_1.Struct.initStructAt(0, NewTransaction, this); }
    setTransaction(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    getStatus() { return capnp_ts_1.Struct.getUint8(0, this); }
    setStatus(value) { capnp_ts_1.Struct.setUint8(0, value, this); }
    adoptState(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownState() { return capnp_ts_1.Struct.disown(this.getState()); }
    getState() { return capnp_ts_1.Struct.getList(1, TransactionData._State, this); }
    hasState() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initState(length) { return capnp_ts_1.Struct.initList(1, TransactionData._State, length, this); }
    setState(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    getStampsUsed() { return capnp_ts_1.Struct.getUint64(8, this); }
    setStampsUsed(value) { capnp_ts_1.Struct.setUint64(8, value, this); }
    toString() { return "TransactionData_" + super.toString(); }
}
TransactionData._capnp = { displayName: "TransactionData", id: "a2d62360f4be217c", size: new capnp_ts_1.ObjectSize(16, 2) };
exports.TransactionData = TransactionData;
class Transactions extends capnp_ts_1.Struct {
    adoptTransactions(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownTransactions() { return capnp_ts_1.Struct.disown(this.getTransactions()); }
    getTransactions() { return capnp_ts_1.Struct.getList(0, Transactions._Transactions, this); }
    hasTransactions() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initTransactions(length) { return capnp_ts_1.Struct.initList(0, Transactions._Transactions, length, this); }
    setTransactions(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    toString() { return "Transactions_" + super.toString(); }
}
Transactions._capnp = { displayName: "Transactions", id: "bbfe7f501da387e9", size: new capnp_ts_1.ObjectSize(0, 1) };
exports.Transactions = Transactions;
class TransactionBatch extends capnp_ts_1.Struct {
    adoptTransactions(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownTransactions() { return capnp_ts_1.Struct.disown(this.getTransactions()); }
    getTransactions() { return capnp_ts_1.Struct.getList(0, TransactionBatch._Transactions, this); }
    hasTransactions() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initTransactions(length) { return capnp_ts_1.Struct.initList(0, TransactionBatch._Transactions, length, this); }
    setTransactions(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    getTimestamp() { return capnp_ts_1.Struct.getFloat64(0, this); }
    setTimestamp(value) { capnp_ts_1.Struct.setFloat64(0, value, this); }
    adoptSignature(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownSignature() { return capnp_ts_1.Struct.disown(this.getSignature()); }
    getSignature() { return capnp_ts_1.Struct.getData(1, this); }
    hasSignature() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initSignature(length) { return capnp_ts_1.Struct.initData(1, length, this); }
    setSignature(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    adoptSender(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(2, this)); }
    disownSender() { return capnp_ts_1.Struct.disown(this.getSender()); }
    getSender() { return capnp_ts_1.Struct.getData(2, this); }
    hasSender() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(2, this)); }
    initSender(length) { return capnp_ts_1.Struct.initData(2, length, this); }
    setSender(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(2, this)); }
    adoptInputHash(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(3, this)); }
    disownInputHash() { return capnp_ts_1.Struct.disown(this.getInputHash()); }
    getInputHash() { return capnp_ts_1.Struct.getData(3, this); }
    hasInputHash() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(3, this)); }
    initInputHash(length) { return capnp_ts_1.Struct.initData(3, length, this); }
    setInputHash(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(3, this)); }
    toString() { return "TransactionBatch_" + super.toString(); }
}
TransactionBatch._capnp = { displayName: "TransactionBatch", id: "b7fe07c9f4fa8a5b", size: new capnp_ts_1.ObjectSize(8, 4) };
exports.TransactionBatch = TransactionBatch;
class NewTransactionPayload extends capnp_ts_1.Struct {
    adoptSender(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownSender() { return capnp_ts_1.Struct.disown(this.getSender()); }
    getSender() { return capnp_ts_1.Struct.getData(0, this); }
    hasSender() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initSender(length) { return capnp_ts_1.Struct.initData(0, length, this); }
    setSender(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptProcessor(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownProcessor() { return capnp_ts_1.Struct.disown(this.getProcessor()); }
    getProcessor() { return capnp_ts_1.Struct.getData(1, this); }
    hasProcessor() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initProcessor(length) { return capnp_ts_1.Struct.initData(1, length, this); }
    setProcessor(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    getNonce() { return capnp_ts_1.Struct.getUint64(0, this); }
    setNonce(value) { capnp_ts_1.Struct.setUint64(0, value, this); }
    getStampsSupplied() { return capnp_ts_1.Struct.getUint64(8, this); }
    setStampsSupplied(value) { capnp_ts_1.Struct.setUint64(8, value, this); }
    getContractName() { return capnp_ts_1.Struct.getText(2, this); }
    setContractName(value) { capnp_ts_1.Struct.setText(2, value, this); }
    getFunctionName() { return capnp_ts_1.Struct.getText(3, this); }
    setFunctionName(value) { capnp_ts_1.Struct.setText(3, value, this); }
    adoptKwargs(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(4, this)); }
    disownKwargs() { return capnp_ts_1.Struct.disown(this.getKwargs()); }
    getKwargs() { return capnp_ts_1.Struct.getData(4, this); }
    hasKwargs() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(4, this)); }
    initKwargs(length) { return capnp_ts_1.Struct.initData(4, length, this); }
    setKwargs(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(4, this)); }
    toString() { return "NewTransactionPayload_" + super.toString(); }
}
NewTransactionPayload._capnp = { displayName: "NewTransactionPayload", id: "ea60ddf0049b6602", size: new capnp_ts_1.ObjectSize(16, 5) };
exports.NewTransactionPayload = NewTransactionPayload;
class NewTransaction extends capnp_ts_1.Struct {
    adoptMetadata(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(0, this)); }
    disownMetadata() { return capnp_ts_1.Struct.disown(this.getMetadata()); }
    getMetadata() { return capnp_ts_1.Struct.getStruct(0, MetaData, this); }
    hasMetadata() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(0, this)); }
    initMetadata() { return capnp_ts_1.Struct.initStructAt(0, MetaData, this); }
    setMetadata(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(0, this)); }
    adoptPayload(value) { capnp_ts_1.Struct.adopt(value, capnp_ts_1.Struct.getPointer(1, this)); }
    disownPayload() { return capnp_ts_1.Struct.disown(this.getPayload()); }
    getPayload() { return capnp_ts_1.Struct.getStruct(1, NewTransactionPayload, this); }
    hasPayload() { return !capnp_ts_1.Struct.isNull(capnp_ts_1.Struct.getPointer(1, this)); }
    initPayload() { return capnp_ts_1.Struct.initStructAt(1, NewTransactionPayload, this); }
    setPayload(value) { capnp_ts_1.Struct.copyFrom(value, capnp_ts_1.Struct.getPointer(1, this)); }
    toString() { return "NewTransaction_" + super.toString(); }
}
NewTransaction._capnp = { displayName: "NewTransaction", id: "e27c9148999550e1", size: new capnp_ts_1.ObjectSize(0, 2) };
exports.NewTransaction = NewTransaction;
TransactionData._State = lib.CompositeList(Delta);
Transactions._Transactions = lib.CompositeList(Transaction);
TransactionBatch._Transactions = lib.CompositeList(NewTransaction);
});

var transaction_capnp$1 = unwrapExports(transaction_capnp);
var transaction_capnp_1 = transaction_capnp._capnpFileId;
var transaction_capnp_2 = transaction_capnp.Delta;
var transaction_capnp_3 = transaction_capnp.MetaData;
var transaction_capnp_4 = transaction_capnp.TransactionPayload;
var transaction_capnp_5 = transaction_capnp.Transaction;
var transaction_capnp_6 = transaction_capnp.TransactionData;
var transaction_capnp_7 = transaction_capnp.Transactions;
var transaction_capnp_8 = transaction_capnp.TransactionBatch;
var transaction_capnp_9 = transaction_capnp.NewTransactionPayload;
var transaction_capnp_10 = transaction_capnp.NewTransaction;

var transaction = /*#__PURE__*/Object.freeze({
            __proto__: null,
            'default': transaction_capnp$1,
            __moduleExports: transaction_capnp,
            _capnpFileId: transaction_capnp_1,
            Delta: transaction_capnp_2,
            MetaData: transaction_capnp_3,
            TransactionPayload: transaction_capnp_4,
            Transaction: transaction_capnp_5,
            TransactionData: transaction_capnp_6,
            Transactions: transaction_capnp_7,
            TransactionBatch: transaction_capnp_8,
            NewTransactionPayload: transaction_capnp_9,
            NewTransaction: transaction_capnp_10
});

var dist = createCommonjsModule(function (module, exports) {
(function (global, factory) {
     factory(exports) ;
}(commonjsGlobal, (function (exports) {
    class ValidateTypes {
      constructor() {}

      getType(value) {
        return Object.prototype.toString.call(value);
      }

      getClassName(value) {
        try {
          return value.constructor.name;
        } catch (e) {}

        return this.getType(value);
      } //Validation functions


      isObject(value) {
        if (this.getType(value) === "[object Object]") return true;
        return false;
      }

      isFunction(value) {
        if (this.getType(value) === "[object Function]") return true;
        return false;
      }

      isString(value) {
        if (this.getType(value) === "[object String]") return true;
        return false;
      }

      isBoolean(value) {
        if (this.getType(value) === "[object Boolean]") return true;
        return false;
      }

      isArray(value) {
        if (this.getType(value) === "[object Array]") return true;
        return false;
      }

      isNumber(value) {
        if (this.getType(value) === "[object Number]") return true;
        return false;
      }

      isInteger(value) {
        if (this.getType(value) === "[object Number]" && Number.isInteger(value)) return true;
        return false;
      }

      isRegEx(value) {
        if (this.getType(value) === "[object RegExp]") return true;
        return false;
      }

      isStringHex(value) {
        if (!this.isStringWithValue(value)) return false;
        let hexRegEx = /([0-9]|[a-f])/gim;
        return (value.match(hexRegEx) || []).length === value.length;
      }

      hasKeys(value, keys) {
        if (keys.map(key => key in value).includes(false)) return false;
        return true;
      }

      isStringWithValue(value) {
        if (this.isString(value) && value !== '') return true;
        return false;
      }

      isObjectWithKeys(value) {
        if (this.isObject(value) && Object.keys(value).length > 0) return true;
        return false;
      }

      isArrayWithValues(value) {
        if (this.isArray(value) && value.length > 0) return true;
        return false;
      }

      isSpecificClass(value, className) {
        if (!this.isObject(value)) return false;
        if (this.getClassName(value) !== className) return false;
        return true;
      }

    }

    class AssertTypes {
      constructor() {
        this.validate = new ValidateTypes();
      } //Validation functions


      isObject(value) {
        if (!this.validate.isObject(value)) {
          throw new TypeError(`Expected type [object Object] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isFunction(value) {
        if (!this.validate.isFunction(value)) {
          throw new TypeError(`Expected type [object Function] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isString(value) {
        if (!this.validate.isString(value)) {
          throw new TypeError(`Expected type [object String] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isBoolean(value) {
        if (!this.validate.isBoolean(value)) {
          throw new TypeError(`Expected type [object Boolean] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isArray(value) {
        if (!this.validate.isArray(value)) {
          throw new TypeError(`Expected type [object Array] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isNumber(value) {
        if (!this.validate.isNumber(value)) {
          throw new TypeError(`Expected type [object Number] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isInteger(value) {
        if (!this.validate.isInteger(value)) {
          throw new TypeError(`Expected "${value}" to be an integer but got non-integer value`);
        }

        return true;
      }

      isRegEx(value) {
        if (!this.validate.isRegEx(value)) {
          throw new TypeError(`Expected type [object RegExp] but got ${this.validate.getType(value)}`);
        }

        return true;
      }

      isStringHex(value) {
        if (!this.validate.isStringHex(value)) {
          throw new TypeError(`Expected "${value}" to be hex but got non-hex value`);
        }

        return true;
      }

      hasKeys(value, keys) {
        if (!this.validate.hasKeys(value, keys)) {
          throw new TypeError(`Provided object does not contain all keys ${JSON.stringify(keys)}`);
        }

        return true;
      }

      isStringWithValue(value) {
        if (!this.validate.isStringWithValue(value)) {
          throw new TypeError(`Expected "${value}" to be [object String] and not empty`);
        }

        return true;
      }

      isObjectWithKeys(value) {
        if (!this.validate.isObjectWithKeys(value)) {
          throw new TypeError(`Expected "${value}" to be [object Object] and have keys`);
        }

        return true;
      }

      isArrayWithValues(value) {
        if (!this.validate.isArrayWithValues(value)) {
          throw new TypeError(`Expected "${value}" to be [object Array] and not empty`);
        }

        return true;
      }

      isSpecificClass(value, className) {
        if (!this.validate.isSpecificClass(value, className)) {
          throw new TypeError(`Expected Object Class to be "${className}" but got ${this.validate.getClassName(value)}`);
        }

        return true;
      }

    }

    const validateTypes = new ValidateTypes();
    const assertTypes = new AssertTypes();

    exports.assertTypes = assertTypes;
    exports.validateTypes = validateTypes;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
});

var validators = unwrapExports(dist);

function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
function hex2buf(hexString) {
    var bytes = new Uint8Array(Math.ceil(hexString.length / 2));
    for (var i = 0; i < bytes.length; i++)
        bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    return bytes;
}
function concatUint8Arrays(array1, array2) {
    var arr = new Uint8Array(array1.length + array2.length);
    arr.set(array1);
    arr.set(array2, array1.length);
    return arr;
}
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}
function str2hex(str) {
    var hex = '';
    for (var i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16);
    }
    return hex;
}
function randomString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

const nacl = require('tweetnacl');

/**
 * @param Uint8Array(length: 32) seed
 *      seed:   A Uint8Array with a length of 32 to seed the keyPair with. This is advanced behavior and should be
 *              avoided by everyday users
 *
 * @return {Uint8Array(length: 32), Uint8Array(length: 32)} { vk, sk }
 *      sk:     Signing Key (SK) represents 32 byte signing key
 *      vk:     Verify Key (VK) represents a 32 byte verify key
 */
function generate_keys(seed = null) {
    var kp = null;
    if (seed == null) {
        kp = nacl.sign.keyPair();
    }
    else {
        kp = nacl.sign.keyPair.fromSeed(seed);
    }
    // In the JS implementation of the NaCL library the sk is the first 32 bytes of the secretKey
    // and the vk is the last 32 bytes of the secretKey as well as the publicKey
    // {
    //   'publicKey': <vk>,
    //   'secretKey': <sk><vk>
    // }
    return {
        sk: new Uint8Array(kp['secretKey'].slice(0, 32)),
        vk: new Uint8Array(kp['secretKey'].slice(32, 64))
    };
}
/**
 * @param String sk
 *      sk:     A 64 character long hex representation of a signing key (private key)
 *
 * @return String vk
 *      vk:     A 64 character long hex representation of a verify key (public key)
 */
function get_vk(sk) {
    var kp = format_to_keys(sk);
    var kpf = keys_to_format(kp);
    return kpf.vk;
}
/**
 * @param String sk
 *      sk:     A 64 character long hex representation of a signing key (private key)
 *
 * @return {Uint8Array(length: 32), Uint8Array(length: 32)} { vk, sk }
 *      sk:     Signing Key (SK) represents 32 byte signing key
 *      vk:     Verify Key (VK) represents a 32 byte verify key
 */
function format_to_keys(sk) {
    var skf = hex2buf(sk);
    var kp = generate_keys(skf);
    return kp;
}
/**
 * @param Object kp
 *      kp:     Object containing the properties sk and vk
 *          sk:     Signing Key (SK) represents 32 byte signing key
 *          vk:     Verify Key (VK) represents a 32 byte verify key
 *
 * @return {string, string} { sk, vk }
 *      sk:     Signing Key (SK) represented as a 64 character hex string
 *      vk:     Verify Key (VK) represented as a 64 character hex string
 */
function keys_to_format(kp) {
    return {
        vk: buf2hex(kp.vk),
        sk: buf2hex(kp.sk)
    };
}
/**
 * @param Uint8Array(length: 32) seed
 *      seed:   A Uint8Array with a length of 32 to seed the keyPair with. This is advanced behavior and should be
 *              avoided by everyday users
 *
 * @return {string, string} { sk, vk }
 *      sk:     Signing Key (SK) represented as a 64 character hex string
 *      vk:     Verify Key (VK) represented as a 64 character hex string
 */
function new_wallet(seed = null) {
    const keys = generate_keys(seed);
    return keys_to_format(keys);
}
/**
 * @param String sk
 * @param Uint8Array msg
 *      sk:     A 64 character long hex representation of a signing key (private key)
 *      msg:    A Uint8Array of bytes representing the message you would like to sign
 *
 * @return String sig
 *      sig:    A 128 character long hex string representing the message's signature
 */
function sign(sk, msg) {
    var kp = format_to_keys(sk);
    // This is required due to the secretKey required to sign a transaction
    // in the js implementation of NaCL being the combination of the sk and
    // vk for some stupid reason. That being said, we still want the sk and
    // vk objects to exist in 32-byte string format (same as cilantro's
    // python implementation) when presented to the user.
    var jsnacl_sk = concatUint8Arrays(kp.sk, kp.vk);
    return buf2hex(nacl.sign.detached(msg, jsnacl_sk));
}
/**
 * @param String vk
 * @param Uint8Array msg
 * @param String sig
 *      vk:     A 64 character long hex representation of a verify key (public key)
 *      msg:    A Uint8Array (bytes) representation of a message that has been signed
 *      sig:    A 128 character long hex representation of a nacl signature
 *
 * @return Bool result
 *      result: true if verify checked out, false if not
 */
function verify(vk, msg, sig) {
    var vkb = hex2buf(vk);
    var sigb = hex2buf(sig);
    try {
        return nacl.sign.detached.verify(msg, sigb, vkb);
    }
    catch (_a) {
        return false;
    }
}

var wallet = /*#__PURE__*/Object.freeze({
            __proto__: null,
            generate_keys: generate_keys,
            get_vk: get_vk,
            format_to_keys: format_to_keys,
            keys_to_format: keys_to_format,
            new_wallet: new_wallet,
            sign: sign,
            verify: verify
});

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

const { validateTypes } = validators;
const fetch = require('node-fetch');

class LamdenMasterNode_API{
    constructor(networkInfoObj){
        if (!validateTypes.isObjectWithKeys(networkInfoObj)) throw new Error(`Expected Object and got Type: ${typeof networkInfoObj}`)
        if (!validateTypes.isStringWithValue(networkInfoObj.host)) throw new Error(`HOST Required (Type: String)`)
        if (!validateTypes.isStringWithValue(networkInfoObj.port)) throw new Error(`PORT Required (Type: String)`)
        if (!validateTypes.isStringWithValue(networkInfoObj.type)) throw new Error(`Network Type Required (Type: String)`)

        const lamdenNetworkTypes = ['mockchain', 'testnet', 'mainnet'];

        this.host = this.vaidateProtocol(networkInfoObj.host);
        this.port = networkInfoObj.port;
        this.url = `${this.host}:${this.port}`;
        this.networkType = networkInfoObj.type.toLowerCase();
        if (!lamdenNetworkTypes.includes(this.networkType)) {
            throw new Error(`${this.networkType} not in Lamden Network Types: ${JSON.stringify(lamdenNetworkTypes)}`)
        }
        
    }
    //This will throw an error if the protocol wasn't included in the host string
    vaidateProtocol(host){
        let protocols = ['https://', 'http://'];
        if (protocols.map(protocol => host.includes(protocol)).includes(true)) return host
        throw new Error('Host String must include http:// or https://')
    }

    send(method, path, data, callback){
        let parms = '';
        if (Object.keys(data).includes('parms')) {
            parms = this.createParms(data.parms);
        }

        let options = {};
        if (method === 'POST'){
            let headers = {'Content-Type': 'application/json'};
            options.method = method;
            options.headers = headers;
            options.body = data;
        }
        
        return fetch(`${this.url}${path}${parms}`, options)
            .then(res => res.json())
            .then(json => {
                    return callback(json, undefined)
            })
            .catch(err => {
                    console.log(err);
                    return callback(undefined, err.toString())
                })
    }

    createParms(parms){
        let parmString = '?';
        Object.keys(parms).forEach(key => {
            parmString = `${parmString}${key}=${parms[key]}&`;
        });
        return parmString.slice(0, -1);
    }

    async getContractInfo(contractName){
        let path = `/contracts/${contractName}`;
        return this.send('GET', path, {}, (res, err) => {
            if (err) return;
            return res
        })
    }

    async getVariable(contract, variable, parms){
        let path = `/contracts/${contract}/${variable}/`;
        return this.send('GET', path, parms, (res, err) => {
            try{
                if (res.value) return res.value
            } catch (e){}
            return;
        })
    }

    async getContractMethods(contract){
        let path = `/contracts/${contract}/methods`;
        return this.send('GET', path, {}, (res, err) => {
            try{
                if (res.methods) return res.methods
            } catch (e){}
            return [];
        })
        
    }

    async lintCode(name, code){
        let data = JSON.stringify({name, code});
        return this.send('POST', '/lint/', data, (res, err) => {
            if (err) return err;
            return res;
        })
    }

    async pingServer(){
        return this.send('GET', '/ping', {}, (res, err) => {
            try { 
                if (res.status === 'online') return true;
            } 
            catch (e) {
                return false;
            }
        })
    }

    async getTauBalance(vk){
        let parms = {};
        parms.key = vk;
        let balanceRes = await this.getVariable('currency', 'balances', {parms});
        if (isNaN(parseFloat(balanceRes))){
            return 0;
        }
        return parseFloat(balanceRes)
    }

    async contractExists(contractName){
        let path = `/contracts/${contractName}`;
        return this.send('GET', path, {}, (res, err) => {
            try{
                if (res.name) return true;
            } catch (e){}
            return false;
        })
    }

    async mintTestNetCoins(vk, amount){
        if (this.networkType !== 'mockchain') throw Error (`${this.networkType} does not allow minting of coins`)
        if (!validateTypes.isStringWithValue(vk) || !validateTypes.isNumber(amount)) return false;
        let data = JSON.stringify({vk, amount});

        let path = `/mint/`;
        return this.send('POST', path, data, (res, err) => {
            try{
                if (res.success) return true;
            } catch (e){}
            return false;
        })    
    }

    async sendTransaction(data, callback){
        return this.send('POST', '/', data, (res, err) => {
            if (err){
                if (callback) {
                    callback(undefined, err);
                    return;
                } 
                else return err
            }
            if (callback) {
                callback(res, undefined);
                return
            }
            return res;
        })   
    }

    async getNonce(sender, callback){
        if (!validateTypes.isStringHex(sender)) return `${sender} is not a hex string.`
        let path = `/nonce/${sender}`; 
        return this.send('GET', path, {}, (res, err) => {
            if (err){
                if (callback) {
                    callback(undefined, `Unable to get nonce for "${sender}". ${err}`);
                    return
                } 
                return `Unable to get nonce for "${sender}". ${err}`
            }
            if (callback) {
                callback(res, undefined);
                return
            }
            else return res;
        })
    }
}

const { validateTypes: validateTypes$1 } = validators;

class Network extends EventEmitter {
    // Constructor needs an Object with the following information to build Class.
    //
    // networkInfo: {
    //      host: <string> masternode webserver hostname/ip,
    //      port: <string> masternode webserver port,
    //      type: <string> "testnet", "mainnet" or "mockchain"
    //  },
    constructor(networkInfoObj){
        super();
        const lamdenNetworkTypes = ['mockchain', 'testnet', 'mainnet'];
        //Reject undefined or missing info
        if (!validateTypes$1.isObjectWithKeys(networkInfoObj)) throw new Error(`Expected Network Info Object and got Type: ${typeof networkInfoObj}`)
        if (!validateTypes$1.isStringWithValue(networkInfoObj.host)) throw new Error(`HOST Required (Type: String)`)
        if (!validateTypes$1.isStringWithValue(networkInfoObj.port)) throw new Error(`PORT Required (Type: String)`)
        if (!validateTypes$1.isStringWithValue(networkInfoObj.type)) throw new Error(`Network Type Required (Type: String)`)

        this.type = networkInfoObj.type.toLowerCase();

        this.host = this.vaidateProtocol(networkInfoObj.host.toLowerCase());
        this.port = networkInfoObj.port;
        this.url = `${this.host}:${this.port}`;
        this.name = validateTypes$1.isStringWithValue(networkInfoObj.name) ? networkInfoObj.name : undefined;
        this.lamden = validateTypes$1.isBoolean(networkInfoObj.lamden) ? networkInfoObj.lamden : undefined;
    
        this.online = false;
        try{
            this.API = new LamdenMasterNode_API(networkInfoObj);
        } catch (e) {
            throw new Error(e)
        }
        
        if (!lamdenNetworkTypes.includes(this.type)) {
            throw new Error(`${this.type} not in Lamden Network Types: ${JSON.stringify(lamdenNetworkTypes)}`)
        }
        
        this.mainnet = this.type === 'mainnet';
        this.testnet = this.type === 'testnet';
        this.mockchain = this.type === 'mockchain';

    }
    //This will throw an error if the protocol wasn't included in the host string
    vaidateProtocol(host){
        let protocols = ['https://', 'http://'];
        if (protocols.map(protocol => host.includes(protocol)).includes(true)) return host
        throw new Error('Host String must include http:// or https://')
    }
    //Check if the network is online
    //Emits boolean as 'online' event
    //Also returns status as well as passes status to a callback
    async ping(callback = undefined){
        this.online = await this.API.pingServer();
        this.emit('online', this.online, `${this.url} is ${this.online}`);
        if (validateTypes$1.isFunction(callback)) callback(this.online);
        return this.online
    }
    getNetworkInfo(){
        return {
            type: this.type,
            host: this.host,
            port: this.port,
            url: this.url,
            online: this.online,
            mainnet: this.mainnet,
            testnet: this.testnet,
            mockchain: this.mockchain
        }
    }
}

var sha = createCommonjsModule(function (module, exports) {
(function(Y){function C(c,a,b){var e=0,h=[],n=0,g,l,d,f,m,q,u,r,I=!1,v=[],w=[],t,y=!1,z=!1,x=-1;b=b||{};g=b.encoding||"UTF8";t=b.numRounds||1;if(t!==parseInt(t,10)||1>t)throw Error("numRounds must a integer >= 1");if("SHA-1"===c)m=512,q=K,u=Z,f=160,r=function(a){return a.slice()};else if(0===c.lastIndexOf("SHA-",0))if(q=function(a,b){return L(a,b,c)},u=function(a,b,h,e){var k,f;if("SHA-224"===c||"SHA-256"===c)k=(b+65>>>9<<4)+15,f=16;else if("SHA-384"===c||"SHA-512"===c)k=(b+129>>>10<<
5)+31,f=32;else throw Error("Unexpected error in SHA-2 implementation");for(;a.length<=k;)a.push(0);a[b>>>5]|=128<<24-b%32;b=b+h;a[k]=b&4294967295;a[k-1]=b/4294967296|0;h=a.length;for(b=0;b<h;b+=f)e=L(a.slice(b,b+f),e,c);if("SHA-224"===c)a=[e[0],e[1],e[2],e[3],e[4],e[5],e[6]];else if("SHA-256"===c)a=e;else if("SHA-384"===c)a=[e[0].a,e[0].b,e[1].a,e[1].b,e[2].a,e[2].b,e[3].a,e[3].b,e[4].a,e[4].b,e[5].a,e[5].b];else if("SHA-512"===c)a=[e[0].a,e[0].b,e[1].a,e[1].b,e[2].a,e[2].b,e[3].a,e[3].b,e[4].a,
e[4].b,e[5].a,e[5].b,e[6].a,e[6].b,e[7].a,e[7].b];else throw Error("Unexpected error in SHA-2 implementation");return a},r=function(a){return a.slice()},"SHA-224"===c)m=512,f=224;else if("SHA-256"===c)m=512,f=256;else if("SHA-384"===c)m=1024,f=384;else if("SHA-512"===c)m=1024,f=512;else throw Error("Chosen SHA variant is not supported");else if(0===c.lastIndexOf("SHA3-",0)||0===c.lastIndexOf("SHAKE",0)){var F=6;q=D;r=function(a){var c=[],e;for(e=0;5>e;e+=1)c[e]=a[e].slice();return c};x=1;if("SHA3-224"===
c)m=1152,f=224;else if("SHA3-256"===c)m=1088,f=256;else if("SHA3-384"===c)m=832,f=384;else if("SHA3-512"===c)m=576,f=512;else if("SHAKE128"===c)m=1344,f=-1,F=31,z=!0;else if("SHAKE256"===c)m=1088,f=-1,F=31,z=!0;else throw Error("Chosen SHA variant is not supported");u=function(a,c,e,b,h){e=m;var k=F,f,g=[],n=e>>>5,l=0,d=c>>>5;for(f=0;f<d&&c>=e;f+=n)b=D(a.slice(f,f+n),b),c-=e;a=a.slice(f);for(c%=e;a.length<n;)a.push(0);f=c>>>3;a[f>>2]^=k<<f%4*8;a[n-1]^=2147483648;for(b=D(a,b);32*g.length<h;){a=b[l%
5][l/5|0];g.push(a.b);if(32*g.length>=h)break;g.push(a.a);l+=1;0===64*l%e&&D(null,b);}return g};}else throw Error("Chosen SHA variant is not supported");d=M(a,g,x);l=A(c);this.setHMACKey=function(a,b,h){var k;if(!0===I)throw Error("HMAC key already set");if(!0===y)throw Error("Cannot set HMAC key after calling update");if(!0===z)throw Error("SHAKE is not supported for HMAC");g=(h||{}).encoding||"UTF8";b=M(b,g,x)(a);a=b.binLen;b=b.value;k=m>>>3;h=k/4-1;if(k<a/8){for(b=u(b,a,0,A(c),f);b.length<=h;)b.push(0);
b[h]&=4294967040;}else if(k>a/8){for(;b.length<=h;)b.push(0);b[h]&=4294967040;}for(a=0;a<=h;a+=1)v[a]=b[a]^909522486,w[a]=b[a]^1549556828;l=q(v,l);e=m;I=!0;};this.update=function(a){var c,b,k,f=0,g=m>>>5;c=d(a,h,n);a=c.binLen;b=c.value;c=a>>>5;for(k=0;k<c;k+=g)f+m<=a&&(l=q(b.slice(k,k+g),l),f+=m);e+=f;h=b.slice(f>>>5);n=a%m;y=!0;};this.getHash=function(a,b){var k,g,d,m;if(!0===I)throw Error("Cannot call getHash after setting HMAC key");d=N(b);if(!0===z){if(-1===d.shakeLen)throw Error("shakeLen must be specified in options");
f=d.shakeLen;}switch(a){case "HEX":k=function(a){return O(a,f,x,d)};break;case "B64":k=function(a){return P(a,f,x,d)};break;case "BYTES":k=function(a){return Q(a,f,x)};break;case "ARRAYBUFFER":try{g=new ArrayBuffer(0);}catch(p){throw Error("ARRAYBUFFER not supported by this environment");}k=function(a){return R(a,f,x)};break;default:throw Error("format must be HEX, B64, BYTES, or ARRAYBUFFER");}m=u(h.slice(),n,e,r(l),f);for(g=1;g<t;g+=1)!0===z&&0!==f%32&&(m[m.length-1]&=16777215>>>24-f%32),m=u(m,f,
0,A(c),f);return k(m)};this.getHMAC=function(a,b){var k,g,d,p;if(!1===I)throw Error("Cannot call getHMAC without first setting HMAC key");d=N(b);switch(a){case "HEX":k=function(a){return O(a,f,x,d)};break;case "B64":k=function(a){return P(a,f,x,d)};break;case "BYTES":k=function(a){return Q(a,f,x)};break;case "ARRAYBUFFER":try{k=new ArrayBuffer(0);}catch(v){throw Error("ARRAYBUFFER not supported by this environment");}k=function(a){return R(a,f,x)};break;default:throw Error("outputFormat must be HEX, B64, BYTES, or ARRAYBUFFER");
}g=u(h.slice(),n,e,r(l),f);p=q(w,A(c));p=u(g,f,m,p,f);return k(p)};}function b(c,a){this.a=c;this.b=a;}function O(c,a,b,e){var h="";a/=8;var n,g,d;d=-1===b?3:0;for(n=0;n<a;n+=1)g=c[n>>>2]>>>8*(d+n%4*b),h+="0123456789abcdef".charAt(g>>>4&15)+"0123456789abcdef".charAt(g&15);return e.outputUpper?h.toUpperCase():h}function P(c,a,b,e){var h="",n=a/8,g,d,p,f;f=-1===b?3:0;for(g=0;g<n;g+=3)for(d=g+1<n?c[g+1>>>2]:0,p=g+2<n?c[g+2>>>2]:0,p=(c[g>>>2]>>>8*(f+g%4*b)&255)<<16|(d>>>8*(f+(g+1)%4*b)&255)<<8|p>>>8*(f+
(g+2)%4*b)&255,d=0;4>d;d+=1)8*g+6*d<=a?h+="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(p>>>6*(3-d)&63):h+=e.b64Pad;return h}function Q(c,a,b){var e="";a/=8;var h,d,g;g=-1===b?3:0;for(h=0;h<a;h+=1)d=c[h>>>2]>>>8*(g+h%4*b)&255,e+=String.fromCharCode(d);return e}function R(c,a,b){a/=8;var e,h=new ArrayBuffer(a),d,g;g=new Uint8Array(h);d=-1===b?3:0;for(e=0;e<a;e+=1)g[e]=c[e>>>2]>>>8*(d+e%4*b)&255;return h}function N(c){var a={outputUpper:!1,b64Pad:"=",shakeLen:-1};c=c||{};
a.outputUpper=c.outputUpper||!1;!0===c.hasOwnProperty("b64Pad")&&(a.b64Pad=c.b64Pad);if(!0===c.hasOwnProperty("shakeLen")){if(0!==c.shakeLen%8)throw Error("shakeLen must be a multiple of 8");a.shakeLen=c.shakeLen;}if("boolean"!==typeof a.outputUpper)throw Error("Invalid outputUpper formatting option");if("string"!==typeof a.b64Pad)throw Error("Invalid b64Pad formatting option");return a}function M(c,a,b){switch(a){case "UTF8":case "UTF16BE":case "UTF16LE":break;default:throw Error("encoding must be UTF8, UTF16BE, or UTF16LE");
}switch(c){case "HEX":c=function(a,c,d){var g=a.length,l,p,f,m,q,u;if(0!==g%2)throw Error("String of HEX type must be in byte increments");c=c||[0];d=d||0;q=d>>>3;u=-1===b?3:0;for(l=0;l<g;l+=2){p=parseInt(a.substr(l,2),16);if(isNaN(p))throw Error("String of HEX type contains invalid characters");m=(l>>>1)+q;for(f=m>>>2;c.length<=f;)c.push(0);c[f]|=p<<8*(u+m%4*b);}return {value:c,binLen:4*g+d}};break;case "TEXT":c=function(c,h,d){var g,l,p=0,f,m,q,u,r,t;h=h||[0];d=d||0;q=d>>>3;if("UTF8"===a)for(t=-1===
b?3:0,f=0;f<c.length;f+=1)for(g=c.charCodeAt(f),l=[],128>g?l.push(g):2048>g?(l.push(192|g>>>6),l.push(128|g&63)):55296>g||57344<=g?l.push(224|g>>>12,128|g>>>6&63,128|g&63):(f+=1,g=65536+((g&1023)<<10|c.charCodeAt(f)&1023),l.push(240|g>>>18,128|g>>>12&63,128|g>>>6&63,128|g&63)),m=0;m<l.length;m+=1){r=p+q;for(u=r>>>2;h.length<=u;)h.push(0);h[u]|=l[m]<<8*(t+r%4*b);p+=1;}else if("UTF16BE"===a||"UTF16LE"===a)for(t=-1===b?2:0,l="UTF16LE"===a&&1!==b||"UTF16LE"!==a&&1===b,f=0;f<c.length;f+=1){g=c.charCodeAt(f);
!0===l&&(m=g&255,g=m<<8|g>>>8);r=p+q;for(u=r>>>2;h.length<=u;)h.push(0);h[u]|=g<<8*(t+r%4*b);p+=2;}return {value:h,binLen:8*p+d}};break;case "B64":c=function(a,c,d){var g=0,l,p,f,m,q,u,r,t;if(-1===a.search(/^[a-zA-Z0-9=+\/]+$/))throw Error("Invalid character in base-64 string");p=a.indexOf("=");a=a.replace(/\=/g,"");if(-1!==p&&p<a.length)throw Error("Invalid '=' found in base-64 string");c=c||[0];d=d||0;u=d>>>3;t=-1===b?3:0;for(p=0;p<a.length;p+=4){q=a.substr(p,4);for(f=m=0;f<q.length;f+=1)l="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(q[f]),
m|=l<<18-6*f;for(f=0;f<q.length-1;f+=1){r=g+u;for(l=r>>>2;c.length<=l;)c.push(0);c[l]|=(m>>>16-8*f&255)<<8*(t+r%4*b);g+=1;}}return {value:c,binLen:8*g+d}};break;case "BYTES":c=function(a,c,d){var g,l,p,f,m,q;c=c||[0];d=d||0;p=d>>>3;q=-1===b?3:0;for(l=0;l<a.length;l+=1)g=a.charCodeAt(l),m=l+p,f=m>>>2,c.length<=f&&c.push(0),c[f]|=g<<8*(q+m%4*b);return {value:c,binLen:8*a.length+d}};break;case "ARRAYBUFFER":try{c=new ArrayBuffer(0);}catch(e){throw Error("ARRAYBUFFER not supported by this environment");}c=
function(a,c,d){var g,l,p,f,m,q;c=c||[0];d=d||0;l=d>>>3;m=-1===b?3:0;q=new Uint8Array(a);for(g=0;g<a.byteLength;g+=1)f=g+l,p=f>>>2,c.length<=p&&c.push(0),c[p]|=q[g]<<8*(m+f%4*b);return {value:c,binLen:8*a.byteLength+d}};break;default:throw Error("format must be HEX, TEXT, B64, BYTES, or ARRAYBUFFER");}return c}function y(c,a){return c<<a|c>>>32-a}function S(c,a){return 32<a?(a-=32,new b(c.b<<a|c.a>>>32-a,c.a<<a|c.b>>>32-a)):0!==a?new b(c.a<<a|c.b>>>32-a,c.b<<a|c.a>>>32-a):c}function w(c,a){return c>>>
a|c<<32-a}function t(c,a){var k=null,k=new b(c.a,c.b);return k=32>=a?new b(k.a>>>a|k.b<<32-a&4294967295,k.b>>>a|k.a<<32-a&4294967295):new b(k.b>>>a-32|k.a<<64-a&4294967295,k.a>>>a-32|k.b<<64-a&4294967295)}function T(c,a){var k=null;return k=32>=a?new b(c.a>>>a,c.b>>>a|c.a<<32-a&4294967295):new b(0,c.a>>>a-32)}function aa(c,a,b){return c&a^~c&b}function ba(c,a,k){return new b(c.a&a.a^~c.a&k.a,c.b&a.b^~c.b&k.b)}function U(c,a,b){return c&a^c&b^a&b}function ca(c,a,k){return new b(c.a&a.a^c.a&k.a^a.a&
k.a,c.b&a.b^c.b&k.b^a.b&k.b)}function da(c){return w(c,2)^w(c,13)^w(c,22)}function ea(c){var a=t(c,28),k=t(c,34);c=t(c,39);return new b(a.a^k.a^c.a,a.b^k.b^c.b)}function fa(c){return w(c,6)^w(c,11)^w(c,25)}function ga(c){var a=t(c,14),k=t(c,18);c=t(c,41);return new b(a.a^k.a^c.a,a.b^k.b^c.b)}function ha(c){return w(c,7)^w(c,18)^c>>>3}function ia(c){var a=t(c,1),k=t(c,8);c=T(c,7);return new b(a.a^k.a^c.a,a.b^k.b^c.b)}function ja(c){return w(c,17)^w(c,19)^c>>>10}function ka(c){var a=t(c,19),k=t(c,61);
c=T(c,6);return new b(a.a^k.a^c.a,a.b^k.b^c.b)}function G(c,a){var b=(c&65535)+(a&65535);return ((c>>>16)+(a>>>16)+(b>>>16)&65535)<<16|b&65535}function la(c,a,b,e){var h=(c&65535)+(a&65535)+(b&65535)+(e&65535);return ((c>>>16)+(a>>>16)+(b>>>16)+(e>>>16)+(h>>>16)&65535)<<16|h&65535}function H(c,a,b,e,h){var d=(c&65535)+(a&65535)+(b&65535)+(e&65535)+(h&65535);return ((c>>>16)+(a>>>16)+(b>>>16)+(e>>>16)+(h>>>16)+(d>>>16)&65535)<<16|d&65535}function ma(c,a){var d,e,h;d=(c.b&65535)+(a.b&65535);e=(c.b>>>16)+
(a.b>>>16)+(d>>>16);h=(e&65535)<<16|d&65535;d=(c.a&65535)+(a.a&65535)+(e>>>16);e=(c.a>>>16)+(a.a>>>16)+(d>>>16);return new b((e&65535)<<16|d&65535,h)}function na(c,a,d,e){var h,n,g;h=(c.b&65535)+(a.b&65535)+(d.b&65535)+(e.b&65535);n=(c.b>>>16)+(a.b>>>16)+(d.b>>>16)+(e.b>>>16)+(h>>>16);g=(n&65535)<<16|h&65535;h=(c.a&65535)+(a.a&65535)+(d.a&65535)+(e.a&65535)+(n>>>16);n=(c.a>>>16)+(a.a>>>16)+(d.a>>>16)+(e.a>>>16)+(h>>>16);return new b((n&65535)<<16|h&65535,g)}function oa(c,a,d,e,h){var n,g,l;n=(c.b&
65535)+(a.b&65535)+(d.b&65535)+(e.b&65535)+(h.b&65535);g=(c.b>>>16)+(a.b>>>16)+(d.b>>>16)+(e.b>>>16)+(h.b>>>16)+(n>>>16);l=(g&65535)<<16|n&65535;n=(c.a&65535)+(a.a&65535)+(d.a&65535)+(e.a&65535)+(h.a&65535)+(g>>>16);g=(c.a>>>16)+(a.a>>>16)+(d.a>>>16)+(e.a>>>16)+(h.a>>>16)+(n>>>16);return new b((g&65535)<<16|n&65535,l)}function B(c,a){return new b(c.a^a.a,c.b^a.b)}function A(c){var a=[],d;if("SHA-1"===c)a=[1732584193,4023233417,2562383102,271733878,3285377520];else if(0===c.lastIndexOf("SHA-",0))switch(a=
[3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428],d=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],c){case "SHA-224":break;case "SHA-256":a=d;break;case "SHA-384":a=[new b(3418070365,a[0]),new b(1654270250,a[1]),new b(2438529370,a[2]),new b(355462360,a[3]),new b(1731405415,a[4]),new b(41048885895,a[5]),new b(3675008525,a[6]),new b(1203062813,a[7])];break;case "SHA-512":a=[new b(d[0],4089235720),new b(d[1],2227873595),
new b(d[2],4271175723),new b(d[3],1595750129),new b(d[4],2917565137),new b(d[5],725511199),new b(d[6],4215389547),new b(d[7],327033209)];break;default:throw Error("Unknown SHA variant");}else if(0===c.lastIndexOf("SHA3-",0)||0===c.lastIndexOf("SHAKE",0))for(c=0;5>c;c+=1)a[c]=[new b(0,0),new b(0,0),new b(0,0),new b(0,0),new b(0,0)];else throw Error("No SHA variants supported");return a}function K(c,a){var b=[],e,d,n,g,l,p,f;e=a[0];d=a[1];n=a[2];g=a[3];l=a[4];for(f=0;80>f;f+=1)b[f]=16>f?c[f]:y(b[f-
3]^b[f-8]^b[f-14]^b[f-16],1),p=20>f?H(y(e,5),d&n^~d&g,l,1518500249,b[f]):40>f?H(y(e,5),d^n^g,l,1859775393,b[f]):60>f?H(y(e,5),U(d,n,g),l,2400959708,b[f]):H(y(e,5),d^n^g,l,3395469782,b[f]),l=g,g=n,n=y(d,30),d=e,e=p;a[0]=G(e,a[0]);a[1]=G(d,a[1]);a[2]=G(n,a[2]);a[3]=G(g,a[3]);a[4]=G(l,a[4]);return a}function Z(c,a,b,e){var d;for(d=(a+65>>>9<<4)+15;c.length<=d;)c.push(0);c[a>>>5]|=128<<24-a%32;a+=b;c[d]=a&4294967295;c[d-1]=a/4294967296|0;a=c.length;for(d=0;d<a;d+=16)e=K(c.slice(d,d+16),e);return e}function L(c,
a,k){var e,h,n,g,l,p,f,m,q,u,r,t,v,w,y,A,z,x,F,B,C,D,E=[],J;if("SHA-224"===k||"SHA-256"===k)u=64,t=1,D=Number,v=G,w=la,y=H,A=ha,z=ja,x=da,F=fa,C=U,B=aa,J=d;else if("SHA-384"===k||"SHA-512"===k)u=80,t=2,D=b,v=ma,w=na,y=oa,A=ia,z=ka,x=ea,F=ga,C=ca,B=ba,J=V;else throw Error("Unexpected error in SHA-2 implementation");k=a[0];e=a[1];h=a[2];n=a[3];g=a[4];l=a[5];p=a[6];f=a[7];for(r=0;r<u;r+=1)16>r?(q=r*t,m=c.length<=q?0:c[q],q=c.length<=q+1?0:c[q+1],E[r]=new D(m,q)):E[r]=w(z(E[r-2]),E[r-7],A(E[r-15]),E[r-
16]),m=y(f,F(g),B(g,l,p),J[r],E[r]),q=v(x(k),C(k,e,h)),f=p,p=l,l=g,g=v(n,m),n=h,h=e,e=k,k=v(m,q);a[0]=v(k,a[0]);a[1]=v(e,a[1]);a[2]=v(h,a[2]);a[3]=v(n,a[3]);a[4]=v(g,a[4]);a[5]=v(l,a[5]);a[6]=v(p,a[6]);a[7]=v(f,a[7]);return a}function D(c,a){var d,e,h,n,g=[],l=[];if(null!==c)for(e=0;e<c.length;e+=2)a[(e>>>1)%5][(e>>>1)/5|0]=B(a[(e>>>1)%5][(e>>>1)/5|0],new b(c[e+1],c[e]));for(d=0;24>d;d+=1){n=A("SHA3-");for(e=0;5>e;e+=1){h=a[e][0];var p=a[e][1],f=a[e][2],m=a[e][3],q=a[e][4];g[e]=new b(h.a^p.a^f.a^
m.a^q.a,h.b^p.b^f.b^m.b^q.b);}for(e=0;5>e;e+=1)l[e]=B(g[(e+4)%5],S(g[(e+1)%5],1));for(e=0;5>e;e+=1)for(h=0;5>h;h+=1)a[e][h]=B(a[e][h],l[e]);for(e=0;5>e;e+=1)for(h=0;5>h;h+=1)n[h][(2*e+3*h)%5]=S(a[e][h],W[e][h]);for(e=0;5>e;e+=1)for(h=0;5>h;h+=1)a[e][h]=B(n[e][h],new b(~n[(e+1)%5][h].a&n[(e+2)%5][h].a,~n[(e+1)%5][h].b&n[(e+2)%5][h].b));a[0][0]=B(a[0][0],X[d]);}return a}var d,V,W,X;d=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,
1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,
2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];V=[new b(d[0],3609767458),new b(d[1],602891725),new b(d[2],3964484399),new b(d[3],2173295548),new b(d[4],4081628472),new b(d[5],3053834265),new b(d[6],2937671579),new b(d[7],3664609560),new b(d[8],2734883394),new b(d[9],1164996542),new b(d[10],1323610764),new b(d[11],3590304994),new b(d[12],4068182383),new b(d[13],991336113),new b(d[14],633803317),new b(d[15],3479774868),new b(d[16],2666613458),new b(d[17],944711139),new b(d[18],2341262773),
new b(d[19],2007800933),new b(d[20],1495990901),new b(d[21],1856431235),new b(d[22],3175218132),new b(d[23],2198950837),new b(d[24],3999719339),new b(d[25],766784016),new b(d[26],2566594879),new b(d[27],3203337956),new b(d[28],1034457026),new b(d[29],2466948901),new b(d[30],3758326383),new b(d[31],168717936),new b(d[32],1188179964),new b(d[33],1546045734),new b(d[34],1522805485),new b(d[35],2643833823),new b(d[36],2343527390),new b(d[37],1014477480),new b(d[38],1206759142),new b(d[39],344077627),
new b(d[40],1290863460),new b(d[41],3158454273),new b(d[42],3505952657),new b(d[43],106217008),new b(d[44],3606008344),new b(d[45],1432725776),new b(d[46],1467031594),new b(d[47],851169720),new b(d[48],3100823752),new b(d[49],1363258195),new b(d[50],3750685593),new b(d[51],3785050280),new b(d[52],3318307427),new b(d[53],3812723403),new b(d[54],2003034995),new b(d[55],3602036899),new b(d[56],1575990012),new b(d[57],1125592928),new b(d[58],2716904306),new b(d[59],442776044),new b(d[60],593698344),new b(d[61],
3733110249),new b(d[62],2999351573),new b(d[63],3815920427),new b(3391569614,3928383900),new b(3515267271,566280711),new b(3940187606,3454069534),new b(4118630271,4000239992),new b(116418474,1914138554),new b(174292421,2731055270),new b(289380356,3203993006),new b(460393269,320620315),new b(685471733,587496836),new b(852142971,1086792851),new b(1017036298,365543100),new b(1126000580,2618297676),new b(1288033470,3409855158),new b(1501505948,4234509866),new b(1607167915,987167468),new b(1816402316,
1246189591)];X=[new b(0,1),new b(0,32898),new b(2147483648,32906),new b(2147483648,2147516416),new b(0,32907),new b(0,2147483649),new b(2147483648,2147516545),new b(2147483648,32777),new b(0,138),new b(0,136),new b(0,2147516425),new b(0,2147483658),new b(0,2147516555),new b(2147483648,139),new b(2147483648,32905),new b(2147483648,32771),new b(2147483648,32770),new b(2147483648,128),new b(0,32778),new b(2147483648,2147483658),new b(2147483648,2147516545),new b(2147483648,32896),new b(0,2147483649),
new b(2147483648,2147516424)];W=[[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];(module.exports&&(module.exports=C),exports=C);})();
});

/**
 * @param String o
 * @param String a
 *      o:      The object that is being used to generate POW in string form
 *      a:      The random seed to generate on for POW
 *
 * @return String hex
 *      hex:    The hex representation of the sha object for POW validation
 */
function _generate(o, a) {
    const shaObj = new sha('SHA3-256', "TEXT");
    shaObj.update(o + a);
    return shaObj.getHash("HEX");
}
/**
 * @param Uint8Array o
 * @param Number complexity
 *      o:          The bytes of the object to use to generate POW
 *      complexity: The number of leading zeros required in the POW
 *
 * @return Object(string, number) { pow, cts }
 *      pow:    The seed used to generate the POW
 *      cts:    calculation time in seconds (CTS) amount of time it took to
 *              generate the POW
 */
function find(o, complexity = 3) {
    const start = new Date();
    const strO = ab2str(o);
    const leadZeros = Array(complexity + 1).join('0');
    var a = randomString(16);
    while (_generate(strO, a).substring(0, complexity) != leadZeros) {
        a = randomString(16);
    }
    const end = new Date();
    return {
        pow: str2hex(a),
        cts: (end.valueOf() - start.valueOf()) / 1000
    };
}

const { NewTransactionPayload, NewTransaction } = transaction;
const { validateTypes: validateTypes$2 } = validators;

class TransactionBuilder extends Network {
    // Constructor needs an Object with the following information to build Class.
    //  
    // arg[0] (networkInfo): {
    //      host: <string> masternode webserver hostname/ip,
    //      port: <string> masternode webserver port,
    //      type: <string> "testnet", "mainnet" or "mockchain"
    //  }
    //  arg[1] (txInfo): {
    //      uid: [Optional] <string> unique ID for tracking purposes, 
    //      senderVk: <hex string> public key of the transaction sender,
    //      contractName: <string> name of lamden smart contract,
    //      methodName: <string> name of method to call in contractName,
    //      kwargs: <object> key/values of args to pass to methodName
    //              example: kwargs.to = "270add00fc708791c97aeb5255107c770434bd2ab71c2e103fbee75e202aa15e"
    //                       kwargs.amount = 1000
    //      stampLimit: <integer> the max amount of stamps the tx should use.  tx could use less. if tx needs more the tx will fail.
    //      nonce: [Optional] <integer> send() will attempt to retrieve this info automatically
    //      processor [Optional] <string> send() will attempt to retrieve this info automatically
    //  }
    //  arg[2] (txData): [Optional] state hydrating data
    constructor(networkInfo, txInfo, txData) {
        super(networkInfo);

        //Validate arguments
        if(!validateTypes$2.isObjectWithKeys(txInfo)) throw new Error(`txInfo object not found`)
        if(!validateTypes$2.isStringHex(txInfo.senderVk)) throw new Error(`Sender Public Key Required (Type: Hex String)`)
        if(!validateTypes$2.isStringWithValue(txInfo.contractName)) throw new Error(`Contract Name Required (Type: String)`)
        if(!validateTypes$2.isStringWithValue(txInfo.methodName)) throw new Error(`Method Required (Type: String)`)
        if(!validateTypes$2.isInteger(txInfo.stampLimit)) throw new Error(`Stamps Limit Required (Type: Integer)`)        

        //Store variables in self for reference
        this.uid = validateTypes$2.isStringWithValue(txInfo.uid) ? txInfo.uid : undefined;
        this.sender = txInfo.senderVk;
        this.contract = txInfo.contractName;
        this.method = txInfo.methodName;
        this.kwargs = {};
        if(validateTypes$2.isObject(txInfo.kwargs)) this.kwargs = txInfo.kwargs;
        this.stampLimit = txInfo.stampLimit;

        //validate and set nonce and processor if user provided them
        if (typeof txInfo.nonce !== 'undefined'){
            if(!validateTypes$2.isInteger(txInfo.nonce)) throw new Error(`arg[6] Nonce is required to be an Integer, type ${typeof txInfo.none} was given`)
            this.nonce = txInfo.nonce;
        }
        if (typeof txInfo.processor !== 'undefined'){
            if(!validateTypes$2.isStringWithValue(txInfo.processor)) throw new Error(`arg[7] Processor is required to be a String, type ${typeof txInfo.processor} was given`)
            this.processor = txInfo.processor;
        }
        
        this.proofGenerated = false;
        this.signature;
        this.transactionSigned = false;

        //Transaction result information
        this.nonceResult = {};
        this.txSendResult = {errors:[]};
        this.txBlockResult = {};
        this.txHash;

        
        //Hydrate other items if passed
        if (txData){
            if (validateTypes$2.isObjectWithKeys(txData.txSendResult)) this.txSendResult = txData.txSendResult;
            if (validateTypes$2.isObjectWithKeys(txData.nonceResult)){
                this.nonceResult = txData.nonceResult;
                if (validateTypes$2.isInteger(this.nonceResult.nonce)) this.nonce = this.nonceResult.nonce;
                if (validateTypes$2.isStringWithValue(this.nonceResult.processor)) this.processor = this.nonceResult.processor;
            }
            if (validateTypes$2.isObjectWithKeys(txData.txSendResult)) this.txSendResult = txData.txSendResult;
            if (validateTypes$2.isObjectWithKeys(txData.txBlockResult)) this.txBlockResult = txData.txBlockResult;
            if (validateTypes$2.isObjectWithKeys(txData.resultInfo)) this.resultInfo = txData.resultInfo;
        }
        //Create Capnp messages and transactionMessages
        this.initializePayload();
    }
    initializePayload(){
        this.payloadMessage = new lib_2();
        this.payload = this.payloadMessage.initRoot(NewTransactionPayload);
        this.transactionMessage = new lib_2();
        this.transaction = this.transactionMessage.initRoot(NewTransaction);
        this.transactionMetadata = this.transaction.initMetadata();
        this.transaction.initPayload();
    }
    numberToUnit64(number) {
        if (number == null)
            return;
        return lib_44.fromNumber(number);
    }
    hexStringToByte(string = '') {
        let a = [];
        for (let i = 0, len = string.length; i < len; i += 2) {
            a.push(parseInt(string.substr(i, 2), 16));
        }
        return new Uint8Array(a);
    }
    setSender() {
        let senderBuffer = this.hexStringToByte(this.sender);
        let senderPayload = this.payload.initSender(senderBuffer.byteLength);
        senderPayload.copyBuffer(senderBuffer);
    }
    setContract() {
        this.payload.setContractName(this.contract);
    }
    setFunctionName() {
        this.payload.setFunctionName(this.method);
    }
    setKwargsInPayload() {
        let kwargBuffer = Buffer.from(JSON.stringify(this.kwargs));
        let kwargPayload = this.payload.initKwargs(kwargBuffer.byteLength);
        kwargPayload.copyBuffer(kwargBuffer);
    }
    setStamps() {
        this.payload.setStampsSupplied(this.numberToUnit64(this.stampLimit));
    }
    setNonce() {
        this.payload.setNonce(this.numberToUnit64(this.nonce));
    }
    setProcessor() {
        let processorBuffer = this.hexStringToByte(this.processor);
        let processorPayload = this.payload.initProcessor(processorBuffer.byteLength);
        processorPayload.copyBuffer(processorBuffer);
    }
    makePayload(){
        //Add values to the capnp structures
        this.setSender();
        this.setProcessor();
        this.setNonce();
        this.setContract();
        this.setFunctionName();
        this.setStamps();
        this.setKwargsInPayload();
    }
    setPayloadBytes() {
        if (this.nonce == null)
            throw new Error('No Nonce Set. Call getNonce()');
        if (this.processor == null)
            throw new Error('No Processor Set. Call getNonce()');
        //Set the Transaction Paylaod to Uint8Array so it can be signed.
        this.makePayload();
        this.payloadBytes = new Uint8Array(this.payloadMessage.toPackedArrayBuffer());
    }
    sign(sk) {
        if (this.payloadBytes == null) this.setPayloadBytes();
        // Get signature
        this.signature = sign(sk, this.payloadBytes);
        this.transactionSigned = true;
    }
    verifySignature(){
        //Verify the signature is correct
        if (!this.transactionSigned) throw new Error('Transaction has not be been signed. Use the sign(<private key>) method first.')
        return verify(this.sender, this.payloadBytes, this.signature)
    }
    setSignature() {
        // Set the signature in the transcation metadata
        if (!this.transactionSigned) throw new Error(`No signature present. Use the sign(<private key>) method then try again.`)
        const signatureBuffer = this.hexStringToByte(this.signature);
        const messageSignature = this.transactionMetadata.initSignature(signatureBuffer.byteLength);
        messageSignature.copyBuffer(signatureBuffer);
    }
    generate_proof() {
        // Generate a proof of work from the payloadBytes
        if (this.payloadBytes == null)
            this.setPayloadBytes();
        this.proof = find(this.payloadBytes).pow;
        this.proofGenerated = true;
    }
    setProof() {
        // Store the proof of work in the transaction metadata
        if (!this.proofGenerated)
            this.generate_proof();
        const proofBuffer = this.hexStringToByte(this.proof);
        const messageProof = this.transactionMetadata.initProof(proofBuffer.byteLength);
        messageProof.copyBuffer(proofBuffer);
    }
    setTimeStamp() {
        // Store timstamp in the transaction metadata
        this.transactionMetadata.setTimestamp(+new Date/1000);
    }
    setTransactionPayload() {
        // Store Transaction Payload in the transaction
        this.transaction.setPayload(this.payload);
    }
    setTransactionMetadata() {
        // Store Transaction Payload in the transaction
        this.transaction.setMetadata(this.transactionMetadata);
    }
    setTransactionBytes() {
        //Convert message to bytes
        this.transactonBytes = this.transactionMessage.toPackedArrayBuffer();
    }
    serialize() {
        if (this.verifySignature()){
            this.setTransactionPayload();
            this.setSignature();
            this.setProof();
            this.setTimeStamp();
            this.setTransactionBytes();
            return this.transactonBytes;
        }
        throw new Error('Invalid signature')
    }
    async getNonce(callback = undefined) {
        let timestamp =  new Date().toUTCString();
        this.nonceResult = await this.API.getNonce(this.sender);
        if (typeof this.nonceResult.nonce === 'undefined'){
            throw new Error(`Unable to get nonce for ${this.sender} on network ${this.url}`)
        }
        this.nonceResult.timestamp = timestamp;
        this.nonce = this.nonceResult.nonce;
        this.processor = this.nonceResult.processor;

        if (!callback) return this.nonceResult;
        return callback(this.nonceResult)
    }
    async send(sk = undefined, callback = undefined) {
        //Error if transaction is not signed and no sk provided to the send method to sign it before sending
        if (!validateTypes$2.isStringWithValue(sk) && !this.transactionSigned){
            throw new Error(`Transation Not Signed: Private key needed or call sign(<private key>) first`);
        }
        let timestamp =  new Date().toUTCString();
        try{
            //If the nonce isn't set attempt to get it
            if (isNaN(this.nonce) || !validateTypes$2.isStringWithValue(this.processor)) await this.getNonce();
            //if the sk is provided then sign the transaction
            if (validateTypes$2.isStringWithValue(sk)) this.sign(sk);
            //Serialize transaction
            this.serialize();
            //Send transaction to the masternode
            let response = await this.API.sendTransaction(this.transactonBytes);
            
            if (validateTypes$2.isStringWithValue(response)) this.txSendResult = {errors: [response]};
            else {
                if (typeof response.error !== 'undefined'){
                    if (validateTypes$2.isArrayWithValues(response.error)) this.txSendResult.errors = response.error;
                    if (validateTypes$2.isStringWithValue(response.error)) this.txSendResult.errors = [response.error];
                } 
                else this.txSendResult = {...this.txSendResult, ...response};
            }
        } catch(e) {
            this.txSendResult = {errors: [e.message]};
        }

        //Set error if txSendResult doesn't exist
        if (this.txSendResult === 'undefined'){
            this.txSendResult = {errors: ['TypeError: Failed to fetch']};
        }
        
        //Set timestamp of result
        this.txSendResult.timestamp = timestamp;
        
        //If errors were set then return 
        if (validateTypes$2.isArrayWithValues(this.txSendResult.errors)){
            this.setBlockResultInfo();
            if (validateTypes$2.isFunction(callback)) callback(undefined, this.txSendResult);
        } else {
            //If hash exists in the result then this is a pending tx and not a blockresult
            if (validateTypes$2.isStringWithValue(this.txSendResult.hash)){
                this.txHash = this.txSendResult.hash;
                this.setPendingBlockInfo();
            }else{
                if (this.txSendResult.stamps_used){
                    this.blockResult = this.txSendResult;
                    this.setBlockResultInfo();
                }
            }
            if (validateTypes$2.isFunction(callback)) callback(this.txSendResult);
        }
        this.emit('response', this.txSendResult, validateTypes$2.isObjectWithKeys(this.resultInfo) ? this.resultInfo.subtitle : 'Response');
        return this.txSendResult; 
    }
    // To possibly be removed or moved to lint masternode_api lint method
    /*
    parseSendErrors(){
        if (validateTypes.isStringWithValue(this.txSendResult.error)) this.txSendResult.errors.push(this.txSendResult.error)
        if (validateTypes.isInteger(this.txSendResult.status_code)){
            if (this.txSendResult.status_code > 0 && typeof this.txSendResult.result !== 'undefined') {
                if (validateTypes.hasKeys(this.txSendResult.result, ['args'])){
                    this.txSendResult.errors.push("Error: One of your method arguments threw an error")
                    this.txSendResult.errors = [...this.txSendResult.result.args, ...this.txSendResult.errors]                     
                } 
                if (validateTypes.hasKeys(this.txSendResult.result, ['error'])){
                    if (validateTypes.hasKeys(this.txSendResult.result.error, ['error'])){
                        this.txSendResult.errors.push(this.txSendResult.result.error.error)
                    }else{
                        this.txSendResult.errors.push(this.txSendResult.result.error)
                    }
                }
            }
        }
    }*/
    setPendingBlockInfo(){
        this.resultInfo =  {
            title: 'Transaction Pending',
            subtitle: 'Your transaction was submitted and is is being processed',
            message: `Tx Hash: ${this.txSendResult.hash}`,
            type: 'success',
        };
        return this.resultInfo;
    }
    setBlockResultInfo(){
        let erroredTx = false;
        let message = '';
        if(validateTypes$2.isArrayWithValues(this.txSendResult.errors)){
            erroredTx = true;
            message = `This transaction returned ${this.txSendResult.errors.length} errors.`;
        }

        this.resultInfo = {
            title: `Transaction ${erroredTx ? 'Failed' : 'Successful'}`,
            subtitle: `Your transaction ${erroredTx ? 'returned an error and ' : ''}used ${this.txSendResult.stamps_used} stamps`,
            message,
            type: `${erroredTx ? 'error' : 'success'}`,
            errorInfo: erroredTx ? this.txSendResult.errors : undefined
        };
        return this.resultInfo;
    }
    getResultInfo(){
        return this.resultInfo;
    }
    getTxInfo(){
        return {
            senderVk: this.sender,
            contractName: this.contract,
            methodName: this.method,
            kwargs: this.kwargs,
            stampLimit: this.stampLimit
        }
    }
    getAllInfo(){
        return {
            uid: this.uid,
            txHash: this.txHash,
            signed: this.transactionSigned,
            signature: this.signature,
            networkInfo: this.getNetworkInfo(),
            txInfo: this.getTxInfo(),
            txSendResult: this.txSendResult,
            txBlockResult: this.txBlockResult,
            resultInfo: this.getResultInfo(),
            nonceResult: this.nonceResult
        }
    }
}

var index = {
    TransactionBuilder,
    Masternode_API: LamdenMasterNode_API,
    Network,
    wallet
};

module.exports = index;
