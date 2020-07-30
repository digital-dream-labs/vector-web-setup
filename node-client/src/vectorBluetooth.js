const _noble = require('noble-mac');
const _bleProtocol = require('../generated/bleMessageProtocol.js');

class VectorBluetooth {
  constructor() {
    this.vectorService = "FEE3";
    this.readCharService = "7D2A4BDAD29B4152B7252491478C5CD7";
    this.writeCharService = "30619F2D0F5441BDA65A7588D8C85B45";
    this.pairingChar = "p".charCodeAt(0);
    this.maxPacketSize = 20;
    this.bleMsgProtocol = null;
    this.readChar;
    this.writeChar;
    this.onReceiveEvent = [];
    this.sessions = {};
    this.peripheral = null;

    this.initializeBleProtocol();
  }

  stop() {
    this.onReceiveEvent = [];
  }

  initializeBleProtocol() {
    let self = this;
    this.bleMsgProtocol = new _bleProtocol.BleMessageProtocol(this.maxPacketSize);
    this.bleMsgProtocol.setDelegate(this);
    this.bleMsgProtocol.onSendRaw(function(buffer) {
      self.sendMessage(Buffer.from(buffer), false);
    });
  }

  send(arr) {
    this.bleMsgProtocol.sendMessage(arr);
  }

  onReceive(fnc) {
    this.onReceiveEvent.push(fnc);
  }

  onReceiveUnsubscribe(obj) {
    for(let i = 0; i < this.onReceiveEvent.length; i++) {
      if(obj == this.onReceiveEvent[i]) {
        this.onReceiveEvent.splice(i, 1);
        return;
      }
    }
  }

  handleReceive(data) {
    let listeners = this.onReceiveEvent.slice(0);

    for(let i = 0; i < listeners.length; i++) {
      listeners[i].receive(data);
    }
  }

  tryConnect(vectorFilter) {
    console.log("Scanning...");
    let self = this;
    _noble.on('discover', function(peripheral) {
      if(vectorFilter != null && vectorFilter.length > 0) {
        let containsFilter = false;
  
        for(let i = 0; i < vectorFilter.length; i++) {
          if(peripheral.advertisement.localName.includes(vectorFilter[i])) {
            containsFilter = true;
            break;
          }
        }
  
        if(!containsFilter) {
          return;
        }
      }
  
      console.log("Connecting to " + peripheral.advertisement.localName + "... ");
      let isPairing = peripheral.advertisement.manufacturerData[3] == self.pairingChar;
  
      peripheral.once('connect', function() { 
        self.peripheral = peripheral;
        self.onConnect(peripheral); 
      });
      peripheral.once('disconnect', function() { console.log("peripheralDisconnecting..."); process.exit(); });
  
      peripheral.connect();
      _noble.stopScanning();
    });
  
    _noble.on('stateChange', function(state) {
      if(state == "poweredOn") {
        _noble.startScanning([ self.vectorService ], false);
      }
    });
  }

  tryDisconnect() {
    if(this.peripheral) {
      this.peripheral.disconnect();
    }
  }

  sendMessage(msg) {
    this.readChar.write(msg, true);
  }
  
  onConnect(peripheral) {
    let self = this;
    this.name = peripheral.advertisement.localName;
    this.discoverServices(peripheral).then(function(characteristics) {
      // Finished discovering
      self.writeChar.on('data', function(data, isNotification) {
        self.bleMsgProtocol.receiveRawBuffer(Array.from(data));
      });
    });
  }
  
  discoverServices(peripheral) {
    // Discovering services
    let self = this;
  
    return new Promise(function(resolve, reject) {
      peripheral.discoverServices([self.vectorService], function(error, services) {
        // Discovering characteristics
  
        let streamPromise = new Promise(function(resolve, reject) {
          services[0].discoverCharacteristics([self.writeCharService, self.readCharService], function(error, characteristics) {
            if(error != undefined) {
              reject();
            } else {
              self.writeChar = characteristics[0];
              self.readChar = characteristics[1];
  
              self.readChar.subscribe();
              self.writeChar.subscribe();
              
              resolve([self.writeChar, self.readChar]);
            }
          });
        });
        
        Promise.all([streamPromise]).then(function(data) {
          resolve([data[0], data[1]]);
        });
      });
    });
  }
}

module.exports = { VectorBluetooth };
