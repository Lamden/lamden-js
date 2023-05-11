import validators from "types-validate-assert";
const { validateTypes } = validators;
import fetch from "node-fetch";
import { io } from "socket.io-client";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export class LamdenBlockservice_API {
    constructor(networkInfoObj) {
        this.timeout = 3000
        this.subscribeTimeOut = 20000
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
    return this.send("GET", "/latest_block", {})
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

async getContractInfo(contractName) {
    return this.send("GET", `/contracts/${contractName}`, {})
        .then(res => res.json())
        .then(json => {
            if (Object.keys(json).length > 0) {
                let data = json[contractName]
                return {
                    name: contractName,
                    code: data['__code__']
                }
            } else {
                return {"error":`${contractName} does not exist`}
            }
        })
        .catch(err => {
            return {error: err.message}
        })
}

    disconnect() {
        if (!this.socket || !this.socket.connected) return true
        this.socket.disconnect()
        return true
    }

    async subscribeTx (txHash) {
        if (!this.socket) {
            this.socket = io(this.host);
        }

        // ensure socket connected
        let isTimeout = false
        let now = new Date().getTime()
        while(!this.socket.connected && !isTimeout){
            isTimeout = new Date().getTime() - now > this.timeout
            await sleep(50)
        }
        
        // check whether the socket is connected;
        if (!this.socket.connected) {
            this.socket.disconnect()
            return {txHash: txHash, errors: ["Subscribe tx result failed. Blockservice socket disconnected"]}
        }

        return new Promise((resolve) => {

            const processResult = (data) => {
                const { room, message } = JSON.parse(data)
                if (room !== txHash) {
                    return
                }

                // leave tx room
                this.socket.emit('leave', txHash);
                // off the listener
                this.socket.off(txHash, processResult)
    
                resolve({
                    hlc_timestamp: message.hlc_timestamp,
                    blockNum: message.blockNum,
                    affectedContractsList: message.affectedContractsList,
                    affectedVariablesList: message.affectedVariablesList,
                    affectedRootKeysList: message.affectedRootKeysList,
                    affectedRawKeysList: message.affectedRawKeysList,
                    state_changes_obj: typeof(message.state_changes_obj) === "string"? JSON.parse(message.state_changes_obj) : message.state_changes_obj,
                    txHash: message.txInfo.hash,
                    txInfo: message.txInfo,
                    senderVk: message.sender,
                    rewards: message.rewards
                })
            }
            // listen for the event
            this.socket.on("new-state-changes-by-transaction", processResult);
            
            // join the tx hash room
            this.socket.emit('join', txHash);

            // for timeout
            setTimeout(() => {
                resolve({isTimeout: true, txHash: txHash, errors: [`Timeout ${this.subscribeTimeOut}ms while subscibing for Tx Result`]})
            }, this.subscribeTimeOut);

        })
    }
}
