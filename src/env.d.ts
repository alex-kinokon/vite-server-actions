declare module "inline:*" {
  const content: string;
  export default content;
}

declare module "PKG_NAME" {
  import type { AsyncLocalStorage } from "node:async_hooks";

  export * from "@aet/server-actions";

  export function setRequestStorage(request: AsyncLocalStorage<Request>): void;
}

declare module "PKG_NAME/json" {
  export * from "@aet/server-actions/json";
}

interface Array<T> {
  reduce<T2, U>(
    callbackfn: (
      previousValue: U | T2,
      currentValue: T,
      currentIndex: number,
      array: T[]
    ) => U,
    initialValue: T2
  ): U;
}
