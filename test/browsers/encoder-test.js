const { Builder, logging, Capabilities } = require('selenium-webdriver');
const Koa = require('koa');
const KoaStatic = require('koa-static');
const path = require('path');
const expect = require("expect.js");

// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/lib/logging.html
const prefs = new logging.Preferences();
prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
const caps = Capabilities.chrome();
caps.setLoggingPrefs(prefs);

const dateString = "2020-07-28T19:16:35.059Z";
const millisecondsDelta = 475200000;

describe('Browsers Tests: Test Type Encoder', function () {
    let driver;
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
        await driver.sleep(2000)
    });

    after(() => {
        driver && driver.quit();
        server && server.close();
    });

    context("TYPES", () => {
        it("Encoder rejects unknown TYPE", async () => {
            await driver.executeScript("return Lamden.Encoder('nope', {})").catch(e=>{
                expect(e.toString()).to.contain("Error: nope is not a valid encoder type");
            })
        });
    });

    context("BigNumber", () => {
        it("Encoder can call BigNumber", async () => {
            let val = await driver.executeScript("return Lamden.Encoder.BigNumber.sum(1, 2).toString()");
            expect(val).to.be("3");
        });
    });

    context("Strings", () => {
        it("encodes a string from a string", async () => {
            let val = await driver.executeScript("return Lamden.Encoder('str', 'string')");
            expect(val).to.be("string");
        });
        it("encodes a number as a string", async () => {
            let val = await driver.executeScript("return Lamden.Encoder('str', 1)");
            expect(val).to.be("1");
        });
        it("encodes a boolean as a string", async () => {
            let val = await driver.executeScript("return Lamden.Encoder('str', true)");
            expect(val).to.be("true");
        });
        it("encodes a Date as a string", async () => {
            let val = await driver.executeScript(`return Lamden.Encoder('str', new Date('${dateString}'))`);
            expect(val).to.be("2020-07-28T19:16:35.059Z");
        });
        it("encodes a Dict as a string", async () => {
            let val = await driver.executeScript("return Lamden.Encoder('str', {})");
            expect(val).to.be("{}");
        });
        it("encodes a List as a string", async () => {
            let val = await driver.executeScript("return Lamden.Encoder('str', [])");
            expect(val).to.be("[]");
        });
    });

context("Integers", () => {
    it("encodes a integer from an integer", async () => {
        let val = await driver.executeScript("return Lamden.Encoder('int', 1)");
        expect(val).to.be(1);
    });
    it("encodes a integer from a float", async () => {
        let val = await driver.executeScript("return Lamden.Encoder('int', 1.5)");
        expect(val).to.be(1);
    });
    it("encodes a integer from a string", async () => {
        let val = await driver.executeScript("return Lamden.Encoder('int', '1.5')");
        expect(val).to.be(1);
    });
    it("fails to encode non-integer values", async () => {
        await driver.executeScript("return Lamden.Encoder('int', true)").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
    });
    });
    context("Floats", () => {
    it("encodes a __fixed__ object from an float", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', 1.5)"))).to.be(JSON.stringify({ __fixed__: "1.5" }));
    });
    it("encodes a __fixed__ object to integer", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', 1)"))).to.be(JSON.stringify({ __fixed__: "1.0" }));
    });
    it("encodes a __fixed__ object with zeros as decimals to an integer", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', 1.0)"))).to.be(JSON.stringify({ __fixed__: "1.0" }));
    });
    it("encodes a __fixed__ object from a string", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', '1.5')"))).to.be(JSON.stringify({ __fixed__: "1.5" }));
    });
    it("encodes a __fixed__ object from a float and loses percision", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', 0.9999999999999999999999999999999)"))).to.be(JSON.stringify({ __fixed__: "1.0" }));
    });
    it("encodes __fixed__ object float from a string and retains precision", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', '0.9999999999999999999999999999999')"))).to.be(JSON.stringify({ __fixed__: "0.999999999999999999999999999999" }));
    });
    it("encodes __fixed__ object float from a bigNumber Object and retains precision", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('float', Lamden.Encoder('bigNumber', '0.9999999999999999999999999999999'))"))).to.be(JSON.stringify({ __fixed__: "0.999999999999999999999999999999" }));
    });
    it("fails to encode non-float values", async () => {
        await driver.executeScript("return Lamden.Encoder('float', true)").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
    });
    });
    context("Boolean", async () => {
    it("encodes a boolean from a boolean", async () => {
        expect(await driver.executeScript("return Lamden.Encoder('bool', true)")).to.be(true);
        expect(await driver.executeScript("return Lamden.Encoder('bool', false)")).to.be(false);
    });
    it("encodes a boolean from a number", async () => {
        expect( await driver.executeScript("return Lamden.Encoder('bool', 1)")).to.be(true);
        expect(await driver.executeScript("return Lamden.Encoder('bool', 0)")).to.be(false);
    });
    it("encodes a boolean from a string", async () => {
        expect(await driver.executeScript("return Lamden.Encoder('bool', 'true')")).to.be(true);
        expect(await driver.executeScript("return Lamden.Encoder('bool', 'false')")).to.be(false);
    });
    it("fails to encode non-boolean values", async () => {
        await driver.executeScript("return Lamden.Encoder('bool', 'nope')").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
        await driver.executeScript("return Lamden.Encoder('bool', 2)").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
        await driver.executeScript("return Lamden.Encoder('bool', {})").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
    });
    });
    context("Dict Object", () => {
    it("encodes a dict from an Object", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('dict', {})"))).to.be(JSON.stringify({}));
    });
    it("encodes a dict from a string", async () => {
        expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('dict','{\"vk\":\"833f3f66de0da4599ca60ae7854256f37404f543cf7a97c328d38aff9d3f8ac7\"}')"))).to.be(
            JSON.stringify({ vk: "833f3f66de0da4599ca60ae7854256f37404f543cf7a97c328d38aff9d3f8ac7" })
        );
    });
    it("encodes datetime and float inside a dict from a string", async () => {
        expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder('dict', { datetime: new Date('${dateString}'), float: 1.1 })`))).to.be(
        '{"datetime":{"__time__":[2020,6,28,19,16,35,59]},"float":{"__fixed__":"1.1"}}'
        );
    });
    it("replaces datetime object with value in dict", async () => {
        expect(
        JSON.stringify(await driver.executeScript(`return Lamden.Encoder("dict", { DateTime: { datetime: new Date('${dateString}') } })`))
        ).to.be('{"DateTime":{"__time__":[2020,6,28,19,16,35,59]}}');
    });
    it("replaces timedelta object with value in dict", async () => {
        expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder("dict", { TimeDelta: { timedelta: 1000 } })`))).to.be(
        '{"TimeDelta":{"__delta__":[0,1]}}'
        );
    });
    it("fails to encode non-objects", async () => {
        expect(() => Encoder("dict", undefined)).to.throwError();
        await driver.executeScript("return Lamden.Encoder('dict', undefined)").catch(e=>{
            expect(e.toString()).to.contain("Error:");
        })
    });
    });
    context("Any Object", () => {
        it("Any does not do any encoding", async () => {
          expect(await driver.executeScript("return Lamden.Encoder('Any', 'string')")).to.be("string");
          expect(await driver.executeScript("return Lamden.Encoder('Any', 1)")).to.be(1);
          expect(await driver.executeScript("return Lamden.Encoder('Any', 1.23456)")).to.be(1.23456);
          expect(await driver.executeScript("return Lamden.Encoder('Any', true)")).to.be(true);
          expect(await driver.executeScript(`return Lamden.Encoder('Any', new Date('${dateString}').toUTCString())`)).to.be(
            new Date(dateString).toUTCString()
          );
          expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('Any', {})"))).to.be(JSON.stringify({}));
          expect(JSON.stringify(await driver.executeScript("return Lamden.Encoder('Any', [])"))).to.be(JSON.stringify([]));
        });
      });
    
      context("DateTime", () => {
        it("Encodes a Date into a value list", async () => {
            expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder('datetime.datetime', new Date('${dateString}'))`))).to.be(
            JSON.stringify({ __time__: [2020, 6, 28, 19, 16, 35, 59] })
          );
        });
        it("Encodes a Date string into a value list", async () => {
            expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder('datetime.datetime', '${dateString}')`))).to.be(
            JSON.stringify({ __time__: [2020, 6, 28, 19, 16, 35, 59] })
          );
        });
        it("Encodes milliseconds into a value list", async () => {
            expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder('datetime.datetime', new Date('${dateString}').getTime())`))).to.be(
            JSON.stringify({ __time__: [2020, 6, 28, 19, 16, 35, 59] })
          );
        });
      });
    
    context("TimeDelta", () => {
    it("Encodes a Date into days seconds", async () => {
        expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder("datetime.timedelta", new Date(${millisecondsDelta}))`))).to.be(
        JSON.stringify({ __delta__: [5, 43200] })
        );
    });
    it("Encodes a millisenconds into days seconds", async () => {
        expect(JSON.stringify(await driver.executeScript(`return Lamden.Encoder("datetime.timedelta", ${millisecondsDelta})`))).to.be(
        JSON.stringify({ __delta__: [5, 43200] })
        );
    });
    });

    context("Stringify()- Parses object and encodes all values", async () => {
        let testObj = {
          integer: 1,
          float: 1.1,
          list: [
            1,
            1.1,
            "this is a string",
            true,
            [1, 2, 3, 4, 5, 6, 7],
            [0, 1234567],
            [1.1],
            {
              fixed: 1.1,
              DateTime: { datetime: new Date(dateString) },
              TimeDelta: { "datetime.timedelta": millisecondsDelta },
            },
          ],
          str: "this is a string",
          bool: true,
          "datetime.datetime": new Date(dateString),
          "datetime.timedelta": millisecondsDelta,
        };
        testObj.dict = JSON.parse(JSON.stringify(testObj));
        let temp = await driver.executeScript(`return Lamden.Encoder('object', ${testObj})`)
        let encodedObj = JSON.stringify(temp);
    
        it("encodes an string", () => {
          expect(encodedObj.includes('"str":"this is a string"')).to.be(true);
        });
        it("encodes an integer", () => {
          expect(encodedObj.includes('"integer":1')).to.be(true);
        });
        it("encodes a float", () => {
          expect(encodedObj.includes('"float":{"__fixed__":"1.1"}')).to.be(true);
        });
        it("encodes an bool", () => {
          expect(encodedObj.includes('"bool":true')).to.be(true);
        });
        it("encodes a datetime.datetime", () => {
          expect(encodedObj.includes('"datetime.datetime":{"__time__":[2020,6,28,19,16,35,59]}')).to.be(
            true
          );
        });
        it("encodes an datetime.timdelta", () => {
          expect(encodedObj.includes('"datetime.timedelta":{"__delta__":[5,43200]}')).to.be(true);
        });
        it("encodes an list", () => {
          expect(
            encodedObj.includes(
              '"list":[1,{"__fixed__":"1.1"},"this is a string",true,[1,2,3,4,5,6,7],[0,1234567],[{"__fixed__":"1.1"}],{"fixed":{"__fixed__":"1.1"},"DateTime":{"__time__":[2020,6,28,19,16,35,59]},"TimeDelta":{"__delta__":[5,43200]}}]'
            )
          ).to.be(true);
        });
        it("encodes a dict/object", () => {
          expect(
            encodedObj.includes(
              '"dict":{"integer":1,"float":{"__fixed__":"1.1"},"list":[1,{"__fixed__":"1.1"},"this is a string",true,[1,2,3,4,5,6,7],[0,1234567],[{"__fixed__":"1.1"}],{"fixed":{"__fixed__":"1.1"},"DateTime":{"__time__":[2020,6,28,19,16,35,59]},"TimeDelta":{"__delta__":[5,43200]}}],"str":"this is a string","bool":true,"datetime.datetime":{"__time__":[2020,6,28,19,16,35,59]},"datetime.timedelta":{"__delta__":[5,43200]}}'
            )
          ).to.be(true);
        });
    });
    
})