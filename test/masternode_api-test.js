const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const { Masternode_API, wallet } = Lamden;

let goodNetwork = {
    type: 'testnet',
    name: 'Lamden Public Testnet', 
    hosts: ['https://testnet-master-1.lamden.io:443'] 
}
let goodNetwork_api = new Masternode_API(goodNetwork)

let badNetwork = {
    type: 'testnet',
    name: 'Bad Network', 
    hosts: ['http://badnetwork.lamden.io:18080']
}

let badNetwork_api = new Masternode_API(badNetwork)

function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

let keyPair = wallet.new_wallet()

const balanceCheckWallet = {
    float: '960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb',
    int: '01930f6472916ae53c9ebbe7d3faf8979c24cac33d68041aa4ab986401bbf7c3'
}

describe('Test Masternode API returns', () => {
    context('constructor', () => {
        it('can create an instance', () => {
            let api = new Masternode_API(goodNetwork)
            expect(api).to.exist;
            expect(JSON.stringify(api.hosts)).to.be(JSON.stringify(goodNetwork.hosts));
            expect(api.url).to.be(goodNetwork.hosts[0]);
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new Masternode_API('https://testnet.lamden.io:443')
            } catch (e) {error = e}
            expect(error.message).to.be('Expected Object and got Type: string')
        })
        it('rejects missing hosts Array', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.hosts = []
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('HOSTS Required (Type: Array)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.hosts = ['missing.protocol.com']
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Host String must include http:// or https://')
        })
    })

    context('Masternode_API.pingServer()', () => {
        it('returns true if the server is online', async () => {
            let response = await goodNetwork_api.pingServer()
            expect(response).to.be(true);
        })
        it('returns false if provided network is unresponsive', async () => {
            let response = await badNetwork_api.pingServer()
            expect(response).to.be(false);
        })
    })

    context('Masternode_API.getCurrencyBalance()', () => {
        it('returns the float balance for a vk', async () => {
            let response = await goodNetwork_api.getCurrencyBalance(balanceCheckWallet.float)
            expect(response).to.be.above(0);
        })
        it('returns the int balance for a vk', async () => {
            let response = await goodNetwork_api.getCurrencyBalance(balanceCheckWallet.int)
            expect(response).to.be.above(0);
        })
        it('returns 0 if the vk does not exist yet', async () => {
            let response = await goodNetwork_api.getCurrencyBalance(wallet.new_wallet().vk)
            expect(response.toNumber()).to.be(0);
        })
        it('returns 0 if provided network is unresponsive',  async () => {
            let response = await badNetwork_api.getCurrencyBalance()
            expect(response.toNumber()).to.be(0);
        })
    })

    context('Masternode_API.contractExists()', () => {
        it('returns true if a contract exists on the blockchain', async () => {
            let response = await goodNetwork_api.contractExists('currency')
            expect(response).to.be(true);
        })
        it('returns false if a contract does not exist on the blockchain', async () => {
            let response = await goodNetwork_api.contractExists(wallet.new_wallet().vk)
            expect(response).to.be(false);
        })
        it('returns false if provided network is unresponsive', async () => {
            let response = await badNetwork_api.contractExists('currency')
            expect(response).to.be(false);
        })
    })

    context('Masternode_API.getContractMethods()', () => {
        it('returns an array if a contract exists on the blockchain', async () => {
            let response = await goodNetwork_api.getContractMethods('currency')
            expect(Array.isArray(response)).to.be(true);
            expect(response.length > 0).to.be(true);
        })
        it('returns an empty array if a contract does not exist on the blockchain', async () => {
            let response = await goodNetwork_api.getContractMethods(wallet.new_wallet().vk)
            expect(Array.isArray(response)).to.be(true);
            expect(response.length === 0).to.be(true);
        })
        it('returns empty array if provided network is unresponsive', async () => {
            let response = await badNetwork_api.getContractMethods('currency')
            expect(Array.isArray(response)).to.be(true);
            expect(response.length === 0).to.be(true);
        })
    })

    context('Masternode_API.getContractVariables()', () => {
        it('returns an array if a contract exists on the blockchain', async () => {
            let response = await goodNetwork_api.getContractVariables('currency')
            expect(Array.isArray(response.variables)).to.be(true);
            expect(Array.isArray(response.hashes)).to.be(true);
            expect(response.hashes.length > 0).to.be(true);
        })
        it('returns an empty Object if a contract does not exist on the blockchain', async () => {
            let response = await goodNetwork_api.getContractVariables(wallet.new_wallet().vk)
            expect(Array.isArray(response.variables)).to.be(false);
            expect(Array.isArray(response.hashes)).to.be(false);
            expect(Object.keys(response).length === 0).to.be(true);
        })
        it('returns empty Object if provided network is unresponsive', async () => {
            let response = await badNetwork_api.getContractVariables('currency')
            expect(Array.isArray(response.variables)).to.be(false);
            expect(Array.isArray(response.hashes)).to.be(false);
            expect(Object.keys(response).length === 0).to.be(true);
        })
    })

    context('Masternode_API.getVariable()', () => {
        it('returns the value of the variable if the key exists', async () => {
            let key = balanceCheckWallet.float;
            let response = await goodNetwork_api.getVariable('currency', 'balances', key)
            expect(parseFloat(response.__fixed__)).to.be.above(0);
        })
        it('returns undefined if the key does not exist in the variable', async () => {
            let key = wallet.new_wallet().vk;
            let response = await goodNetwork_api.getVariable('currency', 'balances', key)
            expect(response).to.be(null);
        })
        it('returns undefined if the contract does not exist', async () => {
            let key = keyPair.vk;
            let response = await goodNetwork_api.getVariable(wallet.new_wallet().vk, 'balances', key)
            expect(response).to.be(null);
        })
        it('returns undefined if the variable does not exist', async () => {
            let key = keyPair.vk;
            let response = await goodNetwork_api.getVariable('currency',  wallet.new_wallet().vk, key)
            expect(response).to.be(null);
        })
        it('returns undefined if provided network is unresponsive', async () => {
            let key = keyPair.vk;
            let response = await badNetwork_api.getVariable('currency', 'balances', key)
            expect(response).to.be(null);
        })
    })

    context('Masternode_API.getContractInfo()', () => {
        it('returns a contract info object', async () => {
            let response = await goodNetwork_api.getContractInfo('currency')
            expect(response.name).to.be('currency');
            expect(response.code.length > 0).to.be(true);
        })
        it('returns undefined if provided network is unresponsive', async () => {
            let response = await badNetwork_api.getContractInfo('currency')
            expect(response).to.be(null);
        })
    })

    context('Masternode_API.getNonce()', () => {
        it('returns a nonce and processor value for a vk', async () => {
            let response = await goodNetwork_api.getNonce(keyPair.vk)
            expect(response.nonce).to.exist
            expect(response.processor).to.exist
            expect(response.sender).to.be(keyPair.vk)
        })
        it('returns an error message if vk is not a hex string', async () => {
            let error = await goodNetwork_api.getNonce('this-is-not-a-vk')
            expect(error).to.be(`this-is-not-a-vk is not a hex string.`)
        })
        it('returns an error message if provided network is unresponsive', async () => {
            let error = await badNetwork_api.getNonce(keyPair.vk)
            expect(error.includes(`Unable to get nonce for ${keyPair.vk}`)).to.be(true)
        })
    })
})