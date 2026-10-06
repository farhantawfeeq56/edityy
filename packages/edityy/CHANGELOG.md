# Changelog

All notable changes to the `edityy` package. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `edityy({ nonce })` puts a CSP nonce on the injected tag, so a page with a
  strict `script-src` runs the launcher. The nonce is a string or a function of
  the request, and it is attribute-escaped. (#63)
- A streamed (chunked) HTML page gets the launcher too. Only the bytes up to
  `</head>` are held; the rest of the page streams through as it is written. (#64)
- `edityy/vite`: a Vite plugin, so the setup is `plugins: [edityy()]`. It applies
  to the dev server only, so `vite build` never includes the launcher. (#61)
- The Vite plugin marks every DOM element in a `.jsx` / `.tsx` file with
  `data-edityy-src="path:line:col"`, using the parser Vite already has, so an
  edit can say which line to change. `edityy({ source: false })` turns it off. (#62)
- An edits button beside the dock, with a count. It lists every element that
  really changed (a slider dragged out and back is not an edit). Selecting a line
  selects that element, and its arrow reverts that element alone. (#65)
- "Copy for an agent" copies the edits as Markdown that a coding agent can act
  on: a selector, the source location when the Vite plugin stamped one, each
  property as `before → after` (the value the page showed, not the empty inline
  one) and any text change. `window.__edityy_changes()` returns the same text. (#65)
- Undo and redo: ⌘Z / Ctrl+Z, and ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y. One drag of a
  slider is one step, from the first input to letting go, and a border's width
  and style go back together. After typing into the words, ⌘Z stays the
  browser's own text undo. (#66)
- Edits survive a reload or a hot update. While the mode is on, they are kept in
  `sessionStorage` for the page's path and put back after the page loads, with
  the mode on again. An edit whose element is gone is dropped. Storage that is
  missing or throws only means the edits are not kept. (#67)
- The arrow keys move the selection: ↑ to the parent, ↓ to the first child, ← →
  to the siblings. While the caret is in words the arrows move the caret, so
  there they take Alt as well. (#68)
- Padding and margin are in the `+` list for every element. Each one is a
  slider for all four sides and a field for each side. Each side is written as a
  longhand, so the edits list names the side. (#69)
- The dock's icon row is a toolbar with one tab stop: ← → move along it, Home and
  End go to its ends. Escape on an open control puts focus back on its icon. (#70)
- "Save to project" in the edits list writes the edits to `.edityy/changes.json`
  in the project, for a coding agent to read. The middleware and the Vite plugin
  serve `POST /__edityy/changes` themselves; Next.js gets `changesRoute()` for a
  one-line route file. Only JSON from the page's own origin is accepted, up to
  1 MB, and the folder gets a `.gitignore` of its own. (#71)
- `npx edityy mcp`: a stdio MCP server for coding agents, with
  `get_visual_changes` and `clear_visual_changes` over the saved edits. Written
  without an SDK, so the package still has no dependencies. (#72)
- TypeScript declarations for every entry point (`edityy`, `edityy/inject`,
  `edityy/client`, `edityy/vite`), so `strict` projects no longer fail with
  "Could not find a declaration file". The Vite plugin's type is its own shape,
  so the package still needs no `vite` types. (#60)

### Changed

- Under `prefers-reduced-motion: reduce`, the dock and its controls no longer
  animate in. (#70)

### Fixed

- Leaving the edit mode left `outline: none` on every element whose text was
  edited, and took away an outline the element had of its own. The outline is
  recorded before Edityy hides the focus ring, so exit puts back the page's. (#74)

## 0.1.3 — 2026-10-05

### Added

- The selected text becomes editable where it stands. `contenteditable` is
  `plaintext-only`, so a paste cannot inject markup, and the element itself is
  the field — there is no panel input and nothing to commit. Only leaf text
  takes a caret: an element holding child elements is still text as far as the
  dock is concerned, but rewriting its text would destroy them. (#55)
- A `+` at the end of the dock, which adds a control to the row for the element
  that is selected. Picking one puts it in the row before the `+` as another
  icon, drawn like the ones that were always there, and it can only be added once.
- Five controls behind the `+`: shadow (four lengths and a colour), blur,
  brightness, greyscale and contrast. A filter back at its default is left out of
  the list entirely, so dragging one home leaves no filter behind. (#55)
- Text colour in the primary dock, and fill and border behind the `+` — those two
  are about the box rather than the words, since the fill of a text is its colour
  and text has no border. Border comes with a width slider, because a colour on a
  zero-width border is a colour nobody sees. (#55)
- An element keeps the controls that were added to it. Adding blur to one heading
  no longer puts blur on every heading, which is the whole reason for the `+`.

### Fixed

- An open control's icon was invisible. The universal `*{color:...}` reached the
  `<path>` inside each icon as well as its `<svg>`, and a path stroked with
  `currentColor` resolves against its own colour — so every icon was the plum an
  open control is painted, at 1:1 against its own background. The colour is on
  `:host` now, and the contrast measures 12.24:1. (#55)
- The caret jumped to the beginning on every click: making an element editable
  rewrote its `textContent`, which destroys the text node and loses the caret
  position. The value is only read now. (#55)
- The selection frame did not resize as the text grew or shrank, because it was
  re-measured on `keydown` — which fires before the browser has changed the
  words. It listens on `input`. (#55)
- The selection frame did not follow the page when it scrolled; the scroll
  listener only ever hid the hover frame. (#55)
- The element being edited carried two outlines: the browser's focus ring on top
  of Edityy's own frame. (#55)
- A shadow drew nothing at all. `box-shadow-offset-x` and its siblings are not
  CSS properties — those longhands exist only inside an `@property` registration,
  so the browser dropped every one of them. It is written as the shorthand now.
- Greyscale silently took every other filter with it: Chrome has never
  implemented `greyscale()`, and one unknown function invalidates the whole
  `filter` list. It is written as `grayscale()`.
- Every filter read back as "off", because its value was used as both CSS and a
  regular expression and the parentheses became a capture group.
- A filter dragged back to its default stayed on the element as `blur(0px)`,
  because `input.value` hands over a string and `"0" !== 0`.
- Writing a property an empty value left an empty declaration behind rather
  than removing it, and recorded nothing to revert.

## 0.1.2 — 2026-10-04

### Added

- An element inspector: selecting any element — not only text — opens a panel of
  the CSS that shapes it. Layout (size, min/max, display, position, overflow,
  z-index), spacing (margin, padding, gap as four- and two-box shorthands), flex
  and grid properties, appearance (background, background image, border, radius,
  shadow, opacity, blur and backdrop blur, blend mode), and effects (transform,
  rotate, scale, translate, transitions and animations). Every control maps to a
  real CSS longhand, so a change is one inline style that reverts like any other.
- The inspector is built from one table of properties rather than hand-written
  inputs, and the panel shows one section at a time: unrevealed controls have no
  footprint, so a 78-property inspector stays small. (#47)
- The orb is replaced by a custom editing cursor while the mode is on, so the
  pointer carries the affordance and the orb has no footprint until it is needed.
  The selection and hover frames stand 3px off the element and round to the
  nearest radius in the `DESIGN.md` ramp that the element's own corner radius and
  short side allow, and the panel enters on a short scale-and-fade. The panel can
  be picked up by its header and dropped anywhere; a hand-placed panel stays
  where it is put until the next selection. (#47)

- A temporary text editing mode. The launcher button toggles it: hover outlines
  any element that has text, click selects it, and a panel next to the selection
  edits its text and its typography — font family, size, weight, line height,
  letter spacing, alignment, case, decoration and colour. The font list leads
  with the site's own face and offers the stacks a machine already has; no
  webfont is ever loaded. Changes are applied inline to the live element and
  listed as proposals, each reversible, and leaving the mode reverts all of
  them. Nothing is written to the codebase and nothing is persisted. (#47)

### Changed

- The launcher and the editor panel now wear the `DESIGN.md` design system: Plus
  Jakarta Sans for every label, field and the orb; Primary `#3a283c` orb,
  On-primary `#f9f2ee` label, Secondary `#86546b` hover, hairline `#3a283c1a`
  borders, and a blurred translucent-paper floating layer at the 16px layer
  radius. The ink + mint colours and the bare `system-ui` stack the payload used
  before are gone. (#48)
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
