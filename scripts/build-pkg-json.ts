#!/usr/bin/env tsx
import fs from "node:fs/promises";

import type { PackageJson } from "type-fest";

import pkg from "../package.json" with { type: "json" };

const result = pkg as PackageJson;
delete result.scripts;
delete result.devDependencies;
delete result.prettier;
delete result.private;
result.exports = {
  ".": "./index.js",
  "./plugin": "./plugin.js",
  "./json": "./json.js",
};

await fs.writeFile("dist/package.json", JSON.stringify(result, null, 2));
