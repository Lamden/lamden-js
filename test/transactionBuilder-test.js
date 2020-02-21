const expect = require('expect.js');
const Lamden = require('../dist/bundle');

let goodNetwork = {
    type: 'mockchain',
    name: 'Lamden Public Mockchain', 
    host: 'https://testnet.lamden.io', 
    port: '443'
}

let badNetwork = {
    type: 'mockchain',
    name: 'Bad Network', 
    host: 'http://badnetwork.lamden.io', 
    port: '8000'
}

let uid = "randomUIDstring"
let senderWallet = Lamden.wallet.new_wallet()
let recieverWallet = Lamden.wallet.new_wallet()

let senderVk = senderWallet.vk
let contractName = 'currency'
let methodName = 'transfer'
let stampLimit = 50000
let nonce = 0;
let processor = "0000000000000000000000000000000000000000000000000000000000000000";

let kwargs = {}
kwargs.to = recieverWallet.vk
kwargs.amount = 1000

let txInfo_noNonce = {uid, senderVk, contractName, methodName, kwargs, stampLimit }
let txInfo_withNonce = {uid, senderVk, contractName, methodName, kwargs, stampLimit, nonce, processor }

describe('Test TransactionBuilder class', () => {
    before(async function() {
        //Mint some Coins to the wallet we will use for testing
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
        let response = await newTx.API.mintTestNetCoins(senderWallet.vk, 100000)
        expect(response).to.be(true);
    })

    context('new TransactionBuilder', () => {
        it('can create an instance without nonce or processor', () => {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            let newTxInfo = newTx.getAllInfo()
            console.log(newTxInfo)
            expect(newTx).to.exist;
            //Validate TX Info propagated in the class
            expect(newTxInfo.uid).to.be(txInfo_noNonce.uid)
            expect(newTxInfo.txInfo.senderVk).to.be(txInfo_noNonce.senderVk)
            expect(newTxInfo.txInfo.contractName).to.be(txInfo_noNonce.contractName)
            expect(newTxInfo.txInfo.methodName).to.be(txInfo_noNonce.methodName)
            expect(JSON.stringify(newTxInfo.txInfo.kwargs)).to.be(JSON.stringify(txInfo_noNonce.kwargs))
            //Validate internal properties
            expect(newTxInfo.signed).to.be(false)
            expect(newTxInfo.signature).to.be(undefined)
            expect(JSON.stringify(newTxInfo.txSendResult)).to.be(JSON.stringify({errors: []}))
            expect(JSON.stringify(newTxInfo.txBlockResult)).to.be(JSON.stringify({}))
            expect(JSON.stringify(newTxInfo.nonceResult)).to.be(JSON.stringify({}))
        })
        it('can create an instance by providing nonce and processor', () => {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce)
            let newTxInfo = newTx.getAllInfo()
            expect(newTx).to.exist;
            expect(newTxInfo.txInfo.nonce).to.exist;
            expect(newTxInfo.txInfo.processor).to.exist;
        })
        
        it('it throws error when missing arguments', () => {
            function testValues(argName, networkInfo, senderVk, contractName, methodName, kwargs, stampLimit){
                let txInfo = {senderVk, contractName, methodName, kwargs, stampLimit}
                try{
                    return new Lamden.TransactionBuilder(networkInfo, txInfo)
                }catch (e){
                    console.log(`        o - ${e.message}`)
                    expect(e.message.includes(argName)).to.be(true);
                }
            }
            let newTx = undefined;
            newTx = testValues('Network Info', undefined, senderWallet.vk, 'currency', 'transfer', kwargs, 50000)
            newTx = testValues('Sender', goodNetwork, undefined, 'currency', 'transfer', kwargs, 50000)
            newTx = testValues('Contract', goodNetwork, senderWallet.vk, undefined, 'transfer', kwargs, 50000)
            newTx = testValues('Method', goodNetwork, senderWallet.vk, 'currency', undefined, kwargs, 50000)
            newTx = testValues('Stamps', goodNetwork, senderWallet.vk, 'currency', 'transfer', kwargs, undefined)
            expect(typeof newTx).to.be('undefined');
        })
    })

    context('TransactionBuilder.sign()', () => {
        it('can sign and verify a transaction', () => {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce)
            newTx.sign(senderWallet.sk)
            expect(newTx.transactionSigned).to.be(true)
            expect(newTx.verifySignature()).to.be(true)
        })
        it('throws and error if nonce not set ', () => {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            expect(newTx.nonce).to.not.exist
            expect(newTx.processor).to.not.exist
            try {
                newTx.sign(senderWallet.sk)
            } catch (e){
                expect(e.toString()).to.be('Error: No Nonce Set. Call getNonce()')
            }
        })
    })

    context('TransactionBuilder.getNonce()', () => {
        it('can retieve nonce and processor from the masternode', async () => {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            expect(newTx.nonce).to.not.exist
            expect(newTx.processor).to.not.exist

            let response = await newTx.getNonce();

            //Validate Nonce was retrieved
            expect(response.nonce).to.exist
            expect(response.processor).to.exist
            expect(response.sender).to.exist
            expect(newTx.nonce).to.be(response.nonce)
            expect(newTx.processor).to.be(response.processor)
            expect(newTx.sender).to.be(response.sender)

        })
        it('throws error if vk is not correct type, missing or invalid', async () => {
                let error = ''
                let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
                newTx.sender = 'not-a-good-vk'
                try{
                    await newTx.getNonce()
                } catch (e){
                    error = e.message
                }
                expect(error).to.be(`Unable to get nonce for ${newTx.sender} on network ${newTx.url}`)
        })
        it('throws error if provided network is unresponsive', async () => {
            let error = ''
            let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_noNonce)
            try{
                await newTx.getNonce()
            } catch (e){
                error = e.message
            }
            expect(error).to.be(`Unable to get nonce for ${newTx.sender} on network ${newTx.url}`)
        })
    })

    context('TransactionBuilder.send()', () => {
        it('sends a transaction and produces success resultInfo', async function () {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            await newTx.getNonce();

            //Sign transaction
            newTx.sign(senderWallet.sk)

            //Validate transaction is signed
            expect(newTx.transactionSigned).to.be(true)
            expect(newTx.verifySignature()).to.be(true)

            let response = await newTx.send();
            console.log(response)

            expect(Object.keys(response.state_changes).length >= 2).to.be(true)
            expect(response.status_code).to.exist
            expect(response.result).to.be(undefined)
            expect(response.stamps_used).to.exist    
            
            let txData = newTx.getAllInfo()
            let resultInfo = txData.resultInfo;
            expect(response.errors.length === 0).to.be(true)
            expect(resultInfo.title).to.be(`Transaction Successful`)
            expect(resultInfo.subtitle).to.be(`Your transaction used ${response.stamps_used} stamps`)
            expect(resultInfo.message).to.be(``)
            expect(resultInfo.type).to.be(`success`)
            expect(resultInfo.errorInfo).to.be(undefined)
        })
        it('gets nonce and signs transacation automatically if sk is provided', async function () {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)

            //Send Transaction
            let response = await newTx.send(senderWallet.sk);

            expect(Object.keys(response.state_changes).length >= 2).to.be(true)
            expect(response.status_code).to.exist
            expect(response.result).to.be(undefined)
            expect(response.stamps_used).to.exist
            expect(response.errors.length === 0).to.be(true)
        })
        it('throws error if provided network is unresponsive', async function () {
            let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_withNonce)
            let response = await newTx.send(senderWallet.sk)

            expect(response.errors.length > 0).to.be(true)
            expect(response.errors[0].includes('FetchError:')).to.be(true)

        })
        it('can return execution errors list', async function () {
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            newTx.stampLimit = 0;

            //Send Transaction
            let response = await newTx.send(senderWallet.sk);
            expect(response.errors.length > 0).to.be(true)
            expect(response.errors[0]).to.be('The cost has exceeded the stamp supplied!\n')

            let txData = newTx.getAllInfo()
            let resultInfo = txData.resultInfo;
            expect(resultInfo.title).to.be(`Transaction Failed`)
            expect(resultInfo.subtitle).to.be(`Your transaction returned an error and used ${response.stamps_used} stamps`)
            expect(resultInfo.message).to.be(`This transaction returned ${response.errors.length} errors.`)
            expect(resultInfo.type).to.be(`error`)
            expect(JSON.stringify(resultInfo.errorInfo)).to.be(JSON.stringify(response.errors))
        })
        it('can return transaction validation errors list', async function () {
            let sender = Lamden.wallet.new_wallet()
            let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce)
            newTx.sender = sender.vk;

            //Send Transaction
            let response = await newTx.send(sender.sk);
            expect(response.errors.length > 0).to.be(true)
            expect(response.errors[0]).to.be('Transaction sender has too few stamps for this transaction.')
        })
    })
})    