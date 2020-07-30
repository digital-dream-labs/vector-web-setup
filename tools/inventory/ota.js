/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

"use strict";

function parseURL(url) {
  let obj = new URL(url);
  obj.filename = url.substring(url.lastIndexOf("/") + 1);
  return obj;
}

function parseName(name) {
  return name.substring(name.lastIndexOf(".") + 1) == "ota"
    ? name
    : name + ".ota";
}

class Ota {
  constructor(url, name, checksum) {
    this.url = url;
    this.name = name != undefined ? parseName(name) : parseURL(url).filename;
    this.checksum = checksum;
  }

  toString() {
    return JSON.stringify(this);
  }

  compare(obj) {
    return obj.name === this.name;
  }
}

// Static method to convert to a basic structure with a class identifier
Ota.freeze = (ota) => ({
  url: ota.url,
  name: ota.name,
  checksum: ota.checksum,
});

// Static method to reconstitute a Ota from the basic structure
Ota.thaw = (json) => new Ota(json.url, json.name, json.checksum);

module.exports = { Ota };
