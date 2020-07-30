var { Stack } = require("./stack.js");
const STACK = "stacks";

class Settings {
  constructor(settingsJson) {
    this.stackDict = {};
    this.parse(settingsJson);
  }

  parse(json) {
    var stackJson = json[STACK];

    if (stackJson !== undefined) {
      for (const name in stackJson) {
        this.stackDict[name] = new Stack(name, stackJson[name]);
      }
    }
  }

  getStackNames() {
    return Object.keys(this.stackDict);
  }

  getStack(name) {
    return this.stackDict[name];
  }
}

module.exports = { Settings };
