import validators from 'types-validate-assert'
const { validateTypes } = validators;
const fetch = require('node-fetch').default;
import { Encoder } from './encoder'

export class LamdenMasterNode_API{
    constructor(networkInfoObj){
        if (!validateTypes.isObjectWithKeys(networkInfoObj)) throw new Error(`Expected Object and got Type: ${typeof networkInfoObj}`)
        if (!validateTypes.isArrayWithValues(networkInfoObj.hosts)) throw new Error(`HOSTS Required (Type: Array)`)

        this.hosts = this.validateHosts(networkInfoObj.hosts);        
    }
    //This will throw an error if the protocol wasn't included in the host string
    vaidateProtocol(host){
        let protocols = ['https://', 'http://']
        if (protocols.map(protocol => host.includes(protocol)).includes(true)) return host
        throw new Error('Host String must include http:// or https://')
    }
    validateHosts(hosts){
        return hosts.map(host => this.vaidateProtocol(host.toLowerCase()))
    }

    get host() {return this.hosts[Math.floor(Math.random() * this.hosts.length)]}
    get url() {return this.host}

    send(method, path, data, overrideURL, callback){
        let parms = '';
        if (Object.keys(data).includes('parms')) {
            parms = this.createParms(data.parms)
        }

        let options = {}
        if (method === 'POST'){
            let headers = {'Content-Type': 'application/json'}
            options.method = method
            options.headers = headers;
            options.body = data;
        }

        return fetch(`${overrideURL ? overrideURL : this.url}${path}${parms}`, options)
            .then(res => {
                return res.json()
            } )
            .then(json => {
                    return callback(json, undefined)
            })
            .catch(err => {
                    return callback(undefined, err.toString())
                })
    }

    createParms(parms){
        if (Object.keys(parms).length === 0) return ''
        let parmString = '?'
        Object.keys(parms).forEach(key => {
            parmString = `${parmString}${key}=${parms[key]}&`
        });
        return parmString.slice(0, -1);
    }

    async getContractInfo(contractName){
        let path = `/contracts/${contractName}`
        return this.send('GET', path, {}, undefined, (res, err) => {
            if (err) return;
            return res
        })
    }

    async getVariable(contract, variable, key = ''){
        let parms = {};
        if (validateTypes.isStringWithValue(key)) parms.key = key;

        let path = `/contracts/${contract}/${variable}/`
        return this.send('GET', path, {parms}, undefined, (res, err) => {
            if (err) return null;
            try{
                if (res.value) return res.value
            } catch (e){}
            return;
        })
    }

    async getContractMethods(contract){
        let path = `/contracts/${contract}/methods`
        return this.send('GET', path, {}, undefined, (res, err) => {
            try{
                if (res.methods) return res.methods
            } catch (e){}
            return [];
        })
        
    }

    async pingServer(){
        return this.send('GET', '/ping', {}, undefined, (res, err) => {
            try { 
                if (res.status === 'online') return true;
            } 
            catch (e) {
                return false;
            }
        })
    }

    async getCurrencyBalance(vk){
        let balanceRes = await this.getVariable('currency', 'balances', vk);
        if (!balanceRes) return Encoder('bigNumber', 0);
        if (balanceRes.__fixed__) return Encoder('bigNumber', balanceRes.__fixed__)
        else{
            if (balanceRes.value === null) return Encoder('bigNumber', 0);
            return Encoder('bigNumber', balanceRes.value);
        }
    }

    async contractExists(contractName){
        let path = `/contracts/${contractName}`
        return this.send('GET', path, {}, undefined, (res, err) => {
            try{
                if (res.name) return true;
            } catch (e){}
            return false;
        })
    }

    async sendTransaction(data, url = undefined, callback){
        return this.send('POST', '/', JSON.stringify(data), url, (res, err) => {
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
        let path = `/nonce/${sender}` 
        let url = this.host
        return this.send('GET', path, {}, url, (res, err) => {
            if (err){
                if (callback) {
                    callback(undefined, `Unable to get nonce for ${sender} on network ${url}`)
                    return
                } 
                return `Unable to get nonce for ${sender} on network ${url}`
            }
            res.masternode = url
            if (callback) {
                callback(res, undefined)
                return
            }
            else return res;
        })
    }

    async checkTransaction(hash, callback){
        const parms = {hash};
        return this.send('GET', '/tx', {parms}, undefined, (res, err) => {
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
}