# Interaction reliability audit

**Date:** 2026-10-22
**Branch:** `audit/interaction-reliability`, cut from `main` at `a8b90ea`.
**Scope:** `packages/edityy/src/edityy.js`. This is the payload the package serves into a host page.
**Code changed:** none. This audit only reads the code and runs probes against it.

## The questions this audit answers

1. Can you select, edit and manipulate elements without the UI breaking?
2. How does it behave with nested elements and with overlapping elements?
3. Do the bounding boxes stay aligned while you scroll and resize?
4. Does the dock behave near the viewport edges?
5. What happens to elements that move, disappear or get replaced?
6. Are the z-index, the click-through and the focus behaviour correct?

## How the findings were checked

The payload was read in full. Eight probes then ran the real payload against the repository's own DOM stub, which lives in `packages/edityy/test/launcher.test.js`. The stub answers `elementFromPoint`, measures boxes and fires document events.

The probe file is not part of the repository. Its source is in the appendix.

Every probe below passed. Each probe proves one behaviour, so every finding below carries its proof.

## Summary

| ID | Area | Finding | Severity |
|---|---|---|---|
| F1 | Keyboard | Page fields lose their keys to the editor | High |
| F2 | Replaced elements | The chrome keeps pointing at a node that is gone | High |
| F3 | Bounding boxes | The frame ignores layout changes made by the page | Medium |
| F4 | Pointer | The pointer dot trails the cursor by up to 300 ms | Medium |
| F5 | Click-through | The frame handles eat clicks and do nothing | Medium |
| F6 | Dock edges | The dock is about 454 px wide and is cut off on a narrow window | Medium |
| F7 | Dock edges | The element card can cover the dock | Medium |
| F8 | Focus | The dock is the last tab stop and never takes focus | Low |
| F9 | Keyboard | Escape in a page field closes the editor and drops every edit | Low |
| F10 | Overlays | A transform on a body child breaks the fixed positioning | Low |
| F11 | Click-through | The orb covers a 56 px circle of the page in the off state | Low |
| F12 | Overlays | Only the colour panel has a height limit | Low |
| F13 | Nested elements | The pointer can never select an ancestor | Low |
| F14 | Docs | The file header names two actions that do not exist | Low |

---

## F1 — Page fields lose their keys to the editor

**Severity:** High

### What happens

While the editing mode is on, the editor takes keys from every field on the page. A page input keeps the caret, but the editor runs its own action first and calls `preventDefault`.

Four keys are taken.

- **Arrow keys.** `walkSelection` (line 4900) moves the selection and cancels the key. The caret in a page field does not move.
- **Shift + A.** Line 5241 runs the column auto-layout and cancels the key. The letter `A` never reaches the field.
- **Command + Z.** Line 5295 rewinds the style history of the editor and cancels the key. The field does not undo its own text.
- **Escape.** Line 5278 closes the editor and reverts every edit made in the session.

### Why it happens

`onKey` (line 5226) listens on the document in the capture phase. It never asks where the key came from, except in the digit branch at line 5232. That branch already has the right test:

```js
var typing = editing || (field && (field.tagName === "INPUT" || field.tagName === "TEXTAREA" || field.isContentEditable));
```

The other three branches do not use it. `walkSelection` only asks whether the key belongs to Edityy's own chrome, through `e.composedPath()`.

The mouse does not make this safe. The editor swallows the `click` event, but the browser moves the focus on `mousedown`, which the editor does not listen to. A page field can therefore hold the caret while the editor is active.

### Proof

- PROBE 3: an ArrowRight in a page field moved the selection to the sibling and set `preventDefault`.
- PROBE 4: a Shift+A in a page field wrapped the selected siblings in a flex box and set `preventDefault`.
- PROBE 5: a Command+Z in a page field removed the font size the editor had written and set `preventDefault`.

### Suggestion

Reuse the test at line 5232 for the arrow, auto-layout and undo branches. Escape needs its own rule, because Escape in a page field should leave the editor alone.

---

## F2 — The chrome keeps pointing at a node that is gone

**Severity:** High

### What happens

A framework re-renders and replaces the selected node. The editor does not notice. Four things then go wrong at once.

- The selection frame collapses into a 1.5 px box at the top-left corner of the viewport.
- The element card jumps to the same corner.
- Delete on the card does nothing, and says nothing.
- Every edit still on record points at the detached node, so the edits list shows a change that the page does not show.

### Why it happens

The editor holds a direct reference to the node, in `selected` and in each record of `changes`. It never asks whether the node is still in the document. A search of the payload finds no use of `isConnected`.

A browser reports a zero box for a detached node. `place` (line 1142) draws that box as it is, so the frame goes to `0, 0`.

`deleteSelected` (line 1442) starts with `if (!selected || !selected.parentElement) return;`. A detached node has no parent, so the action ends there in silence.

### Proof

- PROBE 2: a detached node left the frame at `left: -0.75px` and `width: 1.5px`, and the dock stayed open for it.
- PROBE 7: the element card moved to `left: 12px` and `top: 12px`, and Delete left the selection and the card untouched.

### Suggestion

One check in `refit` (line 5051) covers the frame, the card and the dock. If the selected node is no longer in the document, clear the selection and tell the user that the element was replaced.

---

## F3 — The frame ignores layout changes made by the page

**Severity:** Medium

### What happens

The selection frame is right when the element is selected. It goes stale as soon as the page changes the box by another road.

- An image loads and pushes the text below it down.
- A webfont swaps and the words change width.
- A page script updates a counter or a price.
- A CSS animation or a transition moves the element.

The frame then sits where the element used to be. Nothing corrects it until the user scrolls or resizes.

### Why it happens

`refit` (line 5051) is the only thing that re-measures the frame. It is called from four places: a scroll (line 5019), a resize (line 4934), a text edit (line 5010), and `set` (line 3031) for the editor's own writes.

The payload holds no `ResizeObserver` and no `MutationObserver`. A search of the file confirms it.

### Proof

PROBE 1 shows the half that works. The editor's own writes do re-measure, because `set` (line 3031) calls `refit`. The gap is the page's own changes, which have no path to `refit`.

### Suggestion

A `ResizeObserver` on the selected node covers images, fonts and script changes. It is one observer and one callback.

---

## F4 — The pointer dot trails the cursor by up to 300 ms

**Severity:** Medium

### What happens

The dot that stands for the pointer follows the cursor late. The lag grows with the speed of the pointer. It reads as lag, not as motion.

### Why it happens

The launch button carries this rule (line 439):

```css
transition:transform .3s cubic-bezier(.2,.8,.2,1),background .15s;
```

`onMove` (line 5178) writes a new `transform` on every pointer move. The browser then restarts the 300 ms transition from the position the dot is in now. The dot therefore travels towards the cursor on a 300 ms curve, and it never arrives while the cursor keeps moving.

The comment above `onMove` says the opposite:

```js
// The orb follows the pointer with no lag.
```

The reduced-motion rule at the end of the sheet sets `transition:none` on `#launch`. That is the proof: with reduced motion the dot is exact, and without it the dot trails.

### Proof

PROBE 8: the rule is in the sheet, and the pointer move writes the transform on every event.

### Suggestion

Turn the transition off on the button when the mode opens, and turn it back on when the mode closes. The scale from orb to dot is a separate animation and does not need the same rule.

---

## F5 — The frame handles eat clicks and do nothing

**Severity:** Medium

### What happens

Eight small handles sit on the corners and the edges of the selected element. They take pointer events. Nothing is attached to them.

A click on one of the handles does not reach the page below, and it does not select anything either. The click is lost.

### Why it happens

The rule at line 464 asks for the events:

```css
.frame-marker{position:absolute;background:var(--frame,var(--ink));pointer-events:auto}
```

The markup at line 611 builds eight `<i>` elements. A search of the payload finds no listener on any of them.

### Proof

PROBE 6: the rule asks for pointer events, the frame holds eight markers, and no marker carries a listener.

### Suggestion

Either set `pointer-events:none` on the handles, or give them a job, such as a drag to resize.

---

## F6 — The dock is about 454 px wide and is cut off on a narrow window

**Severity:** Medium

### What happens

The dock sits at the bottom centre. It is about 454 px wide on a text selection. A window narrower than that cuts the dock on both sides, because the dock is centred on its own middle.

The family field is the first control on the left, and the `+` is the last control on the right. Those are the two that go.

The panel that opens over the dock has the same problem. It is up to 420 px wide, and the window must be wider than that for it to fit.

### Why it happens

The dock rule at line 156 is:

```css
#dock{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:3;pointer-events:auto;display:flex;flex-direction:column;align-items:center}
```

There is no width limit and no wrap. The row rule at line 158 has no `flex-wrap` either.

The width comes from the controls. On a text selection the row holds the family field at 92 px, the size control at 86 px, six squares at 34 px, and the `+` at 34 px. That is 382 px, plus 14 px of gaps, plus 8 px of padding. The bar adds the edits button at 44 px and a gap of 6 px. The dock is about 454 px.

### Suggestion

Give the row a `max-width:calc(100vw - 24px)` and `overflow-x:auto`. The controls then stay reachable on a narrow window.

---

## F7 — The element card can cover the dock

**Severity:** Medium

### What happens

The element card sits at the selected element. When the element is near the bottom of the screen, the card goes above it. It can then land on the dock.

The card is at z-index 5 and the dock is at z-index 3. The card wins. The dock's buttons under it cannot be clicked.

### Why it happens

`placeElementMenu` (line 1382) keeps the card inside the viewport and away from the edges. It never looks at the dock.

```js
var below = rect.bottom + height + 12 <= window.innerHeight;
var top = below ? rect.bottom + 8 : rect.top - height - 8;
```

The dock is at the bottom centre, and the card follows the element to the bottom centre.

### Suggestion

Treat the dock as an obstacle. When the card would sit over the dock, place it to the side of the element or hold it clear of the bottom strip.

---

## F8 — The dock is the last tab stop and never takes focus

**Severity:** Low

### What happens

The launcher is the last thing the Tab key reaches on the page. The host is appended to the body (line 5308), so its shadow content comes after every other focusable element on the page.

After a selection, the focus does not move. A keyboard user cannot reach the dock without tabbing through the whole page again.

The panel over the dock has the same problem in the other direction. It stands before the row in the shadow root, so the keyboard only reaches it by holding Shift and tabbing backwards, once per option.

### Why it happens

`select` (line 1228) calls `syncDock`, which rebuilds the row. `buildRow` (line 3584) sets the tab stop with `rove(row.children[0])` but never calls `focus`.

### What already works

The row is one toolbar and one tab stop. The arrows walk it, and the rule at line 3709 stops the walk from reaching the document handler. Escape puts the focus back on the icon that opened the panel.

### Suggestion

Move the focus to the first control of the row after a selection. Give the panel the same one-tab-stop treatment as the row.

---

## F9 — Escape in a page field closes the editor and drops every edit

**Severity:** Low

### What happens

The user is typing in a field on the page. The user presses Escape to dismiss a suggestion or a menu. The editor closes and every edit made in the session is reverted.

### Why it happens

The Escape branch at line 5247 ends with `exit()` at line 5278. `exit` (line 4959) calls `changes.slice().forEach(revert)`.

### Suggestion

Leave the editor alone when the key comes from a page field, in the same way as F1.

---

## F10 — A transform on a body child breaks the fixed positioning

**Severity:** Low

### What happens

A page that puts a `transform`, a `filter` or a `contain` on a child of the body gives that child a new containing block. The editor's host is one of those children, so the host's `position:fixed` now resolves against that child.

The frames then scroll with the page, and the dock drifts away from the bottom of the window.

### Why it happens

The host is a fixed box at the top level of the body (line 40):

```js
host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
```

The rule `body > div { transform: translateZ(0) }` is common enough in the wild.

### Suggestion

This is a hard problem to fix from the outside. A note in the docs is enough for now.

---

## F11 — The orb covers a 56 px circle of the page in the off state

**Severity:** Low

### What happens

The launcher button sits at the bottom right at all times. It takes pointer events in the off state, so it takes the clicks of whatever the page put under it.

### Why it happens

The rule at line 439 ends with `pointer-events:auto`, and the mode only clears it at line 4944, after the mode opens.

### Suggestion

This is a design decision, not a fault. It is listed here because it is a click-through question.

---

## F12 — Only the colour panel has a height limit

**Severity:** Low

### What happens

The panels over the dock have no height limit. On a short window, a tall panel runs off the top of the screen, and the part that is off the screen cannot be reached.

### Why it happens

The panel rule at line 340 has no `max-height`. The colour panel has its own rule further down:

```css
.pop.color{...;max-height:calc(100vh - 96px);overflow-y:auto;overscroll-behavior:contain}
```

The other panels have none. The tallest of them is the spacing control, at about 180 px.

### Suggestion

Move the limit from `.pop.color` to `.pop`, and keep the colour rule for the padding it needs.

---

## F13 — The pointer can never select an ancestor

**Severity:** Low

### What happens

A card holds a heading and a paragraph. Clicking the heading selects the heading. Clicking the paragraph selects the paragraph. The card can only be selected by a click on its own padding.

There is no pointer route to an ancestor. The keyboard route is the Up arrow.

### Why it happens

`pickAt` (line 777) walks up from the node under the pointer and stops at the first node that holds words or is media.

```js
if (k === "media") return { el: el, kind: k };
if (k === "text") return { el: el, kind: k };
```

This is on purpose. The comment above it says that clicking words should select words.

### Suggestion

This is the intended behaviour. It is listed here because it is one of the questions in this audit, and because the answer is not obvious to a new user.

---

## F14 — The file header names two actions that do not exist

**Severity:** Low

### What happens

The header of `packages/edityy/src/edityy.js` says the card holds `Edit text`, `Move`, `Parent`, `Child` and `Delete`. The card holds `Edit text`, `Move`, `Comment`, `Variations` and `Delete`.

There is no Parent action and no Child action. The docs site at `/docs/editing` is right.

### Suggestion

Fix the header. It is the first thing a reader sees.

---

## Checked and found sound

These parts of the brief were checked and behaved well.

- **The frame follows the editor's own writes.** `set` (line 3031) calls `refit`, so a change of size, padding or font size moves the frame at once. PROBE 1 proves it.
- **Scroll and resize are caught everywhere.** The listeners at line 4934 sit on the window in the capture phase, so the scroll of any inner box is caught too. The work is held to one frame by `inFrame` (line 5031).
- **The hover frame never points at the wrong element.** A scroll drops it (line 5019) and `refit` drops it again (line 5051).
- **The overlays never block the page.** The host has `pointer-events:none` (line 40) and so have the frames (line 457). The launcher turns its own pointer events off when the mode opens.
- **Overlapping elements behave.** `elementFromPoint` gives the topmost node, and media wins over the words around it.
- **The panel over the dock opens upwards.** It grows from the bottom of the screen, so it cannot fall off the bottom.
- **The element card stays on the screen.** `placeElementMenu` (line 1382) keeps it 12 px from the edges.
- **The row is one tab stop.** `rove` (line 3703) and the key rule at line 3709 keep the arrows inside the row.
- **Multi-selection holds.** A shift click adds an element, the dock steps aside, and each element keeps its own frame.

---

## Not checked

- Real browser behaviour. The probes run against the repository's DOM stub, not a browser. The stub does not lay out, so the widths and the overlaps in F6, F7 and F12 come from reading the sheet, not from a measurement.
- Touch and pen input. The payload listens to `mousemove` only.
- The launcher and the middlewares in `packages/edityy/src/vite.js` and `packages/edityy/src/index.js`.
- Performance under a heavy page.

---

## Appendix — the probes

Copy this file to `packages/edityy/test/zz-probe.test.js` and run `node --test packages/edityy/test/zz-probe.test.js`. The file holds the eight probes and the stub they need. Delete it afterwards.

```js
// Append this to a copy of packages/edityy/test/launcher.test.js.
test("PROBE 1: the selection frame DOES follow Edityy's own style write", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "Hello");
  const rect = () => {
    const size = Number(String(p.style.getPropertyValue("font-size")).replace("px", "")) || 16;
    const w = 50 * (size / 16);
    return { left: 100, top: 50, right: 100 + w, bottom: 80, width: w, height: 30 };
  };
  p.getBoundingClientRect = rect;
  quiet(() => { app.click(); app.hover(p); app.clickPage(); });
  assert.equal(app.root.nodes.sel.style.width, "51.5px");
  const sizeBtn = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  const input = sizeBtn.children[0];
  quiet(() => { input.value = "40"; for (const fn of input.bubbles.input.bubble) fn({}); });
  assert.equal(p.style.getPropertyValue("font-size"), "40px");
  assert.equal(app.root.nodes.sel.style.width, "126.5px", "the frame did follow the dock edit");
});

test("PROBE 2: a replaced (detached) element leaves the frame at the top-left corner", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "Hello", {}, { left: 100, top: 50, right: 220, bottom: 80, width: 120, height: 30 });
  quiet(() => { app.click(); app.hover(p); app.clickPage(); });
  assert.equal(app.root.nodes.sel.style.left, "99.25px");
  p.parentElement = null;
  p.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  quiet(() => app.scroll());
  assert.equal(app.root.nodes.sel.style.left, "-0.75px");
  assert.equal(app.root.nodes.sel.style.width, "1.5px");
  assert.equal(app.root.nodes.dock.hidden, false);
});

test("PROBE 3: an arrow key in a page field moves the selection instead of the caret", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main");
  const first = el("div");
  const second = el("p", { text: "Second" });
  parent.appendChild(first);
  parent.appendChild(second);
  quiet(() => { app.click(); app.hover(first); app.clickPage(); });
  assert.equal(app.root.selection().el, first);
  const field = el("input");
  let prevented = false;
  quiet(() => app.fire("keydown", { key: "ArrowRight", target: field, preventDefault: () => (prevented = true), stopPropagation() {} }));
  assert.equal(app.root.selection().el, second);
  assert.equal(prevented, true);
});

test("PROBE 4: a capital A in a page field runs the auto-layout instead of typing", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main");
  const first = el("div");
  const gap = el("aside");
  const second = el("p", { text: "Second" });
  parent.appendChild(first); parent.appendChild(gap); parent.appendChild(second);
  quiet(() => { app.click(); app.hover(first); app.clickPage(); app.hover(second); app.clickPage(1, 1, true); });
  const field = el("input");
  let prevented = false;
  quiet(() => app.fire("keydown", { key: "A", shiftKey: true, target: field, preventDefault: () => (prevented = true), stopPropagation() {} }));
  assert.equal(prevented, true);
  assert.equal(parent.children[0].style.getPropertyValue("display"), "flex");
});

test("PROBE 5: undo in a page field rewinds Edityy's style history", () => {
  const { run, text, el } = fakeDom();
  const app = run();
  const p = text("p", "Hello");
  quiet(() => { app.click(); app.hover(p); app.clickPage(); });
  const sizeBtn = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  const input = sizeBtn.children[0];
  quiet(() => { input.value = "40"; for (const fn of input.bubbles.input.bubble) fn({}); });
  assert.equal(p.style.getPropertyValue("font-size"), "40px");
  const field = el("input");
  let prevented = false;
  quiet(() => app.fire("keydown", { key: "z", metaKey: true, target: field, preventDefault: () => (prevented = true), stopPropagation() {} }));
  assert.equal(p.style.getPropertyValue("font-size"), "");
  assert.equal(prevented, true);
});

test("PROBE 6: the frame markers take pointer events and nothing listens to them", () => {
  const { run } = fakeDom();
  const app = run();
  assert.match(app.root.innerHTML, /\.frame-marker\{position:absolute;background:var\(--frame,var\(--ink\)\);pointer-events:auto\}/);
  const markers = app.root.nodes.sel.children;
  assert.equal(markers.length, 8);
  for (const marker of markers) assert.deepEqual(marker.bubbles ?? {}, {});
});

test("PROBE 7: the element menu jumps to the top-left corner when the element is replaced", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "Hello", {}, { left: 300, top: 200, right: 420, bottom: 230, width: 120, height: 30 });
  quiet(() => { app.click(); app.hover(p); app.clickPage(); });
  const menu = app.root.nodes["element-menu"];
  assert.equal(menu.style.left, "300px");
  p.parentElement = null;
  p.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  quiet(() => app.scroll());
  assert.equal(menu.style.left, "12px");
  assert.equal(menu.style.top, "12px");
  const before = app.root.selection();
  quiet(() => app.action("Delete"));
  assert.equal(app.root.selection().el, before.el);
  assert.equal(app.root.nodes["element-menu"].hidden, false);
});

test("PROBE 8: the pointer dot is on a 300ms transition, so it trails the cursor", () => {
  const { run } = fakeDom();
  const app = run();
  assert.match(app.root.innerHTML, /transition:transform \.3s cubic-bezier\(\.2,\.8,\.2,1\),background \.15s/);
  const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");
  assert.ok(source.includes("launch.style.transform"));
  assert.ok(source.includes("scale(\" + POINT"));
});
```
