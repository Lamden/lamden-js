const expect = require("expect.js");
require("dotenv").config();
const Lamden = require("../dist/cjs/lamden");

const { vk, sk } = process.env;

let goodNetwork_v1 = {
  type: "testnet",
  name: "Lamden Public Testnet",
  hosts: ["https://testnet-master-1.lamden.io:443"],
  blockservice_hosts: ["http://165.227.181.34:3535"]
};

let goodNetwork = {
	type: "testnet",
	version: 2,
	name: "Lamden Public Testnet",
	hosts: ["https://testnet-v2-master-sf.lamden.io"],
	blockservice_hosts: ["https://testnet-v2-bs-sf.lamden.io"]
  };
  

let badNetwork = {
  type: "testnet",
  name: "Bad Network",
  hosts: ["http://badnetwork.lamden.io:18080"],
  blockservice_hosts: ["http://165.227.181.34:3535"]
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

let txInfo_noNonce = { senderVk, contractName, methodName, kwargs, stampLimit };
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

function sleep(milliseconds) {
	const date = Date.now();
	let currentDate = null;
	do {
	  currentDate = Date.now();
	} while (currentDate - date < milliseconds);
}

describe("Test TransactionBuilder class", () => {
	context("new TransactionBuilder", () => {
		it("can create an instance without nonce or processor", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			let newTxInfo = newTx.getAllInfo();
			expect(newTx).to.exist;
			//Validate TX Info propagated in the class
			expect(newTxInfo.uid).to.be(txInfo_noNonce.uid);
			expect(newTxInfo.txInfo.senderVk).to.be(txInfo_noNonce.senderVk);
			expect(newTxInfo.txInfo.contractName).to.be(txInfo_noNonce.contractName);
			expect(newTxInfo.txInfo.methodName).to.be(txInfo_noNonce.methodName);
			expect(JSON.stringify(newTxInfo.txInfo.kwargs)).to.be(JSON.stringify(txInfo_noNonce.kwargs));
			//Validate internal properties
			expect(newTxInfo.signed).to.be(false);
			expect(newTxInfo.signature).to.be(undefined);
			expect(JSON.stringify(newTxInfo.txSendResult)).to.be(JSON.stringify({ errors: [] }));
			expect(JSON.stringify(newTxInfo.txBlockResult)).to.be(JSON.stringify({}));
			expect(JSON.stringify(newTxInfo.nonceResult)).to.be(JSON.stringify({}));
		});
		it("can create an instance by providing nonce and processor", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
			let newTxInfo = newTx.getAllInfo();
			expect(newTx).to.exist;
			expect(newTxInfo.txInfo.nonce).to.exist;
			expect(newTxInfo.txInfo.processor).to.exist;
		});

		it("it throws error when missing arguments", () => {
			function testValues(
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
				return new Lamden.TransactionBuilder(networkInfo, txInfo);
				} catch (e) {
				expect(e.message.includes(argName)).to.be(true);
				}
			}
			let newTx = undefined;
			newTx = testValues(
				"Network Info",
				undefined,
				senderWallet.vk,
				"currency",
				"transfer",
				kwargs,
				50000
			);
			newTx = testValues("Sender", goodNetwork, undefined, "currency", "transfer", kwargs, 50000);
			newTx = testValues(
				"Contract",
				goodNetwork,
				senderWallet.vk,
				undefined,
				"transfer",
				kwargs,
				50000
			);
			newTx = testValues(
				"Method",
				goodNetwork,
				senderWallet.vk,
				"currency",
				undefined,
				kwargs,
				50000
			);
			newTx = testValues(
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

		it("it can create an instance with a Lamden Network Object as first arg", () => {
			let network = new Lamden.Network(goodNetwork);
			let error = "";
			try {
				var newTx = new Lamden.TransactionBuilder(network, txInfo_withNonce);
			} catch (e) {
				error = e;
			}
			expect(newTx).to.exist;
			expect(error === "").to.be(true);
		});
	});

	context("TransactionBuilder.sign()", () => {
		it("can sign and verify a transaction", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
			newTx.sign(senderWallet.sk);
			expect(newTx.transactionSigned).to.be(true);
			expect(newTx.verifySignature()).to.be(true);
		});
		it("can sign and verify a transaction using a keystore wallet", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);

			let stringBuffer = Buffer.from(newTx.sortedPayload.json);
			let message = new Uint8Array(stringBuffer);
			let keystore = new Lamden.Keystore({ key: { sk: senderWallet.sk } });

			newTx.sign(null, keystore.wallets[0]);

			expect(newTx.transactionSigned).to.be(true);
			expect(newTx.verifySignature()).to.be(true);
			expect(keystore.wallets[0].verify(message, newTx.signature)).to.be(true);
		});
		it("throws and error if nonce not set ", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			expect(newTx.nonce).to.not.exist;
			expect(newTx.processor).to.not.exist;
			try {
				newTx.sign(senderWallet.sk);
			} catch (e) {
				expect(e.toString()).to.be("Error: No Nonce Set. Call getNonce()");
			}
		});
	});

	context("TransactionBuilder.makeTransaction()", () => {
		it("includes timestamp in metadata for v1 network", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork_v1, txInfo_withNonce);
			newTx.makeTransaction()
			expect(newTx.tx.metadata.timestamp).to.exist
		});
		it("does not have timestamp in metadata for v2 network", () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_withNonce);
			newTx.makeTransaction()
			expect(newTx.tx.metadata.timestamp).to.be(undefined)
		});

	});

	context("TransactionBuilder.getNonce()", () => {
		it("can retrieve nonce and processor from the masternode", async () => {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			expect(newTx.nonce).to.not.exist;
			expect(newTx.processor).to.not.exist;

			let response = await newTx.getNonce();

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
			let error = "";
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			newTx.sender = "not-a-good-vk";
			try {
				await newTx.getNonce();
			} catch (e) {
				error = e.message;
			}
			expect(error).to.be(`${newTx.sender} is not a hex string.`);
		});
		it("throws error if provided network is unresponsive", async () => {
			let error = "";
			let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_noNonce);
			try {
				await newTx.getNonce();
			} catch (e) {
				error = e.message;
			}
			expect(error).to.be(`Unable to get nonce for ${newTx.sender} on network ${newTx.url}`);
		});
	});

	context("TransactionBuilder.send()", () => {
		let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);

		it("Sends a transaction and receives a hash back", async function () {
			await newTx1.getNonce();
			//Sign transaction
			newTx1.sign(senderWallet.sk);

			//Validate transaction is signed
			expect(newTx1.transactionSigned).to.be(true);
			expect(newTx1.verifySignature()).to.be(true);

			//Send Tx
			await newTx1.send();
			//console.log(newTx1.getAllInfo())

			let txSendResult = newTx1.txSendResult;
			expect(txSendResult.success).to.equal("Transaction successfully submitted to the network.");
			expect(txSendResult.hash).to.exist;
			expect(txSendResult.timestamp).to.exist;
		});
		it("Creates ResultInfo object based on txSendResult", async function () {
			let resultInfo = newTx1.resultInfo;

			expect(resultInfo.title).to.equal("Transaction Pending");
			expect(resultInfo.subtitle).to.equal("Your transaction was submitted and is being processed");
			expect(resultInfo.message).to.equal(`Tx Hash: ${newTx1.txSendResult.hash}`);
			expect(resultInfo.type).to.equal("success");
		});
		it("Sends transactions and can get hash result from masternode", async function () {
			await newTx1.checkForTransactionResult();
			let txBlockResult = newTx1.txBlockResult;
			expect(txBlockResult.hash).to.equal(newTx1.txSendResult.hash);
			expect(txBlockResult.result).to.equal("None");
			expect(txBlockResult.stamps_used > 0).to.be(true);
			expect(txBlockResult.state.length).to.equal(2);
			expect(txBlockResult.status).to.equal(0);
			expect(JSON.stringify(txBlockResult.transaction)).to.equal(JSON.stringify(newTx1.tx));
			expect(txBlockResult.timestamp).to.exist;
		});
		it("Creates ResultInfo object based on txBlockResult", async function () {
			let resultInfo = newTx1.resultInfo;
			expect(resultInfo.title).to.equal("Transaction Successful");
			expect(resultInfo.subtitle).to.equal(`Your transaction used ${resultInfo.stampsUsed} stamps`);
			expect(resultInfo.message).to.equal("");
			expect(resultInfo.type).to.equal("success");
			expect(resultInfo.errorInfo).to.equal(undefined);
			expect(resultInfo.stampsUsed).to.equal(newTx1.txBlockResult.stamps_used);
			expect(resultInfo.statusCode).to.equal(0);
			expect(resultInfo.returnResult).to.equal("None");
		});
		it("gets nonce and signs transacation automatically if sk is provided", async function () {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			//Send Tx
			await newTx.send(senderWallet.sk);

			let txSendResult = newTx.txSendResult;

			expect(txSendResult.success).to.equal("Transaction successfully submitted to the network.");
			expect(txSendResult.hash).to.exist;
			expect(txSendResult.timestamp).to.exist;
		});
		it("throws error if provided network is unresponsive", async function () {
			let newTx = new Lamden.TransactionBuilder(badNetwork, txInfo_withNonce);
			let response = await newTx.send(senderWallet.sk);
			expect(response.errors[0]).to.be(
				"FetchError: request to http://badnetwork.lamden.io:18080/ failed, reason: getaddrinfo ENOTFOUND badnetwork.lamden.io"
			);
		});
		it("can return execution errors list", async function () {
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			newTx.stampLimit = 0;
			//Send Tx
			await newTx.send(senderWallet.sk);
			await newTx.checkForTransactionResult();

			let resultInfo = newTx.resultInfo;

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
			expect(resultInfo.stampsUsed).to.equal(newTx.txBlockResult.stamps_used);
			expect(resultInfo.statusCode).to.equal(1);
			expect(resultInfo.returnResult.includes("The cost has exceeded the stamp supplied!")).to.be(
				true
			);
		});
		it("can return transaction validation errors list", async function () {
			let sender = Lamden.wallet.new_wallet();
			let newTx = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
			newTx.sender = sender.vk;

			//Send Transaction
			let response = await newTx.send(sender.sk);
			expect(response.errors.length > 0).to.be(true);
			expect(response.errors[0]).to.be(
				"Transaction sender has too few stamps for this transaction."
			);
		});
		it("can encode and send all annotation types", async function () {
			valuesTxInfo.kwargs = Lamden.Encoder("object", valuesTxInfo.kwargs);

			let newTx = new Lamden.TransactionBuilder(goodNetwork, valuesTxInfo);

			//Send Transaction
			let response = await newTx.send(senderWallet.sk);

			expect(response.success).to.be("Transaction successfully submitted to the network.");

			//Check Transaction
			let check = await newTx.checkForTransactionResult();
			expect(check.status).to.be(0);
		});
	});

	context("checkForTransactionResult()", () => {
		context("Promise", () => {
			it("Returns the result of a transaction", async function () {
				let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
				newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367f"
				let res = await newTx1.checkForTransactionResult()
				expect(res.hash).to.exist
				expect(res.status).to.equal(0)
			});
			it("Returns error and status code 2 if txHash could not be found after X tries.", async function () {
				let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
				newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367dd"
				newTx1.txCheckLimit = 2;
				let res = await newTx1.checkForTransactionResult()
				expect(res.errors.length).to.be.greaterThan(0)
				expect(res.status).to.equal(2)
				expect(res.errors.includes("Retry Attempts 2 hit while checking for Tx Result.")).to.equal(true)
			});
		})
		context("Callback", () => {
			it("Returns the result of a transaction", async function () {
				return new Promise(resolver => {
					let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
					newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367f"

					newTx1.checkForTransactionResult((res) => {
						expect(res.hash).to.exist
						expect(res.status).to.equal(0)
						resolver()
					});
				})
			});
			it("Returns error and status code 2 if txHash could not be found after X tries.", async function () {
				return new Promise(resolver => {
					let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
					newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367feqeq"
					newTx1.txCheckLimit = 2;
					newTx1.checkForTransactionResult((res) => {
						expect(res.errors.length).to.be.greaterThan(0)
						expect(res.status).to.equal(2)
						expect(res.errors.includes("Retry Attempts 2 hit while checking for Tx Result.")).to.equal(true)
						resolver()
					});
				})
			});
		})
	});
	
	context("checkBlockserviceForTransactionResult()", () => {
		context("Promise", () => {
			it("Returns the result of a transaction", async function () {
                this.timeout(60000)
				let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
                await newTx1.getNonce();
                //Sign transaction
                newTx1.sign(senderWallet.sk);

				await newTx1.send()
				let res = await newTx1.checkBlockserviceForTransactionResult()
				expect(res.hash).to.exist
				expect(res.status).to.equal(0)
				expect(res.state_changes_obj).to.exist
			});

			it("Fails back to masternode checker if blockservice is not available.", async function () {
				let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
				newTx1.blockservice.hosts = []
				newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367f21"
				newTx1.txCheckLimit = 2;
				let res = await newTx1.checkBlockserviceForTransactionResult()
				expect(res.errors.length).to.be.greaterThan(0)
				expect(res.status).to.equal(2)
				expect(res.errors.includes("Retry Attempts 2 hit while checking for Tx Result.")).to.equal(true)
			});
		})
		context("Callback", () => {
			it("Returns the result of a transaction", async function () {
                let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
                await newTx1.getNonce()
                newTx1.sign(senderWallet.sk)
                await newTx1.send()
				return new Promise(resolver => {
					newTx1.checkBlockserviceForTransactionResult((res) => {
						expect(res.hash).to.exist
						expect(res.status).to.equal(0)
						expect(res.state_changes_obj).to.exist
						resolver()
					});
				})
			});
			it("Returns error and status code 2 if txHash could not be found within X number of blocks.", function () {
				this.timeout(50000)
				let newTx1 = new Lamden.TransactionBuilder(goodNetwork, txInfo_noNonce);
				newTx1.txHash = "bb26df2b0583858a5e18ca2c37d3586ea58c5ed1f4cfb67d3a9b01acbedf367f"
				newTx1.maxBlockToCheck = 2
				newTx1.checkBlockserviceForTransactionResult((res) => {
					expect(res.errors.length).to.be.greaterThan(0)
					expect(res.status).to.equal(2)
					expect(res.errors[0]).to.equal(`No transaction result found within ${newTx1.maxBlockToCheck} attempts.`)
				});
			});
		})
	})
});
