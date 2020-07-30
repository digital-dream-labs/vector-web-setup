/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

var path = require("path");

const pathJoin = (str) => path.join(__dirname, str);

module.exports = {
  filePath: {
    DEF_SETTINGS_FILE: pathJoin("../default-data/settings.json"),
    DEF_INVENTORY_FILE: pathJoin("../default-data/inventory.json"),
    PTERM_LESS_FILE: pathJoin("../less/pterm.less"),
    RTS_MAIN_JS: pathJoin("../rts-js/main.js"),

    DATA_FOLDER: pathJoin("../site/data"),
    SETTINGS_FILE: pathJoin("../site/data/settings.json"),
    INVENTORY_FILE: pathJoin("../site/data/inventory.json"),

    PTERM_CSS_FILE: pathJoin("../site/css/pterm.css"),
    RTS_JS_FILE: pathJoin("../site/js/rts.js"),

    FIRMWARE_FOLDER: pathJoin("../site/firmware"),

    VECTOR_WEB_SETUP: pathJoin("../vector-web-setup.js"),
  },

  prompt: {
    STORE_NOT_EXISTS: "Inventory store doesn't exists",

    OTA_APPROVE_SUCCESS: "Ota approved",
    OTA_NOT_EXISTS: "Ota doesn't exists",
    CHECKSUM_EXITS: "Checksum already present",
  },

  DEFUALT_ENV: "prod",
};
