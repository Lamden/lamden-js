#### constructor([arg]) 

Lamden Keystores

This Class will create a lamden keystore instance




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| arg | `Object`  | constructor argument | *Optional* |
| arg.key | `String`  | Create an instance and load it with one private key | *Optional* |
| arg.keyList | `String`  | Create an instance and load it with an array of private keys | *Optional* |
| arg.keystoreData | `String`  | Create an instance from an existing keystore file data | *Optional* |




##### Returns


- `Keystore`  



#### addKeys(keyList) 

Add a list of keys to add to the keystore




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| keyList | `Array.<String>`  | An array of 32 character long Lamden private keys | &nbsp; |




##### Returns


- `Void`



#### addKey(key) 

Add a key to the keystore




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| key | `string`  | A 32 character long Lamden private key | &nbsp; |




##### Returns


- `Void`



#### addKeystoreData(keystoreData) 

Load the keystore with the data from an existing keystore




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| keystoreData | `string`  | The contents of an existing encrypted keystore file | &nbsp; |




##### Returns


- `Void`



#### getPasswordHint([keystoreData]) 

Returns the password hint in a keystore file




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| keystoreData | `String`  | The contents of an existing encrypted keystore file if one wasn't supplied to the constructor | *Optional* |




##### Returns


- `Void`



#### clearKeys() 

Clears all keys from the keystore






##### Returns


- `Void`



#### wallets() 

Clears all keys from the keystore






##### Returns


- `Array.&lt;Object&gt;`  An array of wallet objects



#### getWallet(vk) 

Load the keystore with the data from an existing keystore




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| vk | `String`  | A 32 character long Lamden public key | &nbsp; |




##### Returns


- `Object`  A wallet object



#### validateKeyStore(keystoreData) 

Used to validate that a keystore is the proper Lamden Format (does not decrypt data)




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| keystoreData | `String`  | The contents of an existing encrypted keystore file | &nbsp; |




##### Returns


- `Boolean`  valid



#### createKeystore(password[, hint]) 

Create a Keystore text string from the keys contained in the Keystore instance




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| password | `String`  | A password to encrypt the data | &nbsp; |
| hint | `String`  | An optional password hint. Not stored in clear text (obsured) but not encrypted with the password. | *Optional* |




##### Returns


- `String`  A JSON stringified object containing the encrypted data



#### decryptKeystore(password[, keystoreData]) 

Decrypt a keystore into a useable array of wallets.  Any decrypted keys will be added to existing keys in the keystore.




##### Parameters

| Name | Type | Description |  |
| ---- | ---- | ----------- | -------- |
| password | `String`  | A password to encrypt the data | &nbsp; |
| keystoreData | `String`  | The encrypted contents from a keystore file if not passed into the constructor. | *Optional* |




##### Returns


- `Void`




*Documentation generated with [doxdox](https://github.com/neogeek/doxdox).*
