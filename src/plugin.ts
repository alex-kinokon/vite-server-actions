// Plugin entry point - orchestrates the dual-mode server action system
// Returns multiple Vite plugins that work together to enable "use server" functionality

// eslint-disable-next-line import-x/no-unresolved
import sscHelperText from "inline:./assets/client.ts";
import type { Plugin, ResolvedConfig } from "vite";

import { configureServer } from "./devServer";
import { writeBundle } from "./prodServer";
import { transform } from "./transform";
import { type Config, type RouteMap, createVirtualModule, quote } from "./utils";

/**
 * A Vite plugin that implements server actions. Write server-side logic directly in your
 * code using the `"use server"` directive.
 */
export default function serverComponents(options?: Partial<Config>): Plugin[] {
  let vite = {} as ResolvedConfig;
  // Central registry mapping action hashes to their file paths and function names
  // Enables routing from client requests to server-side handlers
  const routeMap: RouteMap = new Map();

  const config: Config = {
    apiRoute: "/_api",
    outDir: "server",
    // Generate unique identifiers for each server action
    getId: (path, name) => "$" + cyrb53(quote([path, name])),
    suppressErrors: process.env.NODE_ENV === "production",
    serverViteConfig: {},
    enforceAsync: true,
    ...options,
  };

  // Create the virtual module that provides client-side action request functionality
  // This gets injected into transformed files to replace server function calls
  const sscHelper = createVirtualModule(
    "ssc-helper",
    `const API_ROUTE = ${quote(config.apiRoute)};\n\n${sscHelperText}`
  );

  // Return two plugins: virtual module resolver + main transformation pipeline
  return [
    sscHelper.rollupPlugin,
    {
      name: "server-plugin",
      config: () => ({ environments: { server: {} } }),
      configResolved: viteConfig => {
        vite = viteConfig;
      },
      // Development: Set up middleware to handle server action requests
      configureServer: configureServer(config, routeMap),
      // Core transformation: Convert "use server" files to client-side API callers
      transform: transform(config, routeMap),
      // Production: Generate standalone server after main build completes
      writeBundle: () => writeBundle(vite, config, routeMap),
    },
  ];
}

// cyrb53 hash function - fast, collision-resistant hashing for server action IDs
// Converts file path + function name into compact, URL-safe identifiers
// https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
const HASH_SEED = 0x1a;

export function cyrb53(str: string) {
  let h1 = 0xdeadbeef ^ HASH_SEED;
  let h2 = 0x41c6ce57 ^ HASH_SEED;
  for (let i = 0, ch: number; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
