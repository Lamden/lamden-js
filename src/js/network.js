import { EventEmitter } from "./eventEmitter";
import validators from "types-validate-assert";
const { validateTypes } = validators;
import { LamdenMasterNode_API } from "./masternode-api";
import { LamdenBlockservice_API } from "./blockservice-api";

const NETWORK_VERSIONS = [1, 2]

export class Network {
  // Constructor needs an Object with the following information to build Class.
  //
  // networkInfo: {
  //      hosts: <array> list of masternode hostname/ip urls,
  //      type: <string> "testnet", "mainnet" or "custom",
  //      version <interger>: 1 (default) or 2
  //  },
  constructor(networkInfoObj) {
    //Reject undefined or missing info
    if (!validateTypes.isObjectWithKeys(networkInfoObj))
      throw new Error(`Expected Network Info Object and got Type: ${typeof networkInfoObj}`);
    if (!validateTypes.isArrayWithValues(networkInfoObj.hosts))
      throw new Error(`HOSTS Required (Type: Array)`);
    this.classname = 'Network'
    this.type = validateTypes.isStringWithValue(networkInfoObj.type)
      ? networkInfoObj.type.toLowerCase()
      : "custom";
    this.version = this.getNetworkVersion(networkInfoObj.version)
    this.events = new EventEmitter();
    this.hosts = this.validateHosts(networkInfoObj.hosts);
    this.currencySymbol = validateTypes.isStringWithValue(networkInfoObj.currencySymbol)
      ? networkInfoObj.currencySymbol
      : "TAU";
    this.name = validateTypes.isStringWithValue(networkInfoObj.name)
      ? networkInfoObj.name
      : "lamden network";
    this.lamden = validateTypes.isBoolean(networkInfoObj.lamden) ? networkInfoObj.lamden : false;
    this.blockExplorer = validateTypes.isStringWithValue(networkInfoObj.blockExplorer)
      ? networkInfoObj.blockExplorer
      : undefined;

    this.online = false;
    try {
      this.API = new LamdenMasterNode_API(networkInfoObj);
    } catch (e) {
      throw new Error(e);
    }
    try {
      this.blockservice = new LamdenBlockservice_API(networkInfoObj);
    } catch (e) {
      throw new Error(e);
    }
  }
  //This will throw an error if the protocol wasn't included in the host string
  vaidateProtocol(host) {
    let protocols = ["https://", "http://"];
    if (protocols.map((protocol) => host.includes(protocol)).includes(true)) return host;
    throw new Error("Host String must include http:// or https://");
  }
  validateHosts(hosts) {
    return hosts.map((host) => this.vaidateProtocol(host.toLowerCase()));
  }
  getNetworkVersion(version){
    if (!validateTypes.isInteger(version)) return 1
    if (NETWORK_VERSIONS.includes(version)) return version
    else return 1
  }
  //Check if the network is online
  //Emits boolean as 'online' event
  //Also returns status as well as passes status to a callback
  async ping(callback = undefined) {
    this.online = await this.API.pingServer();
    this.events.emit("online", this.online);
    if (validateTypes.isFunction(callback)) callback(this.online);
    return this.online;
  }
  get host() {
    return this.hosts[Math.floor(Math.random() * this.hosts.length)];
  }
  get url() {
    return this.host;
  }
  getNetworkInfo() {
    return {
      name: this.name,
      lamden: this.lamden,
      type: this.type,
      hosts: this.hosts,
      blockservice_hosts: this.blockservice.hosts,
      url: this.url,
      online: this.online,
      version: this.version
    };
  }

  // Unify APIs
  async pingServer() {
    let res;
    if (this.blockservice.host) {
      res = await this.blockservice.pingServer();
    } else {
      res = await this.API.pingServer();
    }
    return res
  }

  async getVariable(contractName, variableName, key) {
    if (this.blockservice.host) {
      let data = await this.blockservice.getCurrentKeyValue(contractName, variableName, key);
      return data
    } else {
      let res = await this.API.getVariable(contractName, variableName, key);
      if (res) {
        return {
          value: res
        }
      } else {
        return {error: "key or variable not exists"}
      }
    }
  }

  async getCurrencyBalance(vk) {
    return await this.getVariable("currency", "balances", vk)
  }

  async getContractInfo(contractName) {
    if (this.blockservice.host) {
      return await this.blockservice.getContractInfo(contractName);
    } else {
      return await this.API.getContractInfo(contractName);
    }
  }

  async contractExists(contractName) {
    let data;
    if (this.blockservice.host) {
      data = await this.blockservice.getContractInfo(contractName);
    } else {
      data =  await this.API.getContractInfo(contractName);
    }
    return data && data.name ? true : false
  }

  async getLastetBlock() {
    if (this.blockservice.host) {
      let data = await this.blockservice.getLastetBlock();
      if (data.error) {
        return data
      } else {
        return {
          value: data
        }
      }
    } else {
      return await this.API.getLastetBlock();
    }
  }

}
