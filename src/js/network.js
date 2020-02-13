import { EventEmitter } from 'events'
import { ValidateTypes } from './validateTypes'
import { LamdenMasterNode_API } from './masternode-api'
const validate = new ValidateTypes();

export class Network extends EventEmitter {
    constructor(networkInfoObj){
        super();
        const lamdenNetworkTypes = ['mockchain', 'testnet', 'mainnet']
        //Reject undefined or missing info
        if (!validate.isObjectWithKeys(networkInfoObj)) throw new Error(`Expected Object and got Type: ${typeof networkInfoObj}`)
        if (!validate.isStringWithValue(networkInfoObj.name)) throw new Error(`Name Required (Type: String)`)
        if (!validate.isStringWithValue(networkInfoObj.host)) throw new Error(`HOST Required (Type: String)`)
        if (!validate.isStringWithValue(networkInfoObj.port)) throw new Error(`PORT Required (Type: String)`)
        if (!validate.isStringWithValue(networkInfoObj.type)) throw new Error(`Network Type Required (Type: String)`)

        this.type = networkInfoObj.type.toLowerCase();
        this.lamden = networkInfoObj.lamden;

        this.name = networkInfoObj.name;
        this.host = this.vaidateProtocol(networkInfoObj.host.toLowerCase());
        this.port = networkInfoObj.port;
    
        this.online = false;
        if (this.lamden){
            try{
                this.API = new LamdenMasterNode_API(networkInfoObj)
            } catch (e) {
                throw new Error(e)
            }
            
            if (!lamdenNetworkTypes.includes(this.type)) {
                throw new Error(`${this.type} not in Lamden Network Types: ${JSON.stringify(lamdenNetworkTypes)}`)
            }
            
            this.mainnet = this.type === 'mainnet'
            this.testnet = this.type === 'testnet'
            this.mockchain = this.type === 'mockchain'
        }
    }
    //This will throw an error if the protocol wasn't included in the host string
    vaidateProtocol(host){
        let protocols = ['https://', 'http://']
        if (protocols.map(protocol => host.includes(protocol)).includes(true)) return host
        throw new Error('Host String must include http:// or https://')
    }
    //Check if the network is online
    //Emits boolean as 'online' event
    //Also returns status as well as passes status to a callback
    async ping(callback = undefined){
        this.online = await this.API.pingServer()
        this.emit('online', this.online, `${this.name} is ${this.online}`);
        if (validate.isFunction(callback)) callback(this.online)
        return this.online
    }
}