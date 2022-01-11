const expect = require("expect.js");
const Lamden = require("../dist/cjs/lamden");
const { Blockservice_API, wallet } = Lamden;

let goodNetwork = {
	type: "testnet",
	name: "Lamden Public Testnet",
	blockservice_hosts: ["http://165.227.181.34:3535"],
};
let goodNetwork_api = new Blockservice_API(goodNetwork);

let badNetwork = {
	type: "testnet",
	name: "Bad Network",
	blockservice_hosts: ["http://badnetwork.lamden.io:18080"],
};

let badNetwork_api = new Blockservice_API(badNetwork);

function copyObject(object) {
	return JSON.parse(JSON.stringify(object));
}
let good_tx_hash = "b9f9d598c56ae579b8392651a9a463335b68bdf4d6fd60391fca19a7b1fdb46b"
let bad_tx_hash = "this_is_a_bad_tx_hash"

let keyPair = wallet.new_wallet();

const balanceCheckWallet = {
	float: "960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb",
	int: "01930f6472916ae53c9ebbe7d3faf8979c24cac33d68041aa4ab986401bbf7c3",
};

const good_key_info = {
	contractName: 'currency',
	variableName: 'balances',
	key: "960c002a36c30c3aec8bc670e9b8b40eebcfd545f4e9237579fd7395a21ccebb"
}

const keysToGet =  [{
	contractName: 'currency',
	variableName: "balances",
	key: '2341d744f11658d7f1ca1c514a1b76ff07898435c46402b1e4f8b00d4a13f5f9'
}]

const notExistKeysToGet =  [{
	contractName: 'currency',
	variableName: "balances",
	key: 'nope_key_123973'
}]

describe("Test Blockservice_API", () => {
	context("constructor", () => {
		it("can create an instance", () => {
			let bs_api = new Blockservice_API(goodNetwork);
			expect(bs_api).to.exist;
			expect(JSON.stringify(bs_api.hosts)).to.be(JSON.stringify(goodNetwork.blockservice_hosts));
			expect(bs_api.url).to.be(goodNetwork.blockservice_hosts[0]);
		});
		it("rejects arg not being an object", () => {
			let error;
			try {
				new Blockservice_API("some value");
			} catch (e) {
				error = e;
			}
			expect(error.message).to.be("Expected Network to be Object and got Type: string");
		});
		it("still creates instance if no hosts provided", () => {
			let networkInfo = copyObject(goodNetwork);
			delete networkInfo.blockservice_hosts;
			let bs_api = new Blockservice_API(networkInfo);
			expect(bs_api).to.exist;
		});
		it("rejects no protocol in host string", () => {
			let error;
			try {
				let networkInfo = copyObject(goodNetwork);
				networkInfo.blockservice_hosts = ["missing.protocol.com"];
				new Blockservice_API(networkInfo);
			} catch (e) {
				error = e;
			}
			expect(error.message).to.be("Blockservice host value must include http:// or https://");
		});
	});

	context(".pingServer()", () => {
		it("returns true if the server is online", async () => {
			let response = await goodNetwork_api.pingServer();
			expect(response).to.be(true);
		});
		it("returns false if provided network is unresponsive", async () => {
			let response = await badNetwork_api.pingServer();
			expect(response).to.be(false);
		});
	});

	context(".getTransaction()", () => {
		context("Promise", () => {
			it("returns a result for an existing txHash", async () => {
				let response = await goodNetwork_api.getTransaction(good_tx_hash);
				expect(response.txHash).to.equal(good_tx_hash);
			});
			it("returns null for a bad tx haesh", async () => {
				let response = await goodNetwork_api.getTransaction(bad_tx_hash);
				expect(response).to.equal(null)
			});
			it("returns error if host doesn't exists", async () => {
				let response = await badNetwork_api.getTransaction(good_tx_hash);
				expect(response.error).to.be.string
			});
		}),
		context("Callback", () => {
			it("returns a result for an existing txHash", async () => {
				return new Promise(resolver => {
						goodNetwork_api.getTransaction(good_tx_hash, (res, err) => {
						expect(err).to.equal(null);
						expect(res.txHash).to.equal(good_tx_hash);
						resolver()
					});
				})
			});
			it("returns null for a bad tx haesh", async () => {
				return new Promise(resolver => {
						goodNetwork_api.getTransaction(bad_tx_hash, (res, err) => {
						expect(err).to.equal(null);
						expect(res).to.equal(null);
						resolver()
					});
				})
			});
			it("returns error if host doesn't exists", async () => {
				return new Promise(resolver => {
						badNetwork_api.getTransaction(good_tx_hash, (res, err) => {
						expect(err).to.be.string;
						expect(res).to.equal(null);
						resolver()
					});
				});
			});
		})
	})

	context(".getLastetBlock()", () => {
		context("Promise", () => {
			it("returns a result", async () => {
				let res = await goodNetwork_api.getLastetBlock();
				expect(res).to.be.greaterThan(0)
			});
			it("returns error if host doesn't exists", async () => {
				let res = await badNetwork_api.getLastetBlock();
				expect(res.error).to.exist
			});
		}),
		context("Callback", () => {
			it("returns a result", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getLastetBlock((res, err) => {
						expect(err).to.equal(null);
						expect(res).to.be.greaterThan(0)
						resolver()
					});
				})
			});

			it("returns error if host doesn't exists", async () => {
				return new Promise(resolver => {
					badNetwork_api.getLastetBlock((res, err) => {
						expect(err).to.be.string;
						expect(res).to.equal(null);
						resolver()
					});
				});
			});
		})
	});

	context(".getCurrentKeyValue()", () => {
		context("Promise", () => {
			it("returns a result", async () => {
				let res = await goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, good_key_info.key);
				expect(res.value).to.exist
				expect(res.prev_value).to.exist
			});
			it("returns a null result if the contract doesn't exist", async () => {
				let res = await goodNetwork_api.getCurrentKeyValue("does_not_exist", good_key_info.variableName, good_key_info.key);
				expect(res.notFound).to.exist
				expect(res.value).to.equal(null)
				expect(res.prev_value).to.equal(null)
			});
			it("returns a null result if the variable doesn't exist", async () => {
				let res = await goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, "does_not_exist", good_key_info.key);
				expect(res.notFound).to.exist
				expect(res.value).to.equal(null)
				expect(res.prev_value).to.equal(null)
			});
			it("returns a null result if the key doesn't exist", async () => {
				let res = await goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, "nope_key_123973");
				expect(res.notFound).to.exist
				expect(res.value).to.equal(null)
				expect(res.prev_value).to.equal(null)
			});
			it("returns error if host doesn't exists", async () => {
				let res = await badNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, good_key_info.key);
				expect(res.error).to.be.string
			});
		}),
		context("Callback", () => {
			it("returns a result", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, good_key_info.key, (res, err) => {
						expect(err).to.equal(null);
						expect(res.value).to.exist
						expect(res.prev_value).to.exist
						resolver()
					});
				})
			});
			it("returns a null result if the contract doesn't exist", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeyValue("does_not_exist", good_key_info.variableName, good_key_info.key, (res, err) => {
						expect(err).to.be.string;
						expect(res.value).to.equal(null)
						expect(res.prev_value).to.equal(null)
						resolver()
					});
				})
			});
			it("returns a null result if the variable doesn't exist", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, "does_not_exist", good_key_info.key, (res, err) => {
						expect(err).to.be.string;
						expect(res.value).to.equal(null)
						expect(res.prev_value).to.equal(null)
						resolver()
					});
				})
			});
			it("returns a null result if the key doesn't exist", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, "nope_key_123973", (res, err) => {
						expect(err).to.be.string;
						expect(res.value).to.equal(null)
						expect(res.prev_value).to.equal(null)
						resolver()
					});
				})
			});

			it("returns error if host doesn't exists", async () => {
				return new Promise(resolver => {
					badNetwork_api.getCurrentKeyValue(good_key_info.contractName, good_key_info.variableName, good_key_info.key, (res, err) => {
						expect(err).to.be.string;
						resolver()
					});
				});
			});
		})
	});

	context(".getCurrentKeysValues()", () => {
		context("Promise", () => {
			it("returns a result", async () => {
				let res = await goodNetwork_api.getCurrentKeysValues(keysToGet);
				expect(res.length).to.equal(1)
				expect(res[0].value).to.exist
				expect(res[0].prev_value).to.exist
			});
			it("returns a null result if the key doesn't exist", async () => {
				let res = await goodNetwork_api.getCurrentKeysValues(notExistKeysToGet);
				expect(res.length).to.equal(0)
			});
		}),
		context("Callback", () => {
			it("returns a result", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeysValues(keysToGet, (res, err) => {
						expect(res.length).to.equal(1)
						expect(res[0].value).to.exist
						expect(res[0].prev_value).to.exist
						resolver()
					});
				})
			});
			it("returns a null result if the key doesn't exist", async () => {
				return new Promise(resolver => {
					goodNetwork_api.getCurrentKeysValues(notExistKeysToGet, (res, err) => {
						expect(err).to.equal(null);
						expect(res.length).to.equal(0)
						resolver()
					});
				})
			});
		})
	});
});