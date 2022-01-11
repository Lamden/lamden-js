import validators from "types-validate-assert";
const { validateTypes } = validators;
import fetch from "node-fetch";

export class LamdenBlockservice_API {
constructor(networkInfoObj) {
    if (!validateTypes.isObjectWithKeys(networkInfoObj))
    throw new Error(`Expected Network to be Object and got Type: ${typeof networkInfoObj}`);
    if (validateTypes.isArrayWithValues(networkInfoObj.blockservice_hosts)){
        this.hosts = this.validateHosts(networkInfoObj.blockservice_hosts);
    }else{
        this.hosts = []
    }
}
//This will throw an error if the protocol wasn't included in the host string
vaidateProtocol(host) {
    let protocols = ["https://", "http://"];
    if (protocols.map((protocol) => host.includes(protocol)).includes(true)) return host;
    throw new Error("Blockservice host value must include http:// or https://");
}
validateHosts(hosts) {
    return hosts.map((host) => this.vaidateProtocol(host.toLowerCase()));
}

get host() {
    return this.hosts[Math.floor(Math.random() * this.hosts.length)];
}
get url() {
    return this.host;
}

send(method, path, data = {}, overrideURL) {
    let parms = "";
    if (Object.keys(data).includes("parms")) {
        parms = this.createParms(data.parms);
    }

    let options = {};
    if (method === "POST") {
        let headers = { "Content-Type": "application/json" };
        options.method = method;
        options.headers = headers;
        options.body = data;
    }

    return fetch(`${overrideURL ? overrideURL : this.url}${path}${parms}`, options)
}

createParms(parms) {
    if (Object.keys(parms).length === 0) return "";
    let parmString = "?";
    Object.keys(parms).forEach((key) => {
        parmString = `${parmString}${key}=${parms[key]}&`;
    });
    return parmString.slice(0, -1);
}

async pingServer() {
    return this.send("GET", "/ping", {})
        .then(res => res.text())
        .then(text => text === "pong")
        .catch(() => false)
}

async getLastetBlock(callback){
    return this.send("GET", "/latest_block")
        .then(res => res.json())
        .then(json => {
            if (callback) callback(json.latest_block, null)
            return json.latest_block
        })
        .catch(err => {
            if (callback) callback(null, err.message)
            return {error: err.message}
        })
}

async getBlocks(start_block, limit = 10, callback){
    const parms = { start_block, limit };
    return this.send("GET", "/blocks", { parms })
        .then(res => res.json())
        .then(json => {
            if (callback) callback(json, null)
            return json
        })
        .catch(err => {
            if (callback) callback(null, err.message)
            return {error: err.message}
        })
}

async getCurrentKeyValue(contractName, variableName, key, callback){
    return this.send("GET", `/current/one/${contractName}/${variableName}/${key}`)
        .then(res => res.json())
        .then(json => {
            if (callback) callback(json, null)
            return json
        })
        .catch(err => {
            if (callback) callback(null, err.message)
            return {error: err.message}
        })
}

async getCurrentKeysValues(keys, callback){
    try{
        let endpont = 'current/keys'
        let data = await this.send('POST', `/${endpont}`, JSON.stringify(keys))
        .then(res => res.json())
        .then(json => {
            if (callback) callback(json, null)
            return json
        })
        return data
    }catch(err){
        if (callback) callback(null, err.message)
        return {error: err.message}
    }
}

async getTransaction(hash, callback) {
    const parms = { hash };
    return this.send("GET", "/tx", { parms })
        .then(res => res.json())
        .then(json => {
            if (callback) callback(json, null)
            return json
        })
        .catch(err => {
            if (err.message.includes("invalid json response body")) {
                if (callback) callback(null, null)
                return null
            }else{
                if (callback) callback(null, err.message)
                return {error: err.message}
            }
        })
    }
}