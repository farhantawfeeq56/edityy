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
import { edityy as middleware } from "./index.js";

/** A Vite plugin that serves the launcher and injects it into every HTML page. */
export function edityy(options = {}) {
  return {
    name: "edityy",
    apply: "serve",
    configureServer(server) {
      // Added directly, not from a returned post hook, so it runs before Vite's
      // own HTML middleware and sees the page Vite sends.
      server.middlewares.use(middleware(options));
    },
  };
}

export default edityy;
