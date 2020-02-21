const expect = require('expect.js');
const Lamden = require('../dist/lamden');

let goodNetwork = {
    type: 'testnet',
    name: 'Lamden Public Testnet', 
    host: 'https://testnet.lamden.io', 
    port: '443',
    lamden: true,
}

function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

describe('Test Netowrk class', () => {
    context('Constructor', () => {
        it('can create an instance', () => {
            let network = new Lamden.Network(goodNetwork)
            expect(network).to.exist;
            expect(network.host).to.be(goodNetwork.host);
            expect(network.type).to.be(goodNetwork.type);
            expect(network.name).to.be(goodNetwork.name);
            expect(network.port).to.be(goodNetwork.port);
            expect(network.lamden).to.be(goodNetwork.lamden);
            expect(network.mainnet).to.be(false);
            expect(network.testnet).to.be(true);
            expect(network.mockchain).to.be(false);
        }) 
        it('sets mainnet flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'mainnet'
            let network = new Lamden.Network(networkInfo)
            expect(network.mainnet).to.be(true);
            expect(network.testnet).to.be(false);
            expect(network.mockchain).to.be(false);

        })
        it('sets testnet flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'testnet'
            let network = new Lamden.Network(networkInfo)
            expect(network.mainnet).to.be(false);
            expect(network.testnet).to.be(true);
            expect(network.mockchain).to.be(false);

        })
        it('sets mockchain flag', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = 'mockchain'
            let network = new Lamden.Network(networkInfo)
            expect(network.mainnet).to.be(false);
            expect(network.testnet).to.be(false);
            expect(network.mockchain).to.be(true);

        })
        it('rejects missing host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = ''
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('HOST Required (Type: String)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.host = 'missing.protocol.com'
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Host String must include http:// or https://')
        })
        it('rejects missing port string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.port = ''
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('PORT Required (Type: String)')
        })
        it('rejects missing type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = ''
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Network Type Required (Type: String)')
        })
        it('rejects invalid type string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.type = 'badtype'
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be(`Error: badtype not in Lamden Network Types: ["mockchain","testnet","mainnet"]`)
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new Lamden.Network('https://testnet.lamden.io:443')
            } catch (e) {error = e}
            expect(error.message).to.be('Expected Network Info Object and got Type: string')
        })
    })
    context('Ping Network', () => {
        it('emits online status', async () => {
            function checkResult(result){
                expect(result).to.be(true)
            }
            let network = new Lamden.Network(goodNetwork)
            network.on('online', (status) => checkResult(status))
            await network.ping();
        })        

        it('return value from method return', async () => {
            function checkResult(result){
                expect(result).to.be(true)
            }
            let network = new Lamden.Network(goodNetwork)
            let status = await network.ping()
            checkResult(status)
        })
        it('returns online status through callback', async () => {
            function checkResult(result){
                expect(result).to.be(true)
            }
            let network = new Lamden.Network(goodNetwork)
            await network.ping(((status) => checkResult(status)))
        })
    })        
})