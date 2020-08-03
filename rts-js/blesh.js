/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */
class Blesh {
  constructor() {}

  static isSupported() {
    return false;
  }

  onReceiveData(fnc) {}

  send(data) {}

  start(port) {
    let p = new Promise(function (resolve, reject) {
      resolve(false);
    });

    return p;
  }
}

module.exports = { Blesh };
