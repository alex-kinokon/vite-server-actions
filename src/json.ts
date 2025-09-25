export type DevalueReducers = Record<string, (value: unknown) => unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DevalueRevivers = Record<string, (value: any) => unknown>;

/**
 * Reducer argument to pass to `devalue.stringify`.
 */
export let stringifyReducers: DevalueReducers;

/**
 * @example
 * setStringifyReducers({
 *   Vector: value => value instanceof Vector && [value.x, value.y],
 * });
 */
export function setStringifyReducers(reducers: DevalueReducers) {
  stringifyReducers = reducers;
}

/**
 * Reviver argument to pass to `devalue.parse`.
 */
export let parseRevivers: DevalueRevivers | undefined;

/**
 * @example
 * setParseRevivers({
 *   Vector: ([x, y]) => new Vector(x, y),
 * })
 */
export function setParseRevivers(revivers: DevalueRevivers) {
  parseRevivers = revivers;
}
