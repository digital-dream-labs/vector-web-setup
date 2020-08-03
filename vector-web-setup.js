#!/usr/bin/env node

/* Copyright (c) 2019-2020 Digital Dream Labs. See LICENSE file for details. */

var commander = require("commander");

const program = new commander.Command();

program
  .version("1.0.0", "-v, --version")
  .description(
    " __      ________ _____ _______ ____  _____  \n" +
      " \\ \\    / /  ____/ ____|__   __/ __ \\|  __ \\ \n" +
      "  \\ \\  / /| |__ | |       | | | |  | | |__) |\n" +
      "   \\ \\/ / |  __|| |       | | | |  | |  _  / \n" +
      "    \\  /  | |___| |____   | | | |__| | | \\ \\ \n" +
      "     \\/   |______\\_____|  |_|  \\____/|_|  \\_\\ \n\n"
  )
  .addCommand(require("./tools/configure.js"))
  .addCommand(require("./tools/ota.js").otaAdd)
  .addCommand(require("./tools/ota.js").otaSync)
  .addCommand(require("./tools/ota.js").otaApprove)
  .exitOverride(() => {
    process.exit(0);
  });

program
  .command("serve")
  .description("Serve the vector websetup")
  .option("-p, --port <number>", "port to serve the setup on", 8000)
  .action((options) => {
    require("./tools/run.js")(options.port);
  });

program.parse(process.argv);
