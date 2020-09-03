import validators from 'types-validate-assert'
const { validateTypes } = validators;
import { Network } from './network'
import { TransactionBuilder } from './transactionBuilder'

export class TransactionBatcher extends Network {
    constructor(networkInfo) {
        if (validateTypes.isSpecificClass(networkInfo, 'Network'))
            super(networkInfo.getNetworkInfo())
        else super(networkInfo)

        this.txBatches = {}
        this.overflow = []
        this.nonceResults = {}
        this.running = false;
    }
    addTransaction(txInfo){
        if (this.running) {
            this.overflow.push(txInfo)
            return
        }
        this.validateTransactionInfo(txInfo)
        if (!this.txBatches[txInfo.senderVk]) this.txBatches[txInfo.senderVk] = []
        this.txBatches[txInfo.senderVk].push(txInfo)
    }
    addTransactionList(txList){
        txList.forEach(txInfo => this.addTransaction(txInfo))
    }
    processOverflow(){
        const overflow = this.overflow
        this.overflow = []
        overflow.forEach(txInfo => this.addTransaction(txInfo))
    }
    hasTransactions(){
        let test = Object.keys(this.txBatches).map(senderVk => this.txBatches[senderVk].length)
        test.filter(f => f === 0)
        if (test.length > 0 ) return true
        return false
    }
    validateTransactionInfo(txInfo){
        try{
            new TransactionBuilder(txInfo)
        }catch(e){
            return false
        }
        return true
    }
    async getStartingNonce(senderVk, callback = undefined){
        let timestamp =  new Date().toUTCString();
        let response = await this.API.getNonce(senderVk)
        if (typeof response.nonce === 'undefined'){
            throw new Error(response)
        }
        response.timestamp = timestamp
        this.nonceResults[senderVk] = response

        if (callback) callback(response)
        return response;
    }
    async sendAllBatches(keyDict){
        if (this.running) return
        let sentTransactions = []
        this.running = true;
        
        await Promise.all(Object.keys(this.txBatches).map((senderVk) => {
            const senderBatch = this.txBatches[senderVk].splice(0,15);
            if (senderBatch.length <= 15) delete this.txBatches[senderVk]
            
            return new Promise(async (resolver) => {
                if (senderBatch.length === 0 ) resolver()

                if (!keyDict[senderVk]) throw new Error(`Cannot sign batch for ${senderVk}. No signing key provided.`)
                let nonceResponse = await this.getStartingNonce(senderVk)
                let txBatch = this.setBatchNonces(nonceResponse, senderBatch);
                this.signBatch(txBatch, keyDict[senderVk])
                this.sendBatch(txBatch).then(sentList => {
                    sentTransactions = [...sentTransactions, ...sentList]
                    resolver()
                })                
            })
        }))

        try{
            return Promise.all(sentTransactions)
        }catch (e){}
        finally{
            this.running = false;
            this.processOverflow();
        }
    }
    setBatchNonces(nonceResult, txList){
        return txList.map((txInfo, index) => {
            txInfo.nonce = nonceResult.nonce + index
            txInfo.processor = nonceResult.processor
            return new TransactionBuilder({hosts: [nonceResult.masternode]}, txInfo)
        }).sort((a, b) => a.nonce - b.nonce)
    }
    signBatch(txBatch, key){
        txBatch.forEach(txBuilder => txBuilder.sign(key))
    }
    sendBatch(txBatch){
        let resolvedTransactions = []
        return new Promise(resolver => {
            const resolve = (index) => {
                if ((index + 1) === txBatch.length) resolver(resolvedTransactions)
            }
            txBatch.forEach((txBuilder, index) => {
                const delayedSend = () => {
                    resolvedTransactions[index] = txBuilder.send().then(() => {return txBuilder})
                    resolve(index)
                }
                setTimeout(delayedSend, 1200 * index)
            })
        })
    }
}
