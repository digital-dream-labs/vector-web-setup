class RtsCliUtil {
  static msgToStr(msg) {
    let str = '';

    switch(msg.type()) {
      case 'RtsWifiScanResponse_3': {
        str = RtsCliUtil.rtsWifiScanResponseStr(msg, 3);        
        break;
      }
      case 'RtsWifiScanResponse_2': {
        str = RtsCliUtil.rtsWifiScanResponseStr(msg, 2);        
        break;
      }
      case 'RtsWifiConnectResponse_3': {
        str = RtsCliUtil.rtsWifiConnectResponseStr(msg, 3);
        break;
      }
      case 'RtsWifiConnectResponse': {
        str = RtsCliUtil.rtsWifiConnectResponseStr(msg, 2);
        break;
      }
      case 'RtsStatusResponse_2': {
        str = RtsCliUtil.rtsStatusResponseStr(msg, 2);
        break;
      }
      case 'RtsStatusResponse_4': {
        str = RtsCliUtil.rtsStatusResponseStr(msg, 4);
        break;
      }
      case 'RtsStatusResponse_5': {
        str = RtsCliUtil.rtsStatusResponseStr(msg, 5);
        break;
      }
      case 'RtsWifiForgetResponse': {
        str = RtsCliUtil.rtsWifiForgetResponseStr(msg);
        break;
      }
      case 'RtsWifiAccessPointResponse': {
        str = RtsCliUtil.rtsWifiAccessPointResponseStr(msg);
        break;
      }
      case 'RtsWifiIpResponse': {
        str = RtsCliUtil.rtsWifiIpResponseStr(msg);
        break;
      }
      case 'RtsCloudSessionResponse': {
        str = RtsCliUtil.rtsCloudSessionResponseStr(msg);
        break;
      }
      case 'RtsOtaUpdateResponse': {
        str = RtsCliUtil.rtsOtaUpdateResponseStr(msg);
        break;
      }
      case 'RtsSdkProxyResponse': {
        str = RtsCliUtil.rtsSdkProxyResponseStr(msg);
        break;
      }
      case 'RtsResponse': {
        str = RtsCliUtil.rtsResponseStr(msg);
        break;
      }
      case 'RtsFileDownload': {
        str = 'Successfully downloaded logs.';
        break;
      }
      default:
        break;
    }

    return str;
  }

  static padEnd(str, targetLength, padString) {
    str = str + '';
    targetLength = targetLength>>0; //floor if number or convert non-number to 0;
    padString = String((typeof padString !== 'undefined' ? padString : ' '));
    if (str.length > targetLength) {
      return String(str);
    }
    else {
      targetLength = targetLength-str.length;
      if (targetLength > padString.length) {
          padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
      }
      return String(str) + padString.slice(0,targetLength);
    }
  }

  static padStart(str, targetLength, padString) {
    str = str + '';
    targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
    padString = String(typeof padString !== 'undefined' ? padString : ' ');
    if (str.length >= targetLength) {
      return String(str);
    } else {
      targetLength = targetLength - str.length;
      if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
      }
      return padString.slice(0, targetLength) + String(str);
    }
  }

  static replaceAll(base, str1, str2, ignore) {
    return base.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
  } 

  static removeBackspace(str) {
    let hexLine = RtsCliUtil.convertStrToHex(str);
    let hexArr = [];

    for(let i = 0; i < hexLine.length; i += 2) {
      hexArr.push(hexLine.substring(i, i + 2));
    }

    while(hexArr.indexOf('7F') != -1) {
      let idx = hexArr.indexOf('7F');

      hexArr.splice(idx, 1);

      if(idx != 0) {
        hexArr.splice(idx - 1, 1);
      }
    }

    let hexStr = "";
    for(let i = 0; i < hexArr.length; i++) {
      hexStr += hexArr[i];
    }

    return RtsCliUtil.convertHexToStr(hexStr);
  }

  static convertHexToStr(hexString) {
    let ssid = "";

    if(hexString.length % 2 != 0) {
      return null;
    }

    for(let i = 0; i < hexString.length; i+=2) {
      let code = hexString.charAt(i) + hexString.charAt(i + 1);
      try {
        let intFromCode = parseInt("0x" + code);
        if(isNaN(intFromCode)) {
          return null;
        }

        ssid += String.fromCharCode(parseInt("0x" + code));
      } catch {
        return null;
      }
    }

    return ssid;
  }

  static convertStrToHex(str) {
    let hex = "";

    for(let i = 0; i < str.length; i++) {
      hex += RtsCliUtil.padStart(str.charCodeAt(i).toString(16).toUpperCase(), 2, '0');
    }

    return hex;
  }

  static rtsWifiScanResponseStr(msg, version) {
    let str = '';

    let statusStr = '';

    switch(msg.statusCode) {
      case 0:
        statusStr = 'success';
        break;
      case 100:
        statusStr = 'error_getting_proxy';
        break;
      case 101:
        statusStr = 'error_scanning';
        break;
      case 102:
        statusStr = 'failed_scanning';
        break;
      case 103:
        statusStr = 'error_getting_manager';
        break;
      case 104:
        statusStr = 'error_getting_services';
        break;
      case 105:
        statusStr = 'failed_getting_services';
        break;
      default:
        statusStr = '?';
        break;
    }

    str += `status: ${statusStr}\n`;
    str += `scanned ${msg.scanResult.length} network(s)...\n\n`;
    
    str += RtsCliUtil.padEnd('Auth', 12, ' ');
    str += RtsCliUtil.padEnd('Signal', 6, ' ');
    str += RtsCliUtil.padEnd('', 4, ' ');
    str += RtsCliUtil.padEnd('', 4, ' ');
    str += 'SSID\n';

    for(let i = 0; i < msg.scanResult.length; i++) {
      let authType = '';
      let r = msg.scanResult[i];
      switch(r.authType) {
        case 0:
          authType = 'none';
          break;
        case 1:
          authType = 'WEP';
          break;
        case 2:
          authType = 'WEP_SHARED';
          break;
        case 3:
          authType = 'IEEE8021X';
          break;
        case 4:
          authType = 'WPA_PSK';
          break;
        case 5:
          authType = 'WPA_EAP';
          break;
        case 6:
          authType = 'WPA2_PSK';
          break;
        case 7:
          authType = 'WPA2_EAP';
          break;
      }

      str += RtsCliUtil.padEnd(authType, 12, ' ');
      let signalStr = RtsCliUtil.padEnd(r.signalStrength, 6, ' ');

      if(version < 3) {
        switch(r.signalStrength) {
          case 0:
          case 1:
            r.signalStrength = 30;
            break;
          case 2:
            r.signalStrength = 70;
            break;
          default:
          case 3:
            r.signalStrength = 100;
            break;
        }
      }

      if(0 <= r.signalStrength && r.signalStrength <= 30) {
        signalStr = '\x1b[91m' + RtsCliUtil.padEnd('#', 6, ' ') + '\x1b[0m';
      } else if(30 < r.signalStrength && r.signalStrength <= 70) {
        signalStr = '\x1b[93m' + RtsCliUtil.padEnd('##', 6, ' ') + '\x1b[0m';
      } else if(70 < r.signalStrength && r.signalStrength <= 100) {
        signalStr = '\x1b[92m' + RtsCliUtil.padEnd('###', 6, ' ') + '\x1b[0m';
      }

      str += signalStr;
      str += RtsCliUtil.padEnd((r.hidden?'H':''), 4, ' ');

      let p = '';
      if(version >= 3) {
        p = (r.provisioned?'*':'');
      }
      str += RtsCliUtil.padEnd(p, 4, ' ');

      if(r.wifiSsidHex == 'hidden') {
        str += 'hidden\n';
      } else {
        str += RtsCliUtil.convertHexToStr(r.wifiSsidHex) + '\n';
      }
    }

    return str;
  }

  static rtsWifiConnectResponseStr(msg, version) { 
    let str = '';
    let wifiState = '';
    let result = '';

    switch(msg.wifiState) {
      case 0:
        wifiState = '\x1b[91munknown\x1b[0m';
        break;
      case 1:
        wifiState = '\x1b[92monline\x1b[0m';
        break;
      case 2:
        wifiState = '\x1b[93mconnected\x1b[0m';
        break;
      case 3:
        wifiState = '\x1b[91mdisconnected\x1b[0m';
        break;
      default:
        wifiState = '?';
        break;
    }

    str += `WiFi connection:\n`
     + `${RtsCliUtil.padStart('wifi state: ', 14, ' ') + wifiState}\n`;

    if(version >= 3) {
      switch(msg.connectResult) {
        case 0:
          result = 'success';
          break;
        case 1:
          result = 'failure';
          break;
        case 2:
          result = 'invalid password';
          break;
        case 255:
          result = 'none';
          break;
        default:
          result = '?';
          break;
      }
      str += `${RtsCliUtil.padStart('result: ', 14, ' ') + result}\n`;
    }

    return str;
  }

  static rtsStatusResponseStr(msg, version) {
    let str = '';
    let wifiSsid = msg.wifiSsidHex != ''? RtsCliUtil.convertHexToStr(msg.wifiSsidHex) : '';
    let wifiState = '';
    let apStr = msg.accessPoint? 'on':'off';
    let v = msg.version;
    let otaStr = msg.otaInProgress? 'yes':'no';
    let esn, ownerStr, cloudAuthed;

    switch(msg.wifiState) {
      case 0:
        wifiState = '\x1b[91munknown';
        break;
      case 1:
        wifiState = '\x1b[92monline';
        break;
      case 2:
        wifiState = '\x1b[93mconnected';
        break;
      case 3:
        wifiState = '\x1b[91mdisconnected';
        break;
      default:
        wifiState = '?';
        break;
    }

    if(version >= 4) {
      esn = msg.esn;
      ownerStr = msg.hasOwner? 'yes':'no';
    }

    if(version >= 5) {
      cloudAuthed = msg.isCloudAuthed?'yes':'no';
    }

    str += `${RtsCliUtil.padStart('ssid: ', 20, ' ') + wifiSsid}\n`
     + `${RtsCliUtil.padStart('wifi state: ', 20, ' ') + wifiState + '\x1b[0m'}\n`
     + `${RtsCliUtil.padStart('access point: ', 20, ' ') + apStr}\n`
     + `${RtsCliUtil.padStart('build version: ', 20, ' ') + v}\n`
     + `${RtsCliUtil.padStart('is ota updating: ', 20, ' ') + otaStr}\n`;

    if(version >= 4) {
      str += `${RtsCliUtil.padStart('serial number: ', 20, ' ') + esn}\n`
          + `${RtsCliUtil.padStart('has cloud owner: ', 20, ' ') + ownerStr}\n`;
    }

    if(version >= 5) {
      str += `${RtsCliUtil.padStart('is cloud authed: ', 20, ' ') + cloudAuthed}\n`;
    }

    return str;
  }

  static rtsWifiIpResponseStr(msg) {
    let str = '';

    if(msg.hasIpV4) {
      // add ipv4
      str += 'IPv4: ';

      for(let i = 0; i < 4; i++) {
        str += msg.ipV4[i];
        if(i < 4 - 1) {
          str += '.';
        }
      }
      str += '\n';
    }

    if(msg.hasIpV6) {
      // add ipv6
      str += 'IPv6: ';

      for(let i = 0; i < 16; i+=2) {
        str += RtsCliUtil.padStart(msg.ipV6[i].toString(16), 2, '0');
        str += RtsCliUtil.padStart(msg.ipV6[i+1].toString(16), 2, '0');
        if(i < 16 - 3) {
          str += ':';
        }
      }
      str += '\n';
    }

    return str;
  }

  static rtsCloudSessionResponseStr(msg) {
    let str = '';
    let statusStr = '';

    str += RtsCliUtil.padStart('result: ', 10, ' ');

    if(msg.success) {
      str += '\x1b[92msuccessfully authorized\n' + '\x1b[0m'
    } else {
      str += '\x1b[91mfailed to authorize\n' + '\x1b[0m';
    }

    switch(msg.statusCode) {
      case 0:
        statusStr = 'UnknownError';
        break;
      case 1:
        statusStr = 'ConnectionError';
        break;
      case 2:
        statusStr = 'WrongAccount';
        break;
      case 3:
        statusStr = 'InvalidSessionToken';
        break;
      case 4:
        statusStr = 'AuthorizedAsPrimary';
        break;
      case 5:
        statusStr = 'AuthorizedAsSecondary';
        break;
      case 6:
        statusStr = 'ReassociatedPrimary';
        break;
    }

    str += RtsCliUtil.padStart('status: ', 10, ' ') + statusStr + '\n';
    str += RtsCliUtil.padStart('token: ', 10, ' ') + msg.clientTokenGuid + '\n';

    return str;
  }

  static rtsWifiAccessPointResponseStr(msg) {
    let str = '';

    if(msg.ssid == '') {
      str += 'AP Disabled';
    } else {
      str += RtsCliUtil.padStart('ssid: ', 15, ' ') + msg.ssid + '\n';
      str += RtsCliUtil.padStart('password: ', 15, ' ') + msg.password + '\n';
    }

    return str;
  }

  static rtsSdkProxyResponseStr(msg) {
    let str = '';

    str += RtsCliUtil.padStart('messageId: ', 15, ' ') + msg.messageId + '\n';
    str += RtsCliUtil.padStart('statusCode: ', 15, ' ') + msg.statusCode + '\n';
    str += RtsCliUtil.padStart('responseType: ', 15, ' ') + msg.responseType + '\n';
    str += RtsCliUtil.padStart('responseBody: ', 15, ' ') + msg.responseBody + '\n';

    return str;
  }

  static rtsWifiForgetResponseStr(msg) {
    let str = '';

    str += 'status: ' + (msg.didDelete?'deleted':'no delete');

    return str;
  }

  static rtsResponseStr(msg) {
    if(msg.code == 0) {
      return 'Error: Not cloud authorized. Do "anki-auth SESSION_TOKEN"';
    }

    return 'Unknown error...';
  }

  static rtsOtaUpdateResponseStr(msg) {
    let n = 0;
    if(msg.expected > 0) {
      n = Number(msg.current/msg.expected);
    }
    return `status:${msg.status}\nprogress:${100*n}% (${msg.current} / ${msg.expected})`;
  }

  static addTimeout(promise) {
    let timeout = new Promise((resolve, reject) => {
      let t = setTimeout(() => {
        clearTimeout(t);
        reject();
      }, 5000);
    });

    return Promise.race([ promise, timeout ]);
  }

  static makeId() {
    let ret = "";
    let chars = "abcdefghijklmnopqrstuvwxyz";
  
    for (let i = 0; i < 24; i++) {
      ret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  
    return ret;
  }

  static getDateString() {
    let d = new Date(Date.now());
    let year = '' + d.getFullYear();
    let month = ('' + (d.getMonth() + 1)).padStart(2, '0');
    let day = ('' + d.getDate()).padStart(2, '0');
    let hours = ('' + d.getHours()).padStart(2, '0');
    let mins = ('' + d.getMinutes()).padStart(2, '0');
    let secs = ('' + d.getSeconds()).padStart(2, '0');

    return year + '-' + month + '-' + day + '-' + hours + '-' + mins + '-' + secs;
  }

  static byteToHexStr(n) {
    let s = n.toString(16).toUpperCase();
    return '0'.repeat(2 - s.length) + s;
  }

  static keyToHexStr(arr) {
    let str = ""; 
    for(let i = 0; i < arr.length; i++) {
      str += RtsCliUtil.byteToHexStr(arr[i]);
    }
    return str;
  }

  static printHelp(args) {
    let keys = Object.keys(args);
    let p = "";
    for(let i = 0; i < keys.length; i++) {
      p += keys[i] + " ".repeat(24 - keys[i].length) + args[keys[i]].des + "\n";
      p += " ".repeat(24) + args[keys[i]].help + "\n\n";
    }

    return p;
  }
}

module.exports = { RtsCliUtil };