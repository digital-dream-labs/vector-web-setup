/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details */

var readline = require('readline');
var program = require('commander');
var stringArgv = require('string-argv');
var fs = require('fs');
var path = require('path');
const { Sessions } = require('./sessions.js');
const _vectorBle = require('./vectorBluetooth.js');
const { IntBuffer } = require('../generated/clad.js');
const _sodium = require('libsodium-wrappers');
const { RtsV2Handler } = require('../generated/rtsV2Handler.js');
const { RtsV3Handler } = require('../generated/rtsV3Handler.js');
const { RtsV4Handler } = require('../generated/rtsV4Handler.js');
const { RtsV5Handler } = require('../generated/rtsV5Handler.js');
const { RtsV6Handler } = require('../generated/rtsV6Handler.js');
const _cliProgress = require('cli-progress');

let v = 0;
let rtsHandler = null;
let vectorBle = null;
let sessions = new Sessions();
let progressBar = null;
let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
let autoScript;
let pinKey = null;

var script = null;
var config = {};

function main() {
  program
    .version('0.0.2', '-v, --verison')
    .option('-f, --filter [type]', 'Filter BLE scan for specific Vector.', list)
    .option('-t, --test [file]', 'Test script file.')
    .option('-c, --config [file]', 'Test script config data.')
    //.option('-d, --debug', 'Debug logs.')
    .option('-p, --protocol', 'Force a specific RTS protocol version.')
    .option('-k, --pin [type]', 'Force a specific RTS protocol version.')
    .option('-o, --output [type]', 'Output directory')
    .parse(process.argv);

    if(program.test != null) {
      let testPath = program.test;

      if(!fs.existsSync(testPath)) {
        let pathRel = path.relative(__dirname, process.cwd());
        testPath = path.join(pathRel, program.test);
      }

      script = require(testPath);
    }

    if(program.config != null) {
      let configJson = fs.readFileSync(program.config);
      config = JSON.parse(configJson);
    }

    if(program.output != null) {
      config['output'] = program.output;
    }

    if(program.pin != null) {
      pinKey = program.pin;
    }

    startBleComms(program.filter);
}

function list(val) {
  return val.split(',');
}

async function initializeSodium() {
  await _sodium.ready;
}

function generateHandshakeMessage(version) {
  let buffer = IntBuffer.Int32ToLE(version);
  return [1].concat(buffer);
}

function saveSession() {
  // Save session
  let remoteKey = rtsHandler.remoteKeys.publicKey;
  let name = vectorBle.bleName;
  let encryptKey = rtsHandler.cryptoKeys.encrypt;
  let decryptKey = rtsHandler.cryptoKeys.decrypt;
  sessions.setSession(remoteKey, name, encryptKey, decryptKey);
  sessions.setKeys(rtsHandler.keys.publicKey, rtsHandler.keys.privateKey);
  sessions.save();
}

function handleHandshake(version) {
  if(rtsHandler != null) {
    console.log('');

    rtsHandler.cleanup();
    rtsHandler = null;
  }

  console.log(`Vector is requesting RTS v${version}`);

  v = version;

  switch(version) {
    case 6:
      // RTSv6
      rtsHandler = new RtsV6Handler(vectorBle, _sodium, sessions);
      break;
    case 5:
      // RTSv5
      rtsHandler = new RtsV5Handler(vectorBle, _sodium, sessions);
      break;
    case 4:
      // RTSv4
      rtsHandler = new RtsV4Handler(vectorBle, _sodium, sessions);
      break;
    case 3:
      rtsHandler = new RtsV3Handler(vectorBle, _sodium, sessions);
      // RTSv3 (Dev)
      break;
    case 2:
      // RTSv2 (Factory)
      rtsHandler = new RtsV2Handler(vectorBle, _sodium, sessions);
      break;
    default:
      // Unknown
      console.log("Unknown Rts version");
      return;
  }

  rtsHandler.onReadyForPin(function() {
    if(pinKey) {
      rtsHandler.enterPin(pinKey);
      return;
    }

    rl.question("Enter pin: ", function(pin) {
      rtsHandler.enterPin(pin);
    });
  });

  rtsHandler.onEncryptedConnection(function() {
    if(script != null) {
      autoScript = new script.AutoScript(config);
      autoScript.run(rtsHandler);
      return;
    }

    rtsHandler.doStatus()
      .then(function(m) {
        if((v == 2 || v == 3) || 
          (!m.value.hasOwner || m.value.isCloudAuthed)) {
          // RtsV2 or Cloud authorized
          // Save session
          saveSession();
        }
      });
    cmdPrompt();
  });

  if(rtsHandler.onCloudAuthorized) {
    rtsHandler.onCloudAuthorized(function(value) {
      if(value.success) {
        // save session
        saveSession();
      }
    });
  }

  rtsHandler.onCliResponse(function(output) {
    if(progressBar != null) {
      progressBar.stop();
      progressBar = null;
    }
    console.log(output);
    cmdPrompt();
  });

  rtsHandler.onPrint(function(output) {
    console.log(output);;
  });

  rtsHandler.onCommandDone(function() {
    // do nothing
  });

  rtsHandler.onNewProgressBar(function() {
    //
    progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
    progressBar.start(100, 0);
  });

  rtsHandler.onUpdateProgressBar(function(value, total) {
    //
    if(progressBar != null) {
      progressBar.update((value/total)*100);
    }
  });

  rtsHandler.onLogsDownloaded(function(name, logFile) {
    // write logs folder/file
    if (!fs.existsSync('./tmp-logs')){
      fs.mkdirSync('./tmp-logs');
    }

    fs.writeFileSync('./tmp-logs/' + name, Buffer.from(logFile));
  });

  vectorBle.send(generateHandshakeMessage(version));
}

function cmdPrompt() {
  let prompt = vectorBle.name.split(' ')[1];
  rl.question(`\u001b[32;1m[v${v}] ${prompt}\x1b[0m$ `, function(line) {
    if(rtsHandler != null) {
      let args = stringArgv(line);
      let ready = rtsHandler.handleCli(args);

      if(ready) {
        cmdPrompt();
      }
    }
  });
}

function startBleComms(filter) {
  initializeSodium().then(function() {
    // Start cli
    vectorBle = new _vectorBle.VectorBluetooth();
    let handshakeHandler = {};

    handshakeHandler.receive = function(data) {
      if(data[0] == 1 && data.length == 5) {
        // This message is a handshake from Vector
        let v = IntBuffer.BufferToUInt32(data.slice(1));
        handleHandshake(v);
      } else {
        // Received message after version handler exists

      }
    };

    vectorBle.onReceive(handshakeHandler);
    vectorBle.tryConnect(filter);
  });
}

main();
