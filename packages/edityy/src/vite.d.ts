import type { EdityyOptions, Middleware } from "./index.js";

export interface EdityyViteOptions extends EdityyOptions {
  /** `false` stops stamping `data-edityy-src` on JSX elements. */
  source?: boolean;
}

/**
 * The plugin, described by its own shape so this package needs no `vite`
 * types: it is assignable to Vite's `Plugin`.
 */
export interface EdityyVitePlugin {
  name: "edityy";
  apply: "serve";
  enforce: "pre";
  configResolved(config: { root: string }): void;
  configureServer(server: { middlewares: { use(fn: Middleware): unknown } }): void;
  transform(code: string, id: string): { code: string; map: null } | null;
}

/** The attribute that carries where an element was written. */
export declare const SOURCE_ATTR: "data-edityy-src";

/** A Vite plugin, dev server only: `plugins: [edityy()]`. */
export declare function edityy(options?: EdityyViteOptions): EdityyVitePlugin;

/** Stamp `data-edityy-src="path:line:col"` on intrinsic JSX elements of a parsed program. */
export declare function stampSource(code: string, ast: unknown, path: string): string;

export default edityy;
