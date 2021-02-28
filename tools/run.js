/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const cors = require("cors");
const https = require('https');

const fsPromise = require("../utils/fsPromise");
const { getNetworkIp } = require("../utils/ip");

const { filePath } = require("./common.js");

const app = express();

let port = undefined;
let networkIp = getNetworkIp();
let serverIp = undefined;

app.set("view engine", "ejs");
app.use("/static", express.static(path.join(__dirname, "../site")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.get("/", (req, res) => {
  res.render(path.join(__dirname, "../templates/main.ejs"), {
    networkIp: networkIp,
    serverIp: serverIp,
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

const key = fs.readFileSync('key.pem');
const cert = fs.readFileSync('cert.pem');
const server = https.createServer({key: key, cert: cert }, app);

const startServer = (portReq, ipReq) => {
  port = portReq === undefined ? 8000 : portReq;
  serverIp = ipReq === undefined ? "0.0.0.0" : ipReq;

  app
    server.listen(port, serverIp, () => {
      console.log(`Server running on ip ${serverIp} and port ${port}`);

      let ipToShow = serverIp;
      if ("0.0.0.0" == serverIp || serverIp.startsWith("127")) {
        ipToShow = "localhost";
      } else {
        console.log(
          `WARN: Server is running on an ip that might not be accessible to bot.`
        );
      }

      console.log(`Server running. Go to http://${ipToShow}:${port} to use it`);
    })
    .on("error", (err) => {
      switch (err.code) {
        case "EADDRNOTAVAIL":
          console.log(`Unable to bind to IP ${serverIp} on this device`);
          return;
        case "EACCES":
          console.log(
            `Permission denied to bind to IP ${serverIp} on PORT ${port} on this device.`
          );
          return;
        case "EADDRINUSE":
          console.log(
            `Permission denied to bind to IP ${serverIp} on PORT ${port} on this device. The address is already in use.`
          );
          return;
        default:
          console.log(err);
          return;
      }
    });
};

module.exports = (portReq, ipReq) => {
  try {
    if (
      fs.existsSync(filePath.SETTINGS_FILE) &&
      fs.existsSync(filePath.INVENTORY_FILE)
    ) {
      startServer(portReq, ipReq);
    } else {
      console.log("Seems like you have missed this step 'configure'!");
      console.log("E.g. 'vector-web-setup configure'");
    }
  } catch (err) {
    console.log(err);
  }
};
