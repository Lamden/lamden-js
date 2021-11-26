const expect = require("expect.js");
const validators = require("types-validate-assert");
const { validateTypes, assertTypes } = validators;
const {Builder, logging, Capabilities } = require('selenium-webdriver');
const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');

// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/lib/logging.html
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
const caps = Capabilities.chrome();
caps.setLoggingPrefs(prefs);


describe("Browsers Tests: Test Lamden Wallet methods", async () => {
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

  context("wallet.create_wallet_bip39: ", () => {
    it("creates a bip39 / bip32 compatible lamden keypair", async () => {
      let newWallet  = await driver.executeScript("return Lamden.wallet.new_wallet_bip39()");

      expect(validateTypes.isStringHex(newWallet.vk)).to.be(true);
      expect(newWallet.vk.length).to.be(64);
      expect(validateTypes.isStringHex(newWallet.sk)).to.be(true);
      expect(newWallet.sk.length).to.be(64);
      expect(validateTypes.isStringWithValue(newWallet.mnemonic)).to.be(true);
      expect(validateTypes.isNumber(newWallet.derivationIndex)).to.be(true);
      expect(newWallet.derivationIndex).to.be(0);
    }),
      it("creates a bip39 / bip32 compatible lamden keypair from seed", async () => {
        const seed = 'd3ad26bd89d54d0c22bb32d34ea9f06c567ba060d8e1518974d807180b886c643bfb7f455bd3db2c767a17c089aab20db97cf0f0184d730b9d20be0c7b6cc6cc'
        const derivationIndex = 127;

        let newWallet  = await driver.executeScript(`return Lamden.wallet.new_wallet_bip39('${seed}', ${derivationIndex})`);

        expect(validateTypes.isStringHex(newWallet.vk)).to.be(true);
        expect(newWallet.vk).to.be("d0d2de909bf7c2be3bafbcb3af0b1c50487b80ba48b5700bff35bb927921c607");
        expect(validateTypes.isStringHex(newWallet.sk)).to.be(true);
        expect(newWallet.sk).to.be("86c77748edc039c672cf761d2db1e52d6255b16cd4d626d4b66c67eb224287a8");
        expect(newWallet.mnemonic).to.be(null);
        expect(newWallet.seed).to.be( null )
        expect(validateTypes.isNumber(newWallet.derivationIndex)).to.be(true);
        expect(newWallet.derivationIndex).to.be(127);
      });
  });

  context("wallet.new_wallet(): ", () => {
    it("creates a lamden keypair", async () => {
      let newWallet  = await driver.executeScript("return Lamden.wallet.new_wallet();");
      expect(validateTypes.isStringHex(newWallet.vk)).to.be(true);
      expect(newWallet.vk.length).to.be(64);
      expect(validateTypes.isStringHex(newWallet.sk)).to.be(true);
      expect(newWallet.sk.length).to.be(64);
    });
  });

  context("wallet.get_vk(): ",  () => {
    it("can create a vk from an sk", async () => {
      let res = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.new_wallet();
        return [Lamden.wallet.get_vk(newWallet.sk), newWallet.vk]
      });
      expect(res[0]).to.be(res[1]);
    });
  });
  context("wallet.sign(): ", () => {
    it("can sign a message", async () => {
      let signedMessage = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.new_wallet();
        let message = new Uint8Array("this is a message");
        let signedMessage = Lamden.wallet.sign(newWallet.sk, message);
        return signedMessage
      });
      expect(validateTypes.isStringHex(signedMessage)).to.be(true);
    });
  });

  context("wallet.verify(): ", () => {
    it("can validate a correct signature", async () => {
      let res = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.new_wallet();
        let message = new Uint8Array("this is a message");
        let signedMessage = Lamden.wallet.sign(newWallet.sk, message);
        return Lamden.wallet.verify(newWallet.vk, message, signedMessage)
      });
      expect(res).to.be(true);
    });
    it("can validate an incorrect signature", async () => {
      let res = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.new_wallet();
        let newWallet2 = Lamden.wallet.new_wallet();
        let message = new Uint8Array("this is a message");
        let signedMessage = Lamden.wallet.sign(newWallet.sk, message);
        return Lamden.wallet.verify(newWallet2.vk, message, signedMessage)
      });
      expect(res).to.be(false);
    });
  });

  context("wallet.create_wallet(): ", () => {
    it("can create a new wallet object", async () => {
      let newWallet  = await driver.executeScript("return Lamden.wallet.create_wallet();");
      expect(newWallet).to.have.property("sign");
      expect(newWallet).to.have.property("verify");
      expect(newWallet).to.have.property("vk");
      expect(newWallet).to.have.property("sk");
      assertTypes.isStringHex(newWallet.vk);
      assertTypes.isStringHex(newWallet.sk);
    });
    it("can create a new wallet from a private key", async () => {
      let newWallet  = await driver.executeScript(function () {
        let keypair = Lamden.wallet.new_wallet();
        let newWallet = Lamden.wallet.create_wallet({ sk: keypair.sk });
        return newWallet
      });
      expect(newWallet).to.have.property("sign");
      expect(newWallet).to.have.property("verify");
      expect(newWallet).to.have.property("vk");
      expect(newWallet).to.have.property("sk");
      assertTypes.isStringHex(newWallet.vk);
      assertTypes.isStringHex(newWallet.sk);
    });
    it("secret key is not accessible is set to private", async () => {
      let newWallet  = await driver.executeScript("return Lamden.wallet.create_wallet({ keepPrivate: true });");
      expect(() => assertTypes.isStringHex(newWallet.sk)).throwException();
    });
    it("wallet object can sign messages", async () => {
      let res = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.create_wallet({ keepPrivate: true });
        let message = new Uint8Array("this is a message");
        let signedMessage = newWallet.sign(message);
        return Lamden.wallet.verify(newWallet.vk, message, signedMessage)
      })
      expect(res).to.be(true);
    });
    it("wallet object can verify a messages", async () => {
      let res = await driver.executeScript(function () {
        let newWallet = Lamden.wallet.create_wallet({ keepPrivate: true });
        let message = new Uint8Array("this is a message");
        let signedMessage = newWallet.sign(message);
        return newWallet.verify(message, signedMessage)
      })
      expect(res).to.be(true);
    });
  });
});
