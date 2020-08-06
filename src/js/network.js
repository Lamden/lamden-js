import { EventEmitter } from './eventEmitter'
import validators from 'types-validate-assert'
const { validateTypes } = validators;
import { LamdenMasterNode_API } from './masternode-api'

export class Network {
    // Constructor needs an Object with the following information to build Class.
    //
    // networkInfo: {
    //      hosts: <array> list of masternode hostname/ip urls,
    //      type: <string> "testnet", "mainnet" or "custom"
    //  },
    constructor(networkInfoObj){
        //Reject undefined or missing info
        if (!validateTypes.isObjectWithKeys(networkInfoObj)) throw new Error(`Expected Network Info Object and got Type: ${typeof networkInfoObj}`)
        if (!validateTypes.isArrayWithValues(networkInfoObj.hosts)) throw new Error(`HOSTS Required (Type: Array)`)

        this.type = validateTypes.isStringWithValue(networkInfoObj.type) ? networkInfoObj.type.toLowerCase() : "custom";
        this.events = new EventEmitter()
        this.hosts = this.validateHosts(networkInfoObj.hosts);
        this.currencySymbol = validateTypes.isStringWithValue(networkInfoObj.currencySymbol) ? networkInfoObj.currencySymbol : 'TAU'
        this.name = validateTypes.isStringWithValue(networkInfoObj.name) ? networkInfoObj.name : 'lamden network';
        this.lamden = validateTypes.isBoolean(networkInfoObj.lamden) ? networkInfoObj.lamden : false;
        this.blockExplorer = validateTypes.isStringWithValue(networkInfoObj.blockExplorer) ? networkInfoObj.blockExplorer : undefined;
    
        this.online = false;
        try{
            this.API = new LamdenMasterNode_API(networkInfoObj)
        } catch (e) {
            throw new Error(e)
        }
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
    //Check if the network is online
    //Emits boolean as 'online' event
    //Also returns status as well as passes status to a callback
    async ping(callback = undefined){
        this.online = await this.API.pingServer()
        this.events.emit('online', this.online);
        if (validateTypes.isFunction(callback)) callback(this.online)
        return this.online
    }
    get host() {return this.hosts[Math.floor(Math.random() * this.hosts.length)]}
    get url() {return this.host}
    getNetworkInfo(){
        return {
            name: this.name,
            lamden: this.lamden,
            type: this.type,
            hosts: this.hosts,
            url: this.url,
            online: this.online,
        }
    }
}