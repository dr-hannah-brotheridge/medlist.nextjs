#!/usr/bin/env node
/* eslint-disable */
// Update git remote origin URL to the new ScriptPal NZ repo.
const fs = require("fs");
const path = require("path");

const configPath = path.resolve(__dirname, "..", ".git", "config");
const cfg = fs.readFileSync(configPath, "utf8");

const OLD = "https://github.com/dr-hannah-brotheridge/medlist.nextjs.git";
const NEW = "https://github.com/dr-hannah-brotheridge/scriptpal_nz.git";

if (!cfg.includes(OLD)) {
  console.log("Old remote URL not found in .git/config. Current [remote \"origin\"] section:");
  const m = cfg.match(/\[remote "origin"\][\s\S]*?(?=\n\[|$)/);
  console.log(m ? m[0] : "(no origin section)");
  process.exit(0);
}

const out = cfg.split(OLD).join(NEW);
fs.writeFileSync(configPath, out, "utf8");
console.log("OK: updated origin URL ->", NEW);