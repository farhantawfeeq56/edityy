import type { IncomingMessage, ServerResponse } from "node:http";

/** A connect-style middleware: Vite, connect, Express or a plain `http` server. */
export type Middleware = (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => void;

export interface EdityyOptions {
  /** The tag injected into HTML. Defaults to {@link TAG}. */
  tag?: string;
  /** A CSP nonce for the tag: a string, or one made per request. */
  nonce?: string | ((req: IncomingMessage, res: ServerResponse) => string | null | undefined);
  /** Where `.edityy/changes.json` is written. Defaults to `process.cwd()`. */
  root?: string;
  /** `false` turns off the save endpoint at {@link CHANGES_PATH} and the variation endpoint. */
  save?: boolean;
  /**
   * More hosts the save endpoint takes, besides `localhost`, its subdomains and
   * IP addresses. A leading dot also takes the subdomains; `true` takes every host.
   */
  allowedHosts?: string[] | true;
}

/** One property an edit changed, with the value the page showed before. */
export interface PropertyChange {
  prop: string;
  before: string;
  after: string;
}

/** One edited element, as the page saves it. */
export interface ElementChange {
  label: string;
  selector: string;
  /** `path:line:col`, when the Vite plugin stamped the element or an ancestor. */
  source: string | null;
  props: PropertyChange[];
  text: { before: string; after: string } | null;
  /** Words the user wrote about this element, or null. */
  comment: string | null;
}

/** What the page sends to the save endpoint. */
export interface ChangesPayload {
  page?: string | null;
  /** Ignored: the Markdown is made from the checked `changes`. */
  markdown?: string;
  changes: ElementChange[];
}

/** What `.edityy/changes.json` holds. */
export interface SavedChanges {
  version: 1;
  savedAt: string;
  page: string | null;
  markdown: string;
  changes: ElementChange[];
}

/** The launcher script source. */
export declare const launcher: string;
/** The path the middleware serves the launcher on: `/__edityy/edityy.js`. */
export declare const ASSET_PATH: "/__edityy/edityy.js";
/** The tag the middleware injects. */
export declare const TAG: string;
/** The path the page posts its edits to: `/__edityy/changes`. */
export declare const CHANGES_PATH: "/__edityy/changes";
/** Where the edits are written, relative to the root: `.edityy/changes.json`. */
export declare const CHANGES_FILE: ".edityy/changes.json";

/**
 * Put the launcher tag before `</head>`. Returns the body itself, unchanged,
 * when it is not HTML or already has the tag.
 */
export declare function inject<T extends string | Buffer>(body: T, tag?: string): T | string;

/** The dev-server middleware: serves the launcher, injects the tag, saves edits. */
export declare function edityy(options?: EdityyOptions): Middleware;

/** Write a page's edits to `.edityy/changes.json`; resolves to the path written. */
export declare function writeChanges(payload: ChangesPayload, root?: string): Promise<string>;

/**
 * The save endpoint as a fetch-style route handler, for Next.js:
 * `export const POST = changesRoute();` in `app/edityy/changes/route.ts`, with
 * a rewrite from `/__edityy/changes` onto it. It answers 404 unless
 * `NODE_ENV` is `development`.
 */
export declare function changesRoute(
  options?: Pick<EdityyOptions, "root" | "allowedHosts">
): (request: Request) => Promise<Response>;

/**
 * The variation endpoint as fetch-style route handlers, for Next.js:
 * `export const { GET, POST, DELETE } = variationsRoute();` in
 * `app/edityy/variations/route.ts`, with a rewrite from `/__edityy/variations`
 * onto it. It answers 404 unless `NODE_ENV` is `development`.
 */
export declare const PREVIEWS_PATH: "/__edityy/previews";

export declare function variationsRoute(options?: Pick<EdityyOptions, "root" | "allowedHosts">): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};

/**
 * The previews endpoint as fetch-style route handlers, for Next.js:
 * `export const { GET, POST, DELETE } = previewsRoute();` in
 * `app/edityy/previews/route.ts`, with a rewrite from `/__edityy/previews`
 * onto it. It answers 404 unless `NODE_ENV` is `development`.
 */
export declare function previewsRoute(options?: Pick<EdityyOptions, "root" | "allowedHosts">): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};

export default edityy;
