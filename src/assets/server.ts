import { AsyncLocalStorage } from "node:async_hooks";

import * as devalue from "devalue";
import { setRequestStorage } from "PKG_NAME";
import { stringifyReducers } from "PKG_NAME/json";

// Placeholder replaced with generated imports and route mappings during build
__IMPORT__();

// These constants are injected by the build process
declare const ROUTE_MAP: Map<string, (...args: any[]) => unknown>;
declare const SUPPRESS_ERROR: boolean;
declare const __IMPORT__: () => void;

const requestContext = new AsyncLocalStorage<Request>();
setRequestStorage(requestContext);

const jsonResp = (value: unknown, init?: ResponseInit) =>
  new Response(devalue.stringify(value, stringifyReducers), init);

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(undefined, {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  let json: unknown;
  try {
    // Parse and validate request format: [actionId, args]
    json = devalue.parse(await req.text());
  } catch (e) {
    // Handle JSON parsing errors
    if (e instanceof Error && e.message === "Invalid input") {
      return new Response(e.message, { status: 400 });
    }
    throw e;
  }

  if (!Array.isArray(json) || typeof json[0] !== "string" || !Array.isArray(json[1])) {
    return new Response("Invalid request", { status: 400 });
  }

  const [id, payload] = json;
  // Look up the server action function by its hash
  const fn = ROUTE_MAP.get(id);
  if (!fn) {
    return jsonResp(["Not Found"], { status: 404 });
  }

  if (typeof fn !== "function") {
    return jsonResp(
      [
        SUPPRESS_ERROR
          ? "Internal Server Error"
          : `Invalid action handler for ID ${id}: not a function`,
      ],
      { status: 500 }
    );
  }

  try {
    // Execute the server action with the provided arguments
    const result = await requestContext.run(req, () => fn(...payload));
    return jsonResp(result === undefined ? [] : [result]);
  } catch (e) {
    // Return error message, respecting error suppression setting
    return jsonResp([SUPPRESS_ERROR ? "Internal Server Error" : (e as Error).message], {
      status: 500,
    });
  }
}
