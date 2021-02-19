const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const validators = require('types-validate-assert')
const { validateTypes, assertTypes } = validators;
const { wallet } = Lamden;

describe('Test Lamden Wallet methods', () => {

    context('wallet.new_wallet(): ', () => {
        it('creates a lamden keypair', () => {
            let newWallet = wallet.new_wallet()

            expect( validateTypes.isStringHex(newWallet.vk) ).to.be( true )
            expect( newWallet.vk.length ).to.be( 64 )
            expect( validateTypes.isStringHex(newWallet.sk) ).to.be( true )
            expect( newWallet.sk.length ).to.be( 64 )
        })
    })
    context('wallet.get_vk(): ', () => {
        it('can create a vk from an sk', () => {
            let newWallet = wallet.new_wallet()

            expect( wallet.get_vk(newWallet.sk) ).to.be( newWallet.vk )
        })
    })
    context('wallet.sign(): ', () => {
        it('can sign a message', () => {
            let newWallet = wallet.new_wallet()
            let message = new Uint8Array('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)

            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
        })
    })

    context('wallet.verify(): ', () => {
        it('can validate a correct signature', () => {
            let newWallet = wallet.new_wallet()
            let message = new Uint8Array('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)

            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
            expect( wallet.verify(newWallet.vk, message, signedMessage) ).to.be( true )
        })
        it('can validate an incorrect signature', () => {
            let newWallet = wallet.new_wallet()
            let newWallet2 = wallet.new_wallet()
            let message = new Uint8Array('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)

            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
            expect( wallet.verify(newWallet2.vk, message, signedMessage) ).to.be( false )
        })
    })

    context('wallet.create_wallet(): ', () => {
        it('can create a new wallet object', () => {
            let newWallet = wallet.create_wallet()
            expect(newWallet).to.have.property('sign')
            expect(newWallet).to.have.property('verify')
            expect(newWallet).to.have.property('vk')
            expect(newWallet).to.have.property('sk')
            assertTypes.isStringHex(newWallet.vk)
            assertTypes.isStringHex(newWallet.sk)
        })
        it('can create a new wallet from a private key', () => {
            let keypair = wallet.new_wallet()
            let newWallet = wallet.create_wallet({sk: keypair.sk})
            expect(newWallet).to.have.property('sign')
            expect(newWallet).to.have.property('verify')
            expect(newWallet).to.have.property('vk')
            expect(newWallet).to.have.property('sk')
            assertTypes.isStringHex(newWallet.vk)
            assertTypes.isStringHex(newWallet.sk)
        })
        it('secret key is not accessible is set to private', () => {
            let newWallet = wallet.create_wallet({keepPrivate: true})
            expect(() => assertTypes.isStringHex(newWallet.sk)).throwException();
        })
        it('wallet object can sign messages', () => {
            let newWallet = wallet.create_wallet({keepPrivate: true})
            let message = new Uint8Array('this is a message')
            let signedMessage = newWallet.sign(message)
            expect( wallet.verify(newWallet.vk, message, signedMessage) ).to.be( true )
        })
        it('wallet object can verify a messages', () => {
            let newWallet = wallet.create_wallet({keepPrivate: true})
            let message = new Uint8Array('this is a message')
            let signedMessage = newWallet.sign(message)
            expect( newWallet.verify(message, signedMessage) ).to.be( true )
        })
    })
})
