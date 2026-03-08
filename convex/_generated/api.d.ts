/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as diagnostics from "../diagnostics.js";
import type * as export_ from "../export.js";
import type * as files from "../files.js";
import type * as filing from "../filing.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as internalFunctions from "../internalFunctions.js";
import type * as logic from "../logic.js";
import type * as ocr from "../ocr.js";
import type * as print from "../print.js";
import type * as printAction from "../printAction.js";
import type * as returns from "../returns.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  diagnostics: typeof diagnostics;
  export: typeof export_;
  files: typeof files;
  filing: typeof filing;
  http: typeof http;
  import: typeof import_;
  internalFunctions: typeof internalFunctions;
  logic: typeof logic;
  ocr: typeof ocr;
  print: typeof print;
  printAction: typeof printAction;
  returns: typeof returns;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
