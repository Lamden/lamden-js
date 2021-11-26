const {Builder, logging, Capabilities } = require('selenium-webdriver');
const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');
const expect = require("expect.js");
const Lamden = require("../../dist/cjs/lamden");
require("dotenv").config();


// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/lib/logging.html
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
const caps = Capabilities.chrome();
caps.setLoggingPrefs(prefs);


const { vk, sk } = process.env;

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

let uid = "randomUIDstring";

const senderWallet = { vk, sk };

let recieverWallet = Lamden.wallet.new_wallet();

let senderVk = senderWallet.vk;
let contractName = "currency";
let methodName = "transfer";
let stampLimit = 100;
let nonce = 0;
let processor = "0000000000000000000000000000000000000000000000000000000000000000";

let kwargs = {
  to: recieverWallet.vk,
  amount: 1,
};

let valuesTxInfo = {
  senderVk: senderWallet.vk,
  contractName: "con_values_testing_2",
  methodName: "test_values",
  stampLimit: 100,
  kwargs: {
    UID: "lamdenjs-testing",
    Str: "test string",
    Int: 1,
    Float: 1.01,
    Bool: false,
    Dict: { s: "test", i: 1, f: 1.1, b: true, d: { f: 1.1, l: [1, 1.1] }, l: [1, 1.1] },
    List: ["test", 1, 1.1, false, { f: 1.1, l: [1, 1.1] }, [1, 1.1]],
    ANY: { f: 1.1, l: [1, 1.1] },
    DateTime: { datetime: "2020-07-28T19:16:35.059Z" },
    TimeDelta: { timedelta: 1000 },
  },
};

let txInfo_noNonce = { uid, senderVk, contractName, methodName, kwargs, stampLimit };
let txInfo_withNonce = {
  uid,
  senderVk,
  contractName,
  methodName,
  kwargs,
  stampLimit,
  nonce,
  processor,
};

describe("Browsers Tests: Test TransactionBuilder class", () => {
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

  context("new TransactionBuilder", () => {
    it("can create an instance without nonce or processor", async () => {
      const {newTx, newTxInfo} =  await driver.executeScript(function (goodNetwork, txInfo_noNonce) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        let newTxInfo = newTx.getAllInfo();
        return {newTx, newTxInfo}
      }, goodNetwork, txInfo_noNonce)
      expect(newTx).to.exist;
      //Validate TX Info propagated in the class
      expect(newTxInfo.uid).to.be(txInfo_noNonce.uid);
      expect(newTxInfo.txInfo.senderVk).to.be(txInfo_noNonce.senderVk);
      expect(newTxInfo.txInfo.contractName).to.be(txInfo_noNonce.contractName);
      expect(newTxInfo.txInfo.methodName).to.be(txInfo_noNonce.methodName);
      expect(newTxInfo.txInfo.kwargs.to).to.be(txInfo_noNonce.kwargs.to);
      expect(newTxInfo.txInfo.kwargs.amount).to.be(txInfo_noNonce.kwargs.amount);
      //Validate internal properties
      expect(newTxInfo.signed).to.be(false);
      expect(newTxInfo.signature).to.be(null);
      expect(JSON.stringify(newTxInfo.txSendResult)).to.be(JSON.stringify({ errors: [] }));
      expect(JSON.stringify(newTxInfo.txBlockResult)).to.be(JSON.stringify({}));
      expect(JSON.stringify(newTxInfo.nonceResult)).to.be(JSON.stringify({}));
    });
    it("can create an instance by providing nonce and processor", async () => {
      const {newTx, newTxInfo} =  await driver.executeScript(function (goodNetwork, txInfo_withNonce) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
        let newTxInfo = newTx.getAllInfo();
        return {newTx, newTxInfo}
      }, goodNetwork, txInfo_withNonce)
      expect(newTx).to.exist;
      expect(newTxInfo.txInfo.nonce).to.exist;
      expect(newTxInfo.txInfo.processor).to.exist;
    });

    it("it throws error when missing arguments", async() => {
      async function testValues(
        argName,
        networkInfo,
        senderVk,
        contractName,
        methodName,
        kwargs,
        stampLimit
      ) {
        let txInfo = { senderVk, contractName, methodName, kwargs, stampLimit };
        try {
          return await driver.executeScript(function (networkInfo, txInfo) {
            return new Lamden.TransactionBuilder(networkInfo, txInfo)
          }, networkInfo, txInfo)
        } catch (e) {
          expect(e.message.includes(argName)).to.be(true);
        }
      }
      let newTx = undefined;
      
      newTx = await testValues(
        "Network Info",
        undefined,
        senderWallet.vk,
        "currency",
        "transfer",
        kwargs,
        50000
      );
      newTx = await testValues("Sender", goodNetwork, undefined, "currency", "transfer", kwargs, 50000);
      newTx = await testValues(
        "Contract",
        goodNetwork,
        senderWallet.vk,
        undefined,
        "transfer",
        kwargs,
        50000
      );
      newTx = await testValues(
        "Method",
        goodNetwork,
        senderWallet.vk,
        "currency",
        undefined,
        kwargs,
        50000
      );
      newTx = await testValues(
        "Stamps",
        goodNetwork,
        senderWallet.vk,
        "currency",
        "transfer",
        kwargs,
        undefined
      );
      expect(typeof newTx).to.be("undefined");
    });

    it("it can create an instance with a Lamden Network Object as first arg", async () => {
      let error = "";
      let newTx = await driver.executeScript(function (goodNetwork, txInfo_withNonce) {
        let network = new Lamden.Network(goodNetwork);
        let newTx = new Lamden.TransactionBuilder(network, txInfo_withNonce);
        return newTx
      }, goodNetwork, txInfo_withNonce).catch(e => {
        error = e;
      })
      expect(newTx).to.exist;
      expect(error === "").to.be(true);
    });
  });

  context("TransactionBuilder.sign()", () => {
    it("can sign and verify a transaction", async () => {
      let res = await driver.executeScript(function (goodNetwork, txInfo_withNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
        newTx.sign(senderWallet.sk);
        return [newTx.transactionSigned, newTx.verifySignature()];
      }, goodNetwork, txInfo_withNonce, senderWallet)
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(true);
    });
    it("can sign and verify a transaction using a keystore wallet", async () => {
      let res = await driver.executeScript(function (goodNetwork, txInfo_withNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
        let stringBuffer = Buffer.from(newTx.sortedPayload.json);
        let message = new Uint8Array(stringBuffer);
        let keystore = new Lamden.Keystore({ key: { sk: senderWallet.sk } });
        newTx.sign(null, keystore.wallets[0]);
        return [newTx.transactionSigned, newTx.verifySignature(), keystore.wallets[0].verify(message, newTx.signature)];
      }, goodNetwork, txInfo_withNonce, senderWallet)
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(true);
      expect(res[2]).to.be(true);
    });
    it("throws and error if nonce not set ", async () => {
      let res = await driver.executeScript(function (goodNetwork, txInfo_noNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        let error = ""
        try {
          newTx.sign(senderWallet.sk);
        } catch(e){
          error = e
        }
        return [newTx, error];
      }, goodNetwork, txInfo_noNonce, senderWallet)
      expect(res[0].nonce).to.not.exist;
      expect(res[0].processor).to.not.exist;
    });
  });

  context("TransactionBuilder.getNonce()", () => {
    it("can retrieve nonce and processor from the masternode", async () => {
      const {newTx, response} =await driver.executeScript(async function (goodNetwork, txInfo_noNonce){
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        let response = await newTx.getNonce();
        return {newTx, response}
      }, goodNetwork, txInfo_noNonce)
      expect(newTx.nonce).to.not.exist;
      expect(newTx.processor).to.not.exist;

      //Validate Nonce was retrieved
      expect(response.nonce).to.exist;
      expect(response.processor).to.exist;
      expect(response.sender).to.exist;
      expect(newTx.nonce).to.be(response.nonce);
      expect(newTx.processor).to.be(response.processor);
      expect(newTx.sender).to.be(response.sender);
      expect(goodNetwork.hosts.includes(newTx.nonceMasternode)).to.be(true);
    });
    it("throws error if vk is not correct type, missing or invalid", async () => {
      await driver.executeScript(async function (goodNetwork, txInfo_noNonce){
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        newTx.sender = "not-a-good-vk";
        await newTx.getNonce();
      }, goodNetwork, txInfo_noNonce).catch(e =>{
        expect(e.message).to.contain(`is not a hex string.`);
      });
    });
    it("throws error if provided network is unresponsive", async () => {
      let res = await driver.executeScript(async function (badNetwork, txInfo_noNonce){
        let flag = false;
        let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_noNonce);
        try{
          await newTx.getNonce();
        } catch(e) {
          if(e.message.includes(`Unable to get nonce for ${newTx.sender} on network ${newTx.url}`)) {
            flag = true
          }
        }
        return flag
      }, badNetwork, txInfo_noNonce)
      expect(res).to.be(true);
    });
  });

  context("TransactionBuilder.send()", () => {
    let oldResultInfo,resultInfo, txSendResult, txBlockResult, newTx1;
    it("Sends a transaction and receives a hash back", async function () {
      this.timeout(20000);
      await driver.executeAsyncScript(async function (goodNetwork, txInfo_noNonce, senderWallet) {
        let callback = arguments[arguments.length-1]
        let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        await newTx1.getNonce();
        //Sign transaction
        newTx1.sign(senderWallet.sk);
        //Send Tx
        await newTx1.send();
        let oldResultInfo = newTx1.resultInfo
        let txSendResult = newTx1.txSendResult;
        await newTx1.checkForTransactionResult();
        let txBlockResult = newTx1.txBlockResult;
        callback([newTx1.transactionSigned, newTx1.verifySignature(), txSendResult, oldResultInfo, txBlockResult, newTx1.resultInfo, newTx1])
    }, goodNetwork, txInfo_noNonce, senderWallet).then(res => {
      expect(res[0]).to.be(true);
      expect(res[1]).to.be(true);
      expect(res[2].success).to.contain("Transaction successfully submitted to the network.");
      expect(res[2].hash).to.exist;
      expect(res[2].timestamp).to.exist;
      txSendResult = res[2];
      oldResultInfo = res[3];
      txBlockResult = res[4];
      resultInfo = res[5]
      newTx1 = res[6];
    })
    });
    it("Creates ResultInfo object based on txSendResult", function () {
      expect(oldResultInfo.title).to.equal("Transaction Pending");
      expect(oldResultInfo.subtitle).to.equal("Your transaction was submitted and is being processed");
      expect(oldResultInfo.message).to.equal(`Tx Hash: ${txSendResult.hash}`);
      expect(oldResultInfo.type).to.equal("success");
    });
    it("Sends transactions and can get hash result from masternode", function () {
      expect(txBlockResult.hash).to.equal(txSendResult.hash);
      expect(txBlockResult.result).to.equal("None");
      expect(txBlockResult.stamps_used > 0).to.be(true);
      expect(txBlockResult.state.length).to.equal(2);
      expect(txBlockResult.status).to.equal(0);
      expect(JSON.stringify(txBlockResult.transaction)).to.equal(JSON.stringify(newTx1.tx));
      expect(txBlockResult.timestamp).to.exist;
    });
    it("Creates ResultInfo object based on txBlockResult", async function () {
      expect(resultInfo.title).to.equal("Transaction Successful");
      expect(resultInfo.subtitle).to.equal(`Your transaction used ${resultInfo.stampsUsed} stamps`);
      expect(resultInfo.message).to.equal("");
      expect(resultInfo.type).to.equal("success");
      expect(resultInfo.errorInfo).to.equal(null);
      expect(resultInfo.stampsUsed?resultInfo.stampsUsed:undefined).to.equal(txBlockResult.stamps_used);
      expect(resultInfo.statusCode).to.equal(0);
      expect(resultInfo.returnResult).to.equal("None");
    });
    it("gets nonce and signs transacation automatically if sk is provided", async function () {
      this.timeout(30000)
      let txSendResult = await driver.executeScript(async function (goodNetwork, txInfo_noNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        await newTx.send(senderWallet.sk);
        let txSendResult = newTx.txSendResult;
        return txSendResult;
      }, goodNetwork, txInfo_noNonce, senderWallet)

      expect(txSendResult.success).to.equal("Transaction successfully submitted to the network.");
      expect(txSendResult.hash).to.exist;
      expect(txSendResult.timestamp).to.exist;
    });
    it("throws error if provided network is unresponsive", async function () {
      let response = await driver.executeScript(async function (badNetwork, txInfo_withNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_withNonce)
        let res = await newTx.send(senderWallet.sk);
        return res
      }, badNetwork, txInfo_withNonce, senderWallet)
      expect(response.errors[0]).to.be(
        "TypeError: Failed to fetch"
      );
    });
    it("can return execution errors list", async function () {
      this.timeout(30000)
      let {resultInfo, txBlockResult} = await driver.executeScript(async function (goodNetwork, txInfo_noNonce, senderWallet) {
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        newTx.stampLimit = 0;
        //Send Tx
        await newTx.send(senderWallet.sk);
        await newTx.checkForTransactionResult();
        let resultInfo = newTx.resultInfo;
        let txBlockResult = newTx.txBlockResult;
        return {resultInfo, txBlockResult}
      }, goodNetwork, txInfo_noNonce, senderWallet)

      expect(resultInfo.title).to.equal("Transaction Failed");
      expect(resultInfo.subtitle).to.equal(
        `Your transaction returned status code 1 and  used ${resultInfo.stampsUsed} stamps`
      );
      expect(resultInfo.message).to.equal("This transaction returned 1 errors.");
      expect(resultInfo.type).to.equal("error");
      expect(resultInfo.errorInfo.length).to.equal(2);
      expect(resultInfo.errorInfo[0]).to.equal("This transaction returned a non-zero status code");
      expect(resultInfo.errorInfo[1].includes("The cost has exceeded the stamp supplied!")).to.be(
        true
      );
      expect(resultInfo.stampsUsed).to.equal(txBlockResult.stamps_used);
      expect(resultInfo.statusCode).to.equal(1);
      expect(resultInfo.returnResult.includes("The cost has exceeded the stamp supplied!")).to.be(
        true
      );
    });
    it("can return transaction validation errors list", async function () {
      this.timeout(30000)
      let response = await driver.executeScript(async function (goodNetwork, txInfo_noNonce) {
        let sender = Lamden.wallet.new_wallet();
        let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
        newTx.sender = sender.vk;
        //Send Transaction
        let response = await newTx.send(sender.sk)
        return response
      }, goodNetwork, txInfo_noNonce)
      expect(response.errors.length > 0).to.be(true);
      expect(response.errors[0]).to.be(
        "Transaction sender has too few stamps for this transaction."
      );
    });
    it("can encode and send all annotation types", async function () {
      this.timeout(30000);
      const {response, check} = await driver.executeScript(async function (valuesTxInfo,goodNetwork,senderWallet){
        valuesTxInfo.kwargs = Lamden.Encoder("object", valuesTxInfo.kwargs);

        let newTx = new Lamden.TransactionBuilder(goodNetwork, valuesTxInfo);
  
        //Send Transaction
        let response = await newTx.send(senderWallet.sk);
        //Check Transaction
        let check = await newTx.checkForTransactionResult();
        return {response, check}
      },valuesTxInfo,goodNetwork,senderWallet)

      expect(response.success).to.be("Transaction successfully submitted to the network.");
      expect(check.status).to.be(0);
    });
  });
});
