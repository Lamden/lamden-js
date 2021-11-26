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
  lamden: true,
  blockExplorer: "https://testnet.lamden.io",
};

function copyObject(object) {
  return JSON.parse(JSON.stringify(object));
}

describe("Browsers Tests: Test Netowrk class", () => {
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

  context("Constructor", () => {
    it("can create an instance", async () => {
      let network = await driver.executeScript("return new Lamden.Network(arguments[0])", goodNetwork);
      expect(network).to.exist;
      expect(JSON.stringify(network.hosts)).to.be(JSON.stringify(goodNetwork.hosts));
      expect(network.hosts[0]).to.be(goodNetwork.hosts[0]);
      expect(network.hosts[0]).to.be(goodNetwork.hosts[0]);
      expect(network.type).to.be(goodNetwork.type);
      expect(network.name).to.be(goodNetwork.name);
      expect(network.lamden).to.be(goodNetwork.lamden);
      expect(network.blockExplorer).to.be(goodNetwork.blockExplorer);
    });

    it("rejects missing hosts Array", async () => {
      let error;
      try {
        let networkInfo = copyObject(goodNetwork);
        delete networkInfo.hosts;
        await driver.executeScript("return new Lamden.Network(arguments[0])", networkInfo);
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
        await driver.executeScript("return new Lamden.Network(arguments[0])", networkInfo);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain("Host String must include http:// or https://");
    });
    it("defaults missing type to custom", async () => {
      let networkInfo = copyObject(goodNetwork);
      networkInfo.type = "";
      let network = await driver.executeScript("return new Lamden.Network(arguments[0])", networkInfo);
      expect(network.type).to.be("custom");
    });
    it("rejects arg not being an object", async () => {
      let error;
      try {
        await driver.executeScript("return new Lamden.Network(arguments[0])", "https://testnet-master-1.lamden.io:443");
      } catch (e) {
        error = e;
      }
      expect(error.message).to.contain("Expected Network Info Object and got Type: string");
    });
  });
  context("Ping Network", () => {
    it("emits online status", async () => {
      function pingNetwork(goodNetwork) {
        var callback = arguments[arguments.length - 1];
        let network = new Lamden.Network(goodNetwork);
        network.events.on("online", (status) => callback(status));
        network.ping();
      }
      await driver.executeAsyncScript(pingNetwork, goodNetwork).then(function(res) {
        expect(res).to.be(true);
      });
    });
    it("return value from method return", async () => {
      await driver.executeAsyncScript(function () {
        var callback = arguments[arguments.length - 1];
        let network = new Lamden.Network(arguments[0]);
        network.ping().then(res => callback(res));
      }, goodNetwork).then(function(res) {
        expect(res).to.be(true);
      });
    });
    it("returns online status through callback", async () => {
      await driver.executeAsyncScript(function () {
        var callback = arguments[arguments.length - 1];
        let network = new Lamden.Network(arguments[0]);
        network.ping(res => callback(res));
      }, goodNetwork).then(function(res) {
        expect(res).to.be(true);
      });
    });
  });
});
