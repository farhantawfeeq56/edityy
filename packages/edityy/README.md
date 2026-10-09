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

On Vite 8 or later it also marks where each element was written. Every DOM element
in a `.jsx` or `.tsx` file gets `data-edityy-src="src/App.tsx:12:7"`, so an edit can
name the exact line to change. Components (`<Card>`) are skipped, because a
component can drop the attribute. Turn it off with `edityy({ source: false })`.
An older Vite cannot parse TSX in a plugin, so there it does nothing.

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
Load the client bootstrap from an `instrumentation-client` file instead. Next
runs it before hydration, so there is no route handler and no `<script>` tag in
the layout. Put the file in the project root, or in `src/` if your app is there:

```ts
// instrumentation-client.ts
if (process.env.NODE_ENV === "development") import("edityy/client");
```

This works on Next.js 15.3 and later. The check keeps the launcher out of
`next build`, since this is a dev tool.

On Next.js 16.3 and later, you can set `instrumentationClientInject` in
`next.config.ts` instead of the file:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && {
    instrumentationClientInject: ["edityy/client"],
  }),
};

export default nextConfig;
```

Do not use this option on Next.js 16.2 or earlier. Those versions do not know
it: they print `Unrecognized key(s) in object: 'instrumentationClientInject'`,
ignore it, and show no launcher.

The launcher script is bundled into the page rather than served from
`ASSET_PATH`, so nothing extra is requested at runtime. If you would rather
serve it over HTTP — to keep it out of your client bundle — use the layout
approach instead: put `<script src="/__edityy/edityy.js" defer />` in
`app/layout.tsx` and serve that path with a route handler that returns
`launcher` from `edityy/inject`. Next treats a folder that starts with `_` as
private, so the route lives at `app/%5F%5Fedityy/edityy.js/route.ts`. Use this
approach also on Next.js before 15.3, which has no `instrumentation-client` file.

To save edits to the project from Next.js, add the route in
[Save edits to the project](#save-edits-to-the-project).

## Save edits to the project

"Save to project" in the edits list sends the edits to the dev server, which writes
them to `.edityy/changes.json` in the project root. A coding agent working in the
repo can read them from there (or through [MCP](#mcp)). The folder gets its own
`.gitignore`, so pending edits never end up in a commit.

```json
{
  "version": 1,
  "savedAt": "2026-10-06T09:30:00.000Z",
  "page": "http://localhost:5173/pricing",
  "markdown": "# Visual edits from Edityy\n…",
  "changes": [
    {
      "label": "h1 “Simple pricing”",
      "selector": "#pricing > h1",
      "source": "src/Pricing.tsx:12:7",
      "props": [{ "prop": "font-size", "before": "32px", "after": "40px" }],
      "text": { "before": "Simple pricing", "after": "Pricing" }
    }
  ]
}
```

The Vite plugin and the middleware handle this themselves (`POST /__edityy/changes`).
The middleware writes under `process.cwd()` and the Vite plugin under Vite's
`root`, or under `root` if you pass one. Both accept only
JSON from the page's own origin. `save: false` turns the endpoint off.

The endpoint takes requests only for `localhost` (and its subdomains) and IP
addresses. This stops another site that points its own name at your computer
(DNS rebinding). If you open the dev server under another name, add it with
`allowedHosts: ["dev.example", ".test.example"]`. A leading dot also takes the
subdomains, and `true` takes every host.

Each change is checked before it is written, and the `markdown` field is made
from the checked changes. The page cannot put its own text there.

**Next.js** needs one route file. Next treats a folder that starts with `_` as
private, so the folder name spells the underscores as `%5F`:

```ts
// app/%5F%5Fedityy/changes/route.ts
import { changesRoute } from "edityy";

export const POST = changesRoute();
```

The route answers 404 unless `NODE_ENV` is `development`, so it writes nothing in
a production build.

## MCP

`npx edityy mcp` is a stdio [MCP](https://modelcontextprotocol.io) server that
hands the saved edits to a coding agent. It has two tools:

- `get_visual_changes` returns the edits in `.edityy/changes.json`, as the same
  Markdown that "Copy for an agent" copies;
- `clear_visual_changes` deletes them once they are in the code.

Claude Code:

```bash
claude mcp add edityy -- npx edityy mcp
```

Cursor, or any client configured with JSON:

```json
{ "mcpServers": { "edityy": { "command": "npx", "args": ["edityy", "mcp"] } } }
```

It reads from the directory it is started in. Pass `--root <dir>` to read from another one.

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
- dispatches an `edityy:launcher-click` event on `window` when clicked, and toggles the editing mode.

The script is idempotent, so a page that renders the tag more than once still mounts one launcher.

### The editing mode

- The button shrinks into the pointer. Hover outlines an element; a click selects it, and the page's own click handlers do not run. Shift-click adds or removes elements from the selection.
- Selecting an element opens a nearby action menu with **Edit text**, **Move**, **Parent**, **Child** and **Delete**. Text is not editable until you choose **Edit text**. Move previews a new position among its siblings. Delete is temporary and undoable when you leave edit mode.
- Words are typed into where they stand (`contenteditable="plaintext-only"`, leaf text only, so no child element is lost).
- The dock at the bottom changes the selection. Text starts with font family, weight, size, line height, letter spacing, alignment, decoration and colour; a container or media element starts with padding and margin. The `+` adds shadow, blur, brightness, greyscale, contrast, fill, border, padding and margin to that one element.
- The font family control lists the fonts the page has, then the Google Fonts catalog, with a search field over both. Nothing loads with the page:
  - The first open of the control fetches the catalog of names (about 35 KB) from `api.fontsource.org`, once for each page visit.
  - The list draws 40 rows at most. One request to `fonts.googleapis.com` gets a sample of those rows' names, so each row shows in its own face.
  - A pick loads that whole family. The browser downloads only the weights and styles that the page uses.
  - No API key or configuration is necessary. If a request fails, the page's own fonts stay in the list.
- The edits button lists every element that really changed. A line selects its element, the arrow reverts it, and two buttons hand the edits on: **Copy for an agent** (Markdown) and **Save to project** (`.edityy/changes.json`).
- Keys: Shift+A wraps selected siblings in a column flex container. Escape closes the open control, then leaves the mode. ⌘Z / Ctrl+Z undoes and ⇧⌘Z / Ctrl+Y redoes. The arrows move the selection to the parent (↑), first child (↓) or siblings (← →); in editable words they need Alt. In the dock, ← → move along the icons. Shift+Arrow does not extend the selection.
- Edits are kept in `sessionStorage` while the mode is on, so a reload or a hot update brings them back. Leaving the mode reverts all of them.

## API

```js
edityy({ tag, nonce, root, save, allowedHosts }) // returns a (req, res, next) middleware
```

- `tag` defaults to `<script src="/__edityy/edityy.js" defer></script>`. Pass your own if you need a different attribute set.
- `nonce` adds `nonce="…"` to the tag, for a page with a strict `script-src` CSP. Give a string, or a
  function `(req, res) => string` when your app makes a new nonce for each response.
- `root` is where `.edityy/changes.json` is written. Defaults to `process.cwd()`.
- `save: false` turns off the save endpoint.
- `allowedHosts` names more hosts the save endpoint takes, besides `localhost` and IP addresses.
  A leading dot also takes the subdomains; `true` takes every host.

Also exported: `ASSET_PATH`, `TAG`, `launcher` (the script source), `inject(body, tag?)`
for injecting into an HTML string yourself, `changesRoute({ root, allowedHosts })` (the save
endpoint as a fetch-style route handler), `writeChanges(payload, root?)`,
`CHANGES_PATH` and `CHANGES_FILE`, and `edityy/client` — the browser bootstrap that
mounts the launcher, for frameworks that inject client modules.

## Known limits

- **Dev-only.** This is not a proxy and not a production server plugin. Install it as a dev dependency and keep it out of your production build.
- **Streamed HTML is held only up to `</head>`.** A chunked response gets the tag before `</head>` and everything after it streams through. A response is chunked when it says `transfer-encoding: chunked`, or when it calls `write()` before `end()` without a `content-length`. If no `</head>` arrives in the first 256 KB, the page is sent unchanged.
- **A strict `script-src` CSP blocks the tag** unless you pass the page's nonce as `nonce`.
- **Google Fonts need network access.** A page whose CSP blocks `api.fontsource.org`, `fonts.googleapis.com` or `fonts.gstatic.com` shows only its own fonts. A Google font you pick is not added to your project: add it to your code when you keep the edit.
- **It fails open.** An error inside the middleware is swallowed and your page is served unchanged, rather than taking the dev server down.

## Events

`edityy:launcher-click` is dispatched on `window` each time the launcher is
clicked, for a host app that wants to know.

## License

MIT