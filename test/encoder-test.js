const expect = require('expect.js');
const Lamden = require('../dist/lamden');
const { Encoder } = Lamden;

const dateString = "2020-07-28T19:16:35.059Z"
const millisecondsDelta = 475200000

describe('Test Type Encoder', () => {
    context('TYPES', () => {
        it('Encoder rejects unknown TYPE', () => {
            expect(() => Encoder('nope', {})).to.throwError();
        })
    })

    context('BigNumber', () => {
        it('Encoder can call BigNumber', () => {
            expect(Encoder.BigNumber.sum(1,2).toString()).to.be( '3' )
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
        it('encodes a __fixed__ object from an float', () => {
            expect( JSON.stringify(Encoder('float', 1.5)) ).to.be( JSON.stringify({"__fixed__": "1.5"}) )
        })
        it('encodes a __fixed__ object to integer', () => {
            expect( JSON.stringify(Encoder('float', 1 )) ).to.be( JSON.stringify({"__fixed__": "1.0"}) )
        })
        it('encodes a __fixed__ object with zeros as decimals to an integer', () => {
            expect( JSON.stringify(Encoder('float', 1.00 )) ).to.be( JSON.stringify({"__fixed__": "1.0"}) )
        })
        it('encodes a __fixed__ object from a string', () => {
            expect( JSON.stringify(Encoder('float', '1.5' )) ).to.be( JSON.stringify({"__fixed__": "1.5"}) )
        })
        it('encodes a __fixed__ object from a float and loses percision', () => {
            expect( JSON.stringify(Encoder('float', 0.9999999999999999999999999999999 )) ).to.be( JSON.stringify({"__fixed__": "1.0"}) )
        })
        it('encodes __fixed__ object float from a string and retains precision', () => {
            expect( JSON.stringify(Encoder('float', '0.9999999999999999999999999999999' )) ).to.be( JSON.stringify({"__fixed__": "0.999999999999999999999999999999"}) )
        })
        it('encodes __fixed__ object float from a bigNumber Object and retains precision', () => {
            let bn = Encoder('bigNumber', '0.9999999999999999999999999999999')
            expect( JSON.stringify(Encoder('float', bn )) ).to.be( JSON.stringify({"__fixed__": "0.999999999999999999999999999999"}) )
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
        it('encodes a dict from a string', () => {
            expect( JSON.stringify(Encoder('dict', '{"vk":"833f3f66de0da4599ca60ae7854256f37404f543cf7a97c328d38aff9d3f8ac7"}')) ).to.be( JSON.stringify({vk:"833f3f66de0da4599ca60ae7854256f37404f543cf7a97c328d38aff9d3f8ac7"}) )
        })
        it('encodes datetime and float inside a dict from a string', () => {
            expect( JSON.stringify(Encoder('dict', {'datetime':new Date(dateString), 'float': 1.1})) ).to.be( '{"datetime":{"__time__":[2020,6,28,19,16,35,59]},"float":{"__fixed__":"1.1"}}' )
        })
        it('replaces datetime object with value in dict', () => {
            expect( JSON.stringify( Encoder('dict', {'DateTime':{'datetime':new Date(dateString)}})) ).to.be('{"DateTime":{"__time__":[2020,6,28,19,16,35,59]}}');
        })
        it('replaces timedelta object with value in dict', () => {
            expect( JSON.stringify( Encoder('dict', {'TimeDelta':{'timedelta':1000}})) ).to.be('{"TimeDelta":{"__delta__":[0,1]}}');
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
        it('encodes a mixed list', () => {
            expect( JSON.stringify(Encoder('list', ["1.1", 2])) ).to.be( JSON.stringify([{"__fixed__":"1.1"},2]) )
        })
        it('encodes fixed and datetime values in the list', () => {
            expect( JSON.stringify(Encoder('list', [ 1.1, {'datetime':new Date(dateString)}] )) )
            .to.be( '[{"__fixed__":"1.1"},{"__time__":[2020,6,28,19,16,35,59]}]' )
        })
        it('encodes a list of all values and encodes accordingly', () => {
            let testList = [1, 1.1, "string", {'datetime':new Date(dateString)}, {'timedelta':1000}, {'TimeDelta':{'timedelta':1000}}, true, [1.1]]
            expect( JSON.stringify(Encoder('list',  testList)) )
            .to.be( '[1,{"__fixed__":"1.1"},"string",{"__time__":[2020,6,28,19,16,35,59]},{"__delta__":[0,1]},{"TimeDelta":{"__delta__":[0,1]}},true,[{"__fixed__":"1.1"}]]' )
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
            expect( JSON.stringify(Encoder('datetime.datetime', new Date(dateString))) ).to.be(JSON.stringify({'__time__':[2020, 6, 28, 19, 16, 35, 59]}))
        })
        it('Encodes a Date string into a value list', () => {
            expect( JSON.stringify(Encoder('datetime.datetime', dateString)) ).to.be(JSON.stringify({'__time__':[2020, 6, 28, 19, 16, 35, 59]}))
        })
        it('Encodes milliseconds into a value list', () => {
            expect( JSON.stringify(Encoder('datetime.datetime', new Date(dateString).getTime())) ).to.be(JSON.stringify({'__time__':[2020, 6, 28, 19, 16, 35, 59]}))
        })
    })

    context('TimeDelta', () => {
        it('Encodes a Date into days seconds', () => {
            expect( JSON.stringify(Encoder('datetime.timedelta', new Date(millisecondsDelta))) ).to.be(JSON.stringify({'__delta__':[5, 43200]}))
        })
        it('Encodes a millisenconds into days seconds', () => {
            expect( JSON.stringify(Encoder('datetime.timedelta', millisecondsDelta)) ).to.be(JSON.stringify({'__delta__':[5, 43200]}))
        })
    })

    context('Stringify()- Parses object and encodes all values', () => {
        let testObj = {
            'integer': 1,
            'float': 1.1,
            'list': [1, 1.1, "this is a string", true, [1,2,3,4,5,6,7], [0, 1234567], [1.1], {fixed: 1.1, 'DateTime':{'datetime': new Date(dateString)}, 'TimeDelta': {"datetime.timedelta": millisecondsDelta}}],
            'str': "this is a string",
            'bool': true,
            'datetime.datetime': new Date(dateString),
            'datetime.timedelta': millisecondsDelta
        }
        testObj.dict = JSON.parse(JSON.stringify(testObj))
        let encodedObj = JSON.stringify(Encoder('object', testObj))

        it('encodes an string', () => {
            expect( encodedObj.includes('"str":"this is a string"') ).to.be(true)
        })
        it('encodes an integer', () => {
            expect( encodedObj.includes('"integer":1') ).to.be(true)
        })
        it('encodes a float', () => {
            expect( encodedObj.includes('"float":{"__fixed__":"1.1"}') ).to.be(true)
        })
        it('encodes an bool', () => {
            expect( encodedObj.includes('"bool":true') ).to.be(true)
        })
        it('encodes a datetime.datetime', () => {
            expect( encodedObj.includes('"datetime.datetime":{"__time__":[2020,6,28,19,16,35,59]}') ).to.be(true)
        })
        it('encodes an datetime.timdelta', () => {
            expect( encodedObj.includes('"datetime.timedelta":{"__delta__":[5,43200]}') ).to.be(true)
        })
        it('encodes an list', () => {
            expect( 
                encodedObj
                    .includes('"list":[1,{"__fixed__":"1.1"},"this is a string",true,[1,2,3,4,5,6,7],[0,1234567],[{"__fixed__":"1.1"}],{"fixed":{"__fixed__":"1.1"},"DateTime":{"__time__":[2020,6,28,19,16,35,59]},"TimeDelta":{"__delta__":[5,43200]}}]') )
                    .to.be(true)
        })
        it('encodes a dict/object', () => {
            expect( 
                encodedObj
                    .includes('"dict":{"integer":1,"float":{"__fixed__":"1.1"},"list":[1,{"__fixed__":"1.1"},"this is a string",true,[1,2,3,4,5,6,7],[0,1234567],[{"__fixed__":"1.1"}],{"fixed":{"__fixed__":"1.1"},"DateTime":{"__time__":[2020,6,28,19,16,35,59]},"TimeDelta":{"__delta__":[5,43200]}}],"str":"this is a string","bool":true,"datetime.datetime":{"__time__":[2020,6,28,19,16,35,59]},"datetime.timedelta":{"__delta__":[5,43200]}}') )
                    .to.be(true)
        })
    })
})