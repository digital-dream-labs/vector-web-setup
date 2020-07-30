/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const commander = require("commander");
const fs = require("fs");

const { getInventory } = require("./inventory");
const { DEFUALT_ENV } = require("./common");

const { filePath } = require("./common.js");

const otaAdd = new commander.Command("ota-add");
otaAdd
  .arguments("<url>")
  .description("Add a cloud ota (url) as part of your local inventory.")
  .option("-e, --environment <stack>", "set environment", DEFUALT_ENV)
  .option("-f, --force", "Override the existing ota")
  .option("-n, --ota-name <name>", "Save the ota with a specific name")
  .action(async (url, options) => {
    if (!ensureInventoryFileExists()) {
      return;
    }

    let inventory = await getInventory();
    await inventory.addOta(url, options);
    await inventory.cryo();
  });

const otaSync = new commander.Command("ota-sync");
otaSync
  .arguments("[ota_file]")
  .description(
    "Check for new version of an ota based on checksum. For ota-sync dev/test.ota"
  )
  .action(async (otaFile, options) => {
    if (!ensureInventoryFileExists()) {
      return;
    }

    let inventory = await getInventory();

    if (otaFile !== undefined) {
      const { name, env } = parseFile(otaFile);
      await inventory.syncOta(name, env);
    } else {
      await inventory.syncAll();
    }
  });

const parseFile = (otaFile) => {
  otaFile = otaFile.endsWith(".ota") ? otaFile : otaFile + ".ota";
  let name = otaFile;
  let env = DEFUALT_ENV;

  if (otaFile.includes("/")) {
    name = otaFile.substring(otaFile.lastIndexOf("/") + 1);
    env = otaFile.substring(0, otaFile.lastIndexOf("/"));
  }

  return { name, env };
};

const otaApprove = new commander.Command("ota-approve");
otaApprove
  .arguments("<ota_file>")
  .description("Add a checksum to ota. For ota-approve prod/test.ota")
  .action(async (otaFile, options) => {
    if (!ensureInventoryFileExists()) {
      return;
    }

    const { name, env } = parseFile(otaFile);

    let inventory = await getInventory();
    await inventory.approveOta(name, env);
    await inventory.cryo();
  });

const ensureInventoryFileExists = () => {
  if (!fs.existsSync(filePath.INVENTORY_FILE)) {
    console.log("Seems like you have missed this step 'configure'!");
    console.log("E.g. 'vector-setup configure'");
    return false;
  }
  return true;
};

module.exports = {
  otaAdd,
  otaSync,
  otaApprove,
};
