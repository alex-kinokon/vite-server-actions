// Production build system - generates a standalone Hono server after main build
// Creates a separate server bundle that can be deployed independently

import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";

import { types as t } from "@babel/core";
import { generate } from "@babel/generator";
// eslint-disable-next-line import-x/no-unresolved
import productionServerText from "inline:./assets/server.ts";
import type { RollupOutput } from "rollup";
import { type InlineConfig, type ResolvedConfig, build, mergeConfig } from "vite";

import {
  type Config,
  type RouteMap,
  createVirtualModule,
  quote,
  transformJS,
} from "./utils";

export async function writeBundle(
  vite: ResolvedConfig,
  config: Config,
  routeMap: RouteMap
) {
  // Prevent recursive builds when this triggers another build
  if (process.env.VITE_SERVER_ACTIONS_API_BUILD) return;
  process.env.VITE_SERVER_ACTIONS_API_BUILD = "true";

  const rollupOptions = vite.build.rollupOptions;

  // Create entry point by injecting route mappings into server template
  const entry = createVirtualModule("ssc-server", getProductionServer(config, routeMap));

  const outDir = resolve(vite.build.outDir, config.outDir);

  // Build standalone server with SSR configuration
  const mergedConfig = mergeConfig(
    {
      mode: vite.mode,
      dev: vite.dev,
      build: {
        ...vite.build,
        outDir,
        ssr: true, // Server-side build
        copyPublicDir: false,
        emptyOutDir: true,
        rollupOptions: {
          ...rollupOptions,
          output: {
            entryFileNames: "[name].js",
          },
          // External dependencies expected to be available at runtime
          external: [
            "hono",
            "@hono/node-server/serve-static",
            "node:path",
            "node:async_hooks",
            "devalue",
          ],
          input: { app: entry.virtualModuleId },
          plugins: [entry.rollupPlugin],
        },
      },
    } satisfies InlineConfig,
    config.serverViteConfig,
    false
  );
  const out = (await build(mergedConfig)) as RollupOutput;

  await fs.writeFile(
    join(outDir, out.output[0].fileName.replace(/\.js$/, ".d.ts")),
    dts.trimStart()
  );
}

const dts = /* ts */ `
export const API_ROUTE: string;

export function handler(req: Request): Promise<Response>;
`;

// Generate production server code by injecting route mappings into template
function getProductionServer(config: Config, routeMap: RouteMap) {
  const imports: Record<string, Record<string, t.ImportSpecifier>> = Object.create(null);
  const routeMaps: t.ArrayExpression[] = [];
  const { identifier: id } = t;

  // Build import statements and route mapping arrays from the RouteMap
  for (const [hash, { path, name }] of routeMap) {
    const map = (imports[path] ??= Object.create(null));
    if (name.includes(".")) {
      // Handle nested object methods (e.g., "actions.create")
      const [imported, ...rest] = name.split(".");
      const ns = id(config.getId(path, imported, "namespace"));
      map[imported] ??= t.importSpecifier(ns, id(imported));
      routeMaps.push(
        t.arrayExpression([
          id(quote(hash)),
          t.arrowFunctionExpression(
            [t.restElement(id("args"))],
            t.callExpression(
              rest.reduce<t.Identifier, t.MemberExpression>(
                (acc, cur) => t.memberExpression(acc, id(cur)),
                ns
              ),
              [t.spreadElement(id("args"))]
            )
          ),
        ])
      );
    } else {
      // Handle direct function exports
      map[name] = t.importSpecifier(id(hash), id(name));
      routeMaps.push(t.arrayExpression([t.stringLiteral(hash), id(hash)]));
    }
  }

  const injects = t.program([
    ...Object.entries(imports).map(([path, list]) =>
      t.importDeclaration(Object.values(list), t.stringLiteral(`${path}?server`))
    ), //
    t.variableDeclaration("const", [
      t.variableDeclarator(
        id("ROUTE_MAP"),
        t.newExpression(id("Map"), [t.arrayExpression(routeMaps)])
      ),
    ]),
    t.exportNamedDeclaration(
      t.variableDeclaration("const", [
        t.variableDeclarator(id("API_ROUTE"), t.stringLiteral(config.apiRoute)),
      ])
    ),
  ]);

  // Generate the code to inject into the server template
  const inject = generate(injects).code;

  // Replace placeholder in server template with generated imports and constants
  return transformJS(
    productionServerText
      .replace("__IMPORT__();", inject)
      .replaceAll(/\bSUPPRESS_ERROR\b/g, quote(config.suppressErrors))
  );
}
