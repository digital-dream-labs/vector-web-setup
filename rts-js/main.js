/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

var { VectorBluetooth } = require("./vectorBluetooth.js");
var { RtsCliUtil } = require("./rtsCliUtil.js");
var { IntBuffer } = require("./clad.js");
var { RtsV2Handler } = require("./rtsV2Handler.js");
var { RtsV3Handler } = require("./rtsV3Handler.js");
var { RtsV4Handler } = require("./rtsV4Handler.js");
var { RtsV5Handler } = require("./rtsV5Handler.js");
var { RtsV6Handler } = require("./rtsV6Handler.js");
var { Sessions } = require("./sessions.js");
var { Settings } = require("./settings.js");
var { TYPE } = require("./stack.js");

let rtsHandler = null;
let vecBle = new VectorBluetooth();

let _sodium = null;

let currentPhase = 1;
let selectedNetwork = null;
let scannedNetworks = [];
let cloudSession = {};
let _version = 0;
let _wifiCredentials = null;
let _settings = null;
let _stack = null;
let _otaEndpoint = null;
let _serverIp = null;
let _networkIp = null;
let _serverPort = null;
let urlParams = {};
let _statusInterval = null;
let _enableAutoFlow = true;
let _sessions = new Sessions();
let _filter = null;
let _cmdPending = false;
setView(_sessions.getViewMode(), false);

window.sodium = {
  onload: function (sodium) {
    //
    _sodium = sodium;
  },
};

// set build type
function parseParams() {
  let params = new URL(window.location.href).searchParams;
  let buildType = params.get("build");
  switch (buildType) {
    case "dev":
    case "beta":
    case "prod":
      _build = buildType;
      break;
    default:
      _build = "prod";
      break;
  }

  let wifiSsid = params.get("wifiSsid");
  let wifiPassword = params.get("wifiPassword");

  if (wifiSsid != null) {
    _wifiCredentials = {
      ssid: wifiSsid,
      pw: wifiPassword,
      auth: 6,
    };
  }
}

//************* Settings ******************
function setupStacks(stacks) {
  var btns = "";

  if (stacks.length === 1) {
    handleStackSelection(stacks[0]);
    return;
  }

  stacks.map((stack) => (btns += generateStackRow(stack)));

  $("#envOptions").html(btns);

  $(".vec-env-select-btn").click(function () {
    var selectedStack = $("#envOptions").val();
    handleStackSelection(selectedStack);
  });
}

function handleStackSelection(stackName) {
  _stack = _settings.getStack(stackName);

  configurePtrem();

  $("#boxVectorEnv").removeClass("vec-hidden");
  $("#vecEnv").html(stackName);

  toggleIcon("iconEnv", true);

  setPhase("containerDiscover");
}

function generateStackRow(name) {
  return (
    '<option value="' +
    name +
    '">' +
    name.charAt(0).toUpperCase() +
    name.slice(1) +
    "</option>"
  );
}

function configurePtrem() {
  // load env
  let env = _sessions.getEnv();
  if (env != null) {
    pterm_env = env;
  }

  pterm_on("env", function () {
    _sessions.setEnv(pterm_env);
    _sessions.save();
  });

  // pterm_set("OTA_LKG", _stack.otaEndpoints);
  pterm_set("OTA_URL", urlParams["otaUrl"]);

  let lastVector = _sessions.getLastVector();
  if (lastVector) {
    pterm_set("LAST", lastVector);
  }

  pterm_insert_history("ble-connect '" + lastVector + "'");
}

//**************** OTA *******************
function setupOTAFiles() {
  if (_version != 2) {
    toggleIcon("iconOta", true);
    setPhase("containerAccount");
    return;
  }

  if (_stack === null) {
    return;
  }

  getOtasPresent(_stack.name).then((data) => {
    if (!Array.isArray(data.message)) {
      console.log("No otas found for env");
      data.message = [];
    }

    var localOtas = data.message;

    var localUrlPrefix = `http://${_networkIp}:${_serverPort}/static/firmware/${_stack.name}/`;
    var otaUrls = [];

    localOtas.map((endpoint) => {
      var obj = parseURL(localUrlPrefix + endpoint);
      obj.type = TYPE.LOCAL;
      otaUrls.push(obj);
    });

    console.log(otaUrls);

    setPhase("containerOta");

    // No URL present
    if (otaUrls.length == 0) {
      $("#containerOtaSelection").addClass("vec-hidden");
      $("#containerOtaNoImage").removeClass("vec-hidden");
    }
    // One URL present
    else if (otaUrls.length == 1) {
      $("#containerOtaSelection").addClass("vec-hidden");
      $("#otaUpdate").removeClass("vec-hidden");
      _otaEndpoint = otaUrls[0].href;
      doOta();
    }
    // Multiple URL's presents
    else {
      var urlViews = "";
      otaUrls.map((url, index) => (urlViews += generateOtaFileRow(index, url)));
      $("#otaSelection").html(urlViews);

      $(".vec-ota-row").click(function () {
        $("#containerOtaSelection").addClass("vec-hidden");
        $("#otaUpdate").removeClass("vec-hidden");

        var selectedUrl = $(this).data().value;
        _otaEndpoint = otaUrls[selectedUrl].href;

        pterm_set("OTA_LKG", _otaEndpoint);
        // Previous version allowed webclient to be configured using
        // url params. OTA_URL was used to send that to pterm
        pterm_set("OTA_URL", _otaEndpoint);

        doOta();
      });
    }
  });
}

function parseURL(url) {
  var obj = new URL(url);
  obj.filename = url.substring(url.lastIndexOf("/") + 1);
  return obj;
}

function getOtasPresent(env) {
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: `http://${_serverIp}:${_serverPort}/firmware`,
      data: {
        env: env,
      },
    })
      .done(function (data) {
        resolve(data);
      })
      .fail(function (data) {
        reject(data);
      });
  });
}

function generateOtaFileRow(value, urlObj) {
  var img = "";

  if (urlObj.type == TYPE.CLOUD) {
    img = "/static/images/fontawesome/cloud-download-alt-solid.svg";
  } else if (urlObj.type == TYPE.LOCAL) {
    img = "/static/images/fontawesome/sd-card-solid.svg";
  }

  return (
    `<div data-value="${value}" class="row vec-ota-row">` +
    `<div class="col-md-2"><img class="vec-ota-type" src="${img}" /> </div>` +
    `<div class="vec-ota-name col-md-10">` +
    `<div class="vec-ota-name col-md-12">${urlObj.filename}</div>` +
    `<div class="vec-ota-host col-md-12">${urlObj.hostname}</div>` +
    `</div>` +
    `</div>`
  );
}

function getOtaUrl() {
  if ("otaUrl" in urlParams) {
    return urlParams["otaUrl"];
  } else {
    return _otaEndpoint;
  }
}

//**************** Wifi *******************

function connectToWifi(ssid, pw, auth) {
  rtsHandler.doWifiConnect(ssid, pw, auth, 15).then(function (msg) {
    if (msg.value.wifiState == 2 || msg.value.wifiState == 1) {
      $("#wifiConnectErrorLabel").addClass("vec-hidden");
      toggleIcon("iconWifi", true);
      setupOTAFiles();
    } else {
      // wifi failed
      $("#wifiConnectErrorLabel").removeClass("vec-hidden");
      scanForWifi();
      _wifiCredentials = null;
    }
  });
}

function toggleIcon(icon, on) {
  $("#" + icon).removeClass("vec-icon-active");
  $("#" + icon).addClass("vec-icon-done");
}

function setPhase(phase) {
  // general clearing
  $("#txtPin").val("");

  // update icon
  let icon = $("#" + phase).attr("icon");
  if (icon != null && icon != "") {
    $(".vec-icon").removeClass("vec-icon-active");
    $("#" + icon).addClass("vec-icon-active");
  }

  $(".vec-container.vec-current").css("opacity", 0);
  $(".vec-container.vec-current").removeClass("vec-current");
  $("#" + phase).addClass("vec-current");
  $("#" + phase).css("opacity", 1);

  if (phase == "containerAccount") {
    $("#newAccount").css("opacity", 0);
    $("#newAccount").css("display", "none");
  }
}

function setOtaProgress(percent) {
  let maskWidth = (1 - percent) * 100;
  $("#progressBarOta")
    .children(".vec-progress-bar-mask")
    .css("width", maskWidth + "%");
}

function setLogProgress(percent) {
  let maskWidth = (1 - percent) * 100;
  $("#progressBarLogs")
    .children(".vec-progress-bar-mask")
    .css("width", maskWidth + "%");
}

function generateWifiRow(hex, auth, strength) {
  let ssid = RtsCliUtil.convertHexToStr(hex);
  let n = "1";
  if (strength > 45) {
    n = "2";
  }
  if (strength > 65) {
    n = "3";
  }
  let img = "/static/images/settings_icon_wifilife_" + n + "bars_mini.svg";
  return (
    `<div class="vec-wifi-row" authType="${auth}" hexId="${hex}">` +
    `<img class="vec-wifi-signal" src="${img}" />` +
    `<div class="vec-wifi-ssid">${ssid}</div>` +
    "</div>"
  );
}

function displayWifiNetworks(m) {
  let wifiHtml = "";

  for (let i = 0; i < m.scanResult.length; i++) {
    if (m.scanResult[i].wifiSsidHex == "hidden") continue;

    wifiHtml += generateWifiRow(
      m.scanResult[i].wifiSsidHex,
      m.scanResult[i].authType,
      m.scanResult[i].signalStrength
    );
  }

  $("#wifiScanTable").html(wifiHtml);
}

function handleDisconnected() {
  cleanRtsHandler();
  pterm_changeprompt("", null);
  clearInterval(_statusInterval);
  $("#boxVectorStatus").addClass("vec-hidden");
  toggleIcon("iconBle", false);
  setPhase("containerDiscover");
}

function doOta() {
  if (_version == 2) {
    rtsHandler.doOtaStart(getOtaUrl()).then(
      function (msg) {
        console.log("ota success");
      },
      function (msg) {
        console.log(msg);
        $("#otaErrorLabel").removeClass("vec-hidden");
        $("#btnTryAgain").removeClass("vec-hidden");
      }
    );
  } else {
    toggleIcon("iconOta", true);
    setPhase("containerAccount");
  }
}

function setView(mode, animate) {
  _sessions.setViewMode(mode);
  _sessions.save();

  if (!animate) {
    $(".vec-panel").addClass("pterm-no-transition");
  }

  if (mode == 1) {
    $(".vec-panel-ui").css("flex", "1 0 50%");
    $(".vec-shell").css("flex", "0");
  } else if (mode == 2) {
    $(".vec-panel-ui").css("flex", "1 0 50%");
    $(".vec-shell").css("flex", "1 0 50%");
  } else if (mode == 3) {
    $(".vec-panel-ui").css("flex", "0");
    $(".vec-shell").css("flex", "1 0 50%");
  }

  $(".vec-panel")[0].offsetHeight;

  if (!animate) {
    $(".vec-panel").removeClass("pterm-no-transition");
  }
}

$(document).ready(function () {
  $(document).keydown(function (event) {
    if (event.altKey) {
      if (event.keyCode == 49) {
        setView(1, true);
      } else if (event.keyCode == 50) {
        setView(2, true);
      } else if (event.keyCode == 51) {
        setView(3, true);
      }
    }
  });

  console.log(
    " __      ________ _____ _______ ____  _____  \n" +
      " \\ \\    / /  ____/ ____|__   __/ __ \\|  __ \\ \n" +
      "  \\ \\  / /| |__ | |       | | | |  | | |__) |\n" +
      "   \\ \\/ / |  __|| |       | | | |  | |  _  / \n" +
      "    \\  /  | |___| |____   | | | |__| | | \\ \\ \n" +
      "     \\/   |______\\_____|  |_|  \\____/|_|  \\_\\"
  );

  console.log(
    "\nURL parameters:\n" +
      "\t    wifiSsid = WIFI_SSID\n" +
      "\twifiPassword = WIFI_PASSWORD\n\n"
  );

  if (!navigator.bluetooth) {
    setPhase("containerIncompatible");
    return;
  }

  // process url params
  parseParams();

  // set up env selection
  $.getJSON("/static/data/settings.json", function (json) {
    try {
      _settings = new Settings(json);

      setPhase("containerEnvironment");
      // setPhase("containerAccount");

      setupStacks(_settings.getStackNames());
    } catch (error) {
      console.error(error);
      setPhase("containerEnvironmentError");
    }
  }).fail(function () {
    setPhase("containerEnvironmentError");
  });

  _serverIp = $("#serverIp").text();
  _networkIp = $("#networkIp").text();
  _serverPort = $("#serverPort").text();

  // listen to ble messages
  vecBle.onReceive(handleRtsHandshake);
  vecBle.onDisconnected(handleDisconnected);
  vecBle.onCancelSelect(function () {
    setPhase("containerDiscover");

    if (_cmdPending) {
      _cmdPending = false;
      newLine();
    }
  });

  $("#containerEnvironment").css("opacity", 1);

  $("#wifiScanTable").on("click", ".vec-wifi-row", function () {
    for (let i = 0; i < scannedNetworks.length; i++) {
      if (scannedNetworks[i].wifiSsidHex == $(this).attr("hexId")) {
        selectedNetwork = scannedNetworks[i];
      }
    }

    $("#txtWifiSsid").val($(this).children(".vec-wifi-ssid").html());
    $("#txtWifiSsid").addClass("readonly");
    $("#txtWifiSsid").prop("readonly", true);
    setPhase("containerWifiConfig");
  });

  $(".vec-container").bind("keypress", function (e) {
    if (e.which == 13) {
      let buttons = $(this).children('[type="button"]');
      buttons.first().trigger("click");
      return false;
    }
  });

  pterm_on("cmd", function (args) {
    if (rtsHandler != null) {
      pterm_handled = rtsHandler.handleCli(args);
    } else {
      pterm_handled = true;

      if (args[0] == "help") {
        let helpArgs = {
          "ble-connect": {
            args: 0,
            des: "Scan and connect to a Vector",
            help: "ble-connect [VECTOR_NAME]",
          },
          "ble-clear": {
            args: 0,
            des: "Clear stored session data.",
            help: "ble-clear",
          },
          echo: {
            args: 1,
            des: "Echo text to terminal.",
            help: "echo $LAST",
          },
          export: {
            args: 1,
            des: "Save env variables.",
            help: "export MY_VAR=0 OTHER_VAR=40",
          },
          printenv: {
            args: 0,
            des: "Print environment variables.",
            help: "printenv",
          },
          unset: {
            args: 1,
            des: "Unset env variables",
            help: "unset MY_VAR",
          },
        };
        pterm_print(RtsCliUtil.printHelp(helpArgs));
      } else if (args[0] == "ble-connect") {
        if (args[1]) {
          if (args[1].length == 4) {
            _filter = "Vector " + args[1];
          } else {
            _filter = args[1];
          }
        } else {
          _filter = null;
        }
        $("#btnDiscoverVector").click();
        _cmdPending = true;
        pterm_handled = false;
      } else if (args[0] == "ble-clear") {
        _sessions.clearSessions();
        _sessions.save();
      }
    }
  });
});

let handleRtsHandshake = {};
handleRtsHandshake.receive = function (data) {
  if (data[0] == 1 && data.length == 5) {
    // This message is a handshake from Vector
    let version = IntBuffer.BufferToUInt32(data.slice(1));
    HandleHandshake(version);
  } else {
    // Received message after version handler exists
  }
};

function doCloudLogin(inputUsername, inputPassword) {
  let self = this;
  let p = new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: _stack.getAccountEndpoints() + "/1/sessions",
      headers: {
        "Anki-App-Key": _stack.getApiKeys(),
      },
      data: {
        username: inputUsername,
        password: inputPassword,
      },
    })
      .done(function (data) {
        resolve(data);
      })
      .fail(function (data) {
        reject(data);
      });
  });

  return p;
}

function doPasswordReset(inputEmail) {
  let p = new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: _stack.getAccountEndpoints() + "/1/reset_user_password",
      headers: {
        "Anki-App-Key": _stack.getApiKeys(),
      },
      data: {
        email: inputEmail,
      },
    })
      .done(function (data) {
        resolve(data);
      })
      .fail(function (data) {
        reject(data);
      });
  });

  return p;
}

function createAccount(inputEmail, inputPassword, inputDob) {
  let p = new Promise(function (resolve, reject) {
    $.ajax({
      type: "POST",
      url: _stack.getAccountEndpoints() + "/1/users",
      headers: {
        "Anki-App-Key": _stack.getApiKeys(),
      },
      dataType: "json",
      contentType: "application/json",
      data: JSON.stringify({
        email: inputEmail,
        password: inputPassword,
        dob: inputDob,
        created_by_app_name: "vector-web-setup",
        created_by_app_platform: "web",
        created_by_app_version: "1.0.0",
      }),
    })
      .done(function (data) {
        resolve(data);
      })
      .fail(function (data) {
        reject(data);
      });
  });

  return p;
}

function GenerateHandshakeMessage(version) {
  let buffer = IntBuffer.Int32ToLE(version);
  return [1].concat(buffer);
}

function scanForWifi() {
  rtsHandler.doWifiScan().then(function (m) {
    scannedNetworks = m.value;
    displayWifiNetworks(m.value);
    setPhase("containerWifi");
  });
}

function updateStatusBox(m) {
  $("#boxVectorStatus").removeClass("vec-hidden");
  if (m.value.wifiState == 1 || m.value.wifiState == 2) {
    $("#vecInfoWifi").removeClass("vec-hidden");
    $("#vecStatusSsid").html(RtsCliUtil.convertHexToStr(m.value.wifiSsidHex));
  } else {
    $("#vecInfoWifi").addClass("vec-hidden");
  }
  $("#vecInfoEsn").html(m.value.esn);
  $("#vecInfoBuild").html(m.value.version.split("-")[0]);
  $("#vecStatusTitle").html(vecBle.bleName);

  if (
    _version == 2 ||
    _version == 3 ||
    !m.value.hasOwner ||
    m.value.isCloudAuthed
  ) {
    // RtsV2 or Cloud authorized

    // Save session
    saveSession();

    enableLogPanel();
  }
}

function saveSession() {
  // Save session
  let remoteKey = rtsHandler.remoteKeys.publicKey;
  let name = vecBle.bleName;
  let encryptKey = rtsHandler.cryptoKeys.encrypt;
  let decryptKey = rtsHandler.cryptoKeys.decrypt;
  _sessions.setSession(remoteKey, name, encryptKey, decryptKey);
  _sessions.setKeys(rtsHandler.keys.publicKey, rtsHandler.keys.privateKey);
  _sessions.save();
}

function enableLogPanel() {
  $("#boxStatusLogs").removeClass("vec-hidden");
}

function cleanRtsHandler() {
  if (rtsHandler != null) {
    rtsHandler.cleanup();
    rtsHandler = null;
  }
}

function HandleHandshake(version) {
  cleanRtsHandler();
  toggleIcon("iconBle", true);

  switch (version) {
    case 6:
      // RTSv6
      rtsHandler = new RtsV6Handler(vecBle, _sodium, _sessions);
      break;
    case 5:
      // RTSv5
      rtsHandler = new RtsV5Handler(vecBle, _sodium, _sessions);
      break;
    case 4:
      // RTSv4
      rtsHandler = new RtsV4Handler(vecBle, _sodium, _sessions);
      break;
    case 3:
      // RTSv3 (Dev)
      rtsHandler = new RtsV3Handler(vecBle, _sodium, _sessions);
      break;
    case 2:
      // RTSv2 (Factory)
      rtsHandler = new RtsV2Handler(vecBle, _sodium, _sessions);
      break;
    default:
      // Unknown
      break;
  }

  _version = version;

  rtsHandler.onReadyForPin(function () {
    setPhase("containerEnterPin");

    if (_cmdPending) {
      pterm_read("Enter pin:").then(function (args) {
        _enableAutoFlow = false;
        _cmdPending = false;
        rtsHandler.enterPin(args[0]);
        setPhase("containerLoading");
      });
    }
  });

  rtsHandler.onEncryptedConnection(function () {
    $("#discoverFirstTime").addClass("vec-hidden");
    $("#discoverReconnect").removeClass("vec-hidden");

    if (_statusInterval != null) {
      clearInterval(_statusInterval);
    }

    if (_cmdPending) {
      _cmdPending = false;
      newLine();
    }

    rtsHandler.doStatus().then(function (m) {
      updateStatusBox(m);

      if (!_enableAutoFlow) {
        // early out of auto update flow
        $(".vec-panel-ui").css("flex", "0");
        $(".vec-shell").css("flex", "1 0 50%");
        return;
      }

      if (m.value.wifiState == 1 || m.value.wifiState == 2) {
        toggleIcon("iconWifi", true);
        // skip wifi scan
        setupOTAFiles();
      } else if (_wifiCredentials != null) {
        // try to reconnect with stored credentials
        rtsHandler.doWifiScan().then(function (m) {
          connectToWifi(
            _wifiCredentials.ssid,
            _wifiCredentials.pw,
            _wifiCredentials.auth
          );
        });
      } else {
        scanForWifi();
      }
    });

    _sessions.setLastVector(vecBle.bleName);
    _sessions.save();
    pterm_set("LAST", vecBle.bleName);

    pterm_changeprompt(
      "[v" + _version + "] " + vecBle.bleName.split(" ")[1],
      "blue"
    );
  });

  if (rtsHandler.onCloudAuthorized) {
    rtsHandler.onCloudAuthorized(function (value) {
      if (value.success) {
        // save session
        saveSession();
      }
    });
  }

  rtsHandler.onOtaProgress(function (value) {
    if (value.status == 2) {
      let progress = Number(value.current) / Number(value.expected);
      setOtaProgress(progress);
    } else if (value.status == 3) {
      // handle OTA complete
      toggleIcon("iconOta", true);
      setPhase("containerDiscover");
    } else {
      // todo: handle failure
    }
  });

  rtsHandler.onLogProgress(function (value) {
    let progress = Number(value.packetNumber) / Number(value.packetTotal);
    setLogProgress(progress);
  });

  rtsHandler.onCliResponse(function (output) {
    pterm_print(output);
    newLine();
  });

  rtsHandler.onPrint(function (output) {
    pterm_print(output);
  });

  rtsHandler.onCommandDone(function () {
    newLine();
  });

  rtsHandler.onNewProgressBar(function () {
    pterm_new_progress_bar();
  });

  rtsHandler.onUpdateProgressBar(function (value, total) {
    pterm_set_progress_bar(value, total);
  });

  rtsHandler.onLogsDownloaded(function (name, logFile) {
    var file = new Blob(logFile, { type: ".tar.gz" });
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  });

  vecBle.send(GenerateHandshakeMessage(version));
}

$("#btnTryAgain").click(function () {
  $("#btnTryAgain").addClass("vec-hidden");
  $("#otaErrorLabel").addClass("vec-hidden");
  doOta();
});

$("#btnDiscoverVector").click(function () {
  setPhase("containerLoading");
  vecBle.tryConnect(_filter);
  _filter = null;
});

$("#btnEnterPin").click(function () {
  _enableAutoFlow = $("#checkboxEnableAutoFlow").is(":checked");
  rtsHandler.enterPin($("#txtPin").val());
  setPhase("containerLoading");
});

$("#btnConnectWifi").click(function () {
  let auth = 6;
  if (selectedNetwork != null) {
    auth = selectedNetwork.authType;
  }

  _wifiCredentials = {
    ssid: $("#txtWifiSsid").val(),
    pw: $("#txtWifiPw").val(),
    auth: auth,
  };

  setPhase("containerLoading");

  connectToWifi(_wifiCredentials.ssid, _wifiCredentials.pw, auth);

  $("#txtWifiSsid").val("");
  $("#txtWifiPw").val("");
});

$("#btnCustomWifi").click(function () {
  selectedNetwork = null;
  $("#txtWifiSsid").removeClass("readonly");
  $("#txtWifiSsid").prop("readonly", false);
  setPhase("containerWifiConfig");
});

$("#passwordReset").click(function () {
  var email = prompt("Please enter your email:");
  if (email) {
    doPasswordReset(email).then(() => {
      alert("We have sent you an email with a link to reset your password");
    });
  }
});

$("#createAccount").click(function () {
  $("#accountAuth").css("opacity", 0);
  $("#accountAuth").css("visibility", "hidden");
  $("#accountAuth").css("display", "none");

  $("#newAccount").css("opacity", 1);
  $("#newAccount").css("visibility", "visible");
  $("#newAccount").css("display", "block");
});

$("#btnCancelAccountCreation").click(function () {
  showAccountAuth();
});

const showAccountAuth = () => {
  $("#newAccount").css("opacity", 0);
  $("#newAccount").css("visibility", "hidden");
  $("#newAccount").css("display", "none");

  $("#accountAuth").css("opacity", 1);
  $("#accountAuth").css("visibility", "visible");
  $("#accountAuth").css("display", "block");
};

$("#btnCreateAccount").click(function () {
  // let cloudUsername = $("#txtNewAccountUsername").val();
  let cloudEmail = $("#txtNewAccountEmail").val();
  let cloudPassword = $("#txtNewAccountPw").val();
  let cloudDob = $("#txtNewAccountDob").val();

  var re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,4}/gim;

  if (cloudEmail == "" || !re.test(cloudEmail)) {
    handleAccountCreationError("Please enter a valid email address");
    return;
  }

  createAccount(cloudEmail, cloudPassword, cloudDob).then(
    () => {
      showAccountAuth();

      // $("#txtNewAccountUsername").val("");
      $("#txtNewAccountEmail").val("");
      $("#txtNewAccountPw").val("");
      $("#txtNewAccountDob").val("");

      alert("We have sent you an email with a link to activate your account");
    },
    (data) => {
      const response = data.responseJSON.message;

      if (response !== undefined) {
        handleAccountCreationError(response);
      } else {
        handleAccountCreationError(
          "Error while creating account. Please try again."
        );
      }
    }
  );
});

function handleAccountCreationError(msg) {
  $("#accountCreationErrorLabel").html(msg);
  $("#accountCreationErrorLabel").removeClass("vec-hidden");
}

$("#txtAccountUsername").keypress(function (e) {
  var key = e.which;
  if (key == 13) {
    // the enter key code
    $("#txtAccountPw").focus();
    return false;
  }
});

$("#txtAccountPw").keypress(function (e) {
  var key = e.which;
  if (key == 13) {
    // the enter key code
    $("#btnConnectCloud").click();
    return false;
  }
});

$("#btnConnectCloud").click(function () {
  let cloudUsername = $("#txtAccountUsername").val();
  let cloudPassword = $("#txtAccountPw").val();

  setPhase("containerLoading");

  $("#txtAccountPw").val("");

  doCloudLogin(cloudUsername, cloudPassword).then(
    function (data) {
      cloudSession.sesionToken = data.session.session_token;

      rtsHandler.doAnkiAuth(cloudSession.sesionToken).then(function (msg) {
        if (msg.value.success) {
          cloudSession.clientToken = msg.value.clientTokenGuid;

          // adjust default timezone
          let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          let jqtz = $("#selectTimeZone option[value='" + tz + "']");
          jqtz.prop("selected", "selected");

          toggleIcon("iconAccount", true);
          setPhase("containerSettings");
          enableLogPanel();
        } else {
          // todo: handle case when session token fails
          handleLoginError("Error in bot authentication. Please try again.");
        }
      });
    },
    function (data) {
      let msg = "Error logging in. Please try again.";
      console.log(data);
      if (
        data.status == 403 &&
        data.responseJSON.code == "invalid_username_or_password"
      ) {
        msg = data.responseJSON.message;
      }

      handleLoginError(msg);
    }
  );
});

function handleLoginError(msg) {
  $("#accountErrorLabel").html(msg);
  $("#accountErrorLabel").removeClass("vec-hidden");
  setPhase("containerAccount");
}

$("#btnFinishSetup").click(function () {
  let timezone = $("#selectTimeZone").val();
  let locale = navigator.locale;
  let isFahrenheit = $("#selectTemperature").val() == "fahrenheit";
  let isMetric = $("#selectDistance").val() == "metric";
  let allowDataAnalytics = $("#checkboxDataAnalytics").is(":checked");
  let alexaOptIn = $("#checkboxEnableAlexa").is(":checked");

  setPhase("containerLoading");

  rtsHandler
    .doSdk(
      cloudSession.clientToken,
      "1",
      "/v1/alexa_opt_in",
      JSON.stringify({ opt_in: alexaOptIn })
    )
    .then(function (alexaRes) {
      // todo: check response for status 200
      rtsHandler
        .doSdk(
          cloudSession.clientToken,
          "1",
          "/v1/update_account_settings",
          '{ "account_settings":{ "data_collection":' +
            allowDataAnalytics +
            ', "app_locale":"' +
            locale +
            '"} }'
        )
        .then(function (response) {
          // todo: check response for status 200
          rtsHandler
            .doSdk(
              cloudSession.clientToken,
              "1",
              "/v1/update_settings",
              JSON.stringify({
                settings: {
                  time_zone: timezone,
                  locale: locale,
                  dist_is_metric: isMetric,
                  temp_is_fahrenheit: isFahrenheit,
                },
              })
            )
            .then(function (settingsResponse) {
              // todo: check response for status 200 then wake
              rtsHandler
                .doSdk(
                  cloudSession.clientToken,
                  "1",
                  "/v1/send_onboarding_input",
                  JSON.stringify({
                    onboarding_mark_complete_and_exit: {},
                  })
                )
                .then(function (msg) {
                  toggleIcon("iconSettings", true);
                  setPhase("containerComplete");
                });
            });
        });
    });
});

$("#txtAccountPwEye").click(function () {
  let pwId = "#" + $(this).attr("target");
  if ($(this).attr("state") == "visible") {
    $(this).attr("state", "hidden");
    $(this)
      .children(".vec-eyecon")
      .attr("src", "../images/fontawesome/eye-solid.svg");
    $(pwId).attr("type", "text");
  } else {
    $(this).attr("state", "visible");
    $(this)
      .children(".vec-eyecon")
      .attr("src", "../images/fontawesome/eye-slash-solid.svg");
    $(pwId).attr("type", "password");
  }
});

$("#btnDownloadLogs").click(function () {
  $("#btnDownloadLogs").addClass("vec-hidden");
  $("#panelLogs").removeClass("vec-hidden");
  rtsHandler.doLog().then(function () {
    $("#btnDownloadLogs").removeClass("vec-hidden");
    $("#panelLogs").addClass("vec-hidden");
  });
});
