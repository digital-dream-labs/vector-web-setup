class Blesh {
  constructor() {
  } 

  static isSupported() {
    return false;
  }

  onReceiveData(fnc) {
  }

  send(data) {
  }

  start(port) {
    let p = new Promise(function(resolve, reject) {
      resolve(false);
    });

    return p;
  }
}

module.exports = { Blesh };