// Client-side runtime for server actions - injected into transformed files
// Handles HTTP communication between client and server action endpoints
import * as devalue from "devalue";
import { parseRevivers, stringifyReducers } from "PKG_NAME/json";

// API_ROUTE is injected at build time via virtual module system
declare const API_ROUTE: string;

function safeParse(text: string) {
  try {
    return devalue.parse(text, parseRevivers);
  } catch (e) {
    throw new TypeError("Invalid server response.", { cause: e });
  }
}

export async function actionRequest(id: string, payload: unknown) {
  // Send POST request with action ID and arguments as JSON array
  const res = await fetch(API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: devalue.stringify([id, payload], stringifyReducers),
  });

  if (res.ok) {
    // Successful response - unwrap result from array format
    const [result] = safeParse(await res.text());
    return result;
  } else if (res.headers.get("Content-Type")?.startsWith("application/json")) {
    // Server returned structured error with message and optional stack trace
    const [message, stack] = safeParse(await res.text());
    const err = new Error(message);
    if (stack) {
      err.stack = stack;
    }
    throw err;
  } else {
    // Generic HTTP error
    throw new Error(res.status + " " + res.statusText);
  }
}
