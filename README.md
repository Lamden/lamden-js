# lamden-js
This is the Lamden javascript implementation used in the [Lamden Wallet Chrome Extention](https://chrome.google.com/webstore/detail/lamden-wallet-browser-ext/lgkgmnhecgdjiifepobmobkeeeheakko) ([Github](https://github.com/Lamden/wallet)).

This package should work in Node.js and Browser implementations.

## Install

```javascript
npm install lamden-js
```

## Test
```javascript
npm run tests
```

## Add to project

```javascript
import Lamden from 'lamden-js'
or
const Lamden = require('lamden-js')
```

## Wallet Functions
### Create a Lamden Keypair
Creates a new wallet object.
- **verifying key (vk)**: public key
- **secret key (sk)**: private key
```javascript
let lamdenWallet = Lamden.wallet.new_wallet()

console.log(lamdenWallet)
>> {
       vk: "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298",
       sk: "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"
   }
```

### Get a public key (vk) from a private key (sk)
Takes the sk as an argument and returns the vk
```javascript
let sk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"
let vk = wallet.get_vk(sk)

console.log(vk)
>> 'ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298'
```

### Sign a message
Signs a string payload
```javascript
const stringBuffer = Buffer.from('message')
let messageBytes = new Uint8Array(stringBuffer);
let sk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"

let signedMessage = wallet.sign(sk, messageBytes)

console.log(signedMessage)
>> '982c204fe88e620f3319558aa6b11f9d8be75b99b3199f434f5edf2834a9c52059ba4ea3d623ac1d550170e532e919c364aad1333f757f8f22e0355cb1dd8c09'
```

#### Verify signature
verify a payload
```javascript
let validSignature = wallet.verify(vk, messageBytes, signedMessage)

console.log(validSignature)
>> true
```

## Create a Lamden Transaction
Public Testnet masternode is http://167.172.126.5:18080

## Create a Lamden Transaction
Use Lamden.TransactionBuilder(networkInfo, txInfo) to create a new Lamden transaction.

### Create networkInfo object
create an object that describes the masternode/network that you are going to send the transcation to.
```javascript
let networkInfo = {
    // Optional: Name of network
    name: 'Lamden Public Testnet',

    // Required: type of network 'mockchain', 'testnet', 'mainnet'
    type: 'testnet',

    // Required: must begin with http or https
    hosts: ['https://testnet-master-1.lamden.io:443']
}
```
### Create txInfo object
create an object that describes the transaction you are going to send
```javascript
//Sender and Receiver public keys
let senderVk = "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298"
let receiverVk = "bb0fab41b9118f0afdabf3721fa9a6caae3c93845ed409d3118841065ad1a197"

// Kwargs are the arugments you will send the contract method.  
// For example the "currency" contract's "transfer" method needs two arguments to create a transfter; the person reciving the TAU and the amount to transfer.  So we create a kwargs object like so.
let kwargs: {
        to: receiverVk,
        amount: 1000
}

let txInfo = {
    senderVk,
    contractName: "currency",
    methodName: "transfer",
    kwargs,
    stampLimit: 50000, //Max stamps to be used. Could use less, won't use more.
}
```

### Create transaction
```javascript
let tx = new Lamden.TransactionBuilder(networkInfo, txInfo)
```

### Send transaction
```javascript
let senderSk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"

tx.send(senderSk, (res, err) => {
    if (err) throw new Error(err)
    console.log(res.hash)
    tx.checkForTransactionResult()
    .then(res => console.log(res))
})

//or

tx.events.on('response', (response) => {
    if (tx.resultInfo.type === 'error') return
    console.log(response)
})
tx.send(senderSk).then(() => tx.checkForTransactionResult())

```

Returns the NEW changed state in the currency contract for whatever variables the transfer method effected.  
In this case, the <b>*new*</b> balances for both keys is returned
```javascript
{
    state_changes: {
        "currency:balances:ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298": "4895.0" // -1005 (amount + stamps)
        "currency:balances:bb0fab41b9118f0afdabf3721fa9a6caae3c93845ed409d3118841065ad1a197": "1000.0" // +1000
    }
    status_code: 0
    stamps_used: 13924
}
```

## Getting a Nonce and Processor
Note: Nonce and processor will be retrieved from the masternode automatcially when send() is called.

getNonce() can be used to set the nonce and processor before hand.
```javascript
let tx = new Lamden.TransactionBuilder(networkInfo, TxInfo)

tx.getNonce((res, err) => {
    if (err) {
        console.log("Nonce Not Set")
        return
    }
    console.log(res)
})

>> {
       "nonce": 37,
       "processor": "0000000000000000000000000000000000000000000000000000000000000000",
       "sender": "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298"
   }
```

## Network and API
Create a network instance will allow you to call the masternode API.  This class takes a "networkInfo" object as described above.

### Create new Network instance
```javascript
let testnet = new Network({
    name: 'Lamden Public Testnet',
    type: 'testnet',
    hosts: ['https://testnet-master-1.lamden.io:443']
})

testnet.events.on('online', (online) => {
    console.log(online)
    >> true or false
})
testnet.ping()
```
### Netowrk API Endpoints
All API methods return a value, Promise or callback if provided

| method   |      masternode endpoint      |  Description |
|:----------|:-------------:|:------:|
| getContractInfo(contractName)  |  /contracts/*contractName* | Returns the contract code of *contractName* <br> [example](https://testnet.lamden.io/contracts/currency/) |
| getVariable(contractName, variableName, parms) |    /contracts/*contractName*/*variableName*?key=*parm*   |   Retrieve the current state of a contract variable <br> [example](https://testnet.lamden.io/contracts/currency/balances?key=7497cfd946eb332f66fe096d6473aa869cdc3836f1c7ac3630cea68e78228e3e) |
| getContractMethods(contractName) | /contracts/*contractName*/methods |    Returns all methods belonging to *contractName* <br> [example](https://testnet.lamden.io/contracts/currency/methods) |
| pingServer() | /ping | Checks if network is online <br> [example](https://testnet.lamden.io/ping) |
| getCurrencyBalance(vk) | /contracts/currency/balances | A wrapper method for getVariable() which always returns the result of the currency contract's balances?key=*vk* <br> [example](https://testnet.lamden.io/contracts/currency/balances?key=7497cfd946eb332f66fe096d6473aa869cdc3836f1c7ac3630cea68e78228e3e)  |
| contractExists(contractName) | /contracts/*contractName*  | a wrapper method for getContractInfo() which returns if a contract exists on the blockchain |
| sendTransaction(txData, *callback*) | / | submits a contract to the network a txHash will be returned.  Use checkTransaction() to get tx result |
| getNonce(senderVk, *callback*) | /nonce/*senderVk* |    Get the current *nonce* and *processor* for a public key (vk) |
| checkTransaction(txHash, callback) | /tx?hash=*txHash* | Get the result of a transaction |
