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
npm test             # the package's checks
npm pack --dry-run   # what would ship
```

CI (`.github/workflows/ci.yml`) runs on every PR and every push to `main`: the package tests on Node 18, 20, 22 and 24,
a check that the tarball ships exactly `src/`, the README, LICENSE and CHANGELOG, and the site's lint and build. The
`ci` job passes only when all of them do; it is the check branch protection requires.

## Deploying the site

The site in `app/` runs on Cloudflare Workers (https://edityy.webdesignbyft.workers.dev). Deploys are done by
Cloudflare **Workers Builds**, connected to this repo in the Cloudflare dashboard (**Workers & Pages → edityy →
Settings → Builds**): every push to `main` builds and deploys, and its status shows up as a check on the commit.

Workers Builds does not wait for this repo's CI, so a merge deploys even if CI is red. CI must be green before merge
(AGENTS.md §3.7) for that to be safe.

`npm run build` is `vinext build`, the same Workers bundle Cloudflare deploys; `npm start` serves it locally on the
Workers runtime. To check a deploy without deploying: `npm run build && npx wrangler deploy --dry-run`.

## Releasing

`packages/edityy` is published to npm by `.github/workflows/release.yml` when a GitHub Release is published. There is
no npm token anywhere: the workflow authenticates with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC), and every version gets a provenance attestation.

1. In a normal PR, bump `version` in `packages/edityy/package.json` (semver) and move the `Unreleased` notes in
   `packages/edityy/CHANGELOG.md` under the new version with today's date. Merge it the usual way.
2. Publish a GitHub Release from `main` whose tag is `v` plus that version:
   ```bash
   gh release create v0.1.1 --target main --title v0.1.1 --notes-file <notes.md>
   ```
3. The `Release` workflow checks the tag matches `package.json`, checks the version is not already on npm, runs the
   tests, and publishes. A version with a prerelease suffix (`1.0.0-beta.1`) goes to the `next` dist-tag, never
   `latest`.

To rehearse without publishing: **Actions → Release → Run workflow** with `dry-run` ticked.

### One-time setup (owner)

Both steps need the owner's accounts; the workflow cannot publish until they are done.

1. **npm trusted publisher.** On npmjs.com, `edityy` → **Settings** → **Trusted publishing** → GitHub Actions:
   organization or user `farhantawfeeq56`, repository `edityy`, workflow filename `release.yml`, environment `npm`. Then
   set **Publishing access** to *require two-factor authentication and disallow tokens*, so trusted publishing is the
   only way in.
2. **GitHub `npm` environment.** Repo **Settings** → **Environments** → **New environment** `npm`. Add the other
   both developers as required reviewers, tick *Prevent self-review*, and limit deployment branches and tags to `main`
   and `v*`. Whoever publishes the release then needs the other developer to approve the publish job.

## License

MIT