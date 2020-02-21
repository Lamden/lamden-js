const expect = require('expect.js');
const Lamden = require('../dist/bundle');
const validators = require('types-validate-assert')
const { validateTypes } = validators;
const { wallet } = Lamden;

function hexStringToByte(string = '') {
    let a = [];
    for (let i = 0, len = string.length; i < len; i += 2) {
        a.push(parseInt(string.substr(i, 2), 16));
    }
    return new Uint8Array(a);
}

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
            let message = hexStringToByte('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)
            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
        })
    })

    context('wallet.verify(): ', () => {
        it('can validate a correct signature', () => {
            let newWallet = wallet.new_wallet()
            let message = hexStringToByte('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)
            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
            expect( wallet.verify(newWallet.vk, message, signedMessage) ).to.be( true )
        })
        it('can validate an incorrect signature', () => {
            let newWallet = wallet.new_wallet()
            let newWallet2 = wallet.new_wallet()
            let message = hexStringToByte('this is a message')
            let signedMessage = wallet.sign(newWallet.sk, message)
            expect(validateTypes.isStringHex(signedMessage)).to.be(true)
            expect( wallet.verify(newWallet2.vk, message, signedMessage) ).to.be( false )
        })
    })
})
