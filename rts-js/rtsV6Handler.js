var { RtsCliUtil } = require('./rtsCliUtil.js');
var { Anki } = require('./messageExternalComms.js');
var { Blesh } = require('./blesh.js');

if(!Rts) { var Rts = Anki.Vector.ExternalComms; }

class RtsV6Handler {
  constructor(vectorBle, sodium, sessions) {
    this.vectorBle = vectorBle;
    this.vectorBle.onReceive(this);
    this.sodium = sodium;
    this.sessions = sessions;
    this.encrypted = false;
    this.keysAuthorized = false;
    this.waitForResponse = '';
    this.promiseKeys = {};

    // remembered state
    this.wifiScanResults = {};
    this.otaProgress = {};
    this.logId = 0;
    this.logFile = [];
    this.isReading = false;
    this.cryptoKeys = {};
    this.firstTimePair = true;
    this.hasProgressBar = false;
    this.helpArgs = {};
    this.connRequestHandle = null;

    // events
    this.onEncryptedConnectionEvent = [];
    this.onReadyForPinEvent = [];
    this.onOtaProgressEvent = [];
    this.onLogProgressEvent = [];
    this.onCliResponseEvent = [];
    this.onCloudAuthorizedEvent = [];
    this.onPrintEvent = [];
    this.onCommandDoneEvent = [];
    this.onNewProgressBarEvent = [];
    this.onUpdateProgressBarEvent = [];
    this.onLogsDownloadedEvent = [];

    this.blesh = new Blesh();

    this.setCliHelp();
  }

  onReadyForPin(fnc) {
    this.onReadyForPinEvent.push(fnc);
  }

  onOtaProgress(fnc) {
    this.onOtaProgressEvent.push(fnc);
  }

  onLogProgress(fnc) {
    this.onLogProgressEvent.push(fnc);
  }

  onEncryptedConnection(fnc) {
    this.onEncryptedConnectionEvent.push(fnc);
  }

  onCloudAuthorized(fnc) {
    this.onCloudAuthorizedEvent.push(fnc);
  }

  onCliResponse(fnc) {
    this.onCliResponseEvent.push(fnc);
  }

  onPrint(fnc) {
    this.onPrintEvent.push(fnc);
  }

  onCommandDone(fnc) {
    this.onCommandDoneEvent.push(fnc);
  }

  onNewProgressBar(fnc) {
    this.onNewProgressBarEvent.push(fnc);
  }

  onUpdateProgressBar(fnc) {
    this.onUpdateProgressBarEvent.push(fnc);
  }

  onLogsDownloaded(fnc) {
    this.onLogsDownloadedEvent.push(fnc);
  }

  enterPin(pin) {
    let clientKeys = this.sodium.crypto_kx_client_session_keys(this.keys.publicKey, this.keys.privateKey, this.remoteKeys.publicKey);
    let sharedRx = this.sodium.crypto_generichash(32, clientKeys.sharedRx, pin);
    let sharedTx = this.sodium.crypto_generichash(32, clientKeys.sharedTx, pin);

    this.cryptoKeys.decrypt = sharedRx;
    this.cryptoKeys.encrypt = sharedTx;

    this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsAck(
      new Rts.RtsAck(Rts.RtsConnection_6Tag.RtsNonceMessage)
    ));
    
    this.encrypted = true;
  }

  cleanup() {
    this.vectorBle.onReceiveUnsubscribe(this);
  }

  send(rtsConn5) {
    let rtsConn = Rts.RtsConnection.NewRtsConnectionWithRtsConnection_6(rtsConn5);
    let extResponse = Rts.ExternalComms.NewExternalCommsWithRtsConnection(rtsConn);

    let data = extResponse.pack();

    if(this.encrypted) {
      data = this.encrypt(data);
    }

    let packet = Array.from(data); // todo: Buffer.from
    this.vectorBle.send(packet);
  }

  receive(data) {
    if(this.encrypted) {
      data = this.decrypt(data);
    }

    if(data == null) {
      return;
    }

    if(data[0] == 1 && data.length == 5) {
      // data is handshake so we should bail
      this.cancelConnection();
      return;
    }

    let comms = new Rts.ExternalComms();
    comms.unpack(data);

    if(comms.tag == Rts.ExternalCommsTag.RtsConnection) {
      switch(comms.value.tag) {
        case Rts.RtsConnectionTag.RtsConnection_6: {
          let rtsMsg = comms.value.value;

          switch(rtsMsg.tag) {
            case Rts.RtsConnection_6Tag.RtsConnRequest_6:
              this.onRtsConnRequest(rtsMsg.value);
              break;
            case Rts.RtsConnection_6Tag.RtsNonceMessage:
              this.onRtsNonceMessage(rtsMsg.value);
              break;
            case Rts.RtsConnection_6Tag.RtsChallengeMessage:
              this.onRtsChallengeMessage(rtsMsg.value);
              break;
            case Rts.RtsConnection_6Tag.RtsChallengeSuccessMessage:
              this.onRtsChallengeSuccessMessage(rtsMsg.value);
              break;

            // Post-connection messages
            case Rts.RtsConnection_6Tag.RtsWifiScanResponse_3:
              this.resolvePromise('wifi-scan', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsWifiConnectResponse_3:
              this.resolvePromise('wifi-connect', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsStatusResponse_5:
              this.resolvePromise('status', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsWifiForgetResponse:
              this.resolvePromise('wifi-forget', rtsMsg);
              break;
              case Rts.RtsConnection_6Tag.RtsWifiAccessPointResponse:
              this.resolvePromise('wifi-ap', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsWifiIpResponse:
              this.resolvePromise('wifi-ip', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsCloudSessionResponse:
              for(let i = 0; i < this.onCloudAuthorizedEvent.length; i++) {
                this.onCloudAuthorizedEvent[i](rtsMsg.value);
              }

              this.resolvePromise('anki-auth', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsOtaUpdateResponse:
              this.otaProgress['value'] = rtsMsg.value;

              for(let i = 0; i < this.onOtaProgressEvent.length; i++) {
                this.onOtaProgressEvent[i](rtsMsg.value);
              }
              
              if(this.hasProgressBar) {
                for(let i = 0; i < this.onUpdateProgressBarEvent.length; i++) {
                  this.onUpdateProgressBarEvent[i](Number(rtsMsg.value.current), Number(rtsMsg.value.expected));
                }
              }

              if(this.waitForResponse == 'ota-start') {
                if(rtsMsg.status == 3) {
                  this.resolvePromise(this.waitForResponse, rtsMsg);
                } else if(rtsMsg.status >= 5) {
                  this.rejectPromise(this.waitForResponse, rtsMsg);
                }
              } else if(this.waitForResponse == 'ota-cancel') {
                if(rtsMsg.status != 2) {
                  this.resolvePromise(this.waitForResponse, rtsMsg);
                }
              }
              break;
            case Rts.RtsConnection_6Tag.RtsResponse:
              this.rejectPromise(this.waitForResponse, rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsBleshConnectResponse:
              this.resolvePromise(this.waitForResponse, rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsBleshDisconnectResponse:
              this.resolvePromise(this.waitForResponse, rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsBleshToClientRequest: {
                this.blesh.send(rtsMsg.value.data);
              }
              break;
            case Rts.RtsConnection_6Tag.RtsSdkProxyResponse:
              this.resolvePromise('sdk', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsAppConnectionIdResponse:
              this.resolvePromise('connection-id', rtsMsg);
              break;
            case Rts.RtsConnection_6Tag.RtsLogResponse:
              if(rtsMsg.value.exitCode == 0) {
                this.logId = rtsMsg.value.fileId;
                this.logFile = [];
              } else {
                // todo: error case
              }
              break;
            case Rts.RtsConnection_6Tag.RtsFileDownload:
              let chunk = rtsMsg.value;
              if(chunk.fileId == this.logId) {
                this.logFile = this.logFile.concat(chunk.fileChunk);

                for(let i = 0; i < this.onLogProgressEvent.length; i++) {
                  this.onLogProgressEvent[i](rtsMsg.value);
                }

                if(this.hasProgressBar) {
                  for(let i = 0; i < this.onUpdateProgressBarEvent.length; i++) {
                    this.onUpdateProgressBarEvent[i](chunk.packetNumber, chunk.packetTotal);
                  }
                }

                if(chunk.packetNumber == chunk.packetTotal) {
                  // resolve promise
                  let fileName = "vector-logs-" + RtsCliUtil.getDateString() + ".tar.bz2";
                  for(let i = 0; i < this.onLogsDownloadedEvent.length; i++) {
                    this.onLogsDownloadedEvent[i](fileName, this.logFile);
                  }

                  this.resolvePromise('logs', rtsMsg); 
                }
              }
              break;
            default:
              break;
          } 
          break;
        }
        default:
          break;
      }
    }
  }

  encrypt(data) {
    let txt = new Uint8Array(data);
    let nonce = new Uint8Array(this.nonces.encrypt);

    let cipher = this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      txt, null, null, nonce, this.cryptoKeys.encrypt
    );

    this.sodium.increment(this.nonces.encrypt);
    return cipher;
  }

  decrypt(cipher) {
    let c = new Uint8Array(cipher);
    let nonce = new Uint8Array(this.nonces.decrypt);

    let data = null;

    try {
      data = this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, c, null, nonce, this.cryptoKeys.decrypt
      );

      this.sodium.increment(this.nonces.decrypt);
    } catch(e) {
      console.log('error decrypting');
      this.sessions.deleteSession(this.remoteKeys.publicKey);
      this.sessions.save();
    }

    return data;
  }

  onRtsConnRequest(msg) {
    this.remoteKeys = {}
    this.remoteKeys.publicKey = msg.publicKey;

    let savedSession = this.sessions.getSession(this.remoteKeys.publicKey);
    let isPairing = msg.isPairing;

    if(!isPairing) {
      if(savedSession != null) {
        this.keys = this.sessions.getKeys();
        this.cryptoKeys = { encrypt:savedSession.tx, decrypt:savedSession.rx };
        this.firstTimePair = false;

        // use saved session
        this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsConnResponse(
          new Rts.RtsConnResponse(Rts.RtsConnType.Reconnection, this.keys.publicKey)
        ));  
      } else if(this.remoteKeys.publicKey.toString() in this.vectorBle.sessions) {
        let session = this.vectorBle.sessions[this.remoteKeys.publicKey.toString()];
        this.keys = session.myKeys;
        this.cryptoKeys = session.cryptoKeys;
        this.firstTimePair = false;

        // use saved session
        this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsConnResponse(
          new Rts.RtsConnResponse(Rts.RtsConnType.Reconnection, this.keys.publicKey)
        )); 
      } else {
        this.cancelConnection();
      }
    } else {
      // generate keys
      this.keys = this.sodium.crypto_kx_keypair();
      this.firstTimePair = true;
      let self = this;
      this.connRequestHandle = setTimeout(function() {
        self.cancelConnection();
      }, 3000);
      this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsConnResponse(
        new Rts.RtsConnResponse(Rts.RtsConnType.FirstTimePair, this.keys.publicKey)
      ));
    }
  }

  cancelConnection() {
    let msg = "\x1b[91mPairing failed. Double press robot button and try again. You may need to do \'ble-clear\'.\x1b[0m";
    for(let i = 0; i < this.onPrintEvent.length; i++) {
      this.onPrintEvent[i](msg);
    }
    this.vectorBle.tryDisconnect();
    for(let i = 0; i < this.onCommandDoneEvent.length; i++) {
      this.onCommandDoneEvent[i]();
    }
  }

  onRtsNonceMessage(msg) {
    if(this.connRequestHandle != null) {
      clearTimeout(this.connRequestHandle);
      this.connRequestHandle = null;
    }
    this.nonces = {};

    this.nonces.decrypt = msg.toDeviceNonce;
    this.nonces.encrypt = msg.toRobotNonce;

    if(!this.firstTimePair) {
      // No need to enter pin
      this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsAck(
        new Rts.RtsAck(Rts.RtsConnection_6Tag.RtsNonceMessage)
      ));
      
      this.encrypted = true;
      return;
    }

    for(let i = 0; i < this.onReadyForPinEvent.length; i++) {
      this.onReadyForPinEvent[i](this);
    }
  }

  onRtsChallengeMessage(msg) {
    this.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsChallengeMessage(
      new Rts.RtsChallengeMessage(msg.number + 1)
    ));
  }

  onRtsChallengeSuccessMessage(msg) {
    this.keysAuthorized = true;
    this.vectorBle.sessions[this.remoteKeys.publicKey.toString()] = { cryptoKeys:this.cryptoKeys, myKeys:this.keys };

    // successfully received rtsChallengeSuccessMessage
    for(let i = 0; i < this.onEncryptedConnectionEvent.length; i++) {
      this.onEncryptedConnectionEvent[i](this);
    }
  }

  storePromiseMethods(str, resolve, reject) {
    this.promiseKeys[str] = {};
    this.promiseKeys[str].resolve = resolve;
    this.promiseKeys[str].reject = reject;
  }

  resolvePromise(str, msg) {
    if(this.promiseKeys[str] != null) {
      this.promiseKeys[str].resolve(msg);
      this.promiseKeys[str] = null;
    }
  }

  rejectPromise(str, msg) {
    if(this.promiseKeys[str] != null) {
      this.promiseKeys[str].reject(msg);
      this.promiseKeys[str] = null;
    }
  }

  cliResolve(msg) {
    let output = "";

    if(msg == null) {
      output = 'Request timed out.';
    } else {
      output = RtsCliUtil.msgToStr(msg.value);
    }

    for(let i = 0; i < this.onCliResponseEvent.length; i++) {
      this.onCliResponseEvent[i](output);
    }

    this.waitForResponse = '';
  }

  cliPrint(output) {
    for(let i = 0; i < this.onPrintEvent.length; i++) {
      this.onPrintEvent[i](output);
    }
  }

  //
  // <!-- API Promises
  //

  doWifiScan() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('wifi-scan', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsWifiScanRequest(
        new Rts.RtsWifiScanRequest()
      ));
    });

    return p;
  }

  doWifiConnect(ssid, password, auth, timeout) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('wifi-connect', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsWifiConnectRequest(
        new Rts.RtsWifiConnectRequest(RtsCliUtil.convertStrToHex(ssid), password, timeout, auth, false)
      ));
    });

    return p;
  }
  
  doWifiForget(ssid) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('wifi-forget', resolve, reject);
      let deleteAll = ssid == '!all';
      let hexSsid = deleteAll? '' : RtsCliUtil.convertStrToHex(ssid);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsWifiForgetRequest(
        new Rts.RtsWifiForgetRequest(deleteAll, hexSsid)
      ));
    });

    return RtsCliUtil.addTimeout(p);
  }

  doWifiAp(enable) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('wifi-ap', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsWifiAccessPointRequest(
        new Rts.RtsWifiAccessPointRequest(enable.toLowerCase() == 'true')
      ));
    });

    return RtsCliUtil.addTimeout(p);
  }

  doWifiIp() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('wifi-ip', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsWifiIpRequest(
        new Rts.RtsWifiIpRequest()
      ));
    });

    return RtsCliUtil.addTimeout(p);
  }

  doStatus() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('status', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsStatusRequest(
        new Rts.RtsStatusRequest()
      ));
    });

    return RtsCliUtil.addTimeout(p);
  }

  doAnkiAuth(sessionToken) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('anki-auth', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsCloudSessionRequest_5(
        new Rts.RtsCloudSessionRequest_5(sessionToken, '', '')
      ));
    });

    return p;
  }

  doOtaStart(url) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('ota-start', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsOtaUpdateRequest(
        new Rts.RtsOtaUpdateRequest(url)
      ));
    });

    return p;
  }

  doOtaCancel(url) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('ota-cancel', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsOtaCancelRequest(
        new Rts.RtsOtaCancelRequest(url)
      ));
    });

    return p;
  }

  doConnectionId() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('connection-id', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsAppConnectionIdRequest(
        new Rts.RtsAppConnectionIdRequest(url)
      ));
    });

    return RtsCliUtil.addTimeout(p);
  }

  doLog() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('logs', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsLogRequest(
        new Rts.RtsLogRequest(0, [])
      ));
    });

    return p;
  }

  doSdk(clientGuid, id, path, json) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('sdk', resolve, reject);
      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsSdkProxyRequest(
        new Rts.RtsSdkProxyRequest(clientGuid, id, path, json)
      ));
    });

    return p;
  }

  doBlesh(port) {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('blesh', resolve, reject);

      // start ssh server
      self.blesh.start(port).then(function() {
        self.blesh.onReceiveData(function(data) {
          self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsBleshToServerRequest(
            new Rts.RtsBleshToServerRequest(data)
          ));
        });

        self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsBleshConnectRequest(
          new Rts.RtsBleshConnectRequest()
        ));
      });
    });

    return p; 
  }


  doBleshStop() {
    let self = this;
    let p = new Promise(function(resolve, reject) {
      self.storePromiseMethods('blesh-stop', resolve, reject);

      // stop ssh server
      self.blesh.stop();

      self.send(Rts.RtsConnection_6.NewRtsConnection_6WithRtsBleshDisconnectRequest(
        new Rts.RtsBleshDisconnectRequest()
      ));
    });

    return p;  
  }

  requireArgs(args, num) {
    if(args.length < num) {
      console.log('"' + args[0] + '" command requires ' + (num-1) + ' arguments');
      return false;
    }

    return true;
  }

  //
  // API Promises -->
  //
  setCliHelp() {
    let helpArgs = {
      'wifi-connect':{  args:2, 
                        des:'Connect Vector to a WiFi network.',
                        help:'wifi-connect {ssid} {password}' },
      'wifi-scan':{     args:0, 
                        des:'Get WiFi networks that Vector can scan.',
                        help:'wifi-scan' },
      'wifi-ip':{       args:0, 
                        des:'Get Vector\'s WiFi IPv4/IPv6 addresses.',
                        help:'wifi-ip' },
      'wifi-ap':{       args:1, 
                        des:'Enable/Disable Vector as a WiFi access point.',
                        help:'wifi-ap {true|false}' },
      'wifi-forget':{   args:1, 
                        des:'Forget a WiFi network, or optionally all of them.',
                        help:'wifi-forget {ssid|!all}' },
      'ota-start':{     args:1, 
                        des:'Tell Vector to start an OTA update with the given URL.',
                        help:'ota-start {url}' },
      'ota-progress':{  args:0, 
                        des:'Get the current OTA progress.',
                        help:'ota-progress' },
      'ota-cancel':{    args:0, 
                        des:'Cancel an OTA in progress.',
                        help:'ota-cancel' },
      'logs':{          args:0, 
                        des:'Download logs over BLE from Vector.',
                        help:'logs' },
      'status':{        args:0, 
                        des:'Get status information from Vector.',
                        help:'status' },
      'anki-auth':{     args:1, 
                        des:'Provision Vector with Anki account.',
                        help:'anki-auth {session_token}' },
      'connection-id':{ args:1, 
                        des:'Give Vector a DAS/analytics id for this BLE session.',
                        help:'connection-id {id}' },
      'sdk':{           args:3, 
                        des:'Send an SDK request over BLE.',
                        help:'sdk {path} {json} {client_app_guid}' },
      'blesh':{         args:1, 
                        des:'Tunnel SSH over BLE. In other shell, do "ssh root@127.0.0.1 -p {port}"',
                        help:'blesh {port}' }
    };

    this.helpArgs = helpArgs;

    return helpArgs
  }

  // returns whether resolved immediately
  handleCli(args) {
    let self = this;
    let cmd = args[0];
    let r = function(msg) { self.cliResolve(msg); };
    let output = "";

    switch(cmd) {
      case "quit":
      case "exit":
        self.vectorBle.tryDisconnect();
        return false;
      case "help":
        output = RtsCliUtil.printHelp(self.helpArgs);
        for(let i = 0; i < this.onPrintEvent.length; i++) {
          this.onPrintEvent[i](output);
        }
        break;
      case "wifi-scan":
        self.waitForResponse = 'wifi-scan';
        self.doWifiScan().then(function(msg) {
          self.wifiScanResults = msg.value.scanResult;
          self.cliResolve(msg);
        }, r);
        break;
      case "wifi-connect":
        if(!self.requireArgs(args, 3)) break;

        self.waitForResponse = 'wifi-connect';

        let ssid = args[1];
        let hasScanned = false;
        let result = null;

        for(let i = 0; i < self.wifiScanResults.length; i++) {
          let r = self.wifiScanResults[i];

          if(ssid == RtsCliUtil.convertHexToStr(r.wifiSsidHex)) {
            result = r;
            hasScanned = true;
            break;
          }
        }

        self.doWifiConnect(
          ssid, 
          args[2], 
          (hasScanned? result.authType : 6), 
          15).then(function(msg) { self.cliResolve(msg); }, r);

        break;
      case "status":
        self.waitForResponse = 'status';
        self.doStatus().then(function(msg) { self.cliResolve(msg); }, r);
        break;
      case "wifi-ip":
        self.waitForResponse = 'wifi-ip';
        self.doWifiIp().then(function(msg) { self.cliResolve(msg); }, r);
        break;
      case "wifi-forget":
        if(!self.requireArgs(args, 2)) break;

        self.waitForResponse = 'wifi-forget';
        self.doWifiForget(args[1]).then(function(msg) { 
          self.cliResolve(msg); 
        }, r);
        break;
      case "wifi-ap":
        if(!self.requireArgs(args, 2)) break;

        self.waitForResponse = 'wifi-ap';
        self.doWifiAp(args[1]).then(function(msg) { 
          self.cliResolve(msg); 
        }, r);
        break;
      case "anki-auth":
        if(!self.requireArgs(args, 2)) break;

        self.waitForResponse = 'anki-auth';
        self.doAnkiAuth(args[1]).then(function(msg) { self.cliResolve(msg); }, r);
        break;
      case "ota-start":
        if(!self.requireArgs(args, 2)) break;

        self.waitForResponse = 'ota-start';
        self.hasProgressBar = true;
        output = "Updating robot with OTA from " + args[1]; 
        for(let i = 0; i < this.onPrintEvent.length; i++) {
          this.onPrintEvent[i](output);
        }
        for(let i = 0; i < this.onNewProgressBarEvent.length; i++) {
          this.onNewProgressBarEvent[i]();
        }

        self.doOtaStart(args[1]).then(function(msg) { 
          self.otaProgress.value = msg.value;
          self.hasProgressBar = false;
          self.cliResolve(msg);
        }, r);
        break;
      case "ota-cancel":
        self.waitForResponse = 'ota-cancel';
        self.doOtaCancel().then(function(msg) { 
          self.otaProgress.value = msg.value;
          self.cliResolve(msg); 
        }, r);
        break;
      case "ota-progress":
        if(self.otaProgress.value != null) {
          console.log(RtsCliUtil.rtsOtaUpdateResponseStr(self.otaProgress.value));
        }
        
        break;
      case "connection-id":
        if(!self.requireArgs(args, 2)) break;

        self.waitForResponse = 'connection-id';
        self.doConnectionId().then(function(msg) { 
          self.cliResolve(msg); 
        }, r);
        break;
      case "sdk":
        if(!self.requireArgs(args, 3)) break;

        self.waitForResponse = 'sdk';
        self.doSdk(args[3], RtsCliUtil.makeId(), args[1], args[2]).then(function(msg) { 
          self.cliResolve(msg); 
        }, r);
        break;
      case "blesh":
        if(!Blesh.isSupported()) {
          self.cliPrint("blesh is not supported on this platform. Try using node-client.");
          break;
        }
      
        if(!self.requireArgs(args, 2)) break;

        if(args[1] == "stop") {
          self.waitForResponse = 'blesh-stop';
          self.doBleshStop().then(function(msg) {
            self.cliResolve(msg);
          }, r);
          break;
        }

        self.waitForResponse = 'blesh';
        self.doBlesh(args[1]).then(function(msg) {
          self.cliResolve(msg);
        }, r);

        break;
      case "logs":
        console.log('downloading logs over BLE will probably take about 30 seconds...');
        self.waitForResponse = 'logs';
        self.hasProgressBar = true;
        output = "Downloading logs...";
        for(let i = 0; i < this.onPrintEvent.length; i++) {
          this.onPrintEvent[i](output);
        }
        for(let i = 0; i < this.onNewProgressBarEvent.length; i++) {
          this.onNewProgressBarEvent[i]();
        }

        self.doLog().then(function(msg) {
          self.hasProgressBar = false;
          self.cliResolve(msg); 
        }, r);
        break;
      default:
        self.waitForResponse = '';
        break;
    }

    if(self.waitForResponse == '') {
      return true;
    }

    return false;
  }
}

module.exports = { RtsV6Handler };