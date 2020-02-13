import { LamdenMasterNode_API } from '../../src/js/masternode-api'
import {  TransactionBuilder } from '../../src/js/transactionBuilder'
import { new_wallet } from '../../src/js/wallet'


let goodNetwork = {
    type: 'mockchain', 
    host: 'https://testnet.lamden.io', 
    port: '443'
}
let goodNetwork_api = new LamdenMasterNode_API(goodNetwork)


let badNetwork = {
    type: 'mockchain', 
    host: 'https://badnetwork.lamden.io', 
    port: '443'
}
let badNetwork_api = new LamdenMasterNode_API(badNetwork)

function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

let goodCode = "@export\ndef first_method(value):\n\treturn value"
let syntaxErrors = "@export\ndef first_method(value)\n\treturn value"
let lamdenErrors = "def first_method(value):\n\treturn value"

let keyPair = new_wallet()

describe('Test Masternode API returns', () => {
    before(function() {
        Cypress.config({
            defaultCommandTimeout: 60000
        })
    })

    context('constructor', () => {
        it('can create an instance', () => {
            let api = new LamdenMasterNode_API(goodNetwork)
            cy.expect(api).to.exist;
            cy.expect(api.host).to.eq(goodNetwork.host);
            cy.expect(api.type).to.eq(goodNetwork.networkType);
            cy.expect(api.port).to.eq(goodNetwork.port);
            cy.expect(api.url).to.eq(`${goodNetwork.host}:${goodNetwork.port}`);
            
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new LamdenMasterNode_API('https://testnet.lamden.io:443')
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Expected Object and got Type: string')
        })
        it('rejects missing host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = ''
                new LamdenMasterNode_API(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('HOST Required (Type: String)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = 'missing.protocol.com'
                new LamdenMasterNode_API(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Host String must include http:// or https://')
        })
        it('rejects missing port string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.port = ''
                new LamdenMasterNode_API(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('PORT Required (Type: String)')
        })
        it('rejects missing type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = ''
                new LamdenMasterNode_API(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Network Type Required (Type: String)')
        })
        it('rejects invalid type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = 'badtype'
                new LamdenMasterNode_API(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq(`badtype not in Lamden Network Types: ["mockchain","testnet","mainnet"]`)
        })
    })

    context('pingServer', () => {
        it('returns true if the server is online', () => {
            cy.wrap(goodNetwork_api.pingServer())
            .then((res) => {
                cy.expect(res).to.eq(true);
            })
        })
        it('returns false if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.pingServer())
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
    })

    context('mintTestNetCoins', () => {
        it('returns true if mint is successful', () => {
            cy.wrap(goodNetwork_api.mintTestNetCoins(keyPair.vk, 123456789))
            .then((res) => {
                cy.log(JSON.stringify(keyPair))
                cy.expect(res).to.eq(true);
            })
        })
        it('returns false if bad vk is undefined', () => {
            cy.wrap(goodNetwork_api.mintTestNetCoins(undefined, 123456789))
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
        it('returns false if balance is undefined', () => {
            cy.wrap(goodNetwork_api.mintTestNetCoins(keyPair.vk, undefined))
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
        it('returns false if provided network is unresponsive', () => {
            cy.wrap(goodNetwork_api.mintTestNetCoins(keyPair.vk, 123456789))
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
    })

    context('getTauBalance', () => {
        it('returns the balance for a vk', () => {
            cy.wrap(goodNetwork_api.getTauBalance(keyPair.vk))
            .then((res) => {
                cy.expect(res).to.eq(123456789);
            })
        })
        it('returns 0 if the vk does not exist yet', () => {
            cy.wrap(goodNetwork_api.getTauBalance(new_wallet().vk))
            .then((res) => {
                cy.expect(res).to.eq(0);
            })
        })
        it('returns 0 if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.getTauBalance())
            .then((res) => {
                cy.expect(res).to.eq(0);
            })
        })
    })

    context('contractExists', () => {
        it('returns true if a contract exists on the blockchain', () => {
            cy.wrap(goodNetwork_api.contractExists('currency'))
            .then((res) => {
                cy.expect(res).to.eq(true);
            })
        })
        it('returns false if a contract does not exist on the blockchain', () => {
            cy.wrap(goodNetwork_api.contractExists(new_wallet().vk))
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
        it('returns false if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.contractExists('currency'))
            .then((res) => {
                cy.expect(res).to.eq(false);
            })
        })
    })

    context('getContractMethods', () => {
        it('returns an array if a contract exists on the blockchain', () => {
            cy.wrap(goodNetwork_api.getContractMethods('currency'))
            .then((res) => {
                cy.expect(Array.isArray(res)).to.eq(true);
                cy.expect(res.length > 0).to.eq(true);
            })
        })
        it('returns an empty array if a contract does not exist on the blockchain', () => {
            cy.wrap(goodNetwork_api.getContractMethods(new_wallet().vk))
            .then((res) => {
                cy.log(JSON.stringify(res))
                cy.expect(Array.isArray(res)).to.eq(true);
                cy.expect(res.length === 0).to.eq(true);
            })
        })
        it('returns empty array if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.getContractMethods('currency'))
            .then((res) => {
                cy.expect(Array.isArray(res)).to.eq(true);
                cy.expect(res.length === 0).to.eq(true);
            })
        })
    })

    context('getVariable', () => {
        it('returns the value of the variable if the key exists', () => {
            let parms = {key: keyPair.vk};
            cy.wrap(goodNetwork_api.getVariable('currency', 'balances', {parms}))
            .then((res) => {
                cy.expect(res).to.eq('123456789');
            })
        })
        it('returns null if the key does not exist in the variable', () => {
            let parms = {key: new_wallet().vk};
            cy.wrap(goodNetwork_api.getVariable('currency', 'balances', {parms}))
            .then((res) => {
                cy.expect(res).to.eq('null');
            })
        })
        it('returns undefined if the contract does not exist', () => {
            let parms = {key: keyPair.vk};
            cy.wrap(goodNetwork_api.getVariable(new_wallet().vk, 'balances', {parms}))
            .then((res) => {
                cy.expect(res).to.eq(undefined);
            })
        })
        it('returns null if the variable does not exist', () => {
            let parms = {key: keyPair.vk};
            cy.wrap(goodNetwork_api.getVariable('currency',  new_wallet().vk, {parms}))
            .then((res) => {
                cy.expect(res).to.eq('null');
            })
        })
        it('returns undefined if provided network is unresponsive', () => {
            let parms = {key: keyPair.vk};
            cy.wrap(badNetwork_api.getVariable('currency', 'balances', {parms}))
            .then((res) => {
                cy.expect(res).to.eq(undefined);
            })
        })
    })

    context('getContractInfo', () => {
        it('returns a contract info object', () => {
            cy.wrap(goodNetwork_api.getContractInfo('currency'))
            .then((res) => {
                cy.expect(res.name).to.eq('currency');
                cy.expect(res.code.length > 0).to.eq(true);
            })
        })
        it('returns undefined if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.getContractInfo('currency'))
            .then((res) => {
                cy.expect(res).to.eq(undefined);
            })
        })
    })
    context('lintCode', () => {
        it('returns null when no vilations exist', () => {
            cy.wrap(goodNetwork_api.lintCode('testing', goodCode))
            .then((res) => {
                cy.expect(res.violations).to.eq(null);
            })
        })
        it('returns python syntax errors', () => {
            cy.wrap(goodNetwork_api.lintCode('testing', syntaxErrors))
            .then((res) => {
                cy.expect(res.violations.msg).to.eq('invalid syntax');
            })
        })
        it('returns lamden contracting errors errors', () => {
            cy.wrap(goodNetwork_api.lintCode('testing', lamdenErrors))
            .then((res) => {
                cy.expect(res.violations.length > 0).to.eq(true);
                cy.expect(res.violations[0]).to.eq('Line 0: S13- No valid contracting decorator found');
            })
        })
        it('returns an error message if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.lintCode('testing', goodCode))
            .then((res) => {
                cy.expect(res).to.eq('TypeError: Failed to fetch');
            })
        })
    })
    context('getNonce', () => {
        it('returns a nonce and processor value for a vk', () => {
            cy.wrap(goodNetwork_api.getNonce(keyPair.vk))
            .then((res) => {
                cy.expect(res.nonce).to.exist
                cy.expect(res.processor).to.exist
                cy.expect(res.sender).to.eq(keyPair.vk)
            })
        })
        it('returns an error message if vk is not a hex string', () => {
            cy.wrap(goodNetwork_api.getNonce('this-is-not-a-vk'))
            .then((err) => {
                cy.expect(err).to.eq(`this-is-not-a-vk is not a hex string.`)
            })
        })
        it('returns an error message if provided network is unresponsive', () => {
            cy.wrap(badNetwork_api.getNonce(keyPair.vk))
            .then((err) => {
                cy.expect(err).to.eq(`Unable to get nonce for "${keyPair.vk}". TypeError: Failed to fetch`)
            })
        })
    })/*
    context('sendTransaction', () => {
        it('can send a transaction and has the proper return object', () => {
            let newWallet = new_wallet()
            let kwargs = {}
            kwargs.to = {type: "address", value: newWallet.vk}
            kwargs.amount = {type: "fixedPoint", value: 1000}

            cy.wrap(api.getNonce(keyPair.vk))
            .then((res) => {
                let newTx = new TransactionBuilder(
                    goodNetwork,
                    keyPair.vk,
                    'currency',
                    'transfer',
                    kwargs,
                    50000,
                    res.nonce,
                    res.processor
                )
                newTx.sign(keyPair.sk)
                const data = newTx.serialize();
                cy.wrap(api.sendTransaction(goodNetwork, data))
                .then((res) => {
                    cy.log(JSON.stringify(res))
                    cy.expect(res.state_changes).to.exist
                    cy.expect(Object.keys(res.state_changes).length).to.eq(2)
                    cy.expect(res.status_code).to.eq(0)
                    cy.expect(res.result).to.eq(null)
                    cy.expect(res.stamps_used).to.be.greaterThan(0)
                })
            })
        })
    })*/
})