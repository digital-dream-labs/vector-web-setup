/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const axios = require("axios");
const fs = require("../../utils/fsPromise");

const { filePath, prompt } = require("../common.js");
const { Ota } = require("./ota");
const { generateChecksum } = require("../../utils/hash");

const healthStatus = {
  checksum: {
    OK: "ok",
    MISMATCH: "mismatch",
    NOT_DEFINED: "checksum not defined",
  },

  filing: {
    OK: "ok",
    ABSENT: "absent",
  },
};

class FirmwareStore {
  constructor(env, otas) {
    this.location = filePath.FIRMWARE_FOLDER + "/" + env;
    this.otas = otas;
    this.name = env;
  }

  async setup() {
    try {
      const storeExists = await fs.exists(this.location);
      if (!storeExists) {
        await fs.mkdir(this.location);
      }
    } catch (err) {
      if (err.code == "ENOENT") {
        let frimwareFolderExists = await fs.exists(filePath.FIRMWARE_FOLDER);
        if (!frimwareFolderExists) {
          await fs.mkdir(filePath.FIRMWARE_FOLDER);
          await this.setup();
        }
      } else {
        this.log(ota, err);
      }
    }
  }

  async downloadAndSaveConfig(ota, options) {
    let force = options.force == undefined ? false : options.force;

    if (!(await this.exists(ota)) || force) {
      await this.download(ota);
    } else {
      this.log(ota, "Ota already exists. No action was taken");
    }
  }

  async download(ota) {
    if (ota === undefined) {
      this.log(ota, prompt.OTA_NOT_EXISTS);
      return;
    }

    this.log(ota, "Downloading ota. It can take some minutes.");

    const writer = fs.createWriteStream(this.getPath(ota));
    const respose = await axios.get(ota.url, { responseType: "stream" });
    respose.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        if (this.otas.filter((o) => ota.compare(o)).length > 0) {
          this.log(ota, "The ota is already present in inventory manifest");
        } else {
          this.otas.push(ota);
        }

        resolve();
      });

      writer.on("error", () =>
        reject("There was an error while downlaoding the ota. Please the url")
      );
    });
  }

  exists(ota) {
    return fs.exists(this.getPath(ota));
  }

  getPath(ota) {
    return this.location + `/${ota.name}`;
  }

  getOta(name) {
    const ota = this.otas.filter((o) => o.name === name)[0];

    if (ota === undefined) {
      throw new Error(
        `[${this.name} - ${name}] Ota doesn't exists in inventory. You need to add the ota using 'vector-setup ota-add'.`
      );
    }

    return ota;
  }

  async sync(name) {
    let ota = this.getOta(name);

    await this.syncOta(ota);
  }

  async syncAll() {
    this.otas.map(async (ota) => {
      this.log(ota, "Starting Sync");
      await this.syncOta(ota);
    });
  }

  async syncOta(ota) {
    if (!(await this.exists(ota))) {
      await this.download(ota);
    }

    if (ota.checksum === undefined) {
      this.log(
        ota,
        "WARN: No checksum defined for the ota. The ota could be harmful"
      );
    } else {
      let generatedChecksum = await generateChecksum(this.getPath(ota));
      generatedChecksum === ota.checksum
        ? this.log(ota, "Checksum matched. Ota is safe to use")
        : this.log(ota, "Checksum mismatched. Delete the ota and retry");
    }
  }

  async addChecksum(name) {
    let ota = this.getOta(name);

    if (ota.checksum != undefined) {
      this.log(ota, prompt.CHECKSUM_EXITS);
      return;
    }

    let checksum = await generateChecksum(this.getPath(ota));
    ota.checksum = checksum;

    this.log(ota, prompt.OTA_APPROVE_SUCCESS);
  }

  log(ota, txt) {
    console.log(`[${this.name} - ${ota.name}] ${txt}`);
  }
}

FirmwareStore.freeze = (store) => {
  let frozenOtas = store.otas.reduce((acc, ota) => {
    acc.push(Ota.freeze(ota));
    return acc;
  }, []);

  return frozenOtas;
};

FirmwareStore.revive = (env, json) => {
  if (!Array.isArray(json)) {
    throw new Error(`${this.env} is not saved as array`);
  }

  let otas = [];
  json.map((o) => {
    otas.push(Ota.thaw(o));
  });

  return new FirmwareStore(env, otas);
};

const getStoreFor = async (env, json) => {
  try {
    let store = FirmwareStore.revive(env, json);
    await store.setup();
    return store;
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  getStoreFor,
  freezeStore: (store) => FirmwareStore.freeze(store),
  healthStatus,
};
