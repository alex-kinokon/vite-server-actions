# vite-server-actions

A Vite plugin that implements server actions. Write server-side logic directly in your code using the `"use server"` directive.
The following example uses React but no framework is required.

> [!IMPORTANT]
> This is a work in progress. It currently works, but is not published on npm.
> You will need to build it yourself.

## Usage

In your Vite config file:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import serverActions from "@aet/server-actions/plugin";

export default defineConfig({
  plugins: [serverActions()],
});
```

To create a server action:

```ts
"use server";

import { useRequest } from "@aet/server-actions";

// Server actions must be async
export async function printAction(data: { username: string }) {
  // Do anything with the request.
  const request = useRequest();

  console.log("Server action executed with data:", data);
  return { message: "Action completed successfully!" };
}
```

and to use your server action from your client code:

```tsx
import { printAction } from "./actions";

export default function MyComponent() {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.target));
    const result = await printAction(formData);
    console.log(result.message);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="username" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Production

In development, the plugin uses the Vite dev server to handle API requests. For production, you’ll need to set up your own server that calls the generated request handler. See `example/production.ts` for reference. The generated handler accepts a WHATWG `Request` object and returns a `Response`.

```ts
// Hono
app.post(API_ROUTE, ctx => handler(ctx.req.raw));

// Elysia
app.post(API_ROUTE, ctx => handler(ctx.request));

// Vanilla
import { createServerAdapter } from "@whatwg-node/server";
import { createServer } from "http";
createServer(createServerAdapter(handler)).listen(4000);

// Express
import { createServerAdapter } from "@whatwg-node/server";
app.use("/mypath", createServerAdapter(handler));

// Bun / Deno
import { createServerAdapter } from "@whatwg-node/server";
Bun.serve(createServerAdapter(handler)); // or...
Deno.serve(createServerAdapter(handler));

// Fastify
app.route({
  url: API_ROUTE,
  method: ["POST"],
  handler: (req, reply) =>
    myServerAdapter.handleNodeRequestAndResponse(req, reply, {
      req,
      reply,
    }),
});
```

### Serialize/hydrate custom data format

This library uses [`devalue`](https://github.com/sveltejs/devalue) to serialize and hydrate data across network and supports complex structures (recursive reference, `Map`, `Set`, `Date`, etc.) out of the box. To support more data types:

```ts
// src/serialize.ts
import type { DevalueReducers, DevalueRevivers } from "@aet/server-actions/json";

export const reducers: DevalueReducers = {
  Vector: value => value instanceof Vector && [value.x, value.y],
};

export const revivers: DevalueRevivers = {
  Vector: ([x, y]) => new Vector(x, y),
};
```

```ts
// Client code
import { setStringifyReducers, setParseRevivers } from "@aet/server-actions/json";
import { reducers, revivers } from "./src/serialize.ts";

setStringifyReducers(reducers);
setParseRevivers(revivers);
```

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { reducers, revivers } from "./src/serialize.ts";

import serverComponents from "@aet/server-actions/plugin";

export default defineConfig({
  plugins: [
    serverComponents({
      parseRevivers: revivers,
      stringifyReducers: reducers,
    }),
  ],
});
```

### Context passing

To make a variable available to your action handlers, use the built-in handler context storage.

```ts
// main.ts
import { getHandlerContext } from "@aet/server-actions";
import { Hono } from "hono";

import { API_ROUTE, handler } from "../example-dist/server/app.js";

export interface HandlerContext {
  db: Kysely;
}

const context = getHandlerContext<HandlerContext>();

const app = new Hono();
app.post(API_ROUTE, c => context.run({ db }, () => handler(c.req.raw)));

// action.ts
import { useContext } from "@aet/server-actions";

import type { HandlerContext } from "./main.ts";

export async function getUserInfo(name: string) {
  const { db } = useContext<HandlerContext>();
  await db.selectFrom("users");
}
```

## How It Works

On the client side, your server action functions will be rewritten into `fetch` calls. This library
generates server side glue code that calls your action handlers based on the HTTP request it
receives.

## Configuration

- `apiRoute`: Prefix for server action endpoints. Defaults to `/_api`.
- `outDir`: Output directory for server code. Relative to Vite config's `outDir`.

Example:

```javascript
export default defineConfig({
  plugins: [
    serverActions({
      apiRoute: "/_api2",
      outDir: "server",
    }),
  ],
});
```

## License

MIT
