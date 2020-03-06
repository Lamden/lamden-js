import * as capnp from 'capnp-ts';
import * as transaction from '../capnp/js/transaction.capnp';
const { NewTransactionPayload, NewTransaction } = transaction;
import validators from 'types-validate-assert'
const { validateTypes } = validators;
import * as wallet from './wallet'
import { Network } from './network'

export class TransactionBuilder extends Network {
    // Constructor needs an Object with the following information to build Class.
    //  
    // arg[0] (networkInfo): {  //Can also accpet a Lamden "Network Class"
    //      host: <string> masternode webserver hostname/ip,
    //      port: <string> masternode webserver port,
    //      type: <string> "testnet", "mainnet" or "mockchain"
    //  }
    //  arg[1] (txInfo): {
    //      uid: [Optional] <string> unique ID for tracking purposes, 
    //      senderVk: <hex string> public key of the transaction sender,
    //      contractName: <string> name of lamden smart contract,
    //      methodName: <string> name of method to call in contractName,
    //      kwargs: <object> key/values of args to pass to methodName
    //              example: kwargs.to = "270add00fc708791c97aeb5255107c770434bd2ab71c2e103fbee75e202aa15e"
    //                       kwargs.amount = 1000
    //      stampLimit: <integer> the max amount of stamps the tx should use.  tx could use less. if tx needs more the tx will fail.
    //      nonce: [Optional] <integer> send() will attempt to retrieve this info automatically
    //      processor [Optional] <string> send() will attempt to retrieve this info automatically
    //  }
    //  arg[2] (txData): [Optional] state hydrating data
    constructor(networkInfo, txInfo, txData) {
        if (validateTypes.isSpecificClass(networkInfo, 'Network'))
            super(networkInfo.getNetworkInfo())
        else super(networkInfo)

        //Validate arguments
        if(!validateTypes.isObjectWithKeys(txInfo)) throw new Error(`txInfo object not found`)
        if(!validateTypes.isStringHex(txInfo.senderVk)) throw new Error(`Sender Public Key Required (Type: Hex String)`)
        if(!validateTypes.isStringWithValue(txInfo.contractName)) throw new Error(`Contract Name Required (Type: String)`)
        if(!validateTypes.isStringWithValue(txInfo.methodName)) throw new Error(`Method Required (Type: String)`)
        if(!validateTypes.isInteger(txInfo.stampLimit)) throw new Error(`Stamps Limit Required (Type: Integer)`)        

        //Store variables in self for reference
        this.uid = validateTypes.isStringWithValue(txInfo.uid) ? txInfo.uid : undefined;
        this.sender = txInfo.senderVk;
        this.contract = txInfo.contractName;
        this.method = txInfo.methodName;
        this.kwargs = {};
        if(validateTypes.isObject(txInfo.kwargs)) this.kwargs = txInfo.kwargs;
        this.stampLimit = txInfo.stampLimit;

        //validate and set nonce and processor if user provided them
        if (typeof txInfo.nonce !== 'undefined'){
            if(!validateTypes.isInteger(txInfo.nonce)) throw new Error(`arg[6] Nonce is required to be an Integer, type ${typeof txInfo.none} was given`)
            this.nonce = txInfo.nonce;
        }
        if (typeof txInfo.processor !== 'undefined'){
            if(!validateTypes.isStringWithValue(txInfo.processor)) throw new Error(`arg[7] Processor is required to be a String, type ${typeof txInfo.processor} was given`)
            this.processor = txInfo.processor;
        }
        
        this.proofGenerated = false;
        this.signature;
        this.transactionSigned = false;

        //Transaction result information
        this.nonceResult = {};
        this.txSendResult = {errors:[]};
        this.txBlockResult = {};
        this.txHash;
        this.txCheckResult = {};
        this.txCheckAttempts = 0;
        this.txCheckLimit = 10;
        
        //Hydrate other items if passed
        if (txData){
            if (txData.uid) this.uid = txData.uid
            if (validateTypes.isObjectWithKeys(txData.txSendResult)) this.txSendResult = txData.txSendResult;
            if (validateTypes.isObjectWithKeys(txData.nonceResult)){
                this.nonceResult = txData.nonceResult;
                if (validateTypes.isInteger(this.nonceResult.nonce)) this.nonce = this.nonceResult.nonce;
                if (validateTypes.isStringWithValue(this.nonceResult.processor)) this.processor = this.nonceResult.processor;
            }
            if (validateTypes.isObjectWithKeys(txData.txSendResult)){
                this.txSendResult = txData.txSendResult;
                if (this.txSendResult.hash) this.txHash = this.txSendResult.hash
            } 
            if (validateTypes.isObjectWithKeys(txData.txBlockResult)) this.txBlockResult = txData.txBlockResult;
            if (validateTypes.isObjectWithKeys(txData.resultInfo)) this.resultInfo = txData.resultInfo;
        }
        //Create Capnp messages and transactionMessages
        this.initializePayload();
    }
    initializePayload(){
        this.payloadMessage = new capnp.Message();
        this.payload = this.payloadMessage.initRoot(NewTransactionPayload);
        this.transactionMessage = new capnp.Message();
        this.transaction = this.transactionMessage.initRoot(NewTransaction);
        this.transactionMetadata = this.transaction.initMetadata();
        this.transaction.initPayload();
    }
    numberToUnit64(number) {
        if (number == null)
            return;
        return capnp.Uint64.fromNumber(number);
    }
    hexStringToByte(string = '') {
        let a = [];
        for (let i = 0, len = string.length; i < len; i += 2) {
            a.push(parseInt(string.substr(i, 2), 16));
        }
        return new Uint8Array(a);
    }
    setSender() {
        let senderBuffer = this.hexStringToByte(this.sender);
        let senderPayload = this.payload.initSender(senderBuffer.byteLength);
        senderPayload.copyBuffer(senderBuffer);
    }
    setContract() {
        this.payload.setContractName(this.contract);
    }
    setFunctionName() {
        this.payload.setFunctionName(this.method);
    }
    setKwargsInPayload() {
        this.payload.setKwargs(JSON.stringify(this.kwargs));
    }
    setStamps() {
        this.payload.setStampsSupplied(this.numberToUnit64(this.stampLimit));
    }
    setNonce() {
        this.payload.setNonce(this.numberToUnit64(this.nonce));
    }
    setProcessor() {
        let processorBuffer = this.hexStringToByte(this.processor);
        let processorPayload = this.payload.initProcessor(processorBuffer.byteLength);
        processorPayload.copyBuffer(processorBuffer);
    }
    makePayload(){
        //Add values to the capnp structures
        this.setSender();
        this.setProcessor();
        this.setNonce();
        this.setContract();
        this.setFunctionName();
        this.setStamps();
        this.setKwargsInPayload();
    }
    setPayloadBytes() {
        if (this.nonce == null)
            throw new Error('No Nonce Set. Call getNonce()');
        if (this.processor == null)
            throw new Error('No Processor Set. Call getNonce()');
        //Set the Transaction Paylaod to Uint8Array so it can be signed.
        this.makePayload();
        this.payloadBytes = new Uint8Array(this.payloadMessage.toPackedArrayBuffer());
    }
    sign(sk) {
        if (this.payloadBytes == null) this.setPayloadBytes();
        // Get signature
        this.signature = wallet.sign(sk, this.payloadBytes);
        this.transactionSigned = true;
    }
    verifySignature(){
        //Verify the signature is correct
        if (!this.transactionSigned) throw new Error('Transaction has not be been signed. Use the sign(<private key>) method first.')
        return wallet.verify(this.sender, this.payloadBytes, this.signature)
    }
    setSignature() {
        // Set the signature in the transcation metadata
        if (!this.transactionSigned) throw new Error(`No signature present. Use the sign(<private key>) method then try again.`)
        const signatureBuffer = this.hexStringToByte(this.signature);
        const messageSignature = this.transactionMetadata.initSignature(signatureBuffer.byteLength);
        messageSignature.copyBuffer(signatureBuffer);
    }
    setTimeStamp() {
        // Store timstamp in the transaction metadata
        this.transactionMetadata.setTimestamp(+new Date/1000);
    }
    setTransactionPayload() {
        // Store Transaction Payload in the transaction
        this.transaction.setPayload(this.payload);
    }
    setTransactionMetadata() {
        // Store Transaction Payload in the transaction
        this.transaction.setMetadata(this.transactionMetadata);
    }
    setTransactionBytes() {
        //Convert message to bytes
        this.transactonBytes = this.transactionMessage.toPackedArrayBuffer();
    }
    serialize() {
        if (this.verifySignature()){
            this.setTransactionPayload();
            this.setSignature();
            this.setTimeStamp();
            this.setTransactionBytes();
            return this.transactonBytes;
        }
        throw new Error('Invalid signature')
    }
    async getNonce(callback = undefined) {
        let timestamp =  new Date().toUTCString();
        this.nonceResult = await this.API.getNonce(this.sender)
        if (typeof this.nonceResult.nonce === 'undefined'){
            throw new Error(`Unable to get nonce for ${this.sender} on network ${this.url}`)
        }
        this.nonceResult.timestamp = timestamp;
        this.nonce = this.nonceResult.nonce;
        this.processor = this.nonceResult.processor;

        if (!callback) return this.nonceResult;
        return callback(this.nonceResult)
    }
    async send(sk = undefined, callback = undefined) {
        console.log(this.getAllInfo())
        //Error if transaction is not signed and no sk provided to the send method to sign it before sending
        if (!validateTypes.isStringWithValue(sk) && !this.transactionSigned){
            throw new Error(`Transation Not Signed: Private key needed or call sign(<private key>) first`);
        }
        let timestamp =  new Date().toUTCString();
        try{
            //If the nonce isn't set attempt to get it
            if (isNaN(this.nonce) || !validateTypes.isStringWithValue(this.processor)) await this.getNonce();
            //if the sk is provided then sign the transaction
            if (validateTypes.isStringWithValue(sk)) this.sign(sk);
            //Serialize transaction
            this.serialize();
            //Send transaction to the masternode
            let response = await this.API.sendTransaction(this.transactonBytes)
            console.log(response)
                    //Set error if txSendResult doesn't exist
            if (response === 'undefined' || validateTypes.isStringWithValue(response)){
                this.txSendResult.errors = ['TypeError: Failed to fetch']
            }else{
                if (response.error) this.txSendResult.errors = [response.error]
                else this.txSendResult = response
            }
        } catch (e){
            this.txSendResult.error = e.message
        }
        this.txSendResult.timestamp = timestamp
        return this.handleMasterNodeResponse(this.txSendResult, callback)
    }
    checkForTransactionResult(callback = undefined){
        return new Promise((resolve) => {
            let timerId = setTimeout(async function checkTx() {
                this.txCheckAttempts = this.txCheckAttempts + 1;
                const res = await this.API.checkTransaction(this.txHash)
                let checkAgain = false;
                const timestamp =  new Date().toUTCString();
                if (typeof res === 'undefined'){
                    this.txCheckResult.error = 'TypeError: Failed to fetch'
                }else{
                    if (res.error){
                        if (res.error === 'Transaction not found.'){
                            if (this.txCheckAttempts < this.txCheckLimit){
                                checkAgain = true
                            }else{
                                this.txCheckResult.errors = [res.error, `Retry Attmpts ${this.txCheckAttempts} hit while checking for Tx Result.`]
                            }
                        }else{
                            this.txCheckResult.errors = [res.error]
                        }
                    }else{
                        this.txCheckResult = res;
                    }
                }
                if (checkAgain) timerId = setTimeout(checkTx.bind(this), 1000);
                else{
                    this.txCheckResult.timestamp = timestamp
                    clearTimeout(timerId);
                    resolve(this.handleMasterNodeResponse(this.txCheckResult, callback))
                }
            }.bind(this), 1000);
        })
    }
    handleMasterNodeResponse(result, callback = undefined){
        //Check to see if this is a successful transacation submission
        console.log(result)
        if (validateTypes.isStringWithValue(result.hash) && validateTypes.isStringWithValue(result.success)){
            this.txHash = result.hash;
            this.setPendingBlockInfo();
        }else{
            this.setBlockResultInfo(result)
            this.txBlockResult = result;
        }
        this.emit('response', result, this.resultInfo.subtitle);
        if (validateTypes.isFunction(callback)) callback(result)
        return result
    }
    setPendingBlockInfo(){
        this.resultInfo =  {
            title: 'Transaction Pending',
            subtitle: 'Your transaction was submitted and is is being processed',
            message: `Tx Hash: ${this.txHash}`,
            type: 'success',
        }
        console.log(this.resultInfo)
        return this.resultInfo;
    }
    setBlockResultInfo(result){
        console.log(result)
        let erroredTx = false;
        let stamps = (result.stampsUsed || result.stamps_used) || 0
        let message = '';
        if(validateTypes.isArrayWithValues(result.errors)){
            erroredTx = true;
            message = `This transaction returned ${result.errors.length} errors.`
        }

        this.resultInfo = {
            title: `Transaction ${erroredTx ? 'Failed' : 'Successful'}`,
            subtitle: `Your transaction ${erroredTx ? 'returned an error and ' : ''}used ${stamps} stamps`,
            message,
            type: `${erroredTx ? 'error' : 'success'}`,
            errorInfo: erroredTx ? result.errors : undefined,
            stampUsed: stamps
        }
        console.log(this.resultInfo)
        return this.resultInfo;
    }
    getResultInfo(){
        return this.resultInfo;
    }
    getTxInfo(){
        return {
            senderVk: this.sender,
            contractName: this.contract,
            methodName: this.method,
            kwargs: this.kwargs,
            stampLimit: this.stampLimit
        }
    }
    getAllInfo(){
        return {
            uid: this.uid,
            txHash: this.txHash,
            signed: this.transactionSigned,
            signature: this.signature,
            networkInfo: this.getNetworkInfo(),
            txInfo: this.getTxInfo(),
            txSendResult: this.txSendResult,
            txBlockResult: this.txBlockResult,
            resultInfo: this.getResultInfo(),
            nonceResult: this.nonceResult
        }
    }
}
