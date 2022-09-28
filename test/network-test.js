const expect = require("expect.js");
const Lamden = require("../dist/cjs/lamden");

let goodNetwork = {
  type: "testnet",
  name: "Lamden Public Testnet",
  hosts: ["https://testnet-master-1.lamden.io:443"],
  lamden: true,
  blockExplorer: "https://testnet.lamden.io",
};

function copyObject(object) {
  return JSON.parse(JSON.stringify(object));
}

describe("Test Netowrk class", () => {
  // context("Constructor", () => {
  //   it("can create an instance", () => {
  //     let network = new Lamden.Network(goodNetwork);
  //     expect(network).to.exist;
  //     expect(JSON.stringify(network.hosts)).to.be(JSON.stringify(goodNetwork.hosts));
  //     expect(network.host).to.be(goodNetwork.hosts[0]);
  //     expect(network.url).to.be(goodNetwork.hosts[0]);
  //     expect(network.type).to.be(goodNetwork.type);
  //     expect(network.name).to.be(goodNetwork.name);
  //     expect(network.lamden).to.be(goodNetwork.lamden);
  //     expect(network.blockExplorer).to.be(goodNetwork.blockExplorer);
  //     expect(network.classname).to.be('Network');
  //     expect(network.version).to.be(1);
  //   });

  //   it("rejects missing hosts Array", () => {
  //     let error;
  //     try {
  //       let networkInfo = copyObject(goodNetwork);
  //       delete networkInfo.hosts;
  //       new Lamden.Network(networkInfo);
  //     } catch (e) {
  //       error = e;
  //     }
  //     expect(error.message).to.be("HOSTS Required (Type: Array)");
  //   });
  //   it("rejects no protocol in host string", () => {
  //     let error;
  //     try {
  //       let networkInfo = copyObject(goodNetwork);
  //       networkInfo.hosts = ["missing.protocol.com"];
  //       new Lamden.Network(networkInfo);
  //     } catch (e) {
  //       error = e;
  //     }
  //     expect(error.message).to.be("Host String must include http:// or https://");
  //   });
  //   it("defaults missing type to custom", () => {
  //     let networkInfo = copyObject(goodNetwork);
  //     networkInfo.type = "";
  //     let network = new Lamden.Network(networkInfo);
  //     expect(network.type).to.be("custom");
  //   });
  //   it("rejects arg not being an object", () => {
  //     let error;
  //     try {
  //       new Lamden.Network("https://testnet-master-1.lamden.io:443");
  //     } catch (e) {
  //       error = e;
  //     }
  //     expect(error.message).to.be("Expected Network Info Object and got Type: string");
  //   });
  //   it("sets network version to 2 if provided", () => {
  //     let networkInfo = copyObject(goodNetwork);
  //     networkInfo.version = 2
  //     let network = new Lamden.Network(networkInfo);
  //     expect(network.version).to.be(2);

  //   })
  //   it("sets network version to 1 version set to anything else", () => {
  //     let networkInfo = copyObject(goodNetwork);
  //     networkInfo.version = "a"
  //     let network = new Lamden.Network(networkInfo);
  //     expect(network.version).to.be(1);
  //   })
  // });
  // context("Ping Network", () => {
  //   it("emits online status", async () => {
  //     function checkResult(result) {
  //       expect(result).to.be(true);
  //     }
  //     let network = new Lamden.Network(goodNetwork);
  //     network.events.on("online", (status) => checkResult(status));
  //     await network.ping();
  //   });

  //   it("return value from method return", async () => {
  //     function checkResult(result) {
  //       expect(result).to.be(true);
  //     }
  //     let network = new Lamden.Network(goodNetwork);
  //     let status = await network.ping();
  //     checkResult(status);
  //   });
  //   it("returns online status through callback", async () => {
  //     function checkResult(result) {
  //       expect(result).to.be(true);
  //     }
  //     let network = new Lamden.Network(goodNetwork);
  //     await network.ping((status) => checkResult(status));
  //   });
  // });
  // context("getNetworkInfo()", () => {
  //   it("returns proper values", async () => {
  //     let networkInfo = copyObject(goodNetwork);
  //     networkInfo.version = 2
  //     let network = new Lamden.Network(networkInfo); 

  //     expect(Object.keys(network.getNetworkInfo()).length).to.be(8)
  //     expect(network.host).to.exist
  //     expect(network.url).to.exist
  //     expect(network.type).to.exist
  //     expect(network.name).to.exist
  //     expect(network.lamden).to.exist
  //     expect(network.blockExplorer).to.exist
  //     expect(network.classname).to.exist
  //     expect(network.version).to.exist
  //   })
  // })

  // context("pingServer()", () => {
  //   it("returns proper values", async () => {
  //     let networkInfo = copyObject(goodNetwork);
  //     networkInfo.version = 2
  //     let network = new Lamden.Network(networkInfo); 
  //     let res = await network.pingServer();
  //     expect(res).to.be(true)
  //   })
  // })
  context("getCurrencyBalance()", () => {
    it("returns proper values", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.getCurrencyBalance("960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb");
      expect(res.value).to.exist;
    })
    it("It should return error", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.getCurrencyBalance("errorkey");
      expect(res.error).to.be('key or variable not exists');
    })
  })
  context("getContractInfo()", () => {
    it("returns proper values", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.getContractInfo("currency");
      expect(res.name).to.be('currency')
      expect(res.code).to.exist
    })
    it("should return error", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.getContractInfo("currency-not-exists");
      expect(res.error).to.be(`currency-not-exists does not exist`)
    })
  })
  context("contractExists()", () => {
    it("returns true", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.contractExists("currency");
      expect(res).to.be(true)
    })
    it("returns false", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.contractExists("currency-not-exists");
      expect(res).to.be(false)
    })
  })
  context("getLastetBlock()", () => {
    it("returns true", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.version = 2
      let network = new Lamden.Network(networkInfo); 
      let res = await network.getLastetBlock();
      expect(res.value).to.exist
    })
  })
});
