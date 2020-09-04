const Encoder = (type, value) => {
    const throwError = () => {
        throw new Error(`Error encoding ${value} to ${type}`)
    }
    const isString = () => {
        return typeof value === 'string' || value instanceof String;
    }
    const isArray = () => {
        return value && typeof value === 'object' && value.constructor === Array;
    }
    const isObject = () => {
        return value && typeof value === 'object' && value.constructor === Object;
    }
    const isDate = () => {
        return value instanceof Date; 
    }
    const isBoolean = () => {
        return typeof value === 'boolean';
    }
    const encodeInt = () => {
        if (isNaN(parseInt(value))) throwError()
        else return parseInt(value)
    }
    const encodeFloat = () => {
        const countDecimals = () => {
            if(Math.floor(value) === value) return 0;
            return value.toString().split(".")[1].length || 0; 
        }

        if (isNaN(parseFloat(value))) throwError()

        else {
            value = parseFloat(value)
            if (countDecimals() === 0) return parseInt(value)
            else return {"__fixed__": String(parseFloat(value))}
        }
    }
    const encodeNumber = () => {
        return encodeFloat();
    }
    const encodeBool = () => {
        if (isBoolean()) return value
        if (value === 'true' || value === 1) return true
        if (value === 'false' || value === 0) return false
        throwError()
    }
    const encodeStr = () => {
        if (isString()) return value
        if (isDate()) return value.toISOString()
        return JSON.stringify(value)
    }
    const encodeDateTime = () => {
        value = !isDate() ? new Date(value) : value
        if (!isDate()) throwError()
        return [
            value.getUTCFullYear(), 
            value.getUTCMonth(), 
            value.getUTCDate(), 
            value.getUTCHours(), 
            value.getUTCMinutes(), 
            value.getUTCSeconds(), 
            value.getUTCMilliseconds()
        ]
    }
    const encodeTimeDelta = () => {
        const time = isDate() ? value.getTime() : new Date(value).getTime()
        const days = parseInt(time  / 1000 / 60 / 60 / 24)
        const seconds = (time - (days * 24 * 60 * 60 * 1000)) / 1000
        return [days, seconds]
    }

    const encodeList = () => {
        if (isArray()) return value
        try{
            value = JSON.parse(value)
        }catch(e){
            throwError()
        }
        if (isArray()) return value
        throwError()
    }

    const encodeDict = () => {
        if (isObject()) return value
        try{
            value = JSON.parse(value)
        }catch(e){
            throwError()
        }
        if (isObject()) return value
        throwError()
    }

    const encodeObject = () => {
        try {
            return encodeList()
        }catch(e){
            return encodeDict()
        }
    }

    const encoder = {
        str: () => encodeStr(),
        string:() => encodeStr(),
        float: () => encodeFloat(),
        int: () => encodeInt(),
        bool: () => encodeBool(),
        boolean: () => encodeBool(),
        dict: () => encodeDict(),
        list: () => encodeList(),
        Any: () => value,
        "datetime.timedelta": () => encodeTimeDelta(), 
        "datetime.datetime": () => encodeDateTime(),
        timedelta: () => encodeTimeDelta(), 
        datetime: () => encodeDateTime(),
        number: () => encodeNumber(),
        object: () => encodeObject()
    }
    
    if (Object.keys(encoder).includes(type)) return encoder[type]()
    else throw new Error(`Error: ${type} is not a valid encoder type.`)
}

Encoder.stringify = (value) => {
    const encode = (key, value) => {
        return Encoder(typeof value, value)
    }

    return JSON.stringify(value, encode)
}

module.exports = {
    Encoder
}