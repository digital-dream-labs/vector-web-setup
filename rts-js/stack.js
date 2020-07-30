/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

const ACCOUNT_ENDPOINTS = "accountEndpoints";
const API_KEYS = "apiKeys";

const TYPE = {
  CLOUD: "cloud",
  LOCAL: "local",
};

class Stack {
  constructor(name, stackJson) {
    this.name = name;
    this.apiKeys = null;
    this.accountEndpoints = null;
    this.parse(stackJson);
  }

  parse(json) {
    if (json[API_KEYS] !== undefined) {
      this.apiKeys = json[API_KEYS];
    }

    if (json[ACCOUNT_ENDPOINTS] !== undefined) {
      this.accountEndpoints = json[ACCOUNT_ENDPOINTS];
    }
  }

  getAccountEndpoints() {
    return this.accountEndpoints;
  }

  getApiKeys() {
    return this.apiKeys;
  }
}

module.exports = { Stack, TYPE };
