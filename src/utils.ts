// Shared utilities for virtual modules, type definitions, and code transformation
// Provides the foundational building blocks used across the plugin system

import { transformSync } from "esbuild";
import type { InlineConfig, Plugin } from "vite";

import type { DevalueReducers, DevalueRevivers } from "./json";

export const PKG_NAME = process.env.PKG_NAME!;

export interface Config {
  /**
   * API route endpoint
   * @default "/_api"
   */
  apiRoute: string;

  /**
   * Relative to `BuildEnvironmentOptions.outDir`
   * @default "server"
   */
  outDir: string;

  /**
   * Generate a unique identifier for the action or namespace. By default it hashes with cyrb53.
   */
  getId: (filePath: string, name: string, type: "action" | "namespace") => string;

  /**
   * Suppresses error messages. This prevents the server from sending error messages to the client.
   * @default process.env.NODE_ENV === "production"
   */
  suppressErrors: boolean;

  /**
   * Vite config for the server actions API.
   * @default {}
   */
  serverViteConfig: InlineConfig;

  /**
   * Reviver argument to pass to `devalue.parse`.
   */
  parseRevivers?: DevalueRevivers;

  /**
   * Reducer argument to pass to `devalue.stringify`.
   */
  stringifyReducers?: DevalueReducers;

  /**
   * Throw an error if an error handler is not an async function.
   * @default true
   */
  enforceAsync: boolean;

  /**
   * Controls the maximum request body size. If this is a number,
   * then the value specifies the number of bytes; if it is a string,
   * the value is passed to the bytes library for parsing. Defaults to '100kb'.
   */
  bodySizeLimit?: number | string | undefined;
}

// Maps action hashes to their source file paths and function names
// This enables routing client requests to the correct server-side handlers
export type RouteMap = Map<string, { path: string; name: string }>;

// Simple string-based detection of "use server" directive
export function isServerAction(code: string) {
  return code.includes('"use server"') || code.includes("'use server'");
}

// Creates Vite virtual modules that can be imported like regular files
// Used to inject client-side helpers and server templates at build time
export function createVirtualModule(name: string, text: string) {
  const virtualModuleId = `virtual:${name}`;
  const resolvedVirtualModuleId = "\0" + virtualModuleId; // Vite convention for virtual modules
  const virtualModule = text;

  return {
    virtualModuleId,
    rollupPlugin: {
      name: `virtual-module:${name}`,
      resolveId: id => (id === virtualModuleId ? resolvedVirtualModuleId : undefined),
      load: id => (id === resolvedVirtualModuleId ? virtualModule : undefined),
    } as Plugin,
  };
}

// Format JavaScript code using esbuild
export const transformJS = (text: string) =>
  transformSync(text, {
    loader: "js",
    format: "esm",
  }).code;

export const quote = JSON.stringify;
