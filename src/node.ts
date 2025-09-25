// https://github.com/honojs/node-server/blob/660e784b9d184b1f18829f8b776561a4df63b6e3/src/request.ts
import type { IncomingMessage } from "node:http";

function getRawBody(req: IncomingMessage, bodySizeLimit?: number) {
  const h = req.headers;
  if (!h["content-type"]) {
    return null;
  }

  const contentLength = Number(h["content-length"]);

  // check if no request body
  if (
    (req.httpVersionMajor === 1 &&
      isNaN(contentLength) &&
      h["transfer-encoding"] == null) ||
    contentLength === 0
  ) {
    return null;
  }

  if (req.destroyed) {
    return null;
  }

  let size = 0;
  let cancelled = false;

  return new ReadableStream({
    start(controller) {
      if (bodySizeLimit !== undefined && contentLength > bodySizeLimit) {
        const message = `Content-length of ${contentLength} exceeds limit of ${bodySizeLimit} bytes.`;
        const error = new Error(message);
        controller.error(error);
        return;
      }

      req.on("error", error => {
        cancelled = true;
        controller.error(error);
      });

      req.on("end", () => {
        if (cancelled) return;
        controller.close();
      });

      req.on("data", chunk => {
        if (cancelled) return;

        size += chunk.length;
        if (size > contentLength) {
          cancelled = true;

          const constraint = contentLength ? "content-length" : "BODY_SIZE_LIMIT";

          controller.error(
            new Error(`request body size exceeded ${constraint} of ${contentLength}`)
          );

          return;
        }

        controller.enqueue(chunk);

        if (controller.desiredSize === null || controller.desiredSize <= 0) {
          req.pause();
        }
      });
    },

    pull() {
      req.resume();
    },

    cancel(reason) {
      cancelled = true;
      req.destroy(reason);
    },
  });
}

export function getRequest({
  request,
  base,
  bodySizeLimit,
}: {
  request: IncomingMessage;
  base: string;
  bodySizeLimit?: number;
}): Request {
  let headers = request.headers as Record<string, string>;
  if (request.httpVersionMajor >= 2) {
    // the Request constructor rejects headers with ':' in the name
    headers = { ...headers };
    // https://www.rfc-editor.org/rfc/rfc9113.html#section-8.3.1-2.3.5
    if (headers[":authority"]) {
      headers.host = headers[":authority"];
    }
    delete headers[":authority"];
    delete headers[":method"];
    delete headers[":path"];
    delete headers[":scheme"];
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : getRawBody(request, bodySizeLimit);

  return new Request(base + request.url, {
    // @ts-expect-error vendor code
    duplex: "half",
    method: request.method,
    headers: Object.entries(headers),
    body,
  });
}
