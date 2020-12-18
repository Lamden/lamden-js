const BigNumber = require('bignumber.js');
BigNumber.config({ RANGE: [-30, 30], EXPONENTIAL_AT: 1e+9 })
BigNumber.set({ DECIMAL_PLACES: 30, ROUNDING_MODE: BigNumber.ROUND_DOWN })    // equivalent

function Encoder (type, value) {
    const throwError = (val) => {
        throw new Error(`Error encoding ${val} to ${type}`)
    }
    const countDecimals = (n) => {
        if(Math.floor(n) === n) return 0;
        try{
            return n.toString().split(".")[1].length
        }catch (e){
            return 0
        } 
    }
    const isString = (val) => typeof val === 'string' || val instanceof String;
    const isArray = (val) => val && typeof val === 'object' && val.constructor === Array;
    const isObject = (val) => val && typeof val === 'object' && val.constructor === Object;
    const isDate = (val) => val instanceof Date;
    const isBoolean = (val) => typeof val === 'boolean';

    const isNumber = (val) => {
        if (isArray(val)) return false
        return !isNaN(encodeBigNumber(val).toNumber())
    }

    const isInteger = (val) => {
        if (!isNumber(val)) return false
        if (countDecimals(val) === 0) return true
        return false
    }
    const encodeInt = (val) => {
        if (!isNumber(val)) throwError(val)
        else return parseInt(val)
    }
    const isFloat = (val) => {
        if (!isNumber(val)) return false
        if (countDecimals(val) === 0) return false
        return true
    }
    const encodeFloat = (val) => {
        if(!isNumber(val)) throwError(val)
        if (!BigNumber.isBigNumber(val)) val = new BigNumber(val)

        return {"__fixed__": val.toFixed(30).replace(/^0+(\d)|(\d)0+$/gm, '$1$2')}
    }
    const encodeNumber = (val) => {
        if(!isNumber(val)) throwError(val)
        if (isFloat(val)) {
            if (!BigNumber.isBigNumber(val)) val = new BigNumber(val)
            return {"__fixed__": val.toFixed(30).replace(/^0+(\d)|(\d)0+$/gm, '$1$2')}
        }
        if (isInteger(val)) return parseInt(val)   
    }
    const encodeBigNumber = (val) => {
        if (!BigNumber.isBigNumber(val)) val = new BigNumber(val)
        return val
    }

    const encodeBool = (val) => {
        if (isBoolean(val)) return val
        if (val === 'true' || val === 1) return true
        if (val === 'false' || val === 0) return false
        throwError(val)
    }
    const encodeStr = (val) => {
        if (isString(val)) return val
        if (isDate(val)) return val.toISOString()
        return JSON.stringify(val)
    }
    const encodeDateTime = (val) => {
        val = !isDate(val) ? new Date(val) : val
        if (!isDate(val)) throwError(val)
        return {'__time__': [
            val.getUTCFullYear(), 
            val.getUTCMonth(), 
            val.getUTCDate(), 
            val.getUTCHours(), 
            val.getUTCMinutes(), 
            val.getUTCSeconds(), 
            val.getUTCMilliseconds()
        ]}
    }
    const encodeTimeDelta = (val) => {
        const time = isDate(val) ? val.getTime() : new Date(val).getTime()
        const days = parseInt(time  / 1000 / 60 / 60 / 24)
        const seconds = (time - (days * 24 * 60 * 60 * 1000)) / 1000
        return {'__delta__':[days, seconds]}
    }

    const encodeList = (val) => {
        if (isArray(val)) return parseObject(val)
        try{
            val = JSON.parse(val)
        }catch(e){
            throwError(val)
        }
        if (isArray(val)) return parseObject(val)
        throwError(val)
    }

    const encodeDict = (val) => {
        if (isObject(val)) return parseObject(val)
        try{
            val = JSON.parse(val)
        }catch(e){
            throwError(val)
        }
        if (isObject(val)) return parseObject(val)
        throwError(val)
    }

    const encodeObject = (val) => {
        try {
            return encodeList(val)
        }catch(e){
            return encodeDict(val)
        }
    }

    function parseObject (obj) {
        const encode = (k, v) => {
            if (k === "datetime" || k === "datetime.datetime" ) return Encoder("datetime.datetime", v)
            if (k === "timedelta" || k === "datetime.timedelta") return Encoder("datetime.timedelta", v)
            if (k !== "__fixed__" && isFloat(v)) return encodeFloat(v)
            return v
        }
    
        const fixDatetime = (k, v) => {
            const isDatetimeObject = (val) => {
                let datetimeTypes = ['datetime.datetime', 'datetime', 'datetime.timedelta', 'timedelta']
                return Object.keys(val).length === 1 && datetimeTypes.filter(f => f === Object.keys(val)[0]).length > 0

            }

            if (v.constructor === Array) {
                v.map(val => {
                    if (Object.keys(val).length === 1 && isDatetimeObject(v)) return val[Object.keys(val)[0]]
                    //if (isFloat(val)) return encodeFloat(val)
                    return val
                })
            }
            if (v.constructor === Object) {
                if (Object.keys(v).length === 1 && isDatetimeObject(v)) return v[Object.keys(v)[0]]
            }

            //if (isFloat(v)) return encodeFloat(v)

            return v
        }
    
        let encodeValues = JSON.stringify(obj, encode)
        return JSON.parse(encodeValues, fixDatetime)
    }

    const encoder = {
        str: encodeStr,
        string: encodeStr,
        float: encodeFloat,
        int: encodeInt,
        bool: encodeBool,
        boolean: encodeBool,
        dict: encodeDict,
        list: encodeList,
        Any: () => value,
        "datetime.timedelta": encodeTimeDelta, 
        "datetime.datetime": encodeDateTime,
        timedelta: encodeTimeDelta, 
        datetime: encodeDateTime,
        number: encodeNumber,
        object: encodeObject,
        bigNumber: encodeBigNumber,
    }
    
    if (Object.keys(encoder).includes(type)) return encoder[type](value)
    else throw new Error(`Error: ${type} is not a valid encoder type.`)
}

Encoder.BigNumber = BigNumber

module.exports = {
    Encoder
}