#!/usr/bin/env node
/* eslint-disable no-console */

const { startWebServer } = require("../src/web/server");

startWebServer().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

