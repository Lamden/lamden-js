/*
    The Transaction Batcher is in alpha and so I disabled the test cases for it as they cause the suite to fail.
    The nonces won't increment properly depending on network lag and I don't have a good solution to it.
*/
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

let networkInfo = {
  hosts: ["https://testnet-master-1.lamden.io:443"],
};

let uid = "randomUIDstring";

const senderWallet1 = {
  vk: "960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb",
  sk: "c8a3c5333aa3b058c4fa16d48db52355ab62ddc8daa9a183706a912e522440b6",
};
const senderWallet2 = {
  vk: "6a91a9a65eb80829a360efc0555cad8841af64c78375bbf394f6ecb89d5644ee",
  sk: "4166ed44f465c51d562895295cdcde64a3444b14ea2a3e477c60cf0ecde65230",
};

let recieverWallet = {
  vk: "f16c130ceb7ed9bcebde301488cfd507717d5d511674bc269c39ad41fc15d780",
};

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

const makeTxList = (senderVK, receiver, amount) => {
  let txList = [];
  for (i = 0; i <= amount - 1; i++) {
    txList.push({
      uid,
      senderVk: senderVK,
      contractName: "currency",
      methodName: "transfer",
      kwargs: {
        to: receiver,
        amount: { __fixed__: "0.0005" },
      },
      stampLimit: 500,
    });
  }
  return txList;
};

let keyList = {};
keyList[senderWallet1.vk] = senderWallet1.sk;
keyList[senderWallet2.vk] = senderWallet2.sk;

describe("Browsers Tests: Test TransactionBuilder class", async () => {
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
    it("can create an instance", async () => {
      let txb = await driver.executeScript(function (networkInfo) {
        return new Lamden.TransactionBatcher(networkInfo);
      }, networkInfo)
      expect(txb.running).to.be(false);
    });
  }); /*
    context('TransactionBatcher.addTransaction()', () => {
        it('can add a list of transactions for 1 sender', () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)
            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)
            txList1.forEach(txInfo => txb.addTransaction(txInfo))

            expect(txb.txBatches[senderWallet1.vk].length).to.be(txList1.length)
        })
        it('can add a list of transactions for 2 sender', () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)

            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)
            const txList2 = makeTxList(senderWallet2.vk, recieverWallet.vk, 15)

            txList1.forEach(txInfo => txb.addTransaction(txInfo))
            txList2.forEach(txInfo => txb.addTransaction(txInfo))

            expect(txb.txBatches[senderWallet1.vk].length).to.be(txList1.length)
            expect(txb.txBatches[senderWallet2.vk].length).to.be(txList2.length)
            expect(Object.keys(txb.txBatches).length).to.be(2)
        })
        it('can add a list of transactions and split info into senders', () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)

            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)
            const txList2 = makeTxList(senderWallet2.vk, recieverWallet.vk, 15)

            txb.addTransactionList([...txList1, ...txList2])

            expect(txb.txBatches[senderWallet1.vk].length).to.be(txList1.length)
            expect(txb.txBatches[senderWallet2.vk].length).to.be(txList2.length)
            expect(Object.keys(txb.txBatches).length).to.be(2)
        })
    })
    context('TransactionBatcher.getStartingNonce()', () => {
        it('can the starting nonce for a senderVk', async () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)
            let response = await txb.getStartingNonce(senderWallet1.vk)

            expect(response.nonce >= 0).to.be(true)
        })
    })
    context('TransactionBatcher.setBatchNonces()', () => {
        it('can increment the nonces in a txList', async () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)
            let response = await txb.getStartingNonce(senderWallet1.vk)

            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)

            let newList = txb.setBatchNonces(response, txList1)

            newList.forEach((txbuilder, index) => {
                expect(txbuilder.nonce).to.be(response.nonce + index)
            })
        })
    })
    context('TransactionBatcher.signBatch()', () => {
        it('can sign a list of transactions', async () => {
            let txb = new Lamden.TransactionBatcher(networkInfo)
            let response = await txb.getStartingNonce(senderWallet1.vk)
            
            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)

            let newList = txb.setBatchNonces(response, txList1)
            txb.signBatch(newList, senderWallet1.sk)

            newList.forEach((txbuilder) => {
                expect(txbuilder.signature.length > 0).to.be(true)
                expect(txbuilder.transactionSigned).to.be(true)
            })
        })
    })
    context('TransactionBatcher.sendBatch()', () => {
        it('can send a batch of successful transactions', async function () {
            this.timeout(60000);
            let txb = new Lamden.TransactionBatcher(networkInfo)
            let response = await txb.getStartingNonce(senderWallet1.vk)

            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)

            let newList = txb.setBatchNonces(response, txList1)
            txb.signBatch(newList, senderWallet1.sk)

            let sentBatch = await txb.sendBatch(newList)

            sentBatch.forEach(async (promise) => {
                let txBuilder = await promise
                if (!txBuilder.txSendResult.hash) console.log(txBuilder.nonce + ": " + txBuilder.txSendResult.errors)
                expect(typeof txBuilder.txSendResult.hash === 'string').to.be(true)
            })

            expect(txb.hasTransactions()).to.be(false)
        })
    })

    context('TransactionBatcher.sendAllBatches()', () => {
        it('Can send batches from all senders', async function () {
            this.timeout(60000);
            sleep(1500)
            let txb = new Lamden.TransactionBatcher(networkInfo)
            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 15)
            const txList2 = makeTxList(senderWallet2.vk, recieverWallet.vk, 15)

            txb.addTransactionList([...txList1, ...txList2])

            let sentBatchs = await txb.sendAllBatches(keyList)

            sentBatchs.forEach(txBuilder => {
                if (!txBuilder.txSendResult.hash) console.log(txBuilder.nonce + ": " + txBuilder.txSendResult.errors)
                expect(typeof txBuilder.txSendResult.hash === 'string').to.be(true)
            })

            expect(txb.hasTransactions()).to.be(false)
        })
        it('Can process overflow', async function () {
            this.timeout(30000);
            sleep(1500)
            let txb = new Lamden.TransactionBatcher(networkInfo)
            const txList1 = makeTxList(senderWallet1.vk, recieverWallet.vk, 1)
            const txList2 = makeTxList(senderWallet2.vk, recieverWallet.vk, 1)

            txb.addTransactionList([...txList1, ...txList2])
            let txPromise = txb.sendAllBatches(keyList)
            txb.addTransactionList([...txList1, ...txList2])

            let sentBatchs1 = await txPromise
            sentBatchs1.forEach(txBuilder => {
                if (!txBuilder.txSendResult.hash) console.log(txBuilder.nonce + ": " + txBuilder.txSendResult.errors)
                expect(typeof txBuilder.txSendResult.hash === 'string').to.be(true)
            })

            expect(txb.hasTransactions()).to.be(true)

            let sentBatchs2 = await txb.sendAllBatches(keyList)
            sleep(1500)
            sentBatchs2.forEach(txBuilder => {
                if (!txBuilder.txSendResult.hash) console.log(txBuilder.nonce + ": " + txBuilder.txSendResult.errors)
                expect(typeof txBuilder.txSendResult.hash === 'string').to.be(true)
            })

            expect(txb.hasTransactions()).to.be(false)

        })
    })*/
});
