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
import { edityy } from "edityy";

export default defineConfig({
  plugins: [
    {
      name: "edityy",
      configureServer(server) {
        server.middlewares.use(edityy());
      },
    },
  ],
});
```

**Anything else** that takes `(req, res, next)` — Connect, Express, a plain
`http` server:

```js
import { createServer } from "node:http";
import { edityy } from "edityy";

createServer(edityy()).listen(3000);
```

Reload the page. The launcher is in the bottom-right.

### Next.js

Next renders the page itself, so a dev-server middleware cannot patch its HTML —
`proxy.ts` (Next 16's name for `middleware.ts`) gets a Web `Request`, not the
node response stream. Add the script to your root layout instead:

```tsx
// app/layout.tsx
<script src="/__edityy/edityy.js" defer />
```

and serve that path with a route handler:

```ts
// app/__edityy/edityy.js/route.ts
import { launcher } from "edityy/inject";

export function GET() {
  return new Response(launcher, { headers: { "content-type": "text/javascript" } });
}
```

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
edityy({ tag }) // returns a (req, res, next) middleware
```

`tag` defaults to `<script src="/__edityy/edityy.js" defer></script>`. Pass your own if you need a different attribute set.

Also exported: `ASSET_PATH`, `TAG`, `launcher` (the script source) and `inject(body, tag?)` for injecting into an HTML string yourself.

## Known limits

- **Dev-only.** This is not a proxy and not a production server plugin. Install it as a dev dependency and keep it out of your production build.
- **A chunked HTML response is left alone.** The tag is not injected into streamed HTML, and the launcher script is not served by this middleware on a chunked server. Vite and Next dev both buffer, so this does not affect them.
- **A strict `script-src` CSP blocks the tag.** Nothing at the Edityy side changes that.
- **It fails open.** An error inside the middleware is swallowed and your page is served unchanged, rather than taking the dev server down.

## What comes next

Clicking the launcher opens the editor panel. `edityy:launcher-click` is the seam
the editor uses to talk to your page.

## License

MIT