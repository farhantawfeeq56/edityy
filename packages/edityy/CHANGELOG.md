# Changelog

All notable changes to the `edityy` package. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `edityy/client`: a browser bootstrap that mounts the launcher. Frameworks that
  inject client modules can use it directly — on Next 16.3+ it makes the launcher
  one line in `next.config.ts` via `instrumentationClientInject`, with no route
  handler and no `<script>` tag.

### Fixed

- The launcher is no longer tree-shaken out of client bundles. `sideEffects` was
  `false`, which let a bundler drop the payload from an import that existed only
  for its side effects. (#43)
- The README's Next.js setup is one config line, not two files to write by hand.
  The previous instructions produced no launcher and no error if you skipped
  them. (#43)

## 0.1.1 — 2026-10-03

### Fixed

- HTML pages arrived truncated: `content-length` was sent before the launcher
  tag was injected. Headers are now held until `end()`, so the length is right
  the first time it is sent. (#20)
- A body written with `write()` and then `end()` got no tag.
- A response whose header store throws no longer turns the page into a 500; the
  middleware fails open as documented.

## 0.1.0 — 2026-10-03

### Added

- `edityy()` dev-server middleware: serves `/__edityy/edityy.js` and injects the
  launcher tag into HTML responses. (#18)
- The launcher: one button in the bottom-right, inside an open shadow root,
  dispatching `edityy:launcher-click` on `window`.
- `inject()`, `launcher`, `ASSET_PATH` and `TAG` exports.
