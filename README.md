# Edityy

**A visual editing layer for code-based websites.**

`npm install -D edityy`, one line in your dev server config, and the Edityy launcher appears in the bottom-right corner
of the site you are already running. Your codebase stays the source of truth.

```bash
npm install -D edityy
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { edityy } from "edityy";

export default defineConfig({
  plugins: [{ name: "edityy", configureServer(server) { server.middlewares.use(edityy()); } }],
});
```

Reload the page. The launcher is there. Full setup for Vite, Connect/Express and Next.js is in the
[package README](packages/edityy/README.md).

## How it works

```
your codebase → your dev server → edityy middleware → the page, with a launcher
```

The middleware serves `/__edityy/edityy.js` and injects a relative `<script>` tag into the HTML your dev server already
returns. A relative URL means it follows whatever port you are on, so there is nothing to configure and no port to keep
in sync.

The launcher itself mounts a host element that is fixed to the viewport, ignores pointer events, and renders its button
inside an **open shadow root** — so your page's CSS cannot restyle it and it cannot leak styles back out. Clicking
dispatches an `edityy:launcher-click` event on `window`: the seam a later editor panel uses to talk to your page.

## The idea

You already have a website built in your codebase. Edityy works on top of the running application instead of asking you
to rebuild that site inside a visual editor.

| Concern | Owner |
| --- | --- |
| Visual intent | Edityy |
| Implementation | AI coding agent |
| Source of truth | Codebase |

See [DESIGN.md](DESIGN.md) for the visual language.

## Status

V1 is the launcher. It runs, it is tested, and it is packaged — the editor panel behind the click does not exist yet.

## Repository layout

| Path | What |
| --- | --- |
| `packages/edityy` | The published npm package. The middleware and the launcher payload. |
| `app` | A one-page site for this repo. Not the product. |
| `DESIGN.md` | Visual language. |

## Development

```bash
npm install          # installs the workspace
npm test             # the package's checks
npm run lint
npm run dev          # the site in this repo
```

```bash
cd packages/edityy
npm test             # 14 checks
npm pack --dry-run   # what would ship
```

## License

MIT