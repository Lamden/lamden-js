const {Builder, logging, Capabilities } = require('selenium-webdriver');
const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');
const expect = require("expect.js");
const validators = require("types-validate-assert");
const { validateTypes, assertTypes } = validators;
const Lamden = require('../../dist/cjs/lamden.js')

// define a plugin for koa to redirect some js resources which will enable the types-valid-assert work in the broswer.
const typeValidAssertMiddleware = async (ctx, next) => {
  if (ctx.request.url.indexOf("types-validate-assert") >= 0 && ctx.request.url.indexOf(".js") === -1) {
    ctx.redirect(`${ctx.request.url}.js`);
  }
  await next();
}


// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/lib/logging.html
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
const caps = Capabilities.chrome();
caps.setLoggingPrefs(prefs);

let KEYSTORE_PASSWORD = "Testing010203";
const KEYSTORE_HINT = "Testing010203";

// Overwritted in "createKeystore() - Can create a keystore"
let KEYSTORE_DATA = {
  data: '{"ct":"s6M4AvQvklttEyGq5ebPj/PzAmjNtV6wlS9X8L0RCoZiaqyOz0Y80eZbdf1WRv7gm4Y9aN4vPEoU4oNVVbXoT7QYhuaxMZ+XUyPihcOOnxxmMMGckWD9QOROSgLovvm5yZxp6C2G47dWp7QLkJvubuPgZ+Ws0uexLnkvxXnCikwdZ20yUAFwGN+u3RhQvmgFagCLeuViFXSOtfkDRXmzX4k/7P6cWet8j5rn5gCBbOYHq8rFOxc34ihdhE/8N+x+3MyxGYk2QmwyfzTE9jDEXZwWRlz4GtMXi29ZccRi0z2XEeB7yBl1LTLvngpQM2QnCcX0AQNjHqlPb30bZtQD5shwzgNiRKRon41tKBAH7uvTjw6N39DVIABUkQCusQ1dWWkuvkt79kPjKI/oRF3RH101kXbejFLfDy0eXNUcV3U=","iv":"14e2a23a66fae00bb201f013e9ae1699","s":"5f4b1877b9d4235e"}',
  w: "U2FsdGVkX19RU+1vmxcY5wDfbkn1Gq8zOsh9Y4ylvSs=",
};

let keyPairs = [Lamden.wallet.new_wallet(), Lamden.wallet.new_wallet()]
let keyList = [
  {
    sk: keyPairs[0].sk,
    nickname: "key1",
    name: "lamden",
    network: "lamden",
    symbol: "TAU",
  },
  {
    sk: keyPairs[1].sk,
    nickname: "key2",
    name: "lamden",
    network: "lamden",
    symbol: "TAU",
  },
];

describe("Browsers Tests: Test Lamden Keystore Class", () => {
  let driver;
  let server;
  const app = new Koa();
  const port = 6800;
  before(async function() {
    // Start a http server
    app.use(typeValidAssertMiddleware)
    app.use(KoaStatic(path.join(__dirname,'../../')));
    server = app.listen(port, () => console.log(`\n\x1B[32mKoa Server running at http://127.0.0.1:${port}/\x1B[0m`))

    driver = await new Builder()
            .withCapabilities(caps)
            .forBrowser("chrome")
            .build();

    // Load the test.html
    await driver.get(`http://127.0.0.1:${port}/test/browsers/test.html`);
    await driver.sleep(1000)
  });

  after(() => {
      driver && driver.quit();
      server && server.close();
  });
  context("keystore construcutor: ", () => {
    it("creates an instance with no constructor arguments", async () => {
      let res = await driver.executeScript(function(){
        let keystore = new Lamden.Keystore()
        return [assertTypes.isSpecificClass(keystore, "Keystore"), keystore.keyList.numOfKeys(), keystore.keyList.getWallets().length]
      });
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(0);
      expect(res[2]).to.be(0);
    });
    it("creates an instance by passing a string to the key property", async () => {
      let res = await driver.executeScript(function(){
        let keystore = new Lamden.Keystore(arguments[0])
        return [assertTypes.isSpecificClass(keystore, "Keystore"), keystore.keyList.numOfKeys(), keystore.keyList.getWallets().length]
      }, { key: keyList[0] })
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(1);
      expect(res[2]).to.be(1);
    });
    it("creates an instance by passing an array to the keys property", async () => {
      let res = await driver.executeScript(function(){
        let keystore = new Lamden.Keystore(arguments[0])
        return [assertTypes.isSpecificClass(keystore, "Keystore"), keystore.keyList.numOfKeys(), keystore.keyList.getWallets().length]
      }, { keyList })
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(2);
      expect(res[2]).to.be(2);
    });
    it("creates an instance by passing a keystoreData object", async () => {
      let res = await driver.executeScript(function(){
        let keystore = new Lamden.Keystore(arguments[0])
        return [assertTypes.isSpecificClass(keystore, "Keystore"), assertTypes.isObjectWithKeys(keystore.encryptedData)]
      }, { keystoreData: KEYSTORE_DATA })
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(true);
    });
    it("creates an instance by passing a keystoreData string", async () => {
      let res = await driver.executeScript(function(){
        let keystore = new Lamden.Keystore(arguments[0])
        return [assertTypes.isSpecificClass(keystore, "Keystore"), assertTypes.isObjectWithKeys(keystore.encryptedData)]
      }, { keystoreData: JSON.stringify(KEYSTORE_DATA) })
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(true);
    });
    it('NEGATIVE - Errors on "keyArg" not Array', async () => {
      await driver.executeScript(function(){
        new Lamden.Keystore(arguments[0])
      }, { keyList: { key1: "key1" } }).catch((e) => {
        expect(e.message).to.contain('Expected type [object Array] but got [object Object]');
      });
    });
    it("NEGATIVE - Errors on if array value is not type string", async () => {
      await driver.executeScript(function(){
        new Lamden.Keystore(arguments[0])
      }, { keyList: [keyList[0], 2] }).catch((e) => {
        expect(e.message).to.contain('Expected "2" to be [object Object] and have keys');
      });;
    });
  });
  context("Adding Keys to the Keystore", () => {
    it('addKey() - Can add a single key to the internal "keyList"', async () => {
      let res = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore();
        keystore.addKey(keyList[0]);
        return keystore.keyList.numOfKeys() 
      }, keyList)
      expect(res).to.be(1);
    });
    it("NEGATIVE - addKey() - Errors if value passed is not type string", async () => {
      await driver.executeScript(function(){
        let keystore = new Lamden.Keystore();
        keystore.addKey(1);
      }).catch(e => {
        expect(e.message).to.contain('Expected "1" to be [object Object] and have keys');
      })
    });
    it('addKeys() - Can add to the internal "keyList" via an array of keys', async () => {
      let res = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore();
        keystore.addKeys(keyList);
        return keystore.keyList.numOfKeys() 
      }, keyList)
      expect(res).to.be(2);
    });
    it("addKeys() - Wallets contain metadata", async () => {
      let res = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore();
        keystore.addKeys(keyList);
        return keystore.wallets 
      }, keyList)
      res.forEach((walletInfo, index) => {
        expect(walletInfo.name).to.be(keyList[index].name);
        expect(walletInfo.nickname).to.be(keyList[index].nickname);
        expect(walletInfo.network).to.be(keyList[index].network);
        expect(walletInfo.symbol).to.be(keyList[index].symbol);
      });
    });
    it("NEGATIVE - addKeys() - Errors if value passed is not type array", async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore();
        keystore.addKeys({ key1: "key1", key2: "key2" })
      }).catch((e) => {
        expect(e.message).to.contain("Expected type [object Array] but got [object Object]");
      });
    });
  });
  context("Deleting Keys from the Keystore", () => {
    it("deleteKey() - Can delete a key from the keystore", async () => {
      let res = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.deleteKey(0);
        return keystore.wallets[0].vk
      }, keyList)
      expect(res).to.be(keyPairs[1].vk);
    });
    it("NEGATIVE - deleteKey() - Errors if argument is not an integer", async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.deleteKey(0.3)
      }, keyList).catch(e => {
        expect(e.message).to.contain('Expected "0.3" to be an integer but got non-integer value');
      })
    });
    it("NEGATIVE - deleteKey() - Errors if index is out of range, high", async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.deleteKey(2)
      }, keyList).catch(e => {
        expect(e.message).to.contain('Key index out of range.');
      })
    });
    it("NEGATIVE - deleteKey() - Errors if index is out of range, low", async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.deleteKey(-1)
      }, keyList).catch(e => {
        expect(e.message).to.contain('Key index out of range.');
      })
    });
    it("NEGATIVE - deleteKey() - Funtion returns no keys in list", async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.deleteKey(0)
      },keyList)

    });
  });
  context("Using keystore wallets", () => {
    it("keystore.wallets - Deletes keys from the keystore", async () => {
      let res = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        return keystore.wallets.length;
      }, keyList)
      expect(res).to.be(2);
    });
    it("getWallet() - Can get a specific wallet", async () => {
      let keystoreWallet = await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        return keystore.getWallet(keystore.wallets[0].vk);
      }, keyList)
      expect(keystoreWallet).to.have.property("sign");
      expect(keystoreWallet).to.have.property("verify");
      expect(keystoreWallet).to.have.property("vk");
      expect(() => assertTypes.isStringHex(keystoreWallet.sk)).throwException();
    });
  });
  context("Clearing a keystore", () => {
    it("clearKeys() - Deletes keys from the keystore", async () => {
      let res = await driver.executeScript(function(keyList){
        let after, before;
        let keystore = new Lamden.Keystore();
        keystore.addKey(keyList[0]);
        before = keystore.keyList.numOfKeys();
        keystore.clearKeys();
        after =  keystore.keyList.numOfKeys();
        return [before, after];
      }, keyList)
      expect(res[0]).to.be(1);
      expect(res[1]).to.be(0);
    });
  });
  context("Creating a Keystore", () => {
    it("createKeystore() - Can create a keystore", async () => {
      let res = await driver.executeScript(function(keyList, KEYSTORE_PASSWORD, KEYSTORE_HINT){
        let keystore = new Lamden.Keystore({ keyList });
        let encryptedKeystore = keystore.createKeystore(KEYSTORE_PASSWORD, KEYSTORE_HINT);
        let keystoreObj = JSON.parse(encryptedKeystore);
        return keystoreObj;
      }, keyList, KEYSTORE_PASSWORD, KEYSTORE_HINT)
      expect(res).to.have.property("data");
      assertTypes.isStringWithValue(res.data);
      expect(res).to.have.property("w");
      assertTypes.isStringWithValue(res.w);
    });
    it('createKeystore() - Can create a keystore without "hint"', async () => {
      let res = await driver.executeScript(function(keyList, KEYSTORE_PASSWORD){
        let keystore = new Lamden.Keystore({ keyList });
        let encryptedKeystore = keystore.createKeystore(KEYSTORE_PASSWORD);
        let keystoreObj = JSON.parse(encryptedKeystore);
        return keystoreObj;
      }, keyList , KEYSTORE_PASSWORD)

      expect(res).to.have.property("data");
      assertTypes.isStringWithValue(res.data);

      expect(res).to.have.property("w");
      assertTypes.isString(res.w);

      expect(() => assertTypes.isStringWithValue(res.w)).throwException((e) => {
        expect(e.message).to.be('Expected "" to be [object String] and not empty');
      });
    });
    it('NEGATIVE - createKeystore() - Errors if "password" value passed is not type string', async () => {
      await driver.executeScript(function(keyList){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.createKeystore(12345);
      }, keyList).catch(e => {
        expect(e.message).to.contain('Expected "12345" to be [object String] and not empty');
      })
    });
    it('NEGATIVE - createKeystore() - Errors if a non-string value for "hint" is provided', async () => {
      await driver.executeScript(function(keyList, KEYSTORE_PASSWORD){
        let keystore = new Lamden.Keystore({ keyList });
        keystore.createKeystore(KEYSTORE_PASSWORD, 12345);
      }, keyList, KEYSTORE_PASSWORD).catch(e => {
        expect(e.message).to.contain('Expected "12345" to be [object String] and not empty');
      })
    });
  });

  context("Keystore password hints", () => {
    it("getPasswordHint() - Can get the hint from the keystore instance", async () => {
      let res = await driver.executeScript(function(KEYSTORE_DATA){
        let keystore = new Lamden.Keystore({ keystoreData: KEYSTORE_DATA });
        let hint = keystore.getPasswordHint();
        return hint;
      }, KEYSTORE_DATA)
      expect(res).to.be(KEYSTORE_HINT);
    });
    it("getPasswordHint() - Can get the hint from a supplied keystore", async () => {
      let res = await driver.executeScript(function(KEYSTORE_DATA){
        let keystore = new Lamden.Keystore();
        let hint = keystore.getPasswordHint(KEYSTORE_DATA);
        return hint;
      }, KEYSTORE_DATA)
      expect(res).to.be(KEYSTORE_HINT);
    });
    it("getPasswordHint() - Can get the hint from a supplied string keystore", async () => {
      let res = await driver.executeScript(function(KEYSTORE_DATA){
        let keystore = new Lamden.Keystore();
        let hint = keystore.getPasswordHint(JSON.stringify(KEYSTORE_DATA));
        return hint;
      }, KEYSTORE_DATA)
      expect(res).to.be(KEYSTORE_HINT);
    });
  });
  context("Decrypting a Keystore", () => {
    it("decryptKeystore() - Can decrypte a keystore", async () => {
      let res = await driver.executeScript(function(KEYSTORE_DATA, KEYSTORE_PASSWORD){
        let keystore = new Lamden.Keystore({ keystoreData: KEYSTORE_DATA });
        keystore.decryptKeystore(KEYSTORE_PASSWORD);
        return [keystore.keyList.numOfKeys(), keystore.version];
      }, KEYSTORE_DATA, KEYSTORE_PASSWORD)
      expect(res[0]).to.be(2);
      expect(res[1]).to.be("1.0");
    });
    it("decryptKeystore() - Can decrypte a keystore passed as a string", async () => {
      let res = await driver.executeScript(function(KEYSTORE_DATA ,KEYSTORE_PASSWORD){
        let keystore = new Lamden.Keystore({ keystoreData: JSON.stringify(KEYSTORE_DATA) });
        keystore.decryptKeystore(KEYSTORE_PASSWORD);
        return [keystore.keyList.numOfKeys(), keystore.version];
      }, KEYSTORE_DATA, KEYSTORE_PASSWORD)
      expect(res[0]).to.be(2);
      expect(res[1]).to.be("1.0");
    });
    it("decryptKeystore() - Can decrypt a provided keystore", async () => {
      let res = await driver.executeScript(function(KEYSTORE_PASSWORD, KEYSTORE_DATA){
        let keystore = new Lamden.Keystore();
        keystore.decryptKeystore(KEYSTORE_PASSWORD, KEYSTORE_DATA);
        return [keystore.keyList.numOfKeys(), keystore.version];
      }, KEYSTORE_PASSWORD, KEYSTORE_DATA)
      expect(res[0]).to.be(2);
      expect(res[1]).to.be("1.0");
    });
    it("NEGATIVE - decryptKeystore() - Reports Incorrect Password", async () => {
      await driver.executeScript(function(KEYSTORE_DATA){
        let keystore = new Lamden.Keystore();
        keystore.decryptKeystore("Nope", KEYSTORE_DATA);
      }, KEYSTORE_DATA).catch((e) => {
        expect(e.message).to.contain("Incorrect Keystore Password.");
      });
    });
    it("NEGATIVE - decryptKeystore() - Errors if no keystoreData found", async () => {
      await driver.executeScript(function(KEYSTORE_PASSWORD){
        let keystore = new Lamden.Keystore();
        keystore.decryptKeystore(KEYSTORE_PASSWORD);
      }, KEYSTORE_PASSWORD).catch((e) => {
        expect(e.message).to.contain("No keystoreData to decrypt.");
      });
    });
  });
});
