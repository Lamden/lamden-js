const expect = require('expect.js');
const Lamden = require('../dist/lamden');

let goodNetwork = {
    type: 'testnet',
    name: 'Lamden Public Testnet', 
    hosts: ['https://testnet-master-1.lamden.io:443'] ,
    lamden: true,
    blockExplorer: 'https://testnet.lamden.io'
}

function copyObject(object){
    return JSON.parse(JSON.stringify(object))
}

describe('Test Netowrk class', () => {
    context('Constructor', () => {
        it('can create an instance', () => {
            let network = new Lamden.Network(goodNetwork)
            expect(network).to.exist;
            expect(JSON.stringify(network.hosts)).to.be(JSON.stringify(goodNetwork.hosts));
            expect(network.host).to.be(goodNetwork.hosts[0]);
            expect(network.url).to.be(goodNetwork.hosts[0]);
            expect(network.type).to.be(goodNetwork.type);
            expect(network.name).to.be(goodNetwork.name);
            expect(network.lamden).to.be(goodNetwork.lamden);
            expect(network.blockExplorer).to.be(goodNetwork.blockExplorer);
        }) 

        it('rejects missing hosts Array', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                delete networkInfo.hosts
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('HOSTS Required (Type: Array)')

        })
        it('rejects no protocol in host string', () => {
            let error;
            try{
                let networkInfo = copyObject(goodNetwork)
                networkInfo.hosts = ['missing.protocol.com']
                new Lamden.Network(networkInfo)
            } catch (e) {error = e}
            expect(error.message).to.be('Host String must include http:// or https://')
        })
        it('defaults missing type to custom', () => {
            let networkInfo = copyObject(goodNetwork)
            networkInfo.type = ''
            let network = new Lamden.Network(networkInfo)
            expect(network.type).to.be("custom");
        })
        it('rejects arg not being an object', () => {
            let error;
            try{
                new Lamden.Network('https://testnet-master-1.lamden.io:443')
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
            network.events.on('online', (status) => checkResult(status))
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