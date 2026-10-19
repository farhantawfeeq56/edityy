# Changelog

All notable changes to the `edityy` package. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Changed

- The editor chrome uses the interaction rules of interior.dev. The dock
  tooltips are one group: the first tooltip opens after 200ms, and the next one
  opens at once and moves to its control. One hover fill moves along the dock
  row. A panel grows from its control and fades out when it closes. The copy and
  save buttons change their words in place, and the edits count pops when it
  changes. The dock and the element menu move in when they appear. Reduced
  motion stops all of this motion. (#181)
- A grid wears its columns and rows in the dock row as `columns × rows`, with
  `auto` where the grid names no tracks of that axis. The count is read from the
  resolved track list, so a grid written with `repeat()` or with its tracks
  written out shows the count it has. An absolute element wears its top, right,
  bottom and left offsets in the row, one field for each side. (#187)
- The alignment control is a 3 x 3 grid of empty cells. The cell is the
  control, and the cell that is picked is filled. (#188)
- A shadow on words is written as `text-shadow`, so the letters carry it and the
  block does not. Its four lengths are number fields in a 2 x 2 grid, with a
  glyph where "Blur" and "Spread" stood, and the colour under them. A text
  shadow offers no spread, because CSS has none for it. (#189)
- The padding and margin panel has one field for the left and right pair, and
  one field for the top and bottom pair: a box is even both ways far more often
  than not. Each pair shows two arrows, and its one value is written to both
  sides. A link button beside the pair breaks it into a field per side, each
  with one arrow. A pair that the stylesheet already sets apart opens broken. The
  Grid gap sliders wear glyphs in place of "Column gap" and "Row gap". (#191)
- Every slider in the dock is a number field: the weight of a variable face, the
  gap, the column and row gap, and a border's width. A number is typed, not
  dragged. The padding and margin panel keeps its two pair fields, and no slider
  stands above them. (#192)
- The typography spacing panel wears a glyph where a word stood: sideways arrows
  for the letters, up and down arrows for the lines. The word stays on the field,
  where a screen reader reads it, like the shadow's blur and spread. (#192)
- A list row that shows its own words keeps no title. Hovering "Shadow" in the
  `+` list showed "Shadow" a second time, in a browser tooltip. The row keeps its
  accessible name. (#192)
- Every field is one chip and answers the pointer the same way: a hairline and
  paper at rest, a touch of ink under the pointer, and the open fill with a
  darker hairline while it holds the caret. A number in a panel is as wide as
  its own digits, so it no longer spans the panel; the dock's own fields keep
  the width they are drawn at. (#192)
- Every value in a panel sits in one chip with the glyph that names it: the two
  typography spacings, the gap, the border width, the shadow lengths, the colour
  value, the weight and the padding and margin sides. A chip presses like the
  size chip in the dock: down in .08s, back in .2s, and it takes the open fill
  while it holds the caret. A number is as wide as its digits and the room to
  type one more, so no field is wider than its value. A dock count field no
  longer takes the padding of a panel field, so it is the width it says it is.
  The search and the comment box keep the width their words need. (#193)
- The dock's size and count chips are a box before the pointer arrives: the
  same hairline a panel field wears, and the open fill while it holds the caret.
  The cobalt ring is not on a field: a text field answers that ring to a pointer
  too, so a click drew a blue edge around a field that had done nothing. The
  cobalt ring stays on the buttons and the lists, where only the keyboard draws
  it. (#193)

### Fixed

- The `+` list wears the chrome face. It drew its words in the machine UI face,
  because each row carried a font stack of its own. (#194)
- A pointer over an option of the size list no longer moves the row's hover fill
  to the left end of the row, where the font family chip stands. An option is
  part of the list that came out of its chip, not a control of the row. (#194)
- The foot of the family list says "Search for more fonts", with no count in
  front of it, in an 11px line where it stood at 16px. (#194)
- A number field printed its value twice: once in the field and once beside it,
  where a unit stood. The field says the number, and no unit stands beside it.
  (#190)

### Removed

- A grid no longer offers the Alignment control. The Grid size control, and the
  width and height control of an absolute element, are gone: their values are
  fields in the dock row. (#187)
- Edit text no longer plays the Canvas UI ASCII sweep. The caret goes in at
  once, and the launcher no longer fetches a second file. A cyclic dock control
  changes the element with no animation. (#179)

## 0.3.1 — 2026-10-17

### Added

- The flex direction and flex wrap controls cycle on one click. Each button shows
  the value the element has, and no list opens. (#152)
- Edit text plays the Canvas UI ASCII sweep over the element before the caret goes
  in. The effect is its own file, served beside the launcher and fetched the first
  time a user asks to edit text. Only the band is drawn over the page, so the
  words keep their own rendering everywhere the band is not. A page without it, or
  a browser without WebGL2, edits text as it did before. (#162)
- The element actions carry a Comment action. It opens a field for a note about
  the element, and the note travels with the edits: it is in
  `.edityy/changes.json`, in the Markdown the agent reads, and in the MCP tool
  result. A change without a note keeps `comment: null`. (#174)

### Changed

- Every colour is picked in HeroUI's picker: the text colour, a fill, a border
  and a shadow. It is a saturation and brightness field with a dot to drag, the
  hue slider with the browser's own picker beside it, and one line holding the
  hex code and the transparency as a percentage. A colour with any transparency
  is written as `rgba(r, g, b, a)`, and a solid one stays `#rrggbb`. The native
  swatch the fill, border and shadow controls used is gone. Where the picker is
  the whole control it wears HeroUI's white overlay; every other control keeps
  the dock's cream. (#171)
- Font size and font weight are one value each: the field beside the arrow holds it,
  the arrow opens the common values, and a pick writes the field instead of a
  second readout. The list of sizes opens upwards, over the dock, where the button
  is in view. (#170)
- The font family button in the dock draws its name in the family it names, and
  the name is set at the size the dock uses. (#170)
- An open dock control takes the screen from the element actions: the card at the
  element closes while a control or a list inside one is open, and comes back when
  it closes. Moving to another element closes the control that belonged to the
  last one. (#166)
- Edit text opens on an element whose words are split by a child element — a
  paragraph around a link — and the caret starts at the end of the words. Leaving
  the mode puts the markup back, child element included. (#165)
- The style dock is fixed at the bottom centre again, whatever the selected
  element does. An open control comes out over the dock. The element actions
  keep their own card at the element. (#151)

### Removed

- The Add element button and its Text and Container choices are gone. A click on
  the page selects an element; it never inserts one. Shift+A still wraps selected
  elements in a new container. (#153)

### Fixed

- A Next.js app that builds with webpack can import `edityy` on the server.
  Before, the save route threw on load, saving failed with a 500 and `next build`
  stopped. This is the default on Next.js 15, and `--webpack` on 16. (#155)

## 0.3.0 — 2026-10-13

### Added

- The selection frame carries four corner handles and four edge handles. An edge
  handle is at most 24px or 40% of its edge, whichever is smaller, and a handle
  on a short edge is hidden. (#147)

### Changed

- The bounding box is a 1.5px line that straddles the element's own edge, in the
  negative of the colour it lies on. (#147)
- Every icon is a Phosphor regular glyph, so the dock, the element actions and
  the insert marker draw one family. (#148)

## 0.2.0 — 2026-10-11

### Changed

- Selecting an element opens one surface at the element. The element actions
  come first, and the style controls sit below them. An open control comes out
  below the controls. (#145)
- The surface follows the element. The controls sit under the actions, or
  beside them when the page leaves no room there. An open control comes out
  above the actions when there is no room below the controls. (#145)

### Removed

- The interaction variant switcher, its number keys and the saved variant are
  gone. The merged surface is the design. (#143, #145)

## 0.1.7 — 2026-10-09

### Added

- Shift-click selects multiple elements. Shift+A wraps selected siblings in a
  column flex container. The element action menu offers Edit text, Move, Parent,
  Child and Delete. (#130)

## 0.1.6 — 2026-10-08

### Added

- Edityy opens with Text and Container options. Choose a page location to insert
  the element, then edit it. New containers use Flex layout. (#127)

### Changed

- Remove Stack from the container layout mode control. Existing default-layout
  containers keep their layout until the user selects Flex, Grid or Absolute. (#127)

### Fixed

- The README's Next.js setup loads the launcher from an `instrumentation-client`
  file, which Next.js 15.3 and later run. Before, it used only
  `instrumentationClientInject`, which Next.js 16.2 and earlier ignore, so no
  launcher came up. The option stays as the alternative for Next.js 16.3 and
  later. (#126, @AathilFelix)

## 0.1.5 — 2026-10-08

### Added

- The font family control has a search field and the Google Fonts catalog,
  after the page's own fonts. The catalog is fetched on the first open, and a
  font file only when its row is drawn or picked. Each request is made once.
  No API key is necessary. (#105, @AathilFelix)
- The text dock has the controls in groups, with a separator between the
  groups. The Font size control is a pixel field in the dock, with a list of
  common sizes. The Font weight control lists only the weights that the font
  has. The Text colour control has an RGB and hex palette. The add control is
  a three-dot button. (#118, @farhantawfeeq56)

### Changed

- The font list measures each family name once, not once for each face that
  `document.fonts` holds. (#105, @AathilFelix)
- The launcher writes the edits to `sessionStorage` once the keys stop, not on
  each key, and when the page is left. It finds and measures the element under
  the pointer, and the selection after a scroll, once for each animation frame. (#109, @AathilFelix)
- The container dock has one Size control for width and height, one Grid
  control for columns and rows, and one Gap control for the row and column
  gaps. The CSS properties that they set do not change. (#122, @farhantawfeeq56)

### Security

- The save endpoint takes requests only for `localhost`, its subdomains, IP
  addresses and the hosts in the new `allowedHosts` option. Before, a site that
  pointed its own name at the computer could write the saved edits. (#107, @AathilFelix)
- `changesRoute()` answers 404 unless `NODE_ENV` is `development`, so a
  production build of a Next.js app writes nothing. (#107, @AathilFelix)
- Each saved change is checked for its shape and size. The `markdown` in
  `changes.json` and in `get_visual_changes` is made from the checked changes;
  the page cannot put its own text there. (#107, @AathilFelix)

### Fixed

- The middleware keeps the status message and the headers that a handler gives
  to `writeHead()` on an HTML page. Before, they were lost when the tag was
  added. A status set with `res.statusCode`, and a held `304`, also stay. (#106, @AathilFelix)
- An HTML page that calls `write()` before `end()` without a `content-length`
  streams after `</head>`. Before, it was held until `end()`. (#106, @AathilFelix)
- The Vite plugin saves edits under Vite's `root`, where the source locations
  start. Before, it saved under `process.cwd()`. (#108, @AathilFelix)
- `changes.json` is written to a temporary file and then renamed, so the MCP
  server never reads half of a file. (#108, @AathilFelix)
- A body past the size limit gets its 413 answer. Before, the socket closed
  first. (#108, @AathilFelix)
- The MCP server keeps answering after a message fails. On `initialize`, it
  answers with a protocol version it speaks. (#108, @AathilFelix)
- The Italic control sets `font-style`. Before, it wrote
  `text-decoration-line: italic`, which the browser ignores. The control also
  shows the decorations that are on when it opens. (#120, @AathilFelix)

## 0.1.4 — 2026-10-07

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
- An edit that resized the element under the pointer left the hover frame at
  the old size, so one element had two frames. The hover frame is dropped on
  every re-measure and comes back on the next pointer move. (#75)

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
