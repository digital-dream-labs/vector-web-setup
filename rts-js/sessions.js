/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

var { RtsCliUtil } = require('./rtsCliUtil.js');

class Sessions {
  constructor() {
    this.sessions = {};
    this.getSessions();
  }

  getSessions() {
    try {
      this.sessions = JSON.parse(Sessions.getCookie("sessions"));
      if('remote-keys' in this.sessions) {
        let remoteKeys = Object.keys(this.sessions['remote-keys']);
        for(let i = 0; i < remoteKeys.length; i++) {
          this.sessions['remote-keys'][remoteKeys[i]].tx = 
            Sessions.keyDictToArray(this.sessions['remote-keys'][remoteKeys[i]].tx);
          this.sessions['remote-keys'][remoteKeys[i]].rx = 
            Sessions.keyDictToArray(this.sessions['remote-keys'][remoteKeys[i]].rx);
        }
      }

      if('id-keys' in this.sessions) {
        this.sessions['id-keys'].publicKey = 
          Sessions.keyDictToArray(this.sessions['id-keys'].publicKey);
        this.sessions['id-keys'].privateKey = 
          Sessions.keyDictToArray(this.sessions['id-keys'].privateKey); 
      }
    }
    catch(e) {
      console.log(e);
      this.sessions = {};
    }
  }

  // ---------------------------------------------------------------------------

  setLastVector(name) {
    this.sessions['last-vec'] = name;
  }

  getLastVector() {
    return this.sessions['last-vec'];
  }

  // ---------------------------------------------------------------------------

  setEnv(env) {
    this.sessions['env'] = env;
  }

  getEnv() {
    return this.sessions['env'];
  }

  // ---------------------------------------------------------------------------

  setKeys(publicKey, privateKey) {
    this.sessions['id-keys'] = { "publicKey":publicKey, "privateKey":privateKey };
  }

  getKeys() {
    return this.sessions['id-keys'];
  }

  // --------------------------------------------------------------------------- 
  
  setViewMode(view) {
    this.sessions['view-mode'] = view;
  }

  getViewMode() {
    let mode = this.sessions['view-mode'];
    if(mode == null) {
      mode = 1;
    }

    return mode;
  }

  // ---------------------------------------------------------------------------

  setSession(remoteKey, name, encryptKey, decryptKey) {
    if(!('remote-keys' in this.sessions)) {
      this.sessions['remote-keys'] = {};
    }

    this.sessions['remote-keys'][RtsCliUtil.keyToHexStr(remoteKey)] = {
      name:name,
      tx:encryptKey,
      rx:decryptKey
    };
  }

  getSession(remoteKey) {
    if(!('remote-keys' in this.sessions)) {
      return null;
    } 

    if(RtsCliUtil.keyToHexStr(remoteKey) in this.sessions['remote-keys']) {
      return this.sessions['remote-keys'][RtsCliUtil.keyToHexStr(remoteKey)];
    }

    return null;
  }

  clearSessions() {
    this.sessions['remote-keys'] = {};
  }
    
  deleteSession(remoteKey) {
    if(!('remote-keys' in this.sessions)) {
      return;
    } 

    if(RtsCliUtil.keyToHexStr(remoteKey) in this.sessions['remote-keys']) {
      delete this.sessions['remote-keys'];
    }
  }

  // ---------------------------------------------------------------------------


  // ---------------------------------------------------------------------------

  save() {
    Sessions.setCookie("sessions", JSON.stringify(this.sessions));
  }

  static keyDictToArray(dict) {
    let dKeys = Object.keys(dict);
    let ret = new Uint8Array(dKeys.length);

    for(let j = 0; j < dKeys.length; j++) {
      ret[j] = dict[dKeys[j]];
    }

    return ret;
  } 

  static getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  }

  static setCookie(cname, cvalue) {
    document.cookie = cname + "=" + cvalue + ";";
  }
}

module.exports = { Sessions };
