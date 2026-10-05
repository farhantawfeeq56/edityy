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
Pushes to other branches build and run `npx wrangler preview`, which creates a Worker Preview for the branch; that
command needs the `previews` block in `wrangler.jsonc`, so keep it even though it is empty.

Workers Builds installs with npm 10, and `.npmrc` raises npm's fetch retries and timeouts so the ~127 MB `workerd`
Linux binary doesn't silently fail to download (the same mitigation `farhantawfeeq56/cmsy` uses). `.nvmrc` pins Node
24. `.github/workflows/cloudflare-deployments.yml` mirrors each build onto the repo's Deployments page with a live link.

Workers Builds does not wait for this repo's CI, so a merge deploys even if CI is red. CI must be green before merge
(AGENTS.md §3.7) for that to be safe.

`npm run build` is `vinext build`, the same Workers bundle Cloudflare deploys; `npm start` serves it locally on the
Workers runtime. To check a deploy without deploying: `npm run build && npx wrangler deploy --dry-run`.

## Releasing

`packages/edityy` is published to npm by `.github/workflows/release.yml`. A version bump that merges to `main` is the
release: the reviewed PR is the only approval, and nothing is done by hand after the merge. There is no npm token
anywhere: the workflow authenticates with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC),
and every version gets a provenance attestation.

1. While you work, add notes under `## Unreleased` in `packages/edityy/CHANGELOG.md`.
2. To release, in a PR:
   ```bash
   npm run bump -- patch      # or minor, major, or an exact version like 1.0.0-beta.1
   ```
   This sets the version in `packages/edityy/package.json` and `package-lock.json`, renames `## Unreleased` to the new
   version with today's date, and moves the root `edityy` range when it would no longer cover the new version (#45).
   It refuses to run if `## Unreleased` is missing or empty.
3. Merge the PR the usual way. On the push to `main`, the `Release` workflow:
   - **check**: reads the version, and stops if CHANGELOG.md has no section for it;
   - **publish**: runs the tests and publishes, if that version is not on npm yet;
   - **release**: creates the `v<version>` tag and GitHub Release with that version's CHANGELOG notes.

   A version with a prerelease suffix (`1.0.0-beta.1`) goes to the `next` dist-tag and a prerelease, never `latest`.
   A push that does not change the version publishes nothing.

npm can take a few minutes to process a new version before you can install it. The **publish** job waits up to 10
minutes for it, then the **release** job runs.

If a run fails, fix the cause and **re-run all jobs**. Each job skips what is already done (version on npm, release
exists), so a re-run never publishes twice. If the version is still not installable after 10 minutes, npm has probably
staged it instead of publishing it, and the run fails and says so. A maintainer approves it on npmjs.com (**Staged
Packages**) with 2FA, then re-runs the workflow to create the release.

To rehearse without publishing: **Actions → Release → Run workflow** on `main` with `dry-run` ticked.

### One-time setup (owner)

Both need the owner's accounts.

1. **npm trusted publisher.** On npmjs.com, `edityy` → **Settings** → **Trusted publishing** → GitHub Actions:
   organization or user `farhantawfeeq56`, repository `edityy`, workflow filename `release.yml`, environment `npm`, and
   under **Allowed actions** tick *Allow `npm publish`*. Without it, npm refuses the publish (`403 OIDC permission
   denied`) or only stages it. An existing connection cannot be edited: delete it and add it again. Then set
   **Publishing access** to *require two-factor authentication and disallow tokens*, so trusted publishing is the
   only way in.
2. **GitHub `npm` environment.** Repo **Settings** → **Environments** → `npm`. Limit deployment branches and tags to
   `main`, and add **no** required reviewers: the PR approval on `main` (AGENTS.md rule 12) is the release approval.

## License

MIT