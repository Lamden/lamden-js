import validators from 'types-validate-assert'
const { validateTypes, assertTypes } = validators;
import * as helpers from './helpers';
import * as wallet from './wallet'

export class Keystore {
    /**
     * Lamden Keystores
     *
     * This Class will create a lamden keystore instance
     *
     * @param {Object|undefined} arg constructor argument
     * @param {String|undefined} arg.key Create an instance and load it with one private key
     * @param {String|undefined} arg.keyList Create an instance and load it with an array of private keys
     * @param {String|undefined} arg.keystoreData Create an instance from an existing keystore file data
     * @return {Keystore}
     */
    constructor(arg = undefined) {
        this.KEYSTORE_VERSION = "1.0"
        this.password = null
        this.encryptedData = null;

        this.keyList = (() => {
            let keyList = []
            let outerClass = this
            let wallets = []

            const addKey = (key) => {
                keyList.push(key)
                createWallets()
            }
            const deleteKey = (position) => {
                keyList.splice(position, 1);
                createWallets()
            }
            const clearKeys = () => {
                keyList = []
                createWallets()
            }
            const numOfKeys = () => keyList.length
            const createWallets = () => {
                wallets = []
                keyList.forEach(keyInfo => {
                    let newWallet = wallet.create_wallet({sk: keyInfo.sk, keepPrivate: true})
                    newWallet = {...newWallet, ...keyInfo}
                    delete newWallet.sk
                    wallets.push(newWallet)
                })
            }
            const createKeystore = (password, hint = undefined) => {
                return JSON.stringify({
                    data: helpers.encryptObject(password, {version: outerClass.KEYSTORE_VERSION, keyList}),
                    w: !hint ? "" : helpers.encryptStrHash('n1ahcKc0lb', hint),
                });
            }
            const decryptKeystore = (password, data) => {
                let decrypted = helpers.decryptObject(password, data)
                if (decrypted) {
                    assertTypes.isArray(decrypted.keyList)
                    decrypted.keyList.forEach(keyInfo => assertTypes.isStringWithValue(keyInfo.sk))
                    decrypted.keyList.forEach(keyInfo => addKey(keyInfo))
                    outerClass.version = decrypted.version
                } else {
                    throw new Error("Incorrect Keystore Password.")
                }
            }

            return {
                getWallets: () => wallets,
                getWallet: (vk) => wallets.find(wallet => wallet.vk === vk),
                addKey, 
                clearKeys, 
                numOfKeys,
                deleteKey,
                createKeystore,
                decryptKeystore
            }
        })()

        if (arg){
            if (arg.key) this.addKey(arg.key)
            if (arg.keyList) this.addKeys(arg.keyList)
            if (arg.keystoreData) this.addKeystoreData(arg.keystoreData)
        }
    }
    /**
     * Add a list of keys to add to the keystore
     * @param {Array.<String>} keyList An array of 32 character long Lamden private keys
     */
    addKeys(keyList){
        assertTypes.isArray(keyList)
        keyList.forEach(key => this.addKey(key))
    }
    /**
     * Add a key to the keystore
     * @param {string} key A 32 character long Lamden private key
     */
    addKey(keyInfo){
        assertTypes.isObjectWithKeys(keyInfo)
        assertTypes.isStringWithValue(keyInfo.sk)
        if (validateTypes.isStringWithValue(keyInfo.vk)) delete keyInfo.vk
        this.keyList.addKey(keyInfo)
    }
    /**
     * Load the keystore with the data from an existing keystore
     * @param {string} keystoreData The contents of an existing encrypted keystore file
     */
    addKeystoreData(keystoreData){
        if (validateTypes.isString(keystoreData)) keystoreData = JSON.parse(keystoreData)
        if(this.validateKeyStore(keystoreData)){
            this.encryptedData = keystoreData
        }
    }
    /**
     * Returns the password hint in a keystore file
     * @param {String|undefined} keystoreData The contents of an existing encrypted keystore file if one wasn't supplied to the constructor
     */
    getPasswordHint(keystoreData = undefined){
        if (!this.encryptedData && !keystoreData) throw new Error("No keystore data found.")

        if (keystoreData)  {
            if (validateTypes.isString(keystoreData))  keystoreData = JSON.parse(keystoreData)
        }
        else keystoreData = this.encryptedData

        if (keystoreData.w) return helpers.decryptStrHash('n1ahcKc0lb', keystoreData.w);
        else return ""
    }
    /**
     * Removes a specific key from the keyList
     * @param {Number} keyIndex The index of the key you want to remove
     */
    deleteKey(keyIndex){
        assertTypes.isInteger(keyIndex)
        if (this.keyList.numOfKeys() === 0) return
        if (keyIndex < 0 || keyIndex >= this.keyList.numOfKeys()) throw new Error("Key index out of range.")
        this.keyList.deleteKey(keyIndex)
    }
    /**
     * Clears all keys from the keystore
     */
    clearKeys(){
        this.keyList.clearKeys()
    }
    /**
     * Clears all keys from the keystore
     * @return {Array.<Object>} An array of wallet objects
     */
    get wallets() {
        return this.keyList.getWallets()
    }
    /**
     * Load the keystore with the data from an existing keystore
     * @param {String} vk A 32 character long Lamden public key
     * @return {Object} A wallet object
     */
    getWallet(vk) {
        return this.keyList.getWallet(vk)
    }
    /**
     * Used to validate that a keystore is the proper Lamden Format (does not decrypt data)
     * @param {String} keystoreData The contents of an existing encrypted keystore file
     * @return {Boolean} valid
     * @throws {Error} This is not a valid keystore file.
     */
    validateKeyStore(keystoreData){
        assertTypes.isObjectWithKeys(keystoreData)
        try{
            let encryptedData = JSON.parse(keystoreData.data);
             if (!encryptedData.ct || !encryptedData.iv || !encryptedData.s){
                throw new Error("This is not a valid keystore file.")
            }
        } catch (e) {
            throw new Error("This is not a valid keystore file.")
        }
        return true;
    }
    /**
     * Create a Keystore text string from the keys contained in the Keystore instance
     * @param {String} password A password to encrypt the data
     * @param {String|undefined} hint An optional password hint. Not stored in clear text (obsured) but not encrypted with the password.
     * @return {String} A JSON stringified object containing the encrypted data
     * @throws {Error} Any errors from the encyption process
     */
    createKeystore(password, hint = undefined) {
        assertTypes.isStringWithValue(password)
        if (hint){
            assertTypes.isStringWithValue(hint)
        }
        return this.keyList.createKeystore(password, hint)
    }
    /**
     * Decrypt a keystore into a useable array of wallets.  Any decrypted keys will be added to existing keys in the keystore.
     * @param {String} password A password to encrypt the data
     * @param {String|undefined} keystoreData The encrypted contents from a keystore file if not passed into the constructor.
     * @throws {Error} Any errors from the encyption process
     */
    decryptKeystore(password, keystoreData = undefined){
        if (keystoreData) this.addKeystoreData(keystoreData)
        if (!this.encryptedData) throw new Error ("No keystoreData to decrypt.")
        try{
            this.keyList.decryptKeystore(password, this.encryptedData.data)
        }catch (e){
            throw new Error("Incorrect Keystore Password.")
        }
    }
}
