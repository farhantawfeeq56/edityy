# edityy

A visual editing layer for code-based websites.

`npm install edityy` puts the Edityy launcher in the bottom-right corner of the site you are already running.

## Install

```bash
npm install -D edityy
```

Add one line to your dev server. The middleware serves the launcher and injects
the tag into the HTML that server returns.

**Vite** — `vite.config.ts`

```ts
import { defineConfig } from "vite";
import { edityy } from "edityy/vite";

export default defineConfig({
  plugins: [edityy()],
});
```

The plugin runs on the dev server only (`apply: "serve"`), so `vite build` never
includes the launcher. It works for every framework that runs on Vite's dev
server: React, Vue, Svelte and Solid templates, SvelteKit, Astro, Nuxt, Remix and
React Router. It takes the same options as the middleware below.

**Anything else** that takes `(req, res, next)` — Connect, Express, a plain
`http` server:

```js
import { createServer } from "node:http";
import { edityy } from "edityy";

createServer(edityy()).listen(3000);
```

Reload the page. The launcher is in the bottom-right.

### Next.js

Next renders the page itself, so a dev-server middleware cannot patch its HTML.
Hand the client bootstrap to `instrumentationClientInject` instead — it runs
before hydration, so there is no route handler and no `<script>` tag in the layout:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  instrumentationClientInject: ["edityy/client"],
};

export default nextConfig;
```

Keep it off in production, since this is a dev tool:

```ts
...(process.env.NODE_ENV === "development" && {
  instrumentationClientInject: ["edityy/client"],
}),
```

The launcher script is bundled into the page rather than served from
`ASSET_PATH`, so nothing extra is requested at runtime. If you would rather
serve it over HTTP — to keep it out of your client bundle — use the layout
approach instead: put `<script src="/__edityy/edityy.js" defer />` in
`app/layout.tsx` and serve that path with a route handler that returns
`launcher` from `edityy/inject`.

## What it does

The middleware does two things:

1. serves `/__edityy/edityy.js` — the launcher script — from your own dev server;
2. injects `<script src="/__edityy/edityy.js" defer>` into the HTML that server returns.

Because the tag is a relative URL, it follows whatever port your dev server is
on and there is nothing to keep in sync.

In the page, the launcher:

- creates a host element fixed to the viewport at `z-index: 2147483647` with `pointer-events: none`, so it never comes between you and your site;
- attaches an **open shadow root**, so your CSS (button resets, fonts, `!important` wars) cannot restyle the launcher and the launcher cannot leak styles back into your page;
- renders one 56px circular button, 24px from the right and bottom edges;
- dispatches an `edityy:launcher-click` event on `window` when clicked, and logs to the console.

The script is idempotent, so a page that renders the tag more than once still mounts one launcher.

## API

```js
edityy({ tag, nonce }) // returns a (req, res, next) middleware
```

- `tag` defaults to `<script src="/__edityy/edityy.js" defer></script>`. Pass your own if you need a different attribute set.
- `nonce` adds `nonce="…"` to the tag, for a page with a strict `script-src` CSP. Give a string, or a
  function `(req, res) => string` when your app makes a new nonce for each response.

Also exported: `ASSET_PATH`, `TAG`, `launcher` (the script source), `inject(body, tag?)`
for injecting into an HTML string yourself, and `edityy/client` — the browser
bootstrap that mounts the launcher, for frameworks that inject client modules.

## Known limits

- **Dev-only.** This is not a proxy and not a production server plugin. Install it as a dev dependency and keep it out of your production build.
- **Streamed HTML is held only up to `</head>`.** A chunked response gets the tag before `</head>` and everything after it streams through. If no `</head>` arrives in the first 256 KB, the page is sent unchanged.
- **A strict `script-src` CSP blocks the tag** unless you pass the page's nonce as `nonce`.
- **It fails open.** An error inside the middleware is swallowed and your page is served unchanged, rather than taking the dev server down.

## What comes next

Clicking the launcher opens the editor panel. `edityy:launcher-click` is the seam
the editor uses to talk to your page.

## License

MIT