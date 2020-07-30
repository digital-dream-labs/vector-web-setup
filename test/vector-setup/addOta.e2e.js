/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const { expect } = require("chai");
const should = require("chai").should();

const path = require("path");

const clicmd = require("../../utils/clicmd");
const fs = require("../../utils/fsPromise");
const { VECTOR_WEB_SETUP } = require("../../tools/common.js").filePath;

const cliProcess = clicmd.create(VECTOR_WEB_SETUP, "."); // this will return a new object { execute }
const testOta = "https://ddltestota.s3.amazonaws.com/test.ota";

const getTestPath = (stage) =>
  path.join(VECTOR_WEB_SETUP, `../site/firmware/${stage}/test.ota`);

const inventoryPath = path.join(
  VECTOR_WEB_SETUP,
  `../site/data/inventory.json`
);

module.exports = () => {
  describe("when using ota-add", () => {
    let originalJson = {};

    before(async () => {
      originalJson = await fs.readFile(inventoryPath);
    });

    after(async () => {
      await fs.writeFile(inventoryPath, originalJson);
    });

    beforeEach(async () => {
      await fs.writeFile(inventoryPath, originalJson);
    });

    it("should throw error when url in not given", async () => {
      try {
        await cliProcess.execute(["ota-add"]);
      } catch (err) {
        should.exist(err);
      }
    });

    it("should add ota to prod when no other option is used", async () => {
      try {
        await cliProcess.execute(["ota-add", testOta]);

        let testPath = getTestPath("prod");
        expect(await fs.exists(testPath)).to.be.true;

        //Cleanup
        fs.unlink(testPath);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it("should add ota to a specific stack", async () => {
      try {
        await cliProcess.execute(["ota-add", testOta, "-e", "test"]);

        let testPath = getTestPath("test");
        expect(await fs.exists(testPath)).to.be.true;

        //Cleanup
        fs.unlink(testPath);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it("should add ota with a specific name", async () => {
      try {
        await cliProcess.execute(["ota-add", testOta, "-n", "abc"]);

        let testPath = path.join(
          VECTOR_WEB_SETUP,
          `../site/firmware/prod/abc.ota`
        );
        expect(await fs.exists(testPath)).to.be.true;

        //Cleanup
        fs.unlink(testPath);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });
};
