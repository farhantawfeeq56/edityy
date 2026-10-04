/*
 * Edityy — the payload this package serves.
 *
 * Runs inside the page it is injected into. Two layers:
 *
 * 1. A launcher button, fixed bottom-right in an open shadow root, so the host
 *    page's CSS cannot reach it and it cannot leak styles back out. Clicking it
 *    dispatches `edityy:launcher-click` on window — the seam a host app can
 *    listen to — and toggles the editing mode below.
 *
 * 2. A temporary editing mode: the orb steps aside for a cursor, hovering any
 *    element outlines it, and clicking selects it. That is the whole interface
 *    for now — selection with no panel attached. `kind()` classifies what was
 *    picked as text, container or media before anything else happens, and
 *    `root.selection()` reports it.
 *
 * The machinery for changing an element is still here and still correct —
 * apply() writes an inline style, remembers what was there, and revert() puts
 * it back — but no UI calls it yet. Nothing is written anywhere: the codebase is
 * the source of truth, and this file only ever changes the page in memory, until
 * a reload.
 *
 * Browser IIFE on purpose: this file is served to the page as-is, so it cannot
 * be a module.
 */
(function () {
  "use strict";

  // The change backend — apply, setText, isLeafText, label, selectedKind — is
  // deliberately parked, not dead: there is no panel to call it right now, and
  // deleting it would throw away working code that the next UI needs as-is.
  /* eslint-disable @typescript-eslint/no-unused-vars */

  if (window.__edityy) return; // a shared layout can render the tag more than once
  window.__edityy = true;

  var host = document.createElement("div");
  host.setAttribute("data-edityy", "");
  // A full-viewport host that ignores pointer events: the cursor and the frames
  // can grow over the site without ever coming between the user and the page.
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";

  var root = host.attachShadow({ mode: "open" });

  // DESIGN.md is the source of truth for every value below: Primary #3a283c,
  // On-primary #f9f2ee, Secondary #86546b, Muted #86546b, hairline #3a283c1a,
  // Blush #ecc5c9 for destructive actions. The ramp is closed — five values,
  // nothing pure black or pure white.
  root.innerHTML = [
    "<style>",
    ":host{all:initial}",
    // `all:initial` severs inheritance, so the payload names the site's own font
    // itself. --font-sans is the app's stack (Plus Jakarta Sans first); the bare
    // family name covers a host that has the font without the token.
    "*{box-sizing:border-box;font-family:var(--font-sans,\"Plus Jakarta Sans\",ui-sans-serif,system-ui,sans-serif);color:#3a283c}",
    "[hidden]{display:none}", // a shadow root has no UA stylesheet, so `hidden` is ours to honour
    // Or `#launch` while the mode is off. Hidden once it is on: a custom cursor
  // takes over, and DESIGN.md wants controls to have no footprint until needed.
  "#launch{position:fixed;right:24px;bottom:24px;width:56px;height:56px;",
    "border-radius:50%;border:0;margin:0;padding:0;cursor:pointer;pointer-events:auto;z-index:3;",
    "display:grid;place-items:center;font:600 14px/1.1 inherit;color:#f9f2ee;",
    "background:#3a283c;box-shadow:0 1px 1px #3a283c14,0 6px 12px #3a283c1f}",
    "#launch:hover{background:#86546b}",
    "#launch:focus-visible{outline:2px solid #3a283c;outline-offset:3px}",
    // The editing cursor. Kept inside the ramp, and it rides above the page in
    // the fixed, top-layer host so the page cannot hide it.
    "#cursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;",
    "border-radius:50%;background:#3a283c1f;border:1px solid #3a283c;pointer-events:none;z-index:4;",
    "transition:transform .12s ease-out}",
    ".box{position:fixed;pointer-events:none;display:none;z-index:1}",
    // Inflated by 3px and rounded per DESIGN.md: an approximate, clearly separate
    // frame around the element, not a traced outline.
    "#hover{border:1px dashed #3a283c59;background:#d79eac2e}",
    "#sel{border:2px solid #3a283c;background:transparent}",
    "@media (prefers-reduced-motion:reduce){#cursor{transition:none}}",
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy">Edityy</button>',
    '<div id="cursor" hidden></div>',
    '<div class="box" id="hover"></div>',
    '<div class="box" id="sel"></div>',
    "</div>",
  ].join("");

  var $ = function (id) {
    return root.getElementById(id);
  };
  var launch = $("launch");
  var cursor = $("cursor");
  var hoverBox = $("hover");
  var selBox = $("sel");

  // The font stacks a machine already has. No webfonts: the editor must not
  // change what the page loads, only what it looks like. The first entry is the
  // site's own face, taken from the app's own token wherever it sets one.
  var active = false;
  var selected = null;
  // The kind of the current selection. Nothing reads it yet — there is no panel —
  // but root.selection() reports it and it is the first thing any UI will want.
  var selectedKind = null; // "text" | "container" | "media"
  var changes = []; // { el, props: {longhand: value-before}, text: value-before, textEdited: bool }

  /* ------------------------------------------------------------ selection */

  /** Does this element hold text of its own, rather than only child elements? */
  function hasOwnText(el) {
    var nodes = el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && nodes[i].nodeValue.trim()) return true;
    }
    return false;
  }

  /** Text we can rewrite as a single string: no child elements to destroy. */
  function isLeafText(el) {
    var nodes = el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 1) return false;
    }
    return hasOwnText(el);
  }

  /**
 * What kind of thing is this element? Three buckets, nothing else.
 *
 * Decided before anything is selected, because the three need different handling
 * and guessing later is how a media element ends up with a text cursor in it.
 *
 *   media     — it *is* the media: img, svg, video, canvas, and the host it loads
 *   text      — it holds words of its own
 *   container — everything else, and it is the largest bucket on purpose
 *
 * The order is the whole rule, and it is deliberately short: media, then text,
 * then everything else falls into container. Naming the containers explicitly
 * would be a list that is wrong the moment the page uses a tag nobody thought of,
 * so nothing is named — a <div> holding no words is a container because there is
 * no text in it, not because div is on a list.
 *
 * A control with words in it — <button>Save</button>, <a>Read more</a> — is text,
 * because that is the copy the reader sees and the copy anyone means to change.
 * Its bare shell is a container. Both readings are defensible; this is the one
 * that keeps Save editable.
 */
  function kind(el) {
    if (!el) return null;
    var tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "video" || tag === "audio" || tag === "canvas" || tag === "picture") {
      return "media";
    }
    // <svg><text>Chart</text></svg>: the words are text, but they live inside a
    // drawing. Called text, because editing them is the useful thing to do and
    // the user can do it nowhere else.
    if (tag === "text") return "text";
    if (hasOwnText(el)) return "text";
    return "container";
  }

  /**
   * The element under the pointer, classified.
   *
   * Text wins the walk upward, because clicking words should select words. But a
   * media element wins over the text around it: clicking a picture must not land
   * on the caption beside it.
   */
  function pickAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el.host === host) el = el.parentElement; // never select ourselves
    var fallback = el;
    while (el && el !== document.body && el !== document.documentElement) {
      var k = kind(el);
      // Media stops the walk outright: the nearest one is what was aimed at.
      if (k === "media") return { el: el, kind: k };
      if (k === "text") return { el: el, kind: k };
      el = el.parentElement;
    }
    return fallback && fallback !== document.body && fallback !== document.documentElement
      ? { el: fallback, kind: kind(fallback) }
      : null;
  }

  function textAt(x, y) {
    var hit = pickAt(x, y);
    return hit ? hit.el : null;
  }

  /**
   * A short, human way to name an element: "h1 “Edityy”".
   *
   * Kept for the changes list a future panel will render. Nothing calls it yet.
   */
  function label(el) {
    var snippet = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return el.tagName.toLowerCase() + " " + (snippet ? "“" + snippet + "”" : "");
  }

  /* -------------------------------------------------------------- changes */

  /** The change record for an element, created on first touch. */
  function record(el) {
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].el === el) return changes[i];
    }
    var rec = { el: el, props: {}, text: null };
    changes.push(rec);
    return rec;
  }

  /**
   * The backend for a change: note what was there, then set the new value.
   *
   * Nothing calls this yet — the UI that would is gone for now — but the record
   * it keeps is what a future panel needs, and it is the whole point of the
   * layer: an inline style, remembered so it can be put back.
   */
  function apply(prop, value) {
    var rec = record(selected);
    if (!(prop in rec.props)) rec.props[prop] = selected.style.getPropertyValue(prop);
    if (value) selected.style.setProperty(prop, value);
    else selected.style.removeProperty(prop); // back to the stylesheet's value
    return rec;
  }

  function setText(el, value) {
    var rec = record(el);
    if (rec.text === null) rec.text = el.textContent;
    el.textContent = value;
    return rec;
  }

  /** Undo every property and the text of one element. */
  function revert(rec) {
    Object.keys(rec.props).forEach(function (prop) {
      var before = rec.props[prop];
      if (before) rec.el.style.setProperty(prop, before);
      else rec.el.style.removeProperty(prop);
    });
    if (rec.text !== null) rec.el.textContent = rec.text;
    changes = changes.filter(function (other) {
      return other !== rec;
    });
  }

  // A frame drawn around an element, deliberately not hugging it: 3px of air on
  // every side, so the box is unmistakably Edityy's and not the page's own edge.
  var GAP = 3;
  // The ramp's own radii (8 UI / 12 / 16 / pill), used inside out — whatever the
  // element rounds to, the frame is never sharper than the design allows.
  var RADII = [28, 16, 12, 8, 4];

  function place(el, rect, target) {
    el.style.left = rect.left - GAP + "px";
    el.style.top = rect.top - GAP + "px";
    el.style.width = rect.width + GAP * 2 + "px";
    el.style.height = rect.height + GAP * 2 + "px";
    el.style.borderRadius = pickRadius(rect, target) + "px";
  }

  /** The first ramp radius that fits inside the element's own corner radius. */
  function pickRadius(rect, target) {
    var el = target || document.documentElement;
    var own = parseFloat((window.getComputedStyle ? window.getComputedStyle(el) : { getPropertyValue: function () { return ""; } }).getPropertyValue("border-top-left-radius")) || 0;
    // Shorter side first: a radius larger than half the smaller dimension becomes
    // a lozenge, which is not what the design means.
    var fit = Math.min(rect.width, rect.height) / 2;
    for (var i = 0; i < RADII.length; i++) {
      if (RADII[i] <= Math.max(own, fit)) return RADII[i];
    }
    return RADII[RADII.length - 1];
  }

  /** Draw the selection frame. There is no panel to place, so this is all a
      selection does for now: the frame is the whole visible result. */
  function select(el, hit) {
    selected = el;
    // The kind comes from the pick, because a form control is text by way of the
    // walk rather than by way of `kind()`: it has no text node of its own.
    selectedKind = el && hit ? hit.kind : null;
    if (!el) {
      selBox.style.display = "none";
      return;
    }
    selBox.style.display = "block";
    place(selBox, el.getBoundingClientRect(), el);
  }

  // What is selected, and what it was classified as. Nothing reads this yet —
  // there is no panel — but it is the seam any UI starts from, so it stays.
  root.selection = function () {
    return selected ? { el: selected, kind: selectedKind } : null;
  };

  /* ----------------------------------------------------------------- mode */

  function enter() {
    active = true;
    // The orb steps aside for a cursor: while editing, the pointer IS the
    // control, so it carries the affordance the orb used to.
    launch.hidden = true;
    cursor.hidden = false;
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    // The selection frame is viewport-fixed like everything else, so a scroll
    // moves the element out from under it and the frame must go with it.
    window.addEventListener("scroll", hideHover, true);
    window.addEventListener("resize", onResize, true);
  }

  function exit() {
    active = false;
    launch.hidden = false;
    cursor.hidden = true;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", hideHover, true);
    window.removeEventListener("resize", onResize, true);
    // Nothing to revert today — no UI writes styles yet — but the backend is
    // here and exiting must always put the page back exactly as it was.
    changes.slice().forEach(revert);
    select(null);
    hideHover();
  }

  /** The hover frame is only meaningful while the pointer is still on it. */
  function hideHover() {
    hoverBox.style.display = "none";
  }

  /** A resize can reflow the selection out from under its frame. */
  function onResize() {
    if (selected) place(selBox, selected.getBoundingClientRect(), selected);
  }

  function onMove(e) {
    cursor.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
    var el = textAt(e.clientX, e.clientY);
    if (!el) {
      hoverBox.style.display = "none";
      return;
    }
    place(hoverBox, el.getBoundingClientRect(), el);
    hoverBox.style.display = "block";
  }

  function onClick(e) {
    // Edityy's own chrome keeps its clicks.
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    // Everything else is swallowed: a link must not navigate, and the page's own
    // handlers must not run against an element that is mid-edit.
    e.preventDefault();
    e.stopPropagation();
    var hit = pickAt(e.clientX, e.clientY);
    select(hit && hit.el, hit);
  }

  function onKey(e) {
    if (e.key === "Escape") exit();
  }

  launch.addEventListener("click", function (e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    if (active) exit();
    else enter();
  });

  (document.body || document.documentElement).appendChild(host);
})();