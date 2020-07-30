"use strict";

const crypto = require("crypto");
const fsPromise = require("./fsPromise");

const generateChecksum = async (path) => {
  let data = await fsPromise.readFile(path);

  return crypto.createHash("sha256").update(data).digest("hex");
};

module.exports = { generateChecksum };
