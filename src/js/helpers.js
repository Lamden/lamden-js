const nodeCryptoJs = require("node-cryptojs-aes")
const { CryptoJS, JsonFormatter } = nodeCryptoJs;
const validators = require('types-validate-assert')
const { validateTypes, assertTypes } = validators;

/**
    * Encrypt a Javascript object with a string password
    * The object passed must pass JSON.stringify or the method will fail.
    * 
    * @param {string} password  A password to encrypt the object with
    * @param {Object} obj A javascript object (must be JSON compatible)
    * @return {string} Encrypted string
 */
export function encryptObject ( password, obj ){
    assertTypes.isStringWithValue(password)
    assertTypes.isObject(obj)

    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(obj), password, { format: JsonFormatter }).toString();
    return encrypted;
};

/**
    *  Decrypt an Object using a password string 
    * 
    *  @param {string} password  A password to encrypt the object with
    *  @param {string} objString A javascript object as JSON string
    *  @return {string} Encrypted string
*/
export function decryptObject ( password, objString ) {
    assertTypes.isStringWithValue(password)
    assertTypes.isStringWithValue(objString)

    try{
        const decrypt = CryptoJS.AES.decrypt(objString, password, { format: JsonFormatter })
        return JSON.parse(CryptoJS.enc.Utf8.stringify(decrypt));
    } catch (e){
        return false;
    }
};

/**
    * Encrypt a string using a password string 
    *
    * @param {string} password  A password to encrypt the object with
    * @param {string} string A string to be password encrypted
    * @return {string} Encrypted string
*/
export function encryptStrHash( password, string ){
    assertTypes.isStringWithValue(password)
    assertTypes.isString(string)

    const encrypt = CryptoJS.AES.encrypt(string, password).toString();
    return encrypt;
};

/**
    * Decrypt a string using a password string
    *
    * @param {string} password  A password to encrypt the object with
    * @param {string} encryptedString A string to decrypt
    * @return {string} Decrypted string
*/
export function decryptStrHash ( password, encryptedString ){
    assertTypes.isStringWithValue(password)
    assertTypes.isStringWithValue(encryptedString)
    
    try{
        const decrypted = CryptoJS.AES.decrypt(encryptedString, password);
        return CryptoJS.enc.Utf8.stringify(decrypted) === '' ? false : CryptoJS.enc.Utf8.stringify(decrypted);
    } catch (e) {
        return false;
    }
};

export function buf2hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}
export function hex2buf(hexString) {
    var bytes = new Uint8Array(Math.ceil(hexString.length / 2));
    for (var i = 0; i < bytes.length; i++)
        bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    return bytes;
}
export function str2buf(string) {
    var buf = new Buffer.from(string);
    return new Uint8Array(buf);
}
export function concatUint8Arrays(array1, array2) {
    var arr = new Uint8Array(array1.length + array2.length);
    arr.set(array1);
    arr.set(array2, array1.length);
    return arr;
}
export function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}
export function str2ab(str) {
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}
export function str2hex(str) {
    var hex = '';
    for (var i = 0; i < str.length; i++) {
        hex += '' + str.charCodeAt(i).toString(16);
    }
    return hex;
}
export function hex2str(hexx) {
    var hex = hexx.toString(); //force conversion
    var str = '';
    for (var i = 0; (i < hex.length && hex.substr(i, 2) !== '00'); i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}
export function randomString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
export function isStringHex(string = '') {
    let hexRegEx = /([0-9]|[a-f])/gim;
    return typeof string === 'string' &&
        (string.match(hexRegEx) || []).length === string.length;
}

export function isLamdenKey( string ){
    if (validateTypes.isStringHex(string) && string.length === 64) return true;
    return false;
};