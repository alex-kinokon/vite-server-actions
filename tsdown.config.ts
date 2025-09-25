import fs from "node:fs/promises";
import { builtinModules } from "node:module";
import { extname, resolve } from "node:path";

import { type Loader, transformSync } from "esbuild";
import type { Plugin as RollupPlugin } from "rollup";
import { defineConfig } from "tsdown";

import pkg from "./package.json" with { type: "json" };

const externals = Object.keys(pkg.dependencies)
  .concat(Object.keys(pkg.peerDependencies))
  .concat(builtinModules)
  .concat(builtinModules.map(name => `node:${name}`));

export default defineConfig({
  entry: ["./src/index.ts", "./src/plugin.ts", "./src/json.ts"],
  outDir: "dist",
  external: externals,
  format: "esm",
  clean: true,
  tsconfig: "./tsconfig.build.json",
  dts: true,
  plugins: [inlineImportPlugin()],
  define: {
    "process.env.PKG_NAME": JSON.stringify(pkg.name),
  },
});

function inlineImportPlugin(): RollupPlugin {
  const filter = /^inline:/;
  const resolvedInlineIds = new Set<string>();

  return {
    name: "rollup-inline-plugin",
    async resolveId(id, importer) {
      if (!id.startsWith("inline:")) return null;

      const resolveDir = importer ? resolve(importer, "..") : process.cwd();
      const nextPath = resolve(resolveDir, id.replace(filter, ""));

      try {
        await fs.access(nextPath);
        resolvedInlineIds.add(nextPath);
        return nextPath;
      } catch {
        return null;
      }
    },
    async load(id) {
      // Only process files that were resolved through inline: imports
      if (!resolvedInlineIds.has(id)) return null;

      let contents = await fs.readFile(id, "utf8");

      if (/\.tsx?$/.test(id)) {
        const { code } = transformSync(contents.replaceAll("PKG_NAME", pkg.name), {
          loader: extname(id).slice(1) as Loader,
          target: "es2022",
        });
        contents = code;
      }

      this.addWatchFile(id);
      // Export the file contents as a default export string
      return `export default ${JSON.stringify(contents)};`;
    },
  };
}
