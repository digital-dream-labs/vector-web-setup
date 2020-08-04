/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");

const fsPromise = require("../utils/fsPromise");
const { getIp } = require("../utils/ip");

const { filePath } = require("./common.js");

const app = express();

let port = 8000;
const IP = getIp();

app.set("view engine", "ejs");
app.use("/static", express.static(path.join(__dirname, "../site")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.render(path.join(__dirname, "../templates/main.ejs"), {
    ip: IP,
    port: port,
  });
});

app.post("/firmware", async (req, res) => {
  try {
    const env = req.body.env;
    const loc = filePath.FIRMWARE_FOLDER + "/" + env;
    if (!(await fsPromise.exists(loc))) {
      return res.json({ message: "Store doesn't exists" });
    } else {
      const result = await fsPromise.readdir(loc);
      return res.json({ message: result });
    }
  } catch (err) {
    console.log(err);
  }
});

module.exports = (portReq) => {
  port = portReq === undefined ? 8000 : portReq;
  try {
    if (fs.existsSync(filePath.SETTINGS_FILE)) {
      app.listen(port);
      console.log(`Vector setup running on http://localhost:${port}`);
    } else {
      console.log("Seems like you have missed this step 'configure'!");
      console.log("E.g. 'vector-web-setup configure'");
    }
  } catch (err) {
    console.log(err);
  }
};
