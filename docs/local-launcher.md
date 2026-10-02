# V1 — Local launcher

The first thing Edityy proves: it can put its own floating launcher on top of a website you are already running.

**One script tag. No npm package, no build step, no framework.**

```html
<script src="http://localhost:3000/edityy.js" defer></script>
```

## Start Edityy

```bash
git clone https://github.com/farhantawfeeq56/edityy.git
cd edityy
npm ci
npm run dev
```

Edityy serves the launcher at <http://localhost:3000/edityy.js> and explains the setup at
<http://localhost:3000/launcher>.

## Add it to your site

Put the tag in your site's `index.html`, layout or template — any stack. Rails, Django, Laravel, plain HTML, a Vite
or Next app: it is the same one line.

Reload your site and look at the bottom-right corner.

## What it does

`public/edityy.js` runs in your page and:

- creates a host element fixed to the viewport at `z-index: 2147483647` with `pointer-events: none`, so it never
  comes between you and your site;
- attaches an **open shadow root**, so your CSS (button resets, fonts, `!important` wars) cannot restyle the launcher
  and the launcher cannot leak styles back into your page;
- renders one 56px circular button, 24px from the right and bottom edges;
- dispatches an `edityy:launcher-click` event on click, and logs to the console.

That is the whole V1. The click currently only logs — there is no editor yet.

The script is idempotent (`window.__edityy`), so a tag that ends up rendered twice — a shared layout, a component
mounted per route — still mounts one launcher.

## Test it

```bash
npm run test
```

Four checks against a small DOM stub: the launcher mounts, the shadow root and pointer-events rules are set, the
button is a real `<button>` with an accessible name, the click event fires, and loading twice mounts once.

Manual check:

1. Run any site on another port, e.g. `npx serve -l 4000 public`.
2. Add the tag to its `index.html`, reload, and look at the bottom-right.
3. Scroll — the launcher stays put. Click links, use forms — they still work.
4. Open the console and click the launcher: `[edityy] launcher clicked`.

## Why a script tag

The obvious alternative — Edityy proxies your site and injects the launcher into the HTML it serves — was built and
thrown away. It needs nothing in your project either, but it has to re-serve your entire site, which means it can
only ever map the root URL (`/about` silently becomes `/`), it does not proxy assets, APIs or websockets correctly,
and it puts a reverse proxy between you and your own dev server. One tag has the same install cost and a far smaller
blast radius: your site is served by your own server, exactly as before, and Edityy only adds a button.

The tag is also the seam every later feature needs. Element selection, text editing and the rest all have to run
*inside* your page to see your DOM. Proving the launcher proves that path works.

## Known limits

- **A strict `script-src` CSP will block the tag.** The launcher cannot be injected from outside a page that forbids
  external scripts. Nothing at the Edityy side changes that.
- **`https` on a LAN address or real domain** would treat `http://localhost:3000` as mixed content. Plain
  `http://localhost` and `https://localhost` are both fine — Chromium treats loopback as a trustworthy origin, so the
  https case works (verified, not assumed).
- The launcher is injected by you, so there is nothing to disable per environment yet. V1 is local-only by design.

## What comes next

- An npm package (`edityy`) that injects the tag as dev-server middleware, so the line lives in your build config
  instead of your markup and follows your dev server's port. It would fail open and stay a dev-only dependency.
- Clicking the launcher opens the editor panel, replacing the console log.
- The `edityy:launcher-click` event is the seam the editor will use to talk to your page.
