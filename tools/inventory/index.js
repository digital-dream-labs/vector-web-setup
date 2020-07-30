/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

const fs = require("../../utils/fsPromise");

const { filePath, prompt } = require("../common.js");
const { Ota } = require("./ota");
const { getStoreFor, freezeStore, healthStatus } = require("./firmwareStore");

const DEFAULT_INV = JSON.stringify({});

class Inventory {
  constructor() {
    this.stores = {};
  }

  async setup() {
    try {
      await fs.readFile(filePath.INVENTORY_FILE);
    } catch (err) {
      if (err.code == "ENOENT") {
        let dataFolderExists = await fs.exists(filePath.DATA_FOLDER);
        if (!dataFolderExists) {
          await fs.mkdir(filePath.DATA_FOLDER);
        }

        await fs.writeFile(filePath.INVENTORY_FILE, DEFAULT_INV);
      }
    }
  }

  async addOta(url, options) {
    try {
      let env = options.environment;
      let name = options.otaName;
      let ota = new Ota(url, name);

      let store = this.stores[env];

      // The store for the environment doesn't exist
      if (store == undefined) {
        store = await getStoreFor(env, []);
        this.stores[env] = store;
      }

      await store.downloadAndSaveConfig(ota, { force: options.force });
    } catch (err) {
      console.log(err.message);
    }
  }

  async syncOta(name, env) {
    try {
      let store = this.stores[env];
      await store.sync(name);
      this.stores[env] = store;
    } catch (err) {
      console.log(err.message);
    }
  }

  async syncAll() {
    try {
      for (const key in this.stores) {
        const store = this.stores[key];
        await store.syncAll();
      }
    } catch (err) {
      console.log(err.message);
    }
  }

  async approveOta(name, env) {
    try {
      let store = this.stores[env];
      if (store == undefined) {
        console.log(prompt.STORE_NOT_EXISTS);
        return;
      }

      await store.addChecksum(name);

      this.stores[env] = store;
    } catch (err) {
      console.log(err.message);
    }
  }

  async getInv() {
    let rawData = await fs.readFile(filePath.INVENTORY_FILE);
    let json = JSON.parse(rawData);
    return json;
  }

  async saveInv(json) {
    await fs.writeFile(filePath.INVENTORY_FILE, JSON.stringify(json));
  }

  async cryo() {
    let json = Object.keys(this.stores).reduce((acc, key) => {
      acc[key] = freezeStore(this.stores[key]);
      return acc;
    }, {});

    await this.saveInv(json);
  }

  async revive() {
    try {
      let json = await this.getInv();
      for (var env in json) {
        this.stores[env] = await getStoreFor(env, json[env]);
      }
    } catch (err) {
      console.log(err.message);
    }
  }
}

module.exports = {
  getInventory: async () => {
    try {
      let vectorInventory = new Inventory();
      await vectorInventory.setup();
      await vectorInventory.revive();

      return vectorInventory;
    } catch (err) {
      console.log(err.message);
    }
  },
};
