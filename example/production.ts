import { relative, resolve } from "node:path";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { API_ROUTE, handler } from "../example-dist/server/app.js";

const app = new Hono();
// Block access to server directory to prevent exposing server code
app.all(`/server/*`, () => new Response("Not Found", { status: 404 }));
// Serve static files (client build output) from parent directory
app.use(
  serveStatic({
    root: relative(process.cwd(), resolve(import.meta.dirname, "example-dist")),
    index: "index.html",
  })
);

app.post(API_ROUTE, ctx => handler(ctx.req.raw));

// Start the production server on configurable port
const port = parseInt(process.env.PORT ?? "3000");

serve({ fetch: app.fetch, port }, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening at http://localhost:${port}`);
});
