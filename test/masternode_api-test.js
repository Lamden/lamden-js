const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const { Masternode_API, wallet } = Lamden;

let goodNetwork = {
    type: 'mockchain', 
    host: 'https://testnet.lamden.io', 
    port: '443'
}
let goodNetwork_api = new Masternode_API(goodNetwork)

let badNetwork = {
    type: 'mockchain', 
    host: 'https://badnetwork.lamden.io', 
    port: '443'
}
let badNetwork_api = new Masternode_API(badNetwork)

function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

let goodCode = "@export\ndef first_method(value):\n\treturn value"
let syntaxErrors = "@export\ndef first_method(value)\n\treturn value"
let lamdenErrors = "def first_method(value):\n\treturn value"

let keyPair = wallet.new_wallet()

describe('Test Masternode API returns', () => {
    context('constructor', () => {
        it('can create an instance', () => {
            let api = new Masternode_API(goodNetwork)
            expect(api).to.exist;
            expect(api.host).to.be(goodNetwork.host);
            expect(api.type).to.be(goodNetwork.networkType);
            expect(api.port).to.be(goodNetwork.port);
            expect(api.url).to.be(`${goodNetwork.host}:${goodNetwork.port}`);
            
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new Masternode_API('https://testnet.lamden.io:443')
            } catch (e) {error = e}
            expect(error.message).to.be('Expected Object and got Type: string')
        })
        it('rejects missing host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = ''
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('HOST Required (Type: String)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = 'missing.protocol.com'
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Host String must include http:// or https://')
        })
        it('rejects missing port string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.port = ''
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('PORT Required (Type: String)')
        })
        it('rejects missing type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = ''
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Network Type Required (Type: String)')
        })
        it('rejects invalid type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = 'badtype'
                new Masternode_API(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be(`badtype not in Lamden Network Types: ["mockchain","testnet","mainnet"]`)
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

    context('Masternode_API.mintTestNetCoins()', () => {
        it('returns true if mint is successful', async () => {
            let response = await goodNetwork_api.mintTestNetCoins(keyPair.vk, 123456789)
            expect(response).to.be(true);
        })
        it('returns false if bad vk is undefined', async () => {
            let response = await goodNetwork_api.mintTestNetCoins(undefined, 123456789)
            expect(response).to.be(false);
        })
        it('returns false if balance is undefined', async () => {
            let response = await goodNetwork_api.mintTestNetCoins(keyPair.vk, undefined)
            expect(response).to.be(false);
        })
        it('returns false if provided network is unresponsive', async () => {
            let response = await badNetwork_api.mintTestNetCoins(keyPair.vk, 123456789)
            expect(response).to.be(false);
        })
    })

    context('Masternode_API.getTauBalance()', () => {
        it('returns the balance for a vk', async () => {
            let response = await goodNetwork_api.getTauBalance(keyPair.vk)
            expect(response).to.be(123456789);
        })
        it('returns 0 if the vk does not exist yet', async () => {
            let response = await goodNetwork_api.getTauBalance(wallet.new_wallet().vk)
            expect(response).to.be(0);
        })
        it('returns 0 if provided network is unresponsive',  async () => {
            let response = await badNetwork_api.getTauBalance()
            expect(response).to.be(0);
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

    context('Masternode_API.getVariable()', () => {
        it('returns the value of the variable if the key exists', async () => {
            let parms = {key: keyPair.vk};
            let response = await goodNetwork_api.getVariable('currency', 'balances', {parms})
            expect(response).to.be('123456789');
        })
        it('returns null if the key does not exist in the variable', async () => {
            let parms = {key: wallet.new_wallet().vk};
            let response = await goodNetwork_api.getVariable('currency', 'balances', {parms})
            expect(response).to.be('null');
        })
        it('returns undefined if the contract does not exist', async () => {
            let parms = {key: keyPair.vk};
            let response = await goodNetwork_api.getVariable(wallet.new_wallet().vk, 'balances', {parms})
            expect(response).to.be(undefined);
        })
        it('returns null if the variable does not exist', async () => {
            let parms = {key: keyPair.vk};
            let response = await goodNetwork_api.getVariable('currency',  wallet.new_wallet().vk, {parms})
            expect(response).to.be('null');
        })
        it('returns undefined if provided network is unresponsive', async () => {
            let parms = {key: keyPair.vk};
            let response = await badNetwork_api.getVariable('currency', 'balances', {parms})
            expect(response).to.be(undefined);
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
            expect(response).to.be(undefined);
        })
    })
    context('Masternode_API.lintCode()', () => {
        it('returns null when no vilations exist', async () => {
            let response = await goodNetwork_api.lintCode('testing', goodCode)
            expect(response.violations).to.be(null);
        })
        it('returns python syntax errors', async () => {
            let response = await goodNetwork_api.lintCode('testing', syntaxErrors)
            expect(response.violations.msg).to.be('invalid syntax');
        })
        it('returns lamden contracting errors errors', async () => {
            let response = await goodNetwork_api.lintCode('testing', lamdenErrors)
            expect(response.violations.length > 0).to.be(true);
            expect(response.violations[0]).to.be('Line 0: S13- No valid contracting decorator found');
        })
        it('returns an error message if provided network is unresponsive', async () => {
            
            let response = await badNetwork_api.lintCode('testing', goodCode)
            expect(response.includes('FetchError:')).to.be(true);
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
            expect(error.includes(`Unable to get nonce for "${keyPair.vk}"`)).to.be(true)
        })
    })
    context('Masternode_API.sendTransaction()', () => {
        it('can send a transaction and has the proper return object', async function() {
            this.timeout(10000)

            let newWallet = wallet.new_wallet()
            let kwargs = {}
            kwargs.to = newWallet.vk
            kwargs.amount = 1000

            let txInfo = {
                senderVk: keyPair.vk,
                contractName: 'currency',
                methodName: 'transfer',
                kwargs,
                stampLimit: 50000
            }

            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo)
            await newTx.getNonce();
            newTx.sign(keyPair.sk)
            newTx.serialize();

            let response = await goodNetwork_api.sendTransaction(newTx.transactonBytes)
            expect(response.state_changes).to.exist
            expect(Object.keys(response.state_changes).length >= 2).to.be(true)
            expect(response.status_code).to.be(0)
            expect(response.stamps_used).to.be.greaterThan(0)

        })
    })
})