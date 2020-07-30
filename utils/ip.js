const ifaces = require("os").networkInterfaces();

let address;

Object.keys(ifaces).forEach((dev) => {
  ifaces[dev].filter((details) => {
    if (details.family === "IPv4" && details.internal === false) {
      address = details.address;
    }
  });
});

const getIp = () => {
  return address;
};

module.exports = {
  getIp,
};
