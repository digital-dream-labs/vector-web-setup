let net = require('net');

class Blesh {
  constructor() {
    this.onReceiveDataEvent = null;
    this.server = null;
    this.socket = null;
    this.writeQueue = new Uint8Array(0);
  } 

  static isSupported() {
    return true;
  }

  onReceiveData(fnc) {
    this.onReceiveDataEvent = fnc;
  }

  send(data) {
    if(this.socket != null) {
      if(this.writeQueue.length > 0) {
        this.socket.write(this.writeQueue);
        this.writeQueue = new Uint8Array(0);
      }

      this.socket.write(data);
    } else {
      // append to the writeQueue
      let tmp = new Uint8Array(this.writeQueue.length + data.length);
      tmp.set(this.writeQueue);
      tmp.set(data, this.writeQueue.length);
      this.writeQueue = tmp;
    }
  }

  stop() {
    if(this.socket != null) {
      this.socket.end();
      this.socket = null;
    }

    if(this.server != null) {
      this.server.close();
      this.server = null;
    }
  }

  start(port) {
    let self = this;
    
    let p = new Promise(function(resolve, reject) {
      self.server = net.createServer((c) => {
        // 'connection' listener
        console.log('* SSH client connected');
        self.socket = c;

        c.on('end', () => {
          console.log('* SSH client disconnected.');
        });

        c.on('data', function(r) {
          self.onReceiveDataEvent(r);
        });
      });
    
      self.server.on('error', (err) => {
        throw err;
      });
    
      self.server.listen(port, () => {
        console.log("* SSH tunnel server started.");
      });

      resolve(true);
    });

    return p;
  }
}

module.exports = { Blesh };