# context.md — Edityy

Read this file first. It names what the repo holds and where each fact lives.

## Refresh rule

Refresh this file with every code change that a reader would miss. Add, rename, or remove a path, endpoint, data file, command, option, or user-visible behavior: update the matching row in the same commit. Review this file in each PR that adds a feature. A stale row is a bug: fix it before merge.

## What Edityy is

Edityy is a visual editing layer for code-based websites. The user runs their own dev server. Edityy adds a launcher in the bottom-right corner. The user points at an element and edits it in the browser. A coding agent writes the edit into source code. The codebase stays the source of truth.

The product, from the user's view:

- Launcher. One install line puts it on the running site. It lives in an open shadow root, so page CSS cannot restyle it and it leaks no styles out.
- Editing mode. Click the launcher, point at any element, click it. The dock edits type, colour, spacing, fill, border, shadow, and filters. The user types new words straight into the text. Each edit is one inline style on the live page. Leaving the mode restores the page exactly.
- Arrange. The user adds, moves, and deletes elements. Shift-click selects siblings. Shift+A stacks them in a column.
- Fonts. The user picks from fonts already on the page or browses Google Fonts. Edityy loads a face only on preview or pick.
- Undo. Undo and redo cover style changes. The edits list reviews, selects, or reverts each edit.
- Variations. The user picks one element, asks for N style variants, and switches them live with keys `1` to `9` and `0`. Each popped card shows the element name over the variant name, a copy-id button with `<` and `>` element nav, square numbered chips, Notes, and `x`/tick. The kept variant becomes a normal edit. The words save as an edit at once; no card waits for the agent. The temporary canvas is removed, so a comment ask writes directly into source code.
- Chat previews. The user types `edityy::` plus an instruction in agent chat. The agent writes the change into the source code directly. The temporary canvas is removed: nothing is painted, and no card waits on the canvas.
- Handoff. Three paths move edits to the agent: copy as Markdown prompt, save to `.edityy/changes.json`, or MCP read with `npx edityy mcp`. Edityy never writes source code. The agent does.
- Setup CLI. `npx edityy init` writes the config for the detected framework. `npx edityy doctor` checks the setup again. Both are idempotent.

Flow:

```
codebase → dev server → Edityy middleware → page with launcher → edits → agent → codebase
```

Edityy never writes source code. The agent does.

## Repo layout

|Path|What|
|-|-|
|`packages/edityy/`|The published npm package. The product.|
|`packages/edityy/src/`|Package source. Zero dependencies.|
|`packages/edityy/test/`|Package checks. Run with `node --test`.|
|`app/`|The marketing site and docs site for this repo. Not the product.|
|`app/edityy/`|Next.js route handlers. They expose the package endpoints under rewrites.|
|`app/docs/`|Docs pages. One page per topic.|
|`app/playground/`|Throwaway page. It compares Puck and Tiptap stacks. Issue #11. Not linked.|
|`app/design/`|Design preview and `vartest` fixture.|
|`app/land/`|Blank test page for landing look. Not linked.|
|`scripts/`|`bump.mjs` (release version bump) and `check-pack.mjs` (tarball check).|
|`.github/workflows/`|`ci.yml`, `release.yml`, `cloudflare-deployments.yml`.|
|`DESIGN.md`|Visual language. Warm paper, graphite ink, one gold signal.|
|`README.md`|Repo overview and deploy notes.|
|`AGENTS.md`|Working agreement. Read it before any code change.|
|`context.md`|This file.|

## The package (`packages/edityy`)

Name: `edityy`. Version: see `packages/edityy/package.json`. License: MIT.

Exports:

|Export|File|Use|
|-|-|-|
|`.` / `./inject`|`src/index.js`|`edityy()` middleware, `inject()`, route factories, paths.|
|`./vite`|`src/vite.js`|Vite plugin. Mounts the middleware on the dev server only.|
|`./client`|`src/client.js`|Next.js bootstrap. Imports `edityy.js` for its side effect.|
|`./motion.css`|`src/motion.css`|Motion tokens. The site imports them.|
|bin `edityy`|`src/cli.js`|`init`, `doctor`, `mcp`.|

Source files:

|File|Role|
|-|-|
|`src/edityy.js`|The launcher payload. About 9600 lines. IIFE. Mounts host element fixed to viewport. Uses open shadow root. Selects elements, shows dock, makes inline-style edits, polls asks, paints previews.|
|`src/previews.js`|Comment-box preview requests and agent previews. Allowlist markup twice (server and page). No script, no event attribute, no iframe reaches canvas. Warns on weak paints (spacing, fixed width, raw colour, breakpoints) in the `place_preview` reply.|
|`src/variations.js`|Style variations for one element. Agent answers with N variants. Keys `1`–`9` and `0` switch the live element.|
|`src/changes.js`|Saved edit list. Validates browser payload. Makes agent Markdown from checked fields only. Never trusts browser Markdown.|
|`src/session.js`|Canvas session persist. Reload or hot update restores edits from `sessionStorage` plus `.edityy/session.json`.|
|`src/store.js`|Shared store. One atomic write (temp file plus rename), one JSON read, one id maker, wrappers for fetch routes and Node middleware.|
|`src/index.js`|Middleware plus all route factories. Serves `/\_\_edityy/edityy.js` and `logo.png`. Injects tag before `</head>`. Fails open (calls `next()` on error).|
|`src/vite.js`|Vite plugin (`apply: "serve"`, `enforce: "pre"`). Stamps each intrinsic JSX element with `data-edityy-src="path:line:col"`. Skips components. Fails open.|
|`src/mcp.js`|MCP server. Exposes saved changes, asks, previews, variations. Agent tools: `get\_work`, `mark\_applied`, `clear\_all`, `place\_preview`, `place\_variants`.|
|`src/init.js`|`npx edityy init`. Detects framework from `package.json`. Writes Vite plugin, or `instrumentation-client.ts` plus `proxy.ts` for Next.js, or prints middleware. Writes MCP config. Appends `vartest` rules to `AGENTS.md`. Idempotent. `--remove` reverts.|
|`src/cli.js`|CLI entry. Commands: `init`, `doctor`, `mcp`.|
|`src/client.js`|One import of `edityy.js`. Next.js 15.3+ path via `instrumentation-client` file. Next.js 16.3+ path via `instrumentationClientInject`.|
|`src/logo.png`|Brand mark. Served at `LOGO\_PATH`.|
|`src/motion.css`|Timing tokens (`--edityy-tint`, `--edityy-settle`, `--edityy-enter`, easings). Site and editor chrome share them.|

Endpoints (all dev only; Next.js routes answer 404 outside `development`):

|Path constant|Path|Role|
|-|-|-|
|`ASSET\_PATH`|`/\_\_edityy/edityy.js`|Launcher script.|
|`LOGO\_PATH`|`/\_\_edityy/logo.png`|Brand mark.|
|`CHANGES\_PATH`|`/\_\_edityy/changes`|POST saves edits to `.edityy/changes.json` (limit 1 MB, max 500 changes).|
|`VARIATIONS\_PATH`|`/\_\_edityy/variations`|Variation requests and responses.|
|`PREVIEWS\_PATH`|`/\_\_edityy/previews`|Agent previews awaiting Keep or Discard.|
|`PREVIEW\_REQUEST\_PATH`|`/\_\_edityy/preview-request`|Comment-box requests (`edityy:: instruction`).|
|`SESSION\_PATH`|`/\_\_edityy/session`|Canvas session.|
|`ASKS\_PATH`|`/\_\_edityy/asks`|All asks at once. The page polls it. The MCP getter reads the same files.|

Data files (all under `<root>/.edityy/`, git-ignored via own `.gitignore`):

|File|Holds|
|-|-|
|`.edityy/changes.json`|`{ version: 1, savedAt, page, markdown, changes\[] }`. Each change: `{ label, selector, source, props\[], text, comment, added, removed, moved }`. Each prop: `{ prop, before, after, on?, when?, googleFont? }`. `source` is `path:line:col` or null.|
|`.edityy/variation-\*.json`|Variation request (`VARIATION\_REQUEST\_FILE`) and responses (`VARIATION\_RESPONSE\_FILE`).|
|`.edityy/previews\*.json`|Pending previews (`PREVIEWS\_FILE`) and preview requests (`PREVIEW\_REQUEST\_FILE`).|
|`.edityy/session.json`|Canvas session (`SESSION\_FILE`).|
|`.edityy/cleared.json`|Last clear timestamp (`CLEARED\_FILE`). Open page drops its state on clear.|
|`.edityy/applied.json`|Last applied timestamp (`APPLIED\_FILE`). Open page adopts its paint on apply, so no refresh is needed.|

Key invariants:

* Browser input never reaches the agent unchecked. `checkChanges` cuts each change to known fields, checks types and lengths, and rebuilds Markdown.
* `inject()` uses two regexes (script-src check, `</head>` match). Returns body untouched when not HTML or tag present.
* Save endpoint accepts `localhost`, subdomains, IP addresses, plus `allowedHosts` option. `allowedHosts: true` accepts all.
* `store()` writes beside target then renames. Reader sees old or new file, never half a file.
* An insert with no anchor lands at the ask's drawn spot (`region.anchor` plus `region.position`, else the insert parent, else the end of `main`). An anchor the agent sets wins.

## The site (`app/`)

Stack: TypeScript, Next.js 16 App Router, React 19, Tailwind v4. Deployed on Cloudflare Workers via `vinext build` and Workers Builds.

|Path|Role|
|-|-|
|`app/layout.tsx`|Root layout. Loads self-hosted Figtree (`app/fonts/Figtree-latin.woff2`). Imports `edityy/motion.css` and `globals.css`.|
|`app/page.tsx`|Landing page. Sections: steps, features, handoffs, install (`npx edityy init`). Client code: `CopyButton` (`app/copy.tsx`). The `#agent` card is static markup.|
|`app/copy.tsx`|Copy-to-clipboard button with live region and `say` animation.|
|`app/globals.css`|Tailwind theme. Paper `#faf9f6`, ink `#25241f`, gold `#d4a72c` (fill only), brand-ink `#8a6a10` (readable gold text). Utilities: `tint`, `lift`, `say`. Old `rose`/`blush`/`plum` names kept as aliases.|
|`app/docs/layout.tsx`|Docs chrome. Header plus sidebar driven by `nav.ts`.|
|`app/docs/nav.ts`|Docs structure. One list drives the sidebar. Add a page here.|
|`app/docs/page.tsx`|Overview. What Edityy does, how launcher arrives, where edits go.|
|`app/docs/install/page.tsx`|Install paths (Vite, Next.js, Connect/Express).|
|`app/docs/editing/page.tsx`|Editing mode: dock and keyboard.|
|`app/docs/variations/page.tsx`|Style variations and `vartest`.|
|`app/docs/previews/page.tsx`|Chat previews (`edityy::`).|
|`app/docs/handoff/page.tsx`|Handoff: copy, save to project, MCP.|
|`app/docs/mcp/page.tsx`|MCP server setup and tools.|
|`app/docs/api/page.tsx`|Options, exports, events.|
|`app/docs/ui.tsx`|Docs primitives (`H1`, `Lead`, `P`, `UL`, `LI`, `Code`, `Note`, `Pre`, `H2`).|
|`app/playground/`|Puck vs Tiptap comparison. Not linked from site.|
|`app/design/`|Design preview (`page.tsx`, `preview.tsx`, `edityy.css`) and `comment-count-vartest.tsx` fixture.|
|`app/edityy/\*/route.ts`|Thin wrappers: `changesRoute`, `variationsRoute`, `previewsRoute`, `previewRequestRoute`, `sessionRoute`, `asksRoute`, `logoRoute` from the package.|
|`next.config.ts`|Dev-only `instrumentationClientInject: \["edityy/client"]` (gated on `NODE\_ENV`). Rewrites `/\_\_edityy/\*` onto `/edityy/\*` routes. Never ship launcher to production.|
|`vite.config.ts`|`vinext()`, `tailwindcss()`, Cloudflare plugin. Build path for Workers.|
|`wrangler.jsonc`|Worker name `edityy`, `nodejs\_compat`, `vinext/server/app-router-entry` main. Keep empty `previews` block (branch previews need it).|
|`ui-policy.json`|UI lint policy: fonts, type sizes, control sizes, banned copy, viewports.|

## Scripts, CI, release, deploy

|Item|Command or file|
|-|-|
|Dev site|`npm run dev` (`next dev --webpack`).|
|Lint site|`npm run lint` (ESLint 9 plus `eslint-config-next`).|
|Tests|`npm test` (workspace tests plus `node --test scripts/\*.test.mjs`). Package only: `cd packages/edityy \&\& npm test`.|
|Bump|`npm run bump -- patch\|minor\|major\|<x.y.z>` (`scripts/bump.mjs`). Updates `packages/edityy/package.json`, lockfile, CHANGELOG `Unreleased` heading, root range if uncovered.|
|Pack check|`scripts/check-pack.mjs`. Tarball must hold exactly `src/`, README, LICENSE, CHANGELOG.|
|CI|`.github/workflows/ci.yml`. Package tests on Node 18, 20, 22, 24, plus pack check, plus site lint and build. Aggregate `ci` job is the required check on `main`.|
|Release|`.github/workflows/release.yml`. A version bump merged to `main` publishes via npm trusted publishing (OIDC). No token. No manual step after merge.|
|Deploy|Cloudflare Workers Builds on every push to `main`. Branch pushes make Worker Previews. `npm run build` is `vinext build`. `npm start` serves it on Workers runtime. Dry run: `npm run build \&\& npx wrangler deploy --dry-run`.|

## Agent workflow (how to work with Edityy artifacts)

* Saved edits live in `.edityy/changes.json`. Read `markdown` for the prompt, `changes\[]` for selectors, `source` lines, and `props\[]` before/after values.
* `vartest{N}` (for example `vartest3`): user tests variants. Segmented control floats bottom-right. Keys `1`–`N` switch variants. Agent writes the variants into the source code. Kept variant becomes a normal edit.
* `edityy:: instruction`: agent writes it into the source code directly. No canvas paint.
* After writing source from edits, call `mark\_applied` with the edit ids so they are not applied twice.
* Pencil on a kept preview reopens its options: the paint returns with the kept pick selected. A reopened preview keeps, discards, and switches like a new one.
* `clear\_all` removes every edit, ask, paint, and handoff. Use only when user asks to remove or clear all edits.
* This repo: `AGENTS.md` is the working agreement. Branch per issue. No push to `main`. Every PR needs the other developer's approval. Commit format: `<type>(<scope>): <summary> \[#<issue>]`.

