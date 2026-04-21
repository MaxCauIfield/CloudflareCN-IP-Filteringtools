#!/usr/bin/env node
/* eslint-disable no-console */

const { runCli } = require("../src/cli");

runCli(process.argv.slice(2)).catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

