var { BleMessageProtocol } = require('./bleMessageProtocol.js');

class VectorBluetooth {
  constructor() {
    this.vectorService = 0xFEE3;
    this.readCharService  = "7d2a4bda-d29b-4152-b725-2491478c5cd7";
    this.writeCharService = "30619f2d-0f54-41bd-a65a-7588d8c85b45";
    this.pairingChar = "p".charCodeAt(0);
    this.maxPacketSize = 20;
    this.bleMsgProtocol = null;
    this.readChar;
    this.writeChar;
    this.onReceiveEvent = [];
    this.onCancelSelectEvent = [];
    this.onDisconnectedEvent = [];
    this.writeQueue = [];
    this.writeReady = true;
    let self = this;
    this.tickInterval = window.setInterval(function() { self.tick(); }, 70);
    this.sessions = {};

    this.initializeBleProtocol();
  }

  initializeBleProtocol() {
    let self = this;
    this.bleMsgProtocol = new BleMessageProtocol(this.maxPacketSize);
    this.bleMsgProtocol.setDelegate(this);
    this.bleMsgProtocol.onSendRaw(function(buffer) {
      self.sendMessage(Uint8Array.from(buffer), false);
    });
  }

  send(arr) {
    this.bleMsgProtocol.sendMessage(arr);
  }

  onReceive(fnc) {
    this.onReceiveEvent.push(fnc);
  }

  onCancelSelect(fnc) {
    this.onCancelSelectEvent.push(fnc); 
  }

  onDisconnected(fnc) {
    this.onDisconnectedEvent.push(fnc);
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

  handleDisconnected() {
    this.bleName = "";
    this.bleDevice = null;

    for(let i = 0; i < this.onDisconnectedEvent.length; i++) {
      this.onDisconnectedEvent[i]();
    }
  }

  tryConnect(vectorFilter) {
    let self = this;
    let f = { services:[ this.vectorService ] };
    if(vectorFilter != null) {
      f['name'] = vectorFilter;
    }

    navigator.bluetooth.requestDevice({
      filters:[f],
      optionalServices: []
    })
    .then(device => {
      self.bleName = device.name;
      self.bleDevice = device;
      self.bleDevice.addEventListener("gattserverdisconnected", function() { self.handleDisconnected(); });
      self.connectToDevice(device);
    },
      error => {
      // user didn't select any peripherals
      for(let i = 0; i < this.onCancelSelectEvent.length; i++) {
        this.onCancelSelectEvent[i]();
      }
    });
  }

  tryDisconnect() {
    if(this.bleDevice) {
      this.bleDevice.gatt.disconnect();
    }
  }

  connectToDevice(device) {
    device.gatt.connect()
    .then(server => {
      return server.getPrimaryService(this.vectorService);
    })
    .then(service => {
      let readChar = service.getCharacteristic(this.readCharService);
      let writeChar = service.getCharacteristic(this.writeCharService);
      return Promise.all([readChar, writeChar]);
    }).then(characteristics => {
      let self = this;
      self.readChar = characteristics[0];
      self.writeChar = characteristics[1];

      characteristics[1].startNotifications().then(ch => {
        ch.addEventListener('characteristicvaluechanged', function(event) {
          self.bleMsgProtocol.receiveRawBuffer(Array.from(new Uint8Array(event.target.value.buffer)));
        });
      });
    });
  }

  forceSendMsg() {
    if(this.writeQueue.length > 0) {
      let msg = this.writeQueue[0];
      this.writeReady = false;
      let self = this;
      this.readChar.writeValue(msg).then(function() {
        self.writeReady = true;
      }, function(err) {
        console.log(err);
      }); 
      this.writeQueue.shift();
    }
  }

  trySendMsg() {
    if(this.writeReady) {
      this.forceSendMsg();
    }
  }

  sendMessage(msg) {
    this.writeQueue.push(msg);
    this.trySendMsg();
  }

  tick() {
    this.trySendMsg();
  }
}

module.exports = { VectorBluetooth };