const {Builder, logging, Capabilities } = require('selenium-webdriver');
const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');
const expect = require("expect.js");

// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/lib/logging.html
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
const caps = Capabilities.chrome();
caps.setLoggingPrefs(prefs);

let goodNetwork = {
  type: "testnet",
  name: "Lamden Public Testnet",
  hosts: ["https://testnet-master-1.lamden.io:443"],
};

let badNetwork = {
  type: "testnet",
  name: "Bad Network",
  hosts: ["http://badnetwork.lamden.io:18080"],
};

function copyObject(object) {
  return JSON.parse(JSON.stringify(object));
}

const balanceCheckWallet = {
  float: "960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb",
  int: "01930f6472916ae53c9ebbe7d3faf8979c24cac33d68041aa4ab986401bbf7c3",
};

describe("Browsers Tests: Test Masternode API returns", () => {
  var driver;
  let server;
  const app = new Koa();
  const port = 6800;
  before(async function() {
    // Start a http server
    app.use(KoaStatic(path.join(__dirname,'../../')));
    server = app.listen(port, () => console.log(`\n\x1B[32mKoa Server running at http://127.0.0.1:${port}/\x1B[0m`))

    driver = await new Builder()
            .withCapabilities(caps)
            .forBrowser("chrome")
            .build();

    // Load the test.html
    await driver.get(`http://127.0.0.1:${port}/test/browsers/test.html`);
  });

  after(() => {
      driver && driver.quit();
      server && server.close();
  });

  context("constructor", () => {
    it("can create an instance", async () => {
      let api = await driver.executeScript(function (goodNetwork) {
        let api = new Lamden.Masternode_API(goodNetwork)
        return {
          hosts: api.hosts,
          url: api.url
        }
      }, goodNetwork)
      expect(api).to.exist;
      expect(JSON.stringify(api.hosts)).to.be(JSON.stringify(goodNetwork.hosts));
      expect(api.url).to.be(goodNetwork.hosts[0]);
    });
    it("rejects arg not being an object", async () => {
      let error;
      try {
        await driver.executeScript(function () {
          new Lamden.Masternode_API("https://testnet.lamden.io:443")
        })
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain("Expected Object and got Type: string");
    });
    it("rejects missing hosts Array", async () => {
      let error;
      try {
        let networkInfo = copyObject(goodNetwork);
        networkInfo.hosts = [];
        await driver.executeScript(function (networkInfo) {
          new Lamden.Masternode_API(networkInfo)
        }, networkInfo)
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain("HOSTS Required (Type: Array)");
    });
    it("rejects no protocol in host string", async () => {
      let error;
      try {
        let networkInfo = copyObject(goodNetwork);
        networkInfo.hosts = ["missing.protocol.com"];
        await driver.executeScript(function (networkInfo) {
         new Lamden.Masternode_API(networkInfo)
        }, networkInfo)
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain("Host String must include http:// or https://");
    });
  });

  context("Masternode_API.pingServer()", async () => {
    it("returns true if the server is online", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.pingServer();
        callback(response);
      }, goodNetwork).then(res => {
        expect(res).to.be(true);
      })
    });
    it("returns false if provided network is unresponsive", async () => {
      await driver.executeAsyncScript(async function (badNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(badNetwork);
        let response = await api.pingServer();
        callback(response);
      }, badNetwork).then(res => {
        expect(res).to.be(false);
      })
    });
  });

  context("Masternode_API.getCurrencyBalance()", () => {
    it("returns the float balance for a vk", async () => {
      await driver.executeAsyncScript(async function (goodNetwork, balanceCheckWallet) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getCurrencyBalance(balanceCheckWallet.float);
        callback(response);
      }, goodNetwork, balanceCheckWallet).then(res => {
        expect(res).to.above(0);
      })
    });
    it("returns the int balance for a vk", async () => {
      await driver.executeAsyncScript(async function (goodNetwork, balanceCheckWallet) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getCurrencyBalance(balanceCheckWallet.int);
        callback(response);
      }, goodNetwork, balanceCheckWallet).then(res => {
        expect(res).to.above(0);
      })
    });
    it("returns 0 if the vk does not exist yet", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getCurrencyBalance(Lamden.wallet.new_wallet().vk);
        callback(response.toNumber());
      }, goodNetwork).then(res => {
        expect(res).to.be(0);
      })
    });
    it("returns 0 if provided network is unresponsive", async () => {
      await driver.executeAsyncScript(async function (badNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(badNetwork);
        let response = await api.getCurrencyBalance();
        callback(response.toNumber());
      }, badNetwork).then(res => {
        expect(res).to.be(0);
      })
    });
  });

  context("Masternode_API.contractExists()", () => {
    it("returns true if a contract exists on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.contractExists("currency");
        callback(response);
      }, goodNetwork).then(res => {
        expect(res).to.be(true);
      })

    });
    it("returns false if a contract does not exist on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.contractExists(Lamden.wallet.new_wallet().vk);
        callback(response);
      }, goodNetwork).then(res => {
        expect(res).to.be(false);
      })
    });
    it("returns false if provided network is unresponsive", async () => {
      await driver.executeAsyncScript(async function (badNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(badNetwork);
        let response = await api.contractExists("currency");
        callback(response);
      }, badNetwork).then(res => {
        expect(res).to.be(false);
      })
    });
  });

  context("Masternode_API.getContractMethods()", () => {
    it("returns an array if a contract exists on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getContractMethods("currency");
        callback(response);
      }, goodNetwork).then(res => {
        expect(Array.isArray(res)).to.be(true);
        expect(res.length > 0).to.be(true);
      })
    });
    it("returns an empty array if a contract does not exist on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getContractMethods(Lamden.wallet.new_wallet().vk);
        callback(response);
      }, goodNetwork).then(res => {
        expect(Array.isArray(res)).to.be(true);
        expect(res.length === 0).to.be(true);
      });
    });
    it("returns empty array if provided network is unresponsive", async () => {
      await driver.executeAsyncScript(async function (badNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(badNetwork);
        let response = await api.getContractMethods("currency");
        callback(response);
      }, badNetwork).then(res => {
        expect(Array.isArray(res)).to.be(true);
        expect(res.length === 0).to.be(true);
      })
    });
  });

  context("Masternode_API.getContractVariables()", () => {
    it("returns an array if a contract exists on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getContractVariables("currency");
        callback(response);
      }, goodNetwork).then(res => {
        expect(Array.isArray(res.variables)).to.be(true);
        expect(Array.isArray(res.hashes)).to.be(true);
        expect(res.hashes.length > 0).to.be(true);
      })
    });
    it("returns an empty Object if a contract does not exist on the blockchain", async () => {
      await driver.executeAsyncScript(async function (goodNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(goodNetwork);
        let response = await api.getContractVariables(Lamden.wallet.new_wallet().vk);
        callback(response);
      }, goodNetwork).then(res => {
        expect(Array.isArray(res.variables)).to.be(false);
        expect(Array.isArray(res.hashes)).to.be(false);
        expect(Object.keys(res).length === 0).to.be(true);
      })
    });
    it("returns empty Object if provided network is unresponsive", async () => {
      await driver.executeAsyncScript(async function (badNetwork) {
        let callback = arguments[arguments.length-1];
        let api = new Lamden.Masternode_API(badNetwork);
        let response = await api.getContractVariables("currency");
        callback(response);
      }, badNetwork).then(res => {
        expect(Array.isArray(res.variables)).to.be(false);
        expect(Array.isArray(res.hashes)).to.be(false);
        expect(Object.keys(res).length === 0).to.be(true);
      })
    });
  });

  // context("Masternode_API.getVariable()", () => {
  //   it("returns the value of the variable if the key exists", async () => {
  //     let key = balanceCheckWallet.float;
  //     let response = await goodNetwork_api.getVariable("currency", "balances", key);
  //     expect(parseFloat(response.__fixed__)).to.be.above(0);
  //   });
  //   it("returns undefined if the key does not exist in the variable", async () => {
  //     let key = wallet.new_wallet().vk;
  //     let response = await goodNetwork_api.getVariable("currency", "balances", key);
  //     expect(response).to.be(null);
  //   });
  //   it("returns undefined if the contract does not exist", async () => {
  //     let key = keyPair.vk;
  //     let response = await goodNetwork_api.getVariable(Lamden.wallet.new_wallet().vk, "balances", key);
  //     expect(response).to.be(null);
  //   });
  //   it("returns undefined if the variable does not exist", async () => {
  //     let key = keyPair.vk;
  //     let response = await goodNetwork_api.getVariable("currency", wallet.new_wallet().vk, key);
  //     expect(response).to.be(null);
  //   });
  //   it("returns undefined if provided network is unresponsive", async () => {
  //     let key = keyPair.vk;
  //     let response = await badNetwork_api.getVariable("currency", "balances", key);
  //     expect(response).to.be(null);
  //   });
  // });

  // context("Masternode_API.getContractInfo()", () => {
  //   it("returns a contract info object", async () => {
  //     let response = await goodNetwork_api.getContractInfo("currency");
  //     expect(response.name).to.be("currency");
  //     expect(response.code.length > 0).to.be(true);
  //   });
  //   it("returns undefined if provided network is unresponsive", async () => {
  //     let response = await badNetwork_api.getContractInfo("currency");
  //     expect(response).to.be(null);
  //   });
  // });

  // context("Masternode_API.getNonce()", () => {
  //   it("returns a nonce and processor value for a vk", async () => {
  //     let response = await goodNetwork_api.getNonce(keyPair.vk);
  //     expect(response.nonce).to.exist;
  //     expect(response.processor).to.exist;
  //     expect(response.sender).to.be(keyPair.vk);
  //   });
  //   it("returns an error message if vk is not a hex string", async () => {
  //     let error = await goodNetwork_api.getNonce("this-is-not-a-vk");
  //     expect(error).to.be(`this-is-not-a-vk is not a hex string.`);
  //   });
  //   it("returns an error message if provided network is unresponsive", async () => {
  //     let error = await badNetwork_api.getNonce(keyPair.vk);
  //     expect(error.includes(`Unable to get nonce for ${keyPair.vk}`)).to.be(true);
  //   });
  // });
});
