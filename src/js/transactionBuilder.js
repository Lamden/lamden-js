import * as capnp from 'capnp-ts';
import * as transaction from '../capnp/js/transaction.capnp';
const { NewTransactionPayload, NewTransaction } = transaction;
import validators from 'types-validate-assert'
const { validateTypes } = validators;
import * as wallet from './wallet'
import { Network } from './network'
import * as pow from './pow';

export class TransactionBuilder extends Network {
    // Constructor needs an Object with the following information to build Class.
    //  
    // arg[0] (networkInfo): {
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
        super(networkInfo)

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

        
        //Hydrate other items if passed
        if (txData){
            if (validateTypes.isObjectWithKeys(txData.txSendResult)) this.txSendResult = txData.txSendResult;
            if (validateTypes.isObjectWithKeys(txData.nonceResult)){
                this.nonceResult = txData.nonceResult;
                if (validateTypes.isInteger(this.nonceResult.nonce)) this.nonce = this.nonceResult.nonce;
                if (validateTypes.isStringWithValue(this.nonceResult.processor)) this.processor = this.nonceResult.processor;
            }
            if (validateTypes.isObjectWithKeys(txData.txSendResult)) this.txSendResult = txData.txSendResult;
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
        let kwargBuffer = Buffer.from(JSON.stringify(this.kwargs));
        let kwargPayload = this.payload.initKwargs(kwargBuffer.byteLength);
        kwargPayload.copyBuffer(kwargBuffer);
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
    generate_proof() {
        // Generate a proof of work from the payloadBytes
        if (this.payloadBytes == null)
            this.setPayloadBytes();
        this.proof = pow.find(this.payloadBytes).pow;
        this.proofGenerated = true;
    }
    setProof() {
        // Store the proof of work in the transaction metadata
        if (!this.proofGenerated)
            this.generate_proof();
        const proofBuffer = this.hexStringToByte(this.proof);
        const messageProof = this.transactionMetadata.initProof(proofBuffer.byteLength);
        messageProof.copyBuffer(proofBuffer);
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
            this.setProof();
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
            
            if (validateTypes.isStringWithValue(response)) this.txSendResult = {errors: [response]}
            else {
                if (typeof response.error !== 'undefined'){
                    if (validateTypes.isArrayWithValues(response.error)) this.txSendResult.errors = response.error
                    if (validateTypes.isStringWithValue(response.error)) this.txSendResult.errors = [response.error]
                } 
                else this.txSendResult = {...this.txSendResult, ...response};
            }
        } catch(e) {
            this.txSendResult = {errors: [e.message]}
        }

        //Set error if txSendResult doesn't exist
        if (this.txSendResult === 'undefined'){
            this.txSendResult = {errors: ['TypeError: Failed to fetch']}
        }
        
        //Set timestamp of result
        this.txSendResult.timestamp = timestamp;
        
        //If errors were set then return 
        if (validateTypes.isArrayWithValues(this.txSendResult.errors)){
            this.setBlockResultInfo()
            if (validateTypes.isFunction(callback)) callback(undefined, this.txSendResult);
        } else {
            //If hash exists in the result then this is a pending tx and not a blockresult
            if (validateTypes.isStringWithValue(this.txSendResult.hash)){
                this.txHash = this.txSendResult.hash;
                this.setPendingBlockInfo()
            }else{
                if (this.txSendResult.stamps_used){
                    this.blockResult = this.txSendResult;
                    this.setBlockResultInfo()
                }
            }
            if (validateTypes.isFunction(callback)) callback(this.txSendResult);
        }
        this.emit('response', this.txSendResult, validateTypes.isObjectWithKeys(this.resultInfo) ? this.resultInfo.subtitle : 'Response');
        return this.txSendResult; 
    }
    // To possibly be removed or moved to lint masternode_api lint method
    /*
    parseSendErrors(){
        if (validateTypes.isStringWithValue(this.txSendResult.error)) this.txSendResult.errors.push(this.txSendResult.error)
        if (validateTypes.isInteger(this.txSendResult.status_code)){
            if (this.txSendResult.status_code > 0 && typeof this.txSendResult.result !== 'undefined') {
                if (validateTypes.hasKeys(this.txSendResult.result, ['args'])){
                    this.txSendResult.errors.push("Error: One of your method arguments threw an error")
                    this.txSendResult.errors = [...this.txSendResult.result.args, ...this.txSendResult.errors]                     
                } 
                if (validateTypes.hasKeys(this.txSendResult.result, ['error'])){
                    if (validateTypes.hasKeys(this.txSendResult.result.error, ['error'])){
                        this.txSendResult.errors.push(this.txSendResult.result.error.error)
                    }else{
                        this.txSendResult.errors.push(this.txSendResult.result.error)
                    }
                }
            }
        }
    }*/
    setPendingBlockInfo(){
        this.resultInfo =  {
            title: 'Transaction Pending',
            subtitle: 'Your transaction was submitted and is is being processed',
            message: `Tx Hash: ${this.txSendResult.hash}`,
            type: 'success',
        }
        return this.resultInfo;
    }
    setBlockResultInfo(){
        let erroredTx = false;
        let message = '';
        if(validateTypes.isArrayWithValues(this.txSendResult.errors)){
            erroredTx = true;
            message = `This transaction returned ${this.txSendResult.errors.length} errors.`
        }

        this.resultInfo = {
            title: `Transaction ${erroredTx ? 'Failed' : 'Successful'}`,
            subtitle: `Your transaction ${erroredTx ? 'returned an error and ' : ''}used ${this.txSendResult.stamps_used} stamps`,
            message,
            type: `${erroredTx ? 'error' : 'success'}`,
            errorInfo: erroredTx ? this.txSendResult.errors : undefined
        }
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
