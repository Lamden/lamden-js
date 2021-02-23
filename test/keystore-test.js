const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const validators = require('types-validate-assert')
const { validateTypes, assertTypes } = validators;
const { wallet } = Lamden;

const KEYSTORE_PASSWORD = "Testing010203"
const KEYSTORE_HINT = "Testing010203"

// Overwritted in "createKeystore() - Can create a keystore"
let KEYSTORE_DATA = {
    data: '{"ct":"s6M4AvQvklttEyGq5ebPj/PzAmjNtV6wlS9X8L0RCoZiaqyOz0Y80eZbdf1WRv7gm4Y9aN4vPEoU4oNVVbXoT7QYhuaxMZ+XUyPihcOOnxxmMMGckWD9QOROSgLovvm5yZxp6C2G47dWp7QLkJvubuPgZ+Ws0uexLnkvxXnCikwdZ20yUAFwGN+u3RhQvmgFagCLeuViFXSOtfkDRXmzX4k/7P6cWet8j5rn5gCBbOYHq8rFOxc34ihdhE/8N+x+3MyxGYk2QmwyfzTE9jDEXZwWRlz4GtMXi29ZccRi0z2XEeB7yBl1LTLvngpQM2QnCcX0AQNjHqlPb30bZtQD5shwzgNiRKRon41tKBAH7uvTjw6N39DVIABUkQCusQ1dWWkuvkt79kPjKI/oRF3RH101kXbejFLfDy0eXNUcV3U=","iv":"14e2a23a66fae00bb201f013e9ae1699","s":"5f4b1877b9d4235e"}',
    w: 'U2FsdGVkX19RU+1vmxcY5wDfbkn1Gq8zOsh9Y4ylvSs='
}

const keyPairs = [wallet.new_wallet(), wallet.new_wallet()]
const keyList = [
    {
        sk: keyPairs[0].sk, 
        nickname: "key1",
        name: "lamden",
        network: "lamden",
        symbol: "TAU"
    },
    {
        sk: keyPairs[1].sk, 
        nickname: "key2",
        name: "lamden",
        network: "lamden",
        symbol: "TAU"
    }

]

describe('Test Lamden Keystore Class', () => {
    context('keystore construcutor: ', () => {
        it('creates an instance with no constructor arguments', () => {
            let keystore = new Lamden.Keystore()
            assertTypes.isSpecificClass(keystore, "Keystore")
            expect( keystore.keyList.numOfKeys() ).to.be( 0 )
            expect( keystore.keyList.getWallets().length ).to.be( 0 )
        })
        it('creates an instance by passing a string to the key property', () => {
            let keystore = new Lamden.Keystore({key:keyList[0]})
            assertTypes.isSpecificClass(keystore, "Keystore")
            expect( keystore.keyList.numOfKeys() ).to.be( 1 )
            expect( keystore.keyList.getWallets().length ).to.be( 1 )
        })
        it('creates an instance by passing an array to the keys property', () => {
            let keystore = new Lamden.Keystore({keyList})
            assertTypes.isSpecificClass(keystore, "Keystore")
            expect( keystore.keyList.numOfKeys() ).to.be( 2 )
            expect( keystore.keyList.getWallets().length ).to.be( 2 )
        })
        it('creates an instance by passing a keystoreData object', () => {
            let keystore = new Lamden.Keystore({keystoreData: KEYSTORE_DATA})
            assertTypes.isSpecificClass(keystore, "Keystore")
            assertTypes.isObjectWithKeys(keystore.encryptedData)
        })
        it('creates an instance by passing a keystoreData string', () => {
            let keystore = new Lamden.Keystore({keystoreData: JSON.stringify(KEYSTORE_DATA)})
            assertTypes.isSpecificClass(keystore, "Keystore")
            assertTypes.isObjectWithKeys(keystore.encryptedData)
        })
        it('NEGATIVE - Errors on "keyArg" not Array', () => {
            expect(() => new Lamden.Keystore({keyList: {key1: "key1"}})).throwException();
        })
        it('NEGATIVE - Errors on if array value is not type string', () => {
            expect(() => new Lamden.Keystore({keyList: [keyList[0], 2]}))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "2" to be [object Object] and have keys');
                });
        })
    })
    context('Adding Keys to the Keystore', () => {
        it('addKey() - Can add a single key to the internal "keyList"', () => {
            let keystore = new Lamden.Keystore()
            keystore.addKey(keyList[0])
            expect( keystore.keyList.numOfKeys() ).to.be( 1 )
        })
        it('NEGATIVE - addKey() - Errors if value passed is not type string', () => {
            let keystore = new Lamden.Keystore()
            expect(() => keystore.addKey(1))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "1" to be [object Object] and have keys');
                });
        })
        it('addKeys() - Can add to the internal "keyList" via an array of keys', () => {
            let keystore = new Lamden.Keystore()
            keystore.addKeys(keyList)
            expect( keystore.keyList.numOfKeys() ).to.be( 2 )
        })
        it('addKeys() - Wallets contain metadata', () => {
            let keystore = new Lamden.Keystore()
            keystore.addKeys(keyList)
            keystore.wallets.forEach((walletInfo, index) => {
                expect(walletInfo.name ).to.be( keyList[index].name )
                expect(walletInfo.nickname ).to.be( keyList[index].nickname )
                expect(walletInfo.network ).to.be( keyList[index].network )
                expect(walletInfo.symbol ).to.be( keyList[index].symbol )
            })
            
        })
        it('NEGATIVE - addKeys() - Errors if value passed is not type array', () => {
            let keystore = new Lamden.Keystore()
            expect(() => keystore.addKeys({key1: "key1", key2: "key2"}))
                .throwException((e) => { 
                    expect(e.message).to.be("Expected type [object Array] but got [object Object]");
                });
        })
    })
    context('Deleting Keys from the Keystore', () => {
        it('deleteKey() - Can delete a key from the keystore', () => {
            let keystore = new Lamden.Keystore({keyList})
            keystore.deleteKey(0)
            expect( keystore.wallets[0].vk ).to.be( keyPairs[1].vk )
        })
        it('NEGATIVE - deleteKey() - Errors if argument is not an integer', () => {
            let keystore = new Lamden.Keystore({keyList})
            
            expect(() => keystore.deleteKey(0.3))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "0.3" to be an integer but got non-integer value');
                });
        })
        it('NEGATIVE - deleteKey() - Errors if index is out of range, high', () => {
            let keystore = new Lamden.Keystore({keyList})
            expect(() => keystore.deleteKey(2))
                .throwException((e) => { 
                    expect(e.message).to.be("Key index out of range.");
                });
        })
        it('NEGATIVE - deleteKey() - Errors if index is out of range, low', () => {
            let keystore = new Lamden.Keystore({keyList})
            expect(() => keystore.deleteKey(-1))
                .throwException((e) => { 
                    expect(e.message).to.be("Key index out of range.");
                });
        })
        it('NEGATIVE - deleteKey() - Funtion returns no keys in list', () => {
            let keystore = new Lamden.Keystore()
            keystore.deleteKey(0)
        })
    })
    context('Using keystore wallets', () => {
        it('keystore.wallets - Deletes keys from the keystore', () => {
            let keystore = new Lamden.Keystore({keyList})
            expect( keystore.wallets.length ).to.be( 2 )
        })
        it('getWallet() - Can get a specific wallet', () => {
            let keystore = new Lamden.Keystore({keyList})
            let keystoreWallet =  keystore.getWallet(keystore.wallets[0].vk)
            expect(keystoreWallet).to.have.property('sign')
            expect(keystoreWallet).to.have.property('verify')
            expect(keystoreWallet).to.have.property('vk')
            expect(() => assertTypes.isStringHex(keystoreWallet.sk)).throwException();
        })
    })
    context('Clearing a keystore', () => {
        it('clearKeys() - Deletes keys from the keystore', () => {
            let keystore = new Lamden.Keystore()
            keystore.addKey(keyList[0])
            expect( keystore.keyList.numOfKeys() ).to.be( 1 )
            keystore.clearKeys()
            expect( keystore.keyList.numOfKeys() ).to.be( 0 )
        })
    })
    context('Creating a Keystore', () => {
        it('createKeystore() - Can create a keystore', () => {
            let keystore = new Lamden.Keystore({keyList})
            let encryptedKeystore = keystore.createKeystore(KEYSTORE_PASSWORD, KEYSTORE_HINT)
            let keystoreObj = JSON.parse(encryptedKeystore)
            KEYSTORE_DATA = JSON.parse(encryptedKeystore)
            expect(keystoreObj).to.have.property('data')
            assertTypes.isStringWithValue(keystoreObj.data)
            expect(keystoreObj).to.have.property('w')
            assertTypes.isStringWithValue(keystoreObj.w)
        })
        it('createKeystore() - Can create a keystore without "hint"', () => {
            let keystore = new Lamden.Keystore({keyList})
            let encryptedKeystore = keystore.createKeystore(KEYSTORE_PASSWORD)
            let keystoreObj = JSON.parse(encryptedKeystore)

            expect(keystoreObj).to.have.property('data')
            assertTypes.isStringWithValue(keystoreObj.data)

            expect(keystoreObj).to.have.property('w')
            assertTypes.isString(keystoreObj.w)

            expect(() => assertTypes.isStringWithValue(keystoreObj.w))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "" to be [object String] and not empty');
                });
            
        })
        it('NEGATIVE - createKeystore() - Errors if "password" value passed is not type string', () => {
            let keystore = new Lamden.Keystore({keyList})
            expect(() => keystore.createKeystore(12345))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "12345" to be [object String] and not empty');
                });
        })
        it('NEGATIVE - createKeystore() - Errors if a non-string value for "hint" is provided', () => {
            let keystore = new Lamden.Keystore({keyList})
            expect(() => keystore.createKeystore(KEYSTORE_PASSWORD, 12345))
                .throwException((e) => { 
                    expect(e.message).to.be('Expected "12345" to be [object String] and not empty');
                });
        })
    })

    context('Keystore password hints', () => {
        it('getPasswordHint() - Can get the hint from the keystore instance', () => {
            let keystore = new Lamden.Keystore({keystoreData: KEYSTORE_DATA})
            let hint = keystore.getPasswordHint()
            expect( hint ).to.be( KEYSTORE_HINT )
        })
        it('getPasswordHint() - Can get the hint from a supplied keystore', () => {
            let keystore = new Lamden.Keystore()
            let hint = keystore.getPasswordHint(KEYSTORE_DATA)
            expect( hint ).to.be( KEYSTORE_HINT )
        })
        it('getPasswordHint() - Can get the hint from a supplied string keystore', () => {
            let keystore = new Lamden.Keystore()
            let hint = keystore.getPasswordHint(JSON.stringify(KEYSTORE_DATA))
            expect( hint ).to.be( KEYSTORE_HINT )
        })
    })
    context('Decrypting a Keystore', () => {
        it('decryptKeystore() - Can decrypte a keystore', () => {
            let keystore = new Lamden.Keystore({keystoreData: KEYSTORE_DATA})
            keystore.decryptKeystore(KEYSTORE_PASSWORD)
            expect( keystore.keyList.numOfKeys() ).to.be( 2 )
            expect( keystore.version ).to.be( "1.0" )
        })
        it('decryptKeystore() - Can decrypte a keystore passed as a string', () => {
            let keystore = new Lamden.Keystore({keystoreData: JSON.stringify(KEYSTORE_DATA)})
            keystore.decryptKeystore(KEYSTORE_PASSWORD)
            expect( keystore.keyList.numOfKeys() ).to.be( 2 )
            expect( keystore.version ).to.be( "1.0" )
        })
        it('decryptKeystore() - Can decrypt a provided keystore', () => {
            let keystore = new Lamden.Keystore()
            keystore.decryptKeystore(KEYSTORE_PASSWORD, KEYSTORE_DATA)
            expect( keystore.keyList.numOfKeys() ).to.be( 2 )
            expect( keystore.version ).to.be( "1.0" )
        })
        it('NEGATIVE - decryptKeystore() - Reports Incorrect Password', () => {
            let keystore = new Lamden.Keystore()
            expect(() => keystore.decryptKeystore("Nope", KEYSTORE_DATA))
            .throwException((e) => { 
                expect(e.message).to.be('Incorrect Keystore Password.');
            });
        })
        it('NEGATIVE - decryptKeystore() - Errors if no keystoreData found', () => {
            let keystore = new Lamden.Keystore()
            expect(() => keystore.decryptKeystore(KEYSTORE_PASSWORD))
            .throwException((e) => { 
                expect(e.message).to.be('No keystoreData to decrypt.');
            });
        })
    })

})
