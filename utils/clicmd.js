"use strict";

const { constants } = require("os");
const spawn = require("cross-spawn");
const concat = require("concat-stream");

const fs = require("./fsPromise");

const PATH = process.env.PATH;

const createProcess = async (processPath, args = [], env = null) => {
  // Ensure that path exists
  if (!processPath || !(await fs.exists(processPath))) {
    throw new Error("Invalid process path");
  }

  args = [processPath].concat(args);

  return spawn("node", args, {
    env: Object.assign(
      {
        NODE_ENV: "test",
        preventAutoStart: false,
        PATH, // This is needed in order to get all the binaries in your current terminal
      },
      env
    ),
    stdio: [null, null, null, "ipc"], // This enables interprocess communication (IPC)
  });
};

const executeWithInput = async (
  processPath,
  args = [],
  inputs = [],
  opts = {}
) => {
  if (!Array.isArray(inputs)) {
    opts = inputs;
    inputs = [];
  }

  const { env = null, timeout = 100, maxTimeout = 10000 } = opts;
  const childProcess = await createProcess(processPath, args, env);
  childProcess.stdin.setEncoding("utf-8");

  let currentInputTimeout, killIOTimeout;

  const loop = (inputs) => {
    if (killIOTimeout) {
      clearTimeout(killIOTimeout);
    }

    if (!inputs.length) {
      childProcess.stdin.end();
      // Set a timeout to wait for CLI response. If CLI takes longer than
      // maxTimeout to respond, kill the childProcess and notify user
      killIOTimeout = setTimeout(() => {
        console.error("Error: Reached I/O timeout");
        childProcess.kill(constants.signals.SIGTERM);
      }, maxTimeout);

      return;
    }

    currentInputTimeout = setTimeout(() => {
      childProcess.stdin.write(inputs[0]);
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log("input:", inputs[0]);
      }
      loop(inputs.slice(1));
    }, timeout);
  };

  const promise = new Promise((resolve, reject) => {
    // Get errors from CLI
    childProcess.stderr.on("data", (data) => {
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log("error:", data.toString());
      }
    });

    // Get output from CLI
    childProcess.stdout.on("data", (data) => {
      // Log debug I/O statements on tests
      if (env && env.DEBUG) {
        console.log("output:", data.toString());
      }
    });

    childProcess.stderr.once("data", (err) => {
      childProcess.stdin.end();

      if (currentInputTimeout) {
        clearTimeout(currentInputTimeout);
        inputs = [];
      }
      reject(err.toString());
    });

    childProcess.on("error", reject);

    // Kick off the process
    loop(inputs);

    childProcess.stdout.pipe(
      concat((result) => {
        if (killIOTimeout) {
          clearTimeout(killIOTimeout);
        }

        resolve(result.toString());
      })
    );
  });

  // Appending the process to the promise, in order to
  // add additional parameters or behavior (such as IPC communication)
  promise.attachedProcess = childProcess;

  return promise;
};

module.exports = {
  createProcess,

  create: (processPath) => {
    const fn = (...args) => executeWithInput(processPath, ...args);

    return {
      execute: fn,
    };
  },
};
