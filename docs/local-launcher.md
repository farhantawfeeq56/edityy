# V1 — Local launcher

The first thing Edityy proves: it can connect to a website you are already running on localhost and put its own
floating launcher on top of that live page.

**Nothing is installed in your project.** No npm package, no script tag, no build step, no code change.

## Start Edityy

```bash
git clone https://github.com/farhantawfeeq56/edityy.git
cd edityy
npm ci
npm run dev
```

Edityy runs on <http://localhost:3000>.

## Start a website to connect to

Any normal website works. For a quick throwaway target:

```bash
npx --yes serve -l 4000 public     # or: npm run dev in your own project
```

## Point Edityy at it

1. Open <http://localhost:3000/launcher>.
2. Enter the URL of the running site, e.g. `http://localhost:4000`.
3. Press **Connect**.

Edityy loads that page inside the Edityy view with a circular **Edityy** launcher fixed in the bottom-right corner
of it. The site underneath keeps behaving normally: links, forms, navigation and its own scripts all work.

Clicking the launcher logs `[edityy] launcher clicked` to the browser console and nothing else — the editor is not
part of V1.

## How the connection works

The connection is a **server-side reverse proxy with HTML injection**, implemented in `app/launcher`:

```
browser                     Edityy (next dev)                your dev server
  │  GET /launcher                │                               │
  │  GET /launcher/proxy?url=...  │  fetch http://localhost:4000/   │
  │──────────────────────────────▶│──────────────────────────────▶│
  │◀───────── HTML + launcher ────│◀─────────────── HTML ─────────│
```

| File | Role |
| --- | --- |
| `app/launcher/page.tsx` | the connect screen: URL form + view of the target |
| `app/launcher/local-launcher.tsx` | form state, renders the proxied page in an iframe |
| `app/launcher/proxy/route.ts` | fetches the target, returns the rewritten HTML |
| `app/launcher/connect.ts` | the only logic: URL guard + `injectLauncher()` |

### How the launcher is injected

`injectLauncher()` (in `app/launcher/connect.ts`) does two string insertions on the fetched HTML:

- before `</head>`: a `<style data-edityy-launcher>` block with the launcher CSS
- before `</body>`: a `<script data-edityy-launcher>` that creates the button and appends it to
  `<html>`

The script runs in the target page's own document, so the button inherits the page's viewport and scrolls with
`position: fixed`. If the target ships a `<meta http-equiv="Content-Security-Policy">` with `frame-ancestors`,
Edityy strips just that directive — otherwise the browser would refuse to frame the page at all and no injection
could help. The CSS is:

```css
position: fixed; right: 24px; bottom: 24px;
z-index: 2147483647;              /* above anything a site realistically uses */
width/height: 56px; border-radius: 50%;
```

Because the launcher is one element with no wrapper, it never intercepts clicks outside the 56px circle — the
underlying page keeps its own pointer behaviour. The style and script are inline, so nothing extra has to be
served for, and a strict `Content-Security-Policy` on the target cannot block them from loading.

The connect screen reads `?url=` from the query string, so a target can be linked directly:
`http://localhost:3000/launcher?url=http%3A%2F%2Flocalhost%3A4000`.

### Limits of V1 (known, deliberate)

- **Origin root only.** The target is fetched at `/`; paths, query strings and sub-routes of the target are not
  mapped. Clicking a link in the proxied page navigates the iframe back to the target's own server (Edityy's
  injection is not applied to that page) — the launcher is visible on the connected page, not on pages you navigate
  into. Refresh the Edityy tab to re-inject.
- **Relative assets work, absolute cross-origin ones may not** (an absolute `https://cdn…` URL still loads, since
  the browser fetches it directly; an absolute URL pointing at a *different* dev server may be blocked by CORS).
- **Only `http(s)` on loopback/private hosts** is accepted, so the proxy cannot be pointed at arbitrary hosts.
- Responses are never cached (`cache-control: no-store`) — the launcher is injected per request.
- **Injection is unconditional** (V1 has nothing to hide behind), so a redirect or a non-HTML content type is passed
  through to the frame instead of an error page.
- A dead target is shown as a readable error in the frame instead of a blank page.
- **"Fixed to the viewport" means the site's viewport**, i.e. the frame Edityy shows the site in. Scrolling the site
  keeps the launcher in place; scrolling the Edityy page itself moves the whole frame.

## Test the integration

Automated check of the logic (URL guard + injection + idempotency):

```bash
npm run test
```

Manual check:

1. Start a website on `http://localhost:4000`.
2. `npm run dev` Edityy, open <http://localhost:3000/launcher>, connect to `http://localhost:4000`.
3. The site renders inside Edityy and the circular launcher sits bottom-right.
4. Scroll the page — the launcher stays put.
5. Click a link or submit a form on the target site — it still responds normally (it loads from its own server,
   so the launcher is not on that page; that is a documented V1 limit).
6. Click the launcher — console logs `[edityy] launcher clicked`.
7. Enter a bad URL, e.g. `https://example.com` — Edityy explains that V1 only connects to localhost.
8. Enter a port with nothing on it, e.g. `http://localhost:4999` — the frame says the server is not running.

## Why this approach for V1

- **Zero install.** The brief forbids requiring a published package. A proxy needs nothing from the developer's
  project, so the mechanism can be proven in an afternoon.
- **The page stays real.** Edityy does not re-render, rebuild or sandbox the site. It is the actual running
  application, so "does the site still work underneath?" is answered by looking at it.
- **The injection point is where a real integration needs to be anyway.** Any future overlay (element selection,
  text editing) has to run inside the target document to see the target's DOM. Proving the launcher first proves
  the hard part: reaching into a page you don't own at runtime.

## What changes later for a real public SDK/integration

- **Injection without a proxy.** Serving the target through Edityy breaks relative paths and target routing. A
  public integration injects a small `<script src="…/edityy.js">` (via a Vite/webpack plugin or a dev-server
  middleware) so the page is served by its own server, unmodified, and the launcher is added at runtime.
- **Path mapping + base-path rewriting** in the proxy, and a websocket/streaming pass-through for HMR.
- **A bridge channel** (postMessage or an injected client) between the overlay and the Edityy app, instead of
  hosting both in one iframe.
- **Origin allow-listing per Space** with a real handshake, instead of the V1 loopback guard.
- Only then: the editor itself. See the README for the wider product direction.
