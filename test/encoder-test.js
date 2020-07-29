const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const validators = require('types-validate-assert')
const { validateTypes } = validators;
const { Encoder } = Lamden;

const dateString = "2020-07-28T19:16:35.059Z"
const millisecondsDelta = 475200000

describe('Test Type Encoder', () => {
    context('TYPES', () => {
        it('Encoder rejects unknown TYPE', () => {
            expect(() => Encoder('nope', {})).to.throwError();
        })
    })

    context('Strings', () => {
        it('encodes a string from a string', () => {
            expect( Encoder('str', 'string') ).to.be( 'string' )
        })
        it('encodes a number as a string', () => {
            expect( Encoder('str', 1) ).to.be( '1' )
        })
        it('encodes a boolean as a string', () => {
            expect( Encoder('str', true) ).to.be( 'true' )
        })
        it('encodes a Date as a string', () => {
            expect( Encoder('str', new Date(dateString)) ).to.be( '2020-07-28T19:16:35.059Z' )
        })
        it('encodes a Dict as a string', () => {
            expect( Encoder('str', {}) ).to.be( '{}' )
        })
        it('encodes a List as a string', () => {
            expect( Encoder('str', []) ).to.be( '[]' )
        })
    })

    context('Integers', () => {
        it('encodes a integer from an integer', () => {
            expect( Encoder('int', 1) ).to.be( 1 )
        })
        it('encodes a integer from a float', () => {
            expect( Encoder('int', 1.5 ) ).to.be( 1 )
        })
        it('encodes a integer from a string', () => {
            expect( Encoder('int', '1.5' ) ).to.be( 1 )
        })
        it('fails to encode non-integer values', () => {
            expect(() => Encoder('int', true)).to.throwError();
        })
    })
    context('Floats', () => {
        it('encodes a float from an float', () => {
            expect( Encoder('float', 1.5) ).to.be( 1.5 )
        })
        it('encodes a float from a integer', () => {
            expect( Encoder('float', 1 ) ).to.be( 1.0 )
        })
        it('encodes a integer from a string', () => {
            expect( Encoder('float', '1.5' ) ).to.be( 1.5 )
        })
        it('fails to encode non-float values', () => {
            expect(() => Encoder('float', true)).to.throwError();
        })
    })
    context('Boolean', () => {
        it('encodes a boolean from a boolean', () => {
            expect( Encoder('bool', true) ).to.be( true )
            expect( Encoder('bool', false) ).to.be( false )
        })
        it('encodes a boolean from a number', () => {
            expect( Encoder('bool', 1 ) ).to.be( true )
            expect( Encoder('bool', 0 ) ).to.be( false )
        })
        it('encodes a boolean from a string', () => {
            expect( Encoder('bool', 'true' ) ).to.be( true )
            expect( Encoder('bool', 'false' ) ).to.be( false )
        })
        it('fails to encode non-boolean values', () => {
            expect(() => Encoder('bool', 'nope')).to.throwError();
            expect(() => Encoder('bool', 2)).to.throwError();
            expect(() => Encoder('bool', {})).to.throwError();
        })
    })
    context('Dict Object', () => {
        it('encodes a dict from an Object', () => {
            expect( JSON.stringify(Encoder('dict', {})) ).to.be( JSON.stringify({}) )
        })
        it('encodes a boolean from a string', () => {
            expect( JSON.stringify(Encoder('dict', '{}')) ).to.be( JSON.stringify({}) )
        })
        it('fails to encode non-objects', () => {
            expect(() => Encoder('dict', undefined)).to.throwError();
        })
    })

    context('List Object', () => {
        it('encodes a list from a list', () => {
            expect( JSON.stringify(Encoder('list', [])) ).to.be( JSON.stringify([]) )
        })
        it('encodes a list from a string', () => {
            expect( JSON.stringify(Encoder('list', '[]')) ).to.be( JSON.stringify([]) )
        })
        it('fails to encode non-list', () => {
            expect(() => Encoder('list', {})).to.throwError();
        })
    })

    context('Any Object', () => {
        it('Any does not do any encoding', () => {
            expect( Encoder('Any', 'string') ).to.be( 'string' )
            expect( Encoder('Any', 1) ).to.be( 1 )
            expect( Encoder('Any', 1.23456) ).to.be( 1.23456 )
            expect( Encoder('Any', true) ).to.be( true )
            expect( Encoder('Any', new Date(dateString).toUTCString()) ).to.be( new Date(dateString).toUTCString() )
            expect( JSON.stringify(Encoder('Any', {})) ).to.be( JSON.stringify({}) )
            expect( JSON.stringify(Encoder('Any', [])) ).to.be( JSON.stringify([]) )
        })
    })

    context('DateTime', () => {
        it('Encodes a Date into a value list', () => {
            expect( JSON.stringify(Encoder('datetime.datetime', new Date(dateString))) ).to.be(JSON.stringify([2020, 6, 28, 19, 16, 35, 59]))
        })
        it('Encodes a Date string into a value list', () => {
            expect( JSON.stringify(Encoder('datetime.datetime', dateString)) ).to.be(JSON.stringify([2020, 6, 28, 19, 16, 35, 59]))
        })
        it('Encodes milliseconds into a value list', () => {
            expect( JSON.stringify(Encoder('datetime.datetime', new Date(dateString).getTime())) ).to.be(JSON.stringify([2020, 6, 28, 19, 16, 35, 59]))
        })
    })

    context('TimeDelta', () => {
        it('Encodes a Date into days seconds', () => {
            expect( JSON.stringify(Encoder('datetime.timedelta', new Date(millisecondsDelta))) ).to.be(JSON.stringify([5, 43200]))
        })
        it('Encodes a millisenconds into days seconds', () => {
            expect( JSON.stringify(Encoder('datetime.timedelta', millisecondsDelta)) ).to.be(JSON.stringify([5, 43200]))
        })
    })
})