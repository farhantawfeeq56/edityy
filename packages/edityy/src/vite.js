/*
 * The Vite plugin: `plugins: [edityy()]`.
 *
 * It is the middleware from index.js, mounted on Vite's dev server. `apply:
 * "serve"` is what keeps it out of `vite build`, so the launcher can never ship
 * in a production bundle however the config is written.
 *
 * Covers every framework that runs on Vite's dev server: plain Vite, React,
 * Vue, Svelte and Solid templates, SvelteKit, Astro, Nuxt, Remix and React Router.
 *
 * `vite` is never imported here: the plugin is a plain object, so the package
 * keeps its zero dependencies.
 */
import { relative, sep } from "node:path";
import { edityy as middleware } from "./index.js";

/** The attribute that carries where an element was written. */
export const SOURCE_ATTR = "data-edityy-src";

const JSX_FILE = /\.[jt]sx$/;

/** A Vite plugin that serves the launcher and injects it into every HTML page. */
export function edityy(options = {}) {
  let root = process.cwd();
  return {
    name: "edityy",
    apply: "serve",
    // Before the JSX is compiled away: the stamp goes on the JSX itself.
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      // Added directly, not from a returned post hook, so it runs before Vite's
      // own HTML middleware and sees the page Vite sends. Edits are saved under
      // Vite's root, the same root the source locations are relative to.
      server.middlewares.use(middleware({ root, ...options }));
    },
    transform(code, id) {
      if (options.source === false) return null;
      const file = id.split("?")[0];
      if (!JSX_FILE.test(file) || /[\\/]node_modules[\\/]/.test(file)) return null;
      if (!code.includes("<")) return null;
      // The parser Vite already has, through the plugin context. Vite 8 parses
      // TSX there; an older Vite that cannot throws on it, and the file is left
      // exactly as it was.
      if (typeof this?.parse !== "function") return null;
      try {
        const ast = this.parse(code, { lang: file.endsWith(".tsx") ? "tsx" : "jsx" });
        const out = stampSource(code, ast, relative(root, file).split(sep).join("/"));
        // map: null keeps the incoming map. Every line stays where it was, so a
        // stack trace or a breakpoint lands on the right line; only columns
        // after an inserted attribute on that same line are off.
        return out === code ? null : { code: out, map: null };
      } catch {
        return null; // fail open: a file we cannot read is a file we do not touch
      }
    },
  };
}

/**
 * Put `data-edityy-src="path:line:col"` on every intrinsic JSX element.
 *
 * Intrinsic only — `<div>`, `<h1>`, not `<Card>` or `<motion.div>`. A data
 * attribute on a DOM element reaches the DOM; on a component it is a prop the
 * component may drop or pass somewhere else, and a wrong location is worse than
 * none. An element that already carries the attribute keeps it.
 *
 * Exported for tests: it takes any ESTree program with JSX nodes and UTF-16
 * offsets, which is what Vite's parser returns.
 */
export function stampSource(code, ast, path) {
  const at = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const name = node.name;
    if (!name || name.type !== "JSXIdentifier" || !/^[a-z]/.test(name.name)) return;
    const has = (node.attributes || []).some(
      (a) => a.type === "JSXAttribute" && a.name && a.name.name === SOURCE_ATTR
    );
    if (!has) at.push({ start: node.start, end: name.end });
  });
  if (!at.length) return code;

  const lines = lineStarts(code);
  let out = code;
  // From the end backwards, so an insertion never shifts an offset still to come.
  at.sort((a, b) => b.end - a.end);
  for (const { start, end } of at) {
    const { line, col } = position(lines, start);
    const value = `${path}:${line}:${col}`.replace(/"/g, "&quot;");
    out = out.slice(0, end) + ` ${SOURCE_ATTR}="${value}"` + out.slice(end);
  }
  return out;
}

/** Every node in an ESTree, depth first. Plain objects only: no parent links. */
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const key in node) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const value = node[key];
    if (value && typeof value === "object") walk(value, visit);
  }
}

/** Offsets at which each line starts. */
function lineStarts(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** 1-based line and column of an offset, by binary search over line starts. */
function position(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - starts[lo] + 1 };
}

export default edityy;
