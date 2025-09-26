import { AsyncLocalStorage } from "node:async_hooks";

let requestStorage: AsyncLocalStorage<Request>;

/**
 * Returns the current `Request` object.
 */
export function useRequest(): Request {
  return requestStorage.getStore()!;
}

/**
 * @internal
 */
export let setRequestStorage: ((request: typeof requestStorage) => void) | null = (
  request: typeof requestStorage
) => {
  requestStorage = request;
  setRequestStorage = null;
};

let handlerContext: AsyncLocalStorage<unknown> | undefined;

/**
 * Use this to make additional data available context to server action handlers.
 * This function always returns the same storage object.
 *
 * @example
 *
 * ```ts
 * import { getHandlerContext } from "@aet/server-actions";
 * import { Hono } from "hono";
 *
 * import { API_ROUTE, handler } from "../example-dist/server/app.js";
 *
 * const handler = getHandlerContext<{ db: Kysely }>();
 *
 * const app = new Hono();
 * app.post(API_ROUTE, c => handlerContext.run({ db }, () => handler(c.req.raw)));
 * ```
 */
export function getHandlerContext<T = unknown>() {
  return (handlerContext ??= new AsyncLocalStorage<T>()) as AsyncLocalStorage<T>;
}

/**
 * Returns the current context data.
 *
 * @example
 * ```ts
 * "use server";
 *
 * import { useContext } from "@aet/server-actions";
 *
 * export async function getUserInfo(name: string) {
 *   const { db } = useContext<{ db: Kysely }>();
 *   await db.selectFrom("users")...
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function useContext<T = unknown>() {
  return handlerContext!.getStore()! as T;
}
