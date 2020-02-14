# lamden-js
This is the Lamden ES6 javascript implementation used in the [Lamden Wallet Chrome Extention](https://chrome.google.com/webstore/detail/lamden-wallet-browser-ext/lgkgmnhecgdjiifepobmobkeeeheakko) ([Github](https://github.com/Lamden/wallet)).
This can be used to create Lamden Wallets and Transactions with the caveat that if you are implementing this in a webpage then you will need to work around CORS issues for both getting Nonces and Sending Transactions.

Vaild transactions can be sent from the broswer but the response will be blocked by CORS.

TODO: Probably need to complie this down to CommonJS to be compatible with Node.js.
TODO: Tests

# Transpiling Capt'Proto Schemas to Javascript files (only for schema changes)
This step only needs to be run if there are changes to the capnp schema files.

Copy new files to src/capnp/original/
Install  [Capt'Proto](https://capnproto.org/install.html)
add/overwrite capnp files in src/capnp/original then run the below command
``` 
capnpc -o js src/capnp/original/* && mv src/capnp/original/*.js src/capnp/js/
```

# Install

```
npm install lamden-js
```


# Usage
## import lamden-js

```
import Lamden from 'lamden-js'
```

## Create a Lamden Keypair

```
let lamdenWallet = Lamden.wallet.new_wallet()

console.log(lamdenWallet)
```
```
{
    vk: "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298",
    sk: "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"
}
```

## Get a public key (vk) from a private key (sk)

```
let sk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"

let vk = wallet.get_vk(sk)

console.log(vk)
```
```
ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298
```

## Sign a message
```
let messageBytes = new Uint8Array('message');
let sk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"

let signedMessage = wallet.sign(sk, messageBytes)

console.log(signedMessage)
```
```
982c204fe88e620f3319558aa6b11f9d8be75b99b3199f434f5edf2834a9c52059ba4ea3d623ac1d550170e532e919c364aad1333f757f8f22e0355cb1dd8c09
```

## Verify signature

```
let vk = "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298"
let messageBytes = new Uint8Array('message');
let signedMessage = "982c204fe88e620f3319558aa6b11f9d8be75b99b3199f434f5edf2834a9c52059ba4ea3d623ac1d550170e532e919c364aad1333f757f8f22e0355cb1dd8c09"

let validSignature = wallet.verify(vk, messageBytes, signedMessage)

console.log(validSignature)

```
```
true
```

## Create a Lamden Transaction
Testnet host is https://testnet.lamden.io:443
** Change this to a local testnet (mockchain) instance if you have one running

### KWARGS (method arguments)
kwarg object is just a regular JavaScript object which you will use to feed the arguments to contract method you are calling.

For example the "transfer" method on the "currency" contract takes two arguments "to" and "amount".

```
let kwargs = {
    to: receiver_public_key,
    amount: 1000
}
```

## Create a Lamden Transaction
```
let network = "https://testnet.lamden.io:443"
let sender = "ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298"
let receiver = "bb0fab41b9118f0afdabf3721fa9a6caae3c93845ed409d3118841065ad1a197"
let contract = "currency"
let method = "transfer"

let kwargs = {
    to: receiver_public_key,
    amount: 1000
}

let stampLimit = 50000
let nonce = "37"
let processor = "0000000000000000000000000000000000000000000000000000000000000000"


let txb = new TransactionBuilder(network, sender, contract, method, kwargs, stampLimit, nonce, processor)
```

## Send a Lamden Transaction
```
let sk = "69a8db3fb7196debc2711fad1fa1935918d09f5d8900d84c3288ea5237611c03"

txb.send(sk, (res, err) =>{
    if (err) throw new Error(err)
    console.log(res)
})
```

Returns the NEW changed state in the currency contract for whatever variables the transfer method effected.  In this case, the balances of both keys (sender -10000 and receiver +10000)
```
{
    state_changes: {
        "currency:balances:ea2cee33f9478d767d67afe345592ef36446ee04f8d588fa76942e6569a53298": "50000.0"
        "currency:balances:bb0fab41b9118f0afdabf3721fa9a6caae3c93845ed409d3118841065ad1a197": "10000.0"
    }
    status_code: 0
    result: null
    stamps_used: 13924
}
```
*** If CORS is an issue then you will not get a response back, but your transaction will go through if valid.

## Getting a Nonce and Processor
Nonces can be set via the TransactionBuilder object directly, if CORS is not an issue.
getNonce() should always be called before send()
```
let txb = new TransactionBuilder(network, sender, contract, method, kwargs, stampLimit)

txb.getNonce((res, err) => {
    if (err) console.log("Not Set")
    console.log("Nonce and Processor Set")
})
```

If CORS is an issue (ie. you are running this from a broswer) then "getNonce" will not work.  
You will need an alternative way (CORS Proxy) to get the nonce from the network API endpoint.

NONCE API ENDPOINT
```
http:<network IP>:<network PORT>/nonce/<your vk>
```
Example
[http://167.71.159.131:8000/nonce/fe417cb73cf7caf406edd7da38ecd6a115228c00ac9cc1b87491eef2a8dd6a6d](http://167.71.159.131:8000/nonce/fe417cb73cf7caf406edd7da38ecd6a115228c00ac9cc1b87491eef2a8dd6a6d)
```
{
    "nonce": 37,
    "processor": "0000000000000000000000000000000000000000000000000000000000000000",
    "sender": "fe417cb73cf7caf406edd7da38ecd6a115228c00ac9cc1b87491eef2a8dd6a6d"
}
```
