/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

var commander = require("commander");
var fs = require("fs");
var less = require("less");
var browserify = require("browserify");

const {
  DATA_FOLDER,
  SETTINGS_FILE,
  INVENTORY_FILE,

  DEF_SETTINGS_FILE,
  DEF_INVENTORY_FILE,

  PTERM_LESS_FILE,
  PTERM_CSS_FILE,
  RTS_JS_FILE,
  RTS_MAIN_JS,
} = require("./common.js").filePath;

const ensureDataFolderExists = () => {
  if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER);
  }
};
const processSettings = (force) => {
  try {
    ensureDataFolderExists();
    console.log("Checking Settings file at " + SETTINGS_FILE);

    if (force) {
      console.log(
        "Overriding Settings file using file from " + DEF_SETTINGS_FILE
      );
      fs.copyFileSync(DEF_SETTINGS_FILE, SETTINGS_FILE);
    } else if (fs.existsSync(SETTINGS_FILE)) {
      console.log("Settings file exist. No action taken");
    } else {
      console.log("Adding Settings file using file from " + DEF_SETTINGS_FILE);
      fs.copyFileSync(DEF_SETTINGS_FILE, SETTINGS_FILE);
    }
  } catch (err) {
    console.log(err);
  }
};

const processInventory = (force) => {
  try {
    ensureDataFolderExists();
    console.log("Checking Inventory file at " + INVENTORY_FILE);

    if (force) {
      console.log(
        "Overriding Inventory file using file from " + DEF_INVENTORY_FILE
      );
      fs.copyFileSync(DEF_INVENTORY_FILE, INVENTORY_FILE);
    } else if (fs.existsSync(INVENTORY_FILE)) {
      console.log("Inventory file exists. No action taken");
    } else {
      console.log(
        "Adding Inventory file using file from " + DEF_INVENTORY_FILE
      );
      fs.copyFileSync(DEF_INVENTORY_FILE, INVENTORY_FILE);
    }
  } catch (err) {
    console.log(err);
  }
};

const processLess = async () => {
  console.log("Adding css files at " + PTERM_LESS_FILE);
  const content = fs.readFileSync(PTERM_LESS_FILE, "utf-8");
  const result = await less.render(content);
  fs.writeFileSync(PTERM_CSS_FILE, result.css, "utf-8");
};

const processRts = () => {
  console.log("Adding rts.js file at " + RTS_JS_FILE);

  return new Promise((resolve, reject) => {
    browserify()
      .add(RTS_MAIN_JS)
      .bundle()
      .pipe(fs.createWriteStream(RTS_JS_FILE))
      .on("finish", resolve)
      .on("error", reject);
  });
};

const configure = new commander.Command("configure");

configure
  .description("configure the settings and assets for websetup")
  .option("-rs, --reset-setting", "Use to force override settings.json")
  .option("-ri, --reset-inventory", "Use to force override inventory.json")
  .action(async (cmd) => {
    console.log("Running configures...");

    processSettings(cmd.resetSetting);
    processInventory(cmd.resetInventory);
    processLess();
    await processRts();

    console.log("Done.");
  });

module.exports = configure;
