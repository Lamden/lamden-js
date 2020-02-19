import { Network } from '../../src/js/network'

let goodNetwork = {
    type: 'testnet',
    name: 'Lamden Public Testnet', 
    host: 'https://testnet.lamden.io', 
    port: '443',
    lamden: true,
}
const newNetwork = new Network(goodNetwork)
console.log(newNetwork)
function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

describe('Test Netowrk class', () => {
    before(function() {
        Cypress.config({
            defaultCommandTimeout: 60000
        })
        cy.log(newNetwork)
    })

    context('Constructor', () => {
        /*
        it('can create an instance', () => {
            let network = new Network(goodNetwork)
            cy.expect(network).to.exist;
            cy.expect(network.host).to.eq(goodNetwork.host);
            cy.expect(network.type).to.eq(goodNetwork.type);
            cy.expect(network.name).to.eq(goodNetwork.name);
            cy.expect(network.port).to.eq(goodNetwork.port);
            cy.expect(network.lamden).to.eq(goodNetwork.lamden);
            cy.expect(network.mainnet).to.eq(false);
            cy.expect(network.testnet).to.eq(true);
            cy.expect(network.mockchain).to.eq(false);
        })
        it('sets mainnet flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'mainnet'
            let network = new Network(networkInfo)
            cy.expect(network.mainnet).to.eq(true);
            cy.expect(network.testnet).to.eq(false);
            cy.expect(network.mockchain).to.eq(false);

        })
        it('sets testnet flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'testnet'
            let network = new Network(networkInfo)
            cy.expect(network.mainnet).to.eq(false);
            cy.expect(network.testnet).to.eq(true);
            cy.expect(network.mockchain).to.eq(false);

        })
        it('sets mockchain flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'mockchain'
            let network = new Network(networkInfo)
            cy.expect(network.mainnet).to.eq(false);
            cy.expect(network.testnet).to.eq(false);
            cy.expect(network.mockchain).to.eq(true);

        })
        it('rejects missing host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = ''
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('HOST Required (Type: String)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = 'missing.protocol.com'
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Host String must include http:// or https://')
        })
        it('rejects missing port string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.port = ''
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('PORT Required (Type: String)')
        })
        it('rejects missing type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = ''
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Network Type Required (Type: String)')
        })
        it('rejects invalid type string', () => {
            
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = 'badtype'
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq(`badtype not in Lamden Network Types: ["mockchain","testnet","mainnet"]`)
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new Network('https://testnet.lamden.io:443')
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Expected Object and got Type: string')
        })
        it('rejects missing name string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.name = ''
                new Network(networkInfo)
            } catch (e) {error = e}
            cy.expect(error.message).to.eq('Name Required (Type: String)')
        })
    })
    context('Ping Network', () => {
        it('emits online status', () => {
            let network = new Network(goodNetwork)
            const spys = {
                online (status) {return status},
            }
            const spy = cy.spy(spys, 'online')

            network.on('online', (status) => spys.online(status))
            cy.wrap(network.ping()).then(() => {
                cy.expect(spy).to.be.called
            })
        })        

        it('return value from method return', () => {
            let network = new Network(goodNetwork)

            const spy = cy.spy(network, 'ping')
            cy.log(network.ping())

            cy.wrap(network.ping()).then((value) => {
                cy.expect(spy).to.be.called
                cy.expect(value).to.eq(true) 
            })
        })
        it('returns online status through callback', () => {
            let network = new Network(goodNetwork)
            let status;

            cy.spy(network, 'ping')
            cy.wrap(network.ping((res) => status = res)).then((value) => {
                cy.expect(network.ping).to.be.called
                cy.expect(status).to.eq(true) 
            })
        })*/
    })        
})