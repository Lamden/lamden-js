import validators from 'types-validate-assert'
const { validateTypes } = validators;
import * as wallet from './wallet'
import { Network } from './network'

export class TransactionBuilder extends Network {
    // Constructor needs an Object with the following information to build Class.
    //  
    // arg[0] (networkInfo): {  //Can also accpet a Lamden "Network Class"
    //      host: <string> masternode webserver hostname/ip,
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
        this.makePayload();
    }
    makePayload(){
        this.payload = {
            contract: this.contract,
            function: this.method,
            kwargs: this.kwargs,
            nonce: this.nonce,
            processor: this.processor,
            sender: this.sender,
            stamps_supplied: this.stampLimit
        }
        this.sortedPayload = this.sortObject(this.payload)
    }
    makeTransaction(){
        this.tx = {
            metadata: {
                signature: this.signature,
                timestamp: parseInt(+new Date / 1000),
            },
            payload: this.sortedPayload.orderedObj
        }
    }
    verifySignature(){
        //Verify the signature is correct
        if (!this.transactionSigned) throw new Error('Transaction has not be been signed. Use the sign(<private key>) method first.')
        const stringBuffer = Buffer.from(this.sortedPayload.json)
        const stringArray = new Uint8Array(stringBuffer)
        return wallet.verify(this.sender, stringArray, this.signature)
    }
    sign(sk = undefined, userWallet = undefined){
        const stringBuffer = Buffer.from(this.sortedPayload.json)
        const stringArray = new Uint8Array(stringBuffer)
        if (userWallet) this.signature = userWallet.sign(stringArray)
        else this.signature = wallet.sign(sk, stringArray)
        this.transactionSigned = true;
    }
    sortObject(object){
        const processObj = (obj) => {
            const getType = (value) => {
             return Object.prototype.toString.call(value)
            }
            const isArray = (value) => {
             if(getType(value) === "[object Array]") return true;
             return false;  
            }
            const isObject = (value) => {
             if(getType(value) === "[object Object]") return true;
             return false;  
            }
        
            const sortObjKeys = (unsorted) => {
                const sorted = {};
                Object.keys(unsorted).sort().forEach(key => sorted[key] = unsorted[key]);
                return sorted
            }
        
            const formatKeys = (unformatted) => {
                Object.keys(unformatted).forEach(key => {
                        if (isArray(unformatted[key])) unformatted[key] = unformatted[key].map(item => {
                        if (isObject(item)) return formatKeys(item)
                        return item
                    })
                    if (isObject(unformatted[key])) unformatted[key] = formatKeys(unformatted[key])
                })
                return sortObjKeys(unformatted)
            }
        
            if (!isObject(obj)) throw new TypeError('Not a valid Object')
                try{
                    obj = JSON.parse(JSON.stringify(obj))
                } catch (e) {
                    throw new TypeError('Not a valid JSON Object')
                }
            return formatKeys(obj)
        }
        const orderedObj = processObj(object)
        return { 
            orderedObj, 
            json: JSON.stringify(orderedObj)
        }
    }
    async getNonce(callback = undefined) {
        let timestamp =  new Date().toUTCString();
        this.nonceResult = await this.API.getNonce(this.sender)
        if (typeof this.nonceResult.nonce === 'undefined'){
            throw new Error(this.nonceResult)
        }
        this.nonceResult.timestamp = timestamp;
        this.nonce = this.nonceResult.nonce;
        this.processor = this.nonceResult.processor;
        this.nonceMasternode = this.nonceResult.masternode
        //Create payload object
        this.makePayload()

        if (!callback) return this.nonceResult;
        return callback(this.nonceResult)
    }
    async send(sk = undefined, masternode = undefined, callback = undefined) {
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
            this.makeTransaction();
            //Send transaction to the masternode
            let masternodeURL = masternode
            if (!masternodeURL && this.nonceMasternode) masternodeURL = this.nonceMasternode
            let response = await this.API.sendTransaction(this.tx, masternodeURL)
            //Set error if txSendResult doesn't exist
            if (!response || validateTypes.isStringWithValue(response)){
                this.txSendResult.errors = [response || "Unknown Transaction Error"]
            }else{
                if (response.error) this.txSendResult.errors = [response.error]
                else this.txSendResult = response
            }
        } catch (e){
            this.txSendResult.errors = [e.message]
        }
        this.txSendResult.timestamp = timestamp
        return this.handleMasterNodeResponse(this.txSendResult, callback)
    }
    checkForTransactionResult(callback = undefined){
        return new Promise((resolve) => {
            let timerId = setTimeout(async function checkTx() {
                this.txCheckAttempts = this.txCheckAttempts + 1;
                let res = await this.API.checkTransaction(this.txHash)
                let checkAgain = false;
                let timestamp =  new Date().toUTCString();
                if (typeof res === 'string' || !res) {
                    if (this.txCheckAttempts < this.txCheckLimit){
                        checkAgain = true
                    }else{
                        this.txCheckResult.errors = [
                            `Retry Attmpts ${this.txCheckAttempts} hit while checking for Tx Result.`,
                            res
                        ]
                    }
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
                    if (validateTypes.isNumber(this.txCheckResult.status)){
                        if (this.txCheckResult.status > 0){
                            if (!validateTypes.isArray(this.txCheckResult.errors)) this.txCheckResult.errors = []
                            this.txCheckResult.errors.push('This transaction returned a non-zero status code')
                        }
                    }
                    this.txCheckResult.timestamp = timestamp
                    clearTimeout(timerId);
                    resolve(this.handleMasterNodeResponse(this.txCheckResult, callback))
                }
            }.bind(this), 1000);
        })
    }
    handleMasterNodeResponse(result, callback = undefined){
        //Check to see if this is a successful transacation submission
        if (validateTypes.isStringWithValue(result.hash) && validateTypes.isStringWithValue(result.success)){
            this.txHash = result.hash;
            this.setPendingBlockInfo();
        }else{
            this.setBlockResultInfo(result)
            this.txBlockResult = result;
        }
        this.events.emit('response', result, this.resultInfo.subtitle);
        if (validateTypes.isFunction(callback)) callback(result)
        return result
    }
    setPendingBlockInfo(){
        this.resultInfo =  {
            title: 'Transaction Pending',
            subtitle: 'Your transaction was submitted and is being processed',
            message: `Tx Hash: ${this.txHash}`,
            type: 'success',
        }
        return this.resultInfo;
    }
    setBlockResultInfo(result){
        let erroredTx = false;
        let errorText = `returned an error and `
        let statusCode = validateTypes.isNumber(result.status) ? result.status : undefined
        let stamps = (result.stampsUsed || result.stamps_used) || 0;
        let message = '';
        if(validateTypes.isArrayWithValues(result.errors)){
            erroredTx = true;
            message = `This transaction returned ${result.errors.length} errors.`;
            if (result.result){
                if (result.result.includes('AssertionError')) result.errors.push(result.result)
            }
        }
        if (statusCode && erroredTx) errorText = `returned status code ${statusCode} and `
          
        this.resultInfo = {
            title: `Transaction ${erroredTx ? 'Failed' : 'Successful'}`,
            subtitle: `Your transaction ${erroredTx ? `${errorText} ` : ''}used ${stamps} stamps`,
            message,
            type: `${erroredTx ? 'error' : 'success'}`,
            errorInfo: erroredTx ? result.errors : undefined,
            returnResult: result.result || "",
            stampsUsed: stamps,
            statusCode
        };
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
            tx: this.tx,
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
