import { ValidateTypes } from '../../src/js/validateTypes'
const validate = new ValidateTypes();

const Spys = {
    'isObject': (value) => {return validate.isObject(value)},
    'isFunction': (value) => {return validate.isFunction(value)},
    'isString': (value) => {return validate.isString(value)},
    'isBoolean': (value) => {return validate.isBoolean(value)},
    'isArray': (value) => {return validate.isArray(value)},
    'isNumber': (value) => {return validate.isNumber(value)},
    'isInteger': (value) => {return validate.isInteger(value)},
    'isStringHex': (value) => {return validate.isStringHex(value)},
    'isStringWithValue': (value) => {return validate.isStringWithValue(value)},
    'isObjectWithKeys': (value) => {return validate.isObjectWithKeys(value)},
    'isArrayWithValues': (value) => {return validate.isArrayWithValues(value)},
    'isSpecificClass': (object, className) => {return validate.isSpecificClass(object, className)}
}

function testFunction(){}
const address = '270add00fc708791c97aeb5255107c770434bd2ab71c2e103fbee75e202aa15e'

class TestClass1{}
const testClass1 = new TestClass1;
class TestClass2{}
const testClass2 = new TestClass2;


const testValues = [
    undefined, null, 
    [], ['test'], 
    {}, {test:''}, 
    true, false,
    '', 'test', address,
    0.01, 50,
    testFunction,
    testClass1, testClass2
]

function jsonStr(value){
    return JSON.stringify(value)
}

describe('Test Type Validation', () => {

    beforeEach(function() {
        Object.keys(Spys).map(func => {
            cy.spy(Spys, func)
        })
    })

    context('hasKeys', () => {
        it('can validate a list of keys exist in an object', () => {
            let test1 = {foo:'', bar:'', stu:''}
            cy.expect(validate.hasKeys(test1, ['foo', 'bar', 'stu'])).to.eq(true)
            cy.expect(validate.hasKeys(test1, ['foo', 'bar', 'stu', 'lamden'])).to.eq(false)
        })
    })

    context('isObject', () => {
        it('can determine an Object is an Object', () => {
            testValues.map(value => { 
                Spys.isObject(value)
                if ([jsonStr({}), jsonStr({test:''})].includes(jsonStr(value))) {
                    cy.expect(Spys.isObject).to.have.returned(true)
                }
                else cy.expect(Spys.isObject).to.have.returned(false)
            })
        })
    })
    context('isFunction', () => {
        it('can determine an Object is a Function', () => {
            testValues.map(value => { 
                Spys.isFunction(value)
                if ([testFunction].includes(value)) {
                    cy.expect(Spys.isFunction).to.have.returned(true)
                }
                else cy.expect(Spys.isFunction).to.have.returned(false)
            })
        })
    })
    context('isString', () => {
        it('can determine a String is a String', () => {
            testValues.map(value => { 
                Spys.isString(value)
                if (['', 'test'].includes(value)) cy.expect(Spys.isString).to.have.returned(true)
                else cy.expect(Spys.isString).to.have.returned(false)
            })
        })
    })
    context('isBoolean', () => {
        it('can determine a Boolean is a Boolean', () => {
            testValues.map(value => { 
                Spys.isBoolean(value)
                if ([true, false].includes(value)) cy.expect(Spys.isBoolean).to.have.returned(true)
                else cy.expect(Spys.isBoolean).to.have.returned(false)
            })
        })
    })
    context('isArray', () => {
        it('can determine a Array is a Array', () => {
            testValues.map(value => { 
                Spys.isArray(value)
                if (['[]', jsonStr(['test'])].includes(jsonStr(value))) {
                    cy.expect(Spys.isArray).to.have.returned(true)
                }
                else cy.expect(Spys.isArray).to.have.returned(false)
            })
        })
    })
    context('isNumber', () => {
        it('can determine a Number is a Number', () => {
            testValues.map(value => { 
                Spys.isNumber(value)
                if ([50, 0.01].includes(value)) cy.expect(Spys.isNumber).to.have.returned(true)
                else cy.expect(Spys.isNumber).to.have.returned(false)
            })
        })
    })
    context('isInteger', () => {
        it('can determine a Number is an Integer', () => {
            testValues.map(value => { 
                Spys.isInteger(value)
                if ([50].includes(value)) cy.expect(Spys.isInteger).to.have.returned(true)
                else cy.expect(Spys.isInteger).to.have.returned(false)
            })
        })
    })
    context('isStringHex', () => {
        it('can determine a String is Hex', () => {
            testValues.map(value => { 
                Spys.isStringHex(value)
                if ([address].includes(value)) cy.expect(Spys.isStringHex).to.have.returned(true)
                else cy.expect(Spys.isStringHex).to.have.returned(false)
            })
        })
    })
    context('isStringWithValue', () => {
        it('can determine a String is not empty', () => {
            testValues.map(value => { 
                Spys.isStringWithValue(value)
                if (value === 'test') cy.expect(Spys.isStringWithValue).to.have.returned(true)
                else cy.expect(Spys.isStringWithValue).to.have.returned(false)
            })
        })
    })
    context('isObjectWithKeys', () => {
        it('can determine an Object is not empty', () => {
            testValues.map(value => { 
                Spys.isObjectWithKeys(value)
                if (jsonStr(value) === jsonStr({test:''})) {
                    cy.expect(Spys.isObjectWithKeys).to.have.returned(true)
                }
                else cy.expect(Spys.isObjectWithKeys).to.have.returned(false)
            })
        })
    })
    context('isArrayWithValues', () => {
        it('can determine an Array is not empty', () => {
            testValues.map(value => { 
                Spys.isArrayWithValues(value)
                if (jsonStr(value) === jsonStr(['test'])) {
                    cy.expect(Spys.isArrayWithValues).to.have.returned(true)
                }
                else cy.expect(Spys.isArrayWithValues).to.have.returned(false)
            })
        })
    })
    context('isSpecificClass', () => {
        it('can determine if an object is of a specfic class', () => {
            testValues.map(value => { 
                Spys.isSpecificClass(value, 'TestClass1')
                if (value === testClass1) {
                    cy.expect(Spys.isSpecificClass).to.have.returned(true)
                }
                else cy.expect(Spys.isSpecificClass).to.have.returned(false)
            })
        })
    })
})