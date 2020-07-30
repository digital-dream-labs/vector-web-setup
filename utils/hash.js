/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const crypto = require("crypto");
const fsPromise = require("./fsPromise");

const generateChecksum = async (path) => {
  let data = await fsPromise.readFile(path);

  return crypto.createHash("sha256").update(data).digest("hex");
};

module.exports = { generateChecksum };
