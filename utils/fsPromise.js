const fs = require("fs");
const { promisify } = require("util");

module.exports = Object.keys(fs).reduce((acc, fn) => {
  if (fn.match(/(stream|sync)/gi)) {
    acc[fn] = fs[fn];
  } else {
    try {
      acc[fn] = promisify(fs[fn]);
    } catch (err) {
      acc[fn] = fs[fn];
    }
  }
  return acc;
}, {});
