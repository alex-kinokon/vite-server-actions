// Development mode server - handles server actions through Vite middleware
// Uses SSR module loading to execute server functions directly during development
import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import { Http2ServerRequest } from "node:http2";
import { TLSSocket } from "node:tls";

import bodyParser from "body-parser";
import * as devalue from "devalue";
import { type Plugin, isRunnableDevEnvironment } from "vite";

import { getRequest } from "./node";
import { type Config, PKG_NAME, type RouteMap, isServerAction, quote } from "./utils";

export const configureServer =
  (config: Config, routeMap: RouteMap): NonNullable<Plugin["configureServer"]> =>
  async devServer => {
    const { apiRoute, suppressErrors, parseRevivers, stringifyReducers } = config;
    const { watcher, middlewares, ssrFixStacktrace, restart, environments } = devServer;

    const serverEnvironment = environments.server;
    assert(isRunnableDevEnvironment(serverEnvironment));

    // Hot reload handler - restarts dev server when server action files change
    // Necessary because route mappings need to be regenerated
    function onReload(file: string) {
      const content = fs.readFileSync(file, "utf-8");
      if (isServerAction(content)) {
        watcher.off("add", onReload);
        watcher.off("change", onReload);
        void restart(/* forceOptimize */ true);
      }
    }

    watcher.on("add", onReload);
    watcher.on("change", onReload);

    // Set up API endpoint middleware to handle server action requests
    middlewares.use(
      apiRoute,
      bodyParser.text({
        type: "application/json",
      })
    );

    const storage = new AsyncLocalStorage<Request>();
    const runtime: typeof import("./index") =
      await serverEnvironment.runner.import(PKG_NAME);
    runtime.setRequestStorage!(storage);

    middlewares.use(
      apiRoute,
      async (req: IncomingMessage & { body?: string }, res, next) => {
        function userError(devMsg: string, code = 400) {
          res.statusCode = code;
          next(new Error(devMsg));
        }

        try {
          if (typeof req.body !== "string") {
            return userError(
              `Invalid request body: must be an string, got ${typeof req.body}`
            );
          }

          const body = devalue.parse(req.body, parseRevivers);

          // Validate request format: [actionId, args]
          if (!Array.isArray(body)) {
            return userError(
              `Invalid request body: must deserialize into an array, got ${typeof body}`
            );
          }

          const [id, payload] = body;
          if (!routeMap.has(id)) {
            return userError(`Invalid action id: ${id}`);
          }

          // Load the server-side module containing the actual function
          const { path, name } = routeMap.get(id)!;
          const module = await serverEnvironment.runner.import(path + "?server");

          // Navigate to the specific function (handles nested object paths)
          let handler = module;
          for (const segment of name.split(".")) {
            if ((handler as unknown) == null || !Object.hasOwn(handler, segment)) {
              return userError(`Invalid action name: ${name}`, 404);
            }
            handler = handler[segment];
          }

          if (typeof handler !== "function") {
            return userError(`Invalid action handler: ${name}`, 500);
          } else if (!Array.isArray(payload)) {
            return userError("Invalid payload: must be an array");
          }

          const base =
            req instanceof Http2ServerRequest
              ? `${req.scheme}://${req.authority}`
              : `${req.socket instanceof TLSSocket ? "https" : "http"}://${req.headers.host}`;

          // Execute the server action with provided arguments
          try {
            const result = await storage.run(getRequest({ request: req, base }), () =>
              handler(...payload)
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              devalue.stringify(result === undefined ? [] : [result], stringifyReducers)
            );
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            // Development shows full errors, production hides them
            if (suppressErrors) {
              res.end('["Internal Server Error"]');
            } else {
              const output: Array<string | undefined> = [(e as Error).message];
              output.push((e as Error).stack);
              res.end(quote(output));
            }
          }
        } catch (error) {
          ssrFixStacktrace(error as Error);
          process.exitCode = 1;
          next(error);
        }
      }
    );
  };
