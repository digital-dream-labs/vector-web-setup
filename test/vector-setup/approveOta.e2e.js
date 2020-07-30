/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;
const should = chai.should();
chai.use(chaiAsPromised);

const path = require("path");

const clicmd = require("../../utils/clicmd");
const fs = require("../../utils/fsPromise");
const rmdir = require("../../utils/rmdir");

const { prompt, filePath } = require("../../tools/common");
const { VECTOR_WEB_SETUP } = filePath;

const cliProcess = clicmd.create(VECTOR_WEB_SETUP, "."); // this will return a new object { execute }
const testOta = "https://ddltestota.s3.amazonaws.com/test.ota";

const testStore = path.join(VECTOR_WEB_SETUP, `../site/firmware/test`);

const inventoryPath = path.join(
  VECTOR_WEB_SETUP,
  `../site/data/inventory.json`
);

module.exports = () => {
  describe("when using ota-approve", () => {
    let originalJson = {};

    before(async () => {
      originalJson = await fs.readFile(inventoryPath);
      rmdir(testStore);
    });

    after(async () => {
      await fs.writeFile(inventoryPath, originalJson);
    });

    beforeEach(async () => {
      await fs.writeFile(inventoryPath, originalJson);
    });

    afterEach(() => {
      rmdir(testStore);
    });

    it("should add checksum if the checksum doesn't exist", async () => {
      await expect(
        cliProcess.execute(["ota-add", testOta, "-e", "test"])
      ).to.be.eventually.contain("Downloading ota. It can take some minutes.");

      let process = cliProcess.execute(["ota-approve", "test/test.ota"]);

      await expect(process).to.be.eventually.contain(
        prompt.OTA_APPROVE_SUCCESS
      );
    });

    it("should throw error if the store doesn't exists", async () => {
      let process = cliProcess.execute([
        "ota-approve",
        "non_existent/test.ota",
      ]);

      await expect(process).to.be.eventually.contain(prompt.STORE_NOT_EXISTS);
    });

    it("should not approve again if the checksum exist", async () => {
      await expect(
        cliProcess.execute(["ota-add", testOta, "-e", "test"])
      ).to.be.eventually.contain("Downloading ota. It can take some minutes.");

      await expect(
        cliProcess.execute(["ota-approve", "test/test.ota"])
      ).to.be.eventually.contain(prompt.OTA_APPROVE_SUCCESS);

      await expect(
        cliProcess.execute(["ota-approve", "test/test.ota"])
      ).to.be.eventually.contain(prompt.CHECKSUM_EXITS);
    });
  });
};
