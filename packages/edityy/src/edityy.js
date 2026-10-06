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
 * 2. A temporary editing mode. There is no second control: the orb itself
 *    shrinks into the pointer, so the thing the user clicked is the thing that
 *    follows them. Hovering any element outlines it and clicking selects it.
 *    `kind()` classifies what was picked as text, container or media before
 *    anything else happens, and `root.selection()` reports it.
 *
 * Selecting text puts the caret in it, so the words are editable where they
 * sit; selecting anything opens a dock that changes it. The dock starts as the
 * seven type controls and one `+`, and picking from the `+` adds a control —
 * shadow, blur, brightness, greyscale, contrast — as another icon in the row.
 *
 * Everything here is still in memory only: apply() writes an inline style,
 * remembers what was there, and revert() puts it back on exit. Nothing is
 * written to the codebase, which stays the source of truth.
 *
 * Browser IIFE on purpose: this file is served to the page as-is, so it cannot
 * be a module.
 */
(function () {
  "use strict";

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
    // all:initial and the colour on ONE rule: a second :host{color} later in the
    // sheet would win, but `all:initial` resets colour itself, so a :host{color}
    // written before it is wiped and every icon goes back to its own plum.
    ":host{all:initial;color:#3a283c}",
    // `all:initial` severs inheritance, so the payload names a font itself. It must
    // not name the host's: this package runs on other people's codebases, and a
    // face invented here would not match the site being edited. The machine own
    // UI face dresses the chrome instead — the controls are Edityy's, not the page's.
    //
    // The colour goes on :host, not on *. A universal colour reaches the <path>
    // inside an icon as well as its <svg>, and since those paths are stroked with
    // currentColor they resolve against their OWN colour — which is this plum on
    // every button. An open control paints itself #3a283c, so its icon was the
    // same colour as its own background: invisible. On :host it is inherited
    // down to the button and stops there.
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif}",
    "[hidden]{display:none!important}", // also for #dock, whose display:flex would beat it
    // The text dock: seven icons in a row and, above them, the one control that is
    // open. Fixed, so it holds still while the page scrolls under it, and below
    // the pointer's z-index so the dot is never hidden behind it.
    "#dock{position:fixed;left:50%;bottom:24px;z-index:3;pointer-events:auto;",
    "display:flex;flex-direction:column;align-items:center;gap:8px;transform:translateX(-50%);",
    "animation:dockIn .26s cubic-bezier(.2,.9,.25,1)}",
    "@keyframes dockIn{from{opacity:0;transform:translateX(-50%) translateY(14px) scale(.96)}",
    "to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}",
    ".row{display:flex;gap:2px;padding:4px;background:#f9f2ee;border:1px solid #3a283c1a;",
    "border-radius:12px;box-shadow:0 1px 1px #3a283c14,0 10px 24px #3a283c1f}",
    // Icons: hairline strokes on the ramp, filled when their control is open, so
    // what is open is obvious without a label.
    ".ic{width:34px;height:34px;display:grid;place-items:center;border:0;padding:0;",
    "border-radius:8px;background:transparent;color:#3a283c;cursor:pointer;",
    "transition:background .13s ease,color .13s ease,transform .13s ease}",
    ".ic:hover{background:#3a283c0f}",
    ".ic:active{transform:scale(.92)}",
    ".ic[aria-expanded=true]{background:#3a283c;color:#f9f2ee}",
    ".ic.add{color:#86546b}",
    ".ic svg{width:18px;height:18px;display:block;color:inherit;stroke:currentColor}",
    // Type controls are their own glyphs: a letterform says "this is about type"
    // faster than any abstract mark could. color:inherit is not optional: the
    // universal * rule above sets a colour on every element, so a glyph would
    // stay plum on the plum of an active button and vanish.
    ".g{font-size:15px;font-weight:600;line-height:1;color:inherit;pointer-events:none}",
    ".g.serif{font-family:Georgia,\"Times New Roman\",serif;font-weight:400;font-size:16px}",
    ".g.heavy{font-weight:800}",
    ".g.thin{font-size:13px}",
    // The swatch is a real control, so it takes focus and shows focus: an inline
    // <i> would be invisible to the keyboard and unreachable by the pointer.
    // The bar wears the element own colour once one is selected, and is a bare
    // outline until then: an empty swatch is honest about knowing nothing, where
    // a swatch painted in our plum would claim the site is that colour.
    ".sw{display:block;width:16px;height:3px;margin-top:2px;border-radius:1px;background:transparent;box-shadow:inset 0 0 0 1px #3a283c40}",
    // No min-width: each control is exactly as wide as its own content. A floor
    // here is what makes a row of four icons as wide as a list of face names,
    // with dead paper either side of the icons.
    ".pop{padding:8px;background:#f9f2ee;border:1px solid #3a283c1a;",
    // Above the dock, not under it: the dock never moves, but the page does, and
    // a control that opens downward gets swallowed by the viewport.
    "border-radius:12px;box-shadow:0 1px 1px #3a283c14,0 10px 24px #3a283c1f;",
    "animation:popIn .16s ease-out}",
    "@keyframes popIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    ".list{display:flex;flex-direction:column;gap:1px;max-height:216px;overflow-y:auto;",
    // The host page scrollbar is the page scrollbar: without this the list shows
    // whatever the site styles its scrollbars with, or a chunky default. A hairline
    // in the ramp, inset so it never sits on the text, and no buttons.
    "scrollbar-width:thin;scrollbar-color:#3a283c40 transparent;padding-right:4px}",
    ".list::-webkit-scrollbar{width:6px}",
    ".list::-webkit-scrollbar-track{background:transparent}",
    ".list::-webkit-scrollbar-thumb{background:#3a283c40;border-radius:6px}",
    ".list::-webkit-scrollbar-thumb:hover{background:#3a283c66}",
    // One row per option: a face shows itself, an alignment shows its own lines.
    // width:max-content, not 100%: a row is as wide as its own label, so a short
    // name does not stretch the list and a long one is not clipped.
    ".opt{display:block;width:max-content;max-width:100%;text-align:left;border:0;",
    "border-radius:8px;padding:7px 10px;",
    "background:transparent;color:#3a283c;font:500 14px/1.2 inherit;cursor:pointer;",
    "transition:background .12s ease,color .12s ease}",
    ".opt:hover{background:#3a283c0f}",
    ".opt[aria-pressed=true]{background:#3a283c;color:#f9f2ee}",
    ".opts{display:flex;gap:2px;padding:2px}",
    // The alignment control lays its row out as a real 3x3 grid instead.
    ".opts.grid3{display:grid;grid-template-columns:repeat(3,34px);gap:2px;padding:2px}",
    ".bar2{display:flex;align-items:center;gap:10px;padding:6px}",
    ".bar2>input[type=number]{width:auto;min-width:0;flex:1}",
    ".field-label{white-space:nowrap}",
    ".val{min-width:36px;text-align:right;font:600 13px/1 inherit;color:#86546b;",
    "font-variant-numeric:tabular-nums}",
    // The weight slider: a hairline track in the ramp and a solid grab dot. The
    // track has to be dark enough to see against paper — the default UA track is
    // a light grey that vanishes on this background.
    "input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:2px;",
    "border-radius:2px;background:#3a283c59;outline:none}",
    "input[type=range]::-webkit-slider-runnable-track{height:2px;border-radius:2px;background:#3a283c59}",
    "input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;",
    "margin-top:-6px;border-radius:50%;background:#3a283c;cursor:grab;",
    "box-shadow:0 1px 2px #3a283c40}",
    "input[type=range]:focus-visible{box-shadow:0 0 0 3px #d79eac66}",
    "input[type=range]::-moz-range-track{height:2px;border-radius:2px;background:#3a283c59}",
    "input[type=range]::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;",
    "background:#3a283c;cursor:grab}",
    // The swatch that picks a shadow's colour. The UA renders it as a rounded
    // rectangle with a border, which would not sit in the ramp next to the rest.
    "input[type=color]{width:44px;height:30px;padding:0;border:1px solid #3a283c26;border-radius:8px;",
    "background:#f9f2ee;cursor:pointer}",
    "input[type=color]::-webkit-color-swatch-wrapper{padding:3px}",
    "input[type=color]::-webkit-color-swatch{border:0;border-radius:5px}",
    "input[type=number]{width:100%;border:1px solid #3a283c26;border-radius:8px;padding:9px 10px;",
    // -webkit-text-fill-color is what actually makes the digits appear: the UA
    // paints them in its own light grey, which is invisible on paper.
    "background:#f9f2ee;-webkit-text-fill-color:#3a283c;color:#3a283c;",
    "font:500 14px/1 inherit;outline:none;font-variant-numeric:tabular-nums;",
    "transition:border-color .13s ease,box-shadow .13s ease}",
    "input[type=number]:focus{border-color:#86546b;box-shadow:0 0 0 3px #d79eac4d}",
    "input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button",
    "{-webkit-appearance:none;margin:0}",
    // One element, both states. Anchored bottom-right while the mode is off, moved
    // to the pointer and scaled down once it is on — so the orb shrinks into the
    // point rather than one control swapping in for another.
    "#launch{position:fixed;right:24px;bottom:24px;width:56px;height:56px;",
    "border-radius:50%;border:0;margin:0;padding:0;cursor:pointer;pointer-events:auto;z-index:4;",
    "display:grid;place-items:center;font:600 14px/1.1 inherit;color:#f9f2ee;",
    "background:#3a283c;box-shadow:0 1px 1px #3a283c14,0 6px 12px #3a283c1f;",
    // transform only: a scale from the centre and a translate to the pointer are
    // the same property, so the shrink and the travel animate as one move. The
    // default centre origin is what makes the dot land exactly under the pointer.
    "transition:transform .3s cubic-bezier(.2,.8,.2,1),background .15s}",
    "#launch:hover{background:#86546b}",
    "#launch:focus-visible{outline:2px solid #3a283c;outline-offset:3px}",
    // The word fades rather than scales: shrinking text is the one thing that
    // reads as a label getting tiny instead of an orb becoming a point.
    "#label{transition:opacity .12s ease-out}",
    // A frame drawn around an element: one violet border, transparent inside, so
    // the element underneath is never covered or tinted. 4px is the ramp sm
    // radius — the smallest the design allows, enough to soften the corners
    // without turning the box into a lozenge.
    ".frame{position:fixed;pointer-events:none;z-index:1;",
    "box-sizing:border-box;border:2px solid #d79eac;border-radius:4px;background:transparent}",
    "@media (prefers-reduced-motion:reduce){#launch,#label{transition:none}}",
    // The row and the edits button, side by side under the open control.
    ".bar{display:flex;align-items:center;gap:6px}",
    ".ic.solo{position:relative;width:44px;height:44px;background:#f9f2ee;border:1px solid #3a283c1a;",
    "border-radius:12px;box-shadow:0 1px 1px #3a283c14,0 10px 24px #3a283c1f}",
    ".ic.solo[aria-expanded=true]{background:#3a283c;color:#f9f2ee}",
    ".count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;",
    "border-radius:9px;background:#86546b;color:#f9f2ee;font:600 11px/18px inherit;text-align:center}",
    // One edited element per line: its name selects it, the arrow reverts it.
    ".chg{display:flex;align-items:center;gap:2px}",
    ".chg .opt{flex:1}",
    ".chg .ic{width:30px;height:30px;flex:none}",
    ".note{margin:6px 10px;max-width:240px;font:500 13px/1.4 inherit;color:#86546b}",
    ".cta{flex:1;border:0;border-radius:8px;padding:9px 12px;background:#3a283c;color:#f9f2ee;white-space:nowrap;",
    "font:600 13px/1 inherit;cursor:pointer;transition:background .13s ease}",
    ".cta:hover{background:#86546b}",
    ".cta:disabled{opacity:.4;cursor:default;background:#3a283c}",
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy"><span id="label">Edityy</span></button>',
    '<div class="frame" id="hover" hidden></div>',
    '<div class="frame" id="sel" hidden></div>',
    "<div id=\"dock\" hidden>",
    '<div class="pop" id="pop" hidden></div>',
    '<div class="bar">',
    '<div class="row" id="row"></div>',
    // The edits so far, apart from the row: the row is this element's controls,
    // and the list is every element's changes.
    '<button type="button" class="ic solo" id="review" title="Edits" aria-label="Edits" aria-expanded="false">',
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">',
    '<path d="M6.5 5h8M6.5 9h8M6.5 13h8M3.5 5h0M3.5 9h0M3.5 13h0"/></svg>',
    '<span class="count" id="count" hidden></span></button>',
    "</div>",
    "</div>",
    "</div>",
  ].join("");

  var $ = function (id) {
    return root.getElementById(id);
  };
  var launch = $("launch");
  var label = $("label");
  // The orb's centre, measured once as the mode opens. Every transform after
  // that translates from this point, so tracking the pointer never has to know
  // where the orb was and the first move animates out of the orb, not into air.
  var anchorX = 0;
  var anchorY = 0;
  // 56px orb → 9px: a point, not a smaller circle.
  var POINT = 0.16;
  var hoverBox = $("hover");
  var selBox = $("sel");
  var dock = $("dock");
  var row = $("row");
  var pop = $("pop");
  var review = $("review");
  // The control that is open, "" for none.
  var openKey = "";
  var countBadge = $("count");
  // The `+` sits at the end of the row and a revealed control goes in before it,
  // so adding one grows the row leftwards from the button that added it.
  var addBtn = null;

  // The font stacks a machine already has. No webfonts: the editor must not
  // change what the page loads, only what it looks like. The first entry is the
  // site's own face, taken from the app's own token wherever it sets one.
  var active = false;
  var selected = null;
  // The kind of the current selection. Nothing reads it yet — there is no panel —
  // but root.selection() reports it and it is the first thing any UI will want.
  var selectedKind = null; // "text" | "container" | "media"
  // The element whose words are being typed into, if any. One at a time: a new
  // selection closes the last, or two elements would both take the caret.
  var editing = null;
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
    // children, not childNodes: an element child is in both, a text node only in
    // childNodes. A container is a container either way, so the one list that
    // holds every element is the one to read.
    return !el.children.length && hasOwnText(el);
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
   * A short, human way to name an element: "h1 “Edityy”". What the edits list
   * shows. Not called `label`: that name is the orb's own text, further up.
   */
  function nameOf(el) {
    var snippet = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return el.tagName.toLowerCase() + " " + (snippet ? "“" + snippet + "”" : "");
  }

  /* -------------------------------------------------------------- changes */

  /** The change record for an element, created on first touch. */
  function record(el) {
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].el === el) return changes[i];
    }
    var rec = { el: el, props: {}, set: {}, was: {}, text: null, layoutMode: null };
    changes.push(rec);
    return rec;
  }

  /**
   * The backend for a change: note what was there, then set the new value.
   *
   * The record remembers the value before, and "before" has to include whether
   * the property was set at all. getPropertyValue() returns "" for both a
   * property that is unset and one set to nothing, so the inline declaration is
   * also read straight off the cssText — without that a width of 0 would be
   * recorded as nothing to put back and exit would leave it behind.
   */
  function apply(prop, value) {
    var rec = record(selected);
    remember(rec, prop);
    var was = selected.style.getPropertyValue(prop);
    // `value` is a string, and "" means "not set": removeProperty empties it
    // without leaving a declaration behind, while setProperty("") would write one
    // that overrides the stylesheet with nothing — the bug a control that writes
    // "" to mean "off" would otherwise cause, and silently break the revert too,
    // since an empty value records nothing to put back.
    if (value) selected.style.setProperty(prop, value);
    else selected.style.removeProperty(prop); // back to the stylesheet's value
    step(rec, prop, was, selected.style.getPropertyValue(prop));
    return rec;
  }

  /* -------------------------------------------------------------- history */

  // Undo and redo, as a stack of steps. A step is one element and the inline
  // values of the properties it touched, before and after:
  //   { rec, before: {prop: value}, after: {prop: value}, at }
  var history = [];
  var future = [];
  // The step this task's writes go into. A control can write two properties
  // for one input (a border's width and its style), and those are one step.
  var current = null;
  // When the words were last typed into: the browser owns the text's own undo,
  // so ⌘Z after typing is the browser's and ⌘Z after a drag is ours.
  var typedAt = 0;
  // A drag fires an input per pixel, and typing "40" fires two. A slider, a
  // number or a colour holds its step open from the first input to the
  // `change` the browser fires when the drag lets go, so the whole gesture is
  // one step. A click on an option is a gesture of its own.
  var dragging = false;

  /** A continuous control is moving: what it writes joins the open step. */
  function hold() {
    dragging = true;
  }

  /** The drag let go, or the user moved on: the next write is a new step. */
  function release() {
    dragging = false;
    var top = history[history.length - 1];
    if (top) top.open = false;
  }

  function step(rec, prop, before, after) {
    var now = Date.now();
    if (!current) {
      var top = history[history.length - 1];
      current = top && top.open && top.rec === rec && prop in top.before ? top : null;
      if (!current) {
        if (top) top.open = false;
        current = { rec: rec, before: {}, after: {}, at: now, open: dragging };
        history.push(current);
      }
      // Closed at the end of this task, so the next input starts fresh.
      Promise.resolve().then(function () { current = null; });
    }
    if (!(prop in current.before)) current.before[prop] = before;
    current.after[prop] = after;
    current.at = now;
    future = [];
  }

  /** Write a step's values back without recording anything. */
  function replay(target, values) {
    Object.keys(values).forEach(function (prop) {
      if (values[prop]) target.rec.el.style.setProperty(prop, values[prop]);
      else target.rec.el.style.removeProperty(prop);
    });
    refit();
    tally();
    // An open control shows the value it read when it opened, so it is redrawn.
    if (openKey && openKey !== "+") show(openKey);
  }

  function undo() {
    var last = history.pop();
    if (!last) return false;
    replay(last, last.before);
    future.push(last);
    return true;
  }

  function redo() {
    var next = future.pop();
    if (!next) return false;
    replay(next, next.after);
    history.push(next);
    return true;
  }

  /** A reverted element takes its steps with it: there is nothing left to undo. */
  function forget(rec) {
    var keep = function (x) { return x.rec !== rec; };
    history = history.filter(keep);
    future = future.filter(keep);
  }

  /* ---------------------------------------------------------- text editing */

  /**
   * Put the caret in an element's own words.
   *
   * Only leaf text — an element with child elements is left alone, because
   * a textContent rewrite would destroy them. The before value is recorded so
   * revert() still knows what the page said before this session touched it.
   *
   * `plaintext-only` and not `true`: pasting a word must not paste a <span> with
   * a style on it. A browser that does not know the value still types, because
   * it reads an unknown value as editable.
   *
   * Only leaf text gets a caret. An element that holds child elements as well as
   * words is still text as far as the dock is concerned — a heading with an <em>
   * in it takes a font size — but rewriting its text would take the <em> too.
   */
  function editText(el) {
    if (editing && editing !== el) stopEditing();
    if (!el || !isLeafText(el)) return;
    // The before value is taken WITHOUT writing it back. Assigning textContent
    // destroys the text node and builds a new one, so the browser loses the caret
    // position and puts it at the start — which is why clicking the middle of a
    // line always typed at the beginning. Nothing is written here; the browser
    // mutates the node itself once it is editable. The record is told the before
    // value so revert() can put it back, but the text is only READ: assigning it
    // would throw the caret away.
    var rec = record(el);
    if (rec.text === null) rec.text = el.textContent;
    el.setAttribute("contenteditable", "plaintext-only");
    // No focus ring. The browser draws one on any focused element, and on the
    // words being edited it lands as a second outline right on top of the frame
    // Edityy already draws — so the element gets two rings, one of them not
    // ours. Set inline because this element is the page's, not ours: a rule in
    // the shadow root cannot reach it, and a class would change the page.
    // outline: none rather than a custom ring, because the frame is the ring.
    //
    // The outline the element had is recorded first, before ours goes on: the
    // record's "before" is what exit puts back, and it must be the page's, not
    // the `none` this line is about to write.
    remember(rec, "outline");
    el.style.setProperty("outline", "none");
    editing = el;
    if (el.focus) el.focus();
  }

  /** Give the words back to the page: no longer editable, and no caret. */
  function stopEditing() {
    if (!editing) return;
    editing.removeAttribute("contenteditable");
    // The outline goes with it: back to exactly what the record says was there,
    // so an element that had an outline of its own gets it back.
    restore(record(editing), "outline");
    if (editing.blur) editing.blur();
    editing = null;
  }

  /**
   * Note what a property was before this session first touched it. Only the
   * first time: after that the inline value is ours, not the page's.
   */
  function remember(rec, prop) {
    if (prop in rec.props) return;
    // The computed value as well, for the edits list: the inline value before is
    // usually nothing at all, and "nothing → 40px" tells a reader very little.
    var view = window.getComputedStyle(rec.el);
    rec.was[prop] = view ? view.getPropertyValue(prop) : "";
    rec.props[prop] = rec.el.style.getPropertyValue(prop);
    rec.set[prop] = new RegExp("(?:^|;)\\s*" + prop + "\\s*:").test(rec.el.style.cssText);
  }

  /** Put one property back exactly as it was: its value, or not set at all. */
  function restore(rec, prop) {
    if (!(prop in rec.props)) return;
    if (rec.set[prop] && rec.props[prop]) rec.el.style.setProperty(prop, rec.props[prop]);
    else rec.el.style.removeProperty(prop);
  }

  /** Undo every property and the text of one element. */
  function revert(rec) {
    Object.keys(rec.props).forEach(function (prop) {
      restore(rec, prop);
    });
    if (rec.text !== null && rec.el.textContent !== rec.text) rec.el.textContent = rec.text;
    changes = changes.filter(function (other) {
      return other !== rec;
    });
    forget(rec);
    tally();
  }

  // The box drawn around an element. It stands off the element by 4px on every
  // side, so the frame is unmistakably Edityy's and not the page's own edge.
  var GAP = 4;
  /** Pin a frame to a target rectangle. One border, four numbers. */
  function place(frame, rect) {
    frame.style.left = rect.left - GAP + "px";
    frame.style.top = rect.top - GAP + "px";
    frame.style.width = rect.width + GAP * 2 + "px";
    frame.style.height = rect.height + GAP * 2 + "px";
  }

  /**
   * Paint the text-colour glyph with the colour the element actually has.
   *
   * Read from the element rather than painted in: the bar under the A is a
   * readout of this site, and a fixed colour on it would be a lie about every
   * site that is not ours. Left transparent when the element has no hex colour
   * of its own — a name or an rgb() is a real colour, and the bar is honest
   * about not being able to show it rather than guessing.
   */
  function paintSwatch() {
    if (!selected) return;
    // Found by walking the row rather than by id: the bar is markup inside the
    // icon's own innerHTML, not an element of its own.
    var icon = slot("color");
    var bar = icon && icon.querySelector ? icon.querySelector("#swatch-color") : null;
    if (!bar) return;
    var current = hex();
    // Left transparent when the colour is a name or an rgb() we cannot express
    // as a hex: the bar is a readout, and a readout that guesses is a lie.
    bar.style.background = current;
  }

  /**
   * The element's own colour as a hex, or "" when it cannot be one.
   *
   * There is nowhere left to read a hex from. `style.color` is normalised to
   * `rgb(0, 105, 92)` the moment it is set, and getComputedStyle only ever
   * answers in the same form — so the only way back to a hex is to convert, and
   * that is arithmetic on a value the page wrote, not a value we invented.
   *
   * Anything that is not a plain rgb/rgba is refused rather than guessed at: a
   * named colour, an hsl() or an oklch() would need a colour space this file
   * has no business implementing, and a swatch that lies about a site is worse
   * than a swatch that shows nothing.
   */
  function hex() {
    if (!selected) return "";
    var v = get("color").trim();
    var m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!m) return "";
    return "#" + [m[1], m[2], m[3]].map(function (n) {
      // Clamped and rounded: a computed channel can be 254.9999, and a hex needs
      // a whole number or the browser will not take it.
      return ("0" + Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16)).slice(-2);
    }).join("");
  }

  /** Draw the selection frame and reveal whatever the new selection can edit. */
  function select(el, hit) {
    stopEditing(); // the caret belongs to the old selection, never to both
    if (el !== selected) release();
    selected = el;
    // The kind comes from the pick, because a form control is text by way of the
    // walk rather than by way of `kind()`: it has no text node of its own.
    selectedKind = el && hit ? hit.kind : null;
    if (!el) {
      selBox.hidden = true;
      syncDock();
      paintSwatch();
      return;
    }
    selBox.hidden = false;
    place(selBox, el.getBoundingClientRect(), el);
    // Words become editable where they sit; nothing else gets a caret, because
    // textContent over a container would destroy the child elements in it.
    if (selectedKind === "text") editText(el);
    syncDock();
    // After syncDock, not before: the dock is what builds the row, so on the
    // first selection there is no colour icon to paint yet and the bar stayed
    // empty on the element that matters most — the first one you click.
    paintSwatch();
  }

  // What is selected, and what it was classified as. The seam any UI starts
  // from, so it stays.
  root.selection = function () {
    return selected ? { el: selected, kind: selectedKind } : null;
  };

  /* ------------------------------------------------------------ text dock */

  /**
   * The seven type controls, as data.
   *
   * `open` builds the control for that one key; the rest render nothing. So
   * opening a control is one function call and the popover starts empty, which
   * is why only one can ever be on screen.
   */
  /** The families a browser can always draw, used only as a floor. */
var SYSTEM_FONTS = [
  { label: "System UI", stack: "system-ui,-apple-system,Segoe UI,sans-serif" },
  { label: "Helvetica", stack: "Helvetica,Arial,sans-serif" },
  { label: "Georgia", stack: "Georgia,Cambria,serif" },
  { label: "Times New Roman", stack: '"Times New Roman",Times,serif' },
  { label: "Courier New", stack: '"Courier New",Courier,monospace' },
];
// Generic families and vendor prefixes: never a deliberate choice, never
// measurable, and not worth a row in the list.
var GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[\w-]+|math|emoji|fangsong)$/;

/** One family name out of a stack: no quotes, no fallbacks. */
function faceName(stack) {
  return String(stack).split(",")[0].replace(/["']/g, "").trim();
}

/**
 * The families this page actually has, found by measuring rather than guessing.
 *
 * Edityy runs on other codebases, so no list of fonts can be baked in: the brand
 * face of the site being edited is the one worth offering and it is never the
 * same twice. Every name the page declares is checked against a width probe and
 * dropped unless the browser really draws it, because a name that is declared
 * but not loaded would silently fall back to something else when picked.
 *
 * Whatever the page declares or loads is offered first; the system families are
 * only a floor, so the list is never empty on a page that names no fonts at all.
 */
function faces() {
  var out = [];
  var seen = {};
  var add = function (label, stack, value) {
    if (!label || seen[label]) return;
    seen[label] = true;
    // `v` is what picking the row writes, so it has to be the full stack and not
    // the name: "Helvetica" alone resolves differently from "Helvetica,Arial".
    out.push({ label: label, stack: stack, v: value });
  };

  // A span of text, measured twice: once in a fallback, once in the candidate. A
  // different width is proof the face exists. Hidden off-screen so it never
  // shows and never reflows the page.
  var probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;font-size:100px;white-space:nowrap;visibility:hidden";
  probe.textContent = "Handgloves 0123";
  document.body.appendChild(probe);

  var measure = function (stack) {
    probe.style.fontFamily = stack;
    return probe.getBoundingClientRect().width;
  };
  var available = function (label) {
    return measure(JSON.stringify(label) + ",monospace") !== measure("monospace");
  };

  try {
    // Declared by the page or by the selected element, loaded webfonts, then the
    // system floor. Order is what the user sees: the site first, the machine last.
    var names = String(get("font-family") || "").split(",");
    var page = viewOf(document.documentElement);
    names = names.concat(String(page.fontFamily || "").split(","));

    // document.fonts is the reliable list; the stylesheets are read as well
    // because a cross-origin sheet throws on cssRules and a @font-face is the
    // one place a loaded face can otherwise hide from the API.
    try {
      Array.prototype.forEach.call(document.fonts || [], function (face) {
        names.push(face.family);
      });
    } catch (e) {
      /* no FontFaceSet: the stylesheets below are the whole story */
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try {
        rules = document.styleSheets[i].cssRules;
      } catch (e) {
        continue; // cross-origin: nothing to read, and nothing to fail on
      }
      for (var j = 0; rules && j < rules.length; j++) {
        if (rules[j].type === 5) names.push(rules[j].style.getPropertyValue("font-family"));
      }
    }
    SYSTEM_FONTS.forEach(function (f) { names.push(f.label); });

    names.forEach(function (name) {
      var label = faceName(name);
      // Generics and the vendor prefixes are never a face anyone picked on
      // purpose, and none of them can be measured.
      if (!label || GENERIC.test(label)) return;
      if (available(label)) add(label, label, label);
    });
  } finally {
    probe.remove();
  }

  // The floor, in case a page declares nothing a probe can measure.
  SYSTEM_FONTS.forEach(function (f) { add(f.label, f.stack, f.stack); });
  return out;
}

  var WEIGHTS = [300, 400, 500, 600, 700, 800];
  var ALIGNS = [
    { v: "left", label: "Align left", icon: '<path d="M3 5h12M3 9h8M3 13h12"/>' },
    { v: "center", label: "Align centre", icon: '<path d="M3 5h12M6 9h6M3 13h12"/>' },
    { v: "right", label: "Align right", icon: '<path d="M3 5h12M7 9h8M3 13h12"/>' },
    { v: "justify", label: "Justify", icon: '<path d="M3 5h12M3 9h12M3 13h12"/>' },
  ];
  var DECORATIONS = [
    { v: "underline", label: "Underline", icon: '<path d="M5 4v5a4 4 0 0 0 8 0V4M4 15h10"/>' },
    { v: "line-through", label: "Strikethrough", icon: '<path d="M5 6a4 4 0 0 1 8 0M12 12a4 4 0 0 1-8 0M3 9h12"/>' },
    { v: "italic", label: "Italic", icon: '<path d="M12 4H7M9 14h5M10.5 4l-3 10"/>' },
  ];

  // Container controls are mode-specific: the dock mirrors the layout table,
  // rather than showing one mixed panel whose controls change meaning.
  var MODES = ["stack", "flex", "grid", "absolute"];
  var MODE_LABELS = { stack: "Stack", flex: "Flex", grid: "Grid", absolute: "Absolute" };
  var MODE_GLYPHS = {
    stack: '<path d="M3 5h12M3 9h12M3 13h12"/>',
    flex: '<rect x="2.5" y="6" width="4" height="6" rx="1"/><rect x="7" y="6" width="4" height="6" rx="1"/><rect x="11.5" y="6" width="4" height="6" rx="1"/>',
    grid: '<rect x="3" y="3.5" width="5" height="5" rx="1"/><rect x="10" y="3.5" width="5" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/>',
    absolute: '<path d="M4 4h10v10H4zM7 7h4v4H7z"/>',
  };
  var DIRECTIONS = [
    { v: "row", label: "Row", icon: '<path d="M3 9h12M11 5l4 4-4 4"/>' },
    { v: "column", label: "Column", icon: '<path d="M9 3v12M5 11l4 4 4-4"/>' },
  ];
  var WRAPS = [
    { v: "nowrap", label: "No wrap", icon: '<path d="M3 6h12M3 12h12"/>' },
    { v: "wrap", label: "Wrap", icon: '<path d="M3 6h8a4 4 0 0 1 0 8H8M3 12l3 2-3 2"/>' },
    { v: "wrap-reverse", label: "Wrap reverse", icon: '<path d="M3 12h8a4 4 0 0 0 0-8H8M3 6l3-2-3-2"/>' },
  ];
  // Alignment as one 3x3 grid: each cell is a justify/align pair, drawn as a
  // dot in a frame so the cell itself says where the children go.
  var ALIGN_CELLS = [
    { j: "flex-start", a: "flex-start", x: 6, y: 6, label: "Top left" },
    { j: "center", a: "flex-start", x: 9, y: 6, label: "Top center" },
    { j: "flex-end", a: "flex-start", x: 12, y: 6, label: "Top right" },
    { j: "flex-start", a: "center", x: 6, y: 9, label: "Middle left" },
    { j: "center", a: "center", x: 9, y: 9, label: "Center" },
    { j: "flex-end", a: "center", x: 12, y: 9, label: "Middle right" },
    { j: "flex-start", a: "flex-end", x: 6, y: 12, label: "Bottom left" },
    { j: "center", a: "flex-end", x: 9, y: 12, label: "Bottom center" },
    { j: "flex-end", a: "flex-end", x: 12, y: 12, label: "Bottom right" },
  ];
  var ALIGN_GRID = ALIGN_CELLS.map(function (c) {
    return {
      v: c.j + ":" + c.a,
      label: c.label,
      icon: '<rect x="3" y="3.5" width="12" height="11" rx="1"/><circle cx="' + c.x + '" cy="' + c.y + '" r="1.6" fill="currentColor" stroke="none"/>',
    };
  });
  var BOX_GLYPHS = {
    direction: '<path d="M3 9h12M11 5l4 4-4 4"/>',
    gap: '<path d="M3 6.5h12M3 11.5h12"/>',
    alignment: '<circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    wrap: '<path d="M3 6h8a4 4 0 0 1 0 8H8M3 12l3 2-3 2"/>',
    columns: '<path d="M4 3v12M9 3v12M14 3v12"/>',
    rows: '<path d="M3 4h12M3 9h12M3 14h12"/>',
    columnGap: '<path d="M4 4v10M14 4v10M7 9h4M9 7l2 2-2 2"/>',
    rowGap: '<path d="M4 4h10M4 14h10M9 7v4M7 9l2 2 2-2"/>',
    position: '<path d="M3 3h12v12H3zM9 6v6M6 9h6"/>',
    width: '<path d="M3 9h12M6 6l-3 3 3 3M12 6l3 3-3 3"/>',
    height: '<path d="M9 3v12M6 6l3-3 3 3M6 12l3 3 3-3"/>',
  };

  // The filters, as data. Blur is the only one that takes a length; the other
  // four are percentages, and no webkit prefix: every engine that matters has
  // supported the unprefixed name for years and a second declaration per filter
  // is one more thing to keep in step.
  //
  // `write` is the CSS that gets set, `find` is how the current value is read
  // back. They cannot be the same string: `blur(Npx)` is a filter function when
  // written, but as a pattern its parentheses are a capture group, so it matches
  // `blur8px` and never `blur(8px)` — the value then reads as "off" and the next
  // filter's drag throws this one away. So the parens are escaped for reading.
  //
  // The shipped values are the CSS defaults, so "off" is the absence of a filter
  // rather than a set of zeroes. Adding one of these controls must not change
  // how the element looks before the user has touched the slider.
  // Greyscale is spelled "grayscale" here on purpose. Chrome has never
  // implemented `greyscale()`, and one unknown function does not merely drop
  // itself — it invalidates the whole `filter` list, so asking for greyscale
  // silently took the blur and the brightness with it. The alias works
  // everywhere the standard name does.
  var FILTERS = [
    { key: "shadow", label: "Shadow" },
    { key: "blur", label: "Blur", prop: "filter", min: 0, max: 40, step: 0.5, unit: "px", fallback: 0, write: "blur", find: "blur\\((\\d*\\.?\\d+)px\\)" },
    { key: "brightness", label: "Brightness", prop: "filter", min: 0, max: 300, step: 1, unit: "%", fallback: 100, write: "brightness", find: "brightness\\((\\d*\\.?\\d+)%\\)" },
    { key: "greyscale", label: "Greyscale", prop: "filter", min: 0, max: 100, step: 1, unit: "%", fallback: 0, write: "grayscale", find: "grayscale\\((\\d*\\.?\\d+)%\\)" },
    { key: "contrast", label: "Contrast", prop: "filter", min: 0, max: 300, step: 1, unit: "%", fallback: 100, write: "contrast", find: "contrast\\((\\d*\\.?\\d+)%\\)" },
  ];

  // Hairline icons: two strokes, round caps, 1.5 on an 18px grid. Enough that the
  // dock reads as one family without shipping an icon font for seven glyphs.
  var svg = function (body) {
    return '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  };
  var ICONS = [
    // Serif Aa, the way the font panel of every design tool marks it.
    { key: "family", label: "Font family", glyph: '<i class="g serif">Aa</i>' },
    // A heavy A beside a light one: the weight scale is the control.
    {
      key: "weight",
      label: "Font weight",
      glyph:
        '<svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.5"' +
        ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M2 14 5.5 4 9 14M3.3 10.5h4.4"/>' +
        '<path d="M12.5 14 16 4 19.5 14M13.8 10.5h4.4" stroke-width="1"/></svg>',
    },
    // A tall A beside a short one: two sizes.
    {
      key: "size",
      label: "Font size",
      glyph: svg('<path d="M2 13 5.5 4 9 13M3.3 10h4.4"/><path d="M11 13V6.5h1.8a1.75 1.75 0 0 1 0 3.5H11M15 5v9"/>'),
    },
    // Two lines with the leading between them.
    {
      key: "line",
      label: "Line height",
      glyph: svg('<path d="M3 5.5h12M3 12.5h12M12 7.5v3"/>'),
    },
    // Tight, then loose: the same two letters, tracked apart.
    {
      key: "tracking",
      label: "Letter spacing",
      glyph: svg('<path d="M6.5 5 4 13M11.5 5 14 13M2.5 9h13"/>'),
    },
    // Four bars, each ending short of a different edge: what the button does.
    {
      key: "align",
      label: "Text alignment",
      glyph: svg('<path d="M3 4.5h12M3 8h8M3 11.5h12M3 15h8"/>'),
    },
    // A with a line under it: the two decorations at once.
    {
      key: "decorate",
      label: "Text decoration",
      glyph: svg('<path d="M4.5 11 7.5 4 10.5 11M5.5 8.5h4M4 14h7"/>'),
    },
    // A letterform painted in: the colour the words themselves are.
    // An A over a bar that shows the element own colour once one is selected.
    // It starts empty rather than wearing a colour of ours: a swatch that does
    // not match the site reads as the site being that colour.
    { key: "color", label: "Text colour", glyph: '<i class="g">A<i class="sw" id="swatch-color"></i></i>' },
  ];

  // The `+`, and the one control it opens: the five things that are not type.
  // Shown as options rather than five more icons in the dock, because the dock is
  // the controls you have and the `+` is the ones you might want.
  var ADD = [
    { key: "shadow", label: "Shadow", glyph: svg('<rect x="3" y="6" width="9" height="9" rx="1.5"/><path d="M6 13.5h9"/>') },
    { key: "blur", label: "Blur", glyph: svg('<circle cx="9" cy="9" r="5.5"/><path d="M6.5 4.5 4 2M11.5 4.5 14 2M3 9H.5M15 9h2.5"/>') },
    { key: "brightness", label: "Brightness", glyph: svg('<circle cx="9" cy="9" r="3.5"/><path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4 4l1 1M14 4l-1 1M4 14l1-1M14 14l-1-1"/>') },
    { key: "greyscale", label: "Greyscale", glyph: svg('<circle cx="9" cy="9" r="6"/><path d="M9 3a6 6 0 0 1 0 12z" fill="currentColor" stroke="none"/>') },
    { key: "contrast", label: "Contrast", glyph: svg('<circle cx="9" cy="9" r="6"/><path d="M9 3v12" /><path d="M9 3a6 6 0 0 1 0 12z" fill="currentColor" stroke="none"/>') },

    // Fill and border are about the box, not the words: an element has a
    // background and a border, and its text has neither — a text fill is the
    // text colour, which is in the primary dock, and text has no border at all.
    { key: "fill", label: "Fill", glyph: svg('<path d="M3.5 8.5 9 3l5.5 5.5v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M7 15.5v-4h4v4"/>') },
    { key: "border", label: "Border", glyph: svg('<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><path d="M3.5 7h11"/>') },
  ];

  /** A button in the dock, or an option inside one control. */
  function button(cls, html, label, onClick, key) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.dataset.key = key || "";
    // Markup goes in as a string so the browser's own parser creates the icons:
    // an SVG element cannot be made with createElement(), which only ever builds
    // HTML elements and would hand back an <svg> that draws nothing.
    b.innerHTML = html;
    b.addEventListener("click", onClick);
    return b;
  }

  /** A run of label text, as a text node. Anything that is not markup. */
  function text(value) {
    return document.createTextNode(value);
  }

  /**
   * Show one control under the dock, or nothing at all.
   *
   * The popover starts empty every time, so a closed control takes its DOM with
   * it and can never leave a stale listener behind.
   */
  function show(key) {
    // Emptied by hand rather than with innerHTML: children is a live HTMLCollection,
    // so it has to be copied before anything is removed from under it.
    while (pop.firstChild) pop.removeChild(pop.firstChild);
    if (key !== openKey) release();
    openKey = key;
    // Dressed by data-key, not by position: the row is rebuilt per selection and
    // the added controls sit in front of the seven, so index i is not icon i.
    for (var i = 0; i < row.children.length; i++) {
      row.children[i].setAttribute("aria-expanded", row.children[i].dataset.key === key ? "true" : "false");
    }
    review.setAttribute("aria-expanded", key === "changes" ? "true" : "false");
    if (!key) {
      pop.hidden = true;
      return;
    }
    pop.hidden = false;
    // `+` is not a control and is not in ICONS, so it needs its own way in. Every
    // other key is either one of the seven or one that the `+` just added, and
    // both are in CONTROLS by the time the row shows them.
    if (key === "+") addOne();
    else if (key === "changes") listChanges();
    else CONTROLS[key]();
  }

  /** The options a single control can choose from, with a tick on the current one. */
  function options(items, current, onPick, font) {
    var list = document.createElement("div");
    list.className = "list";
    items.forEach(function (item) {
      // Every row writes item.v, whatever the control is: a list of faces and a
      // list of alignments are both just choices, and one that forgets its value
      // silently writes nothing at all.
      var value = item.v === undefined ? item.stack : item.v;
      var b = button("opt", "", item.label || value, function () {
        // Picking an option does not close anything. The control stays open on
        // purpose: comparing two weights or two faces means looking at the page
        // with the choices still in view, and a click that dismisses the list is
        // a click you have to make again before trying the next value.
        release();
        onPick(value);
        mark(value);
      }, value);
      // The label is added rather than passed in, because a face name is text and
      // text is a node — there is no markup to parse it out of.
      b.appendChild(text(font ? font(item) : item.label));
      // cssText rather than the property: a face stack is commas and quotes, and
      // the shorthand carries them through without the DOM re-parsing anything.
      b.style.cssText = "font-family:" + item.stack;
      b.setAttribute("aria-pressed", value === current ? "true" : "false");
      list.appendChild(b);
    });
    pop.appendChild(list);
  }

  /** Move the tick in an open control to whatever was just picked. */
  function mark(value) {
    for (var i = 0; i < pop.children.length; i++) {
      var rows = pop.children[i].children;
      for (var j = 0; rows && j < rows.length; j++) {
        // A control can hold anything, not only buttons — a label is a text node
        // and has no aria-pressed to move. Only an option carries one.
        if (rows[j].getAttribute && rows[j].getAttribute("aria-pressed") !== null) {
          rows[j].setAttribute("aria-pressed", rows[j].dataset.key === value ? "true" : "false");
        }
      }
    }
  }

  /** A row of icon buttons, for alignment and decoration. */
  /**
 * A row of icon buttons, for alignment and decoration.
 *
 * `onPick` returns the options that are now on, as a list, and the ticks follow
 * it: one item for a control that only allows one, several for decoration, which
 * CSS lets you stack.
 */
function icons(items, current, onPick, cls) {
    var list = document.createElement("div");
    list.className = cls ? "opts " + cls : "opts";
    var rows = items.map(function (item) {
      var b = button("ic", svg(item.icon), item.label || item.v, function () {
        // Stays open like every other control: these are things you try twice,
        // and the tick moves so you can see which one is on.
        release();
        mark(onPick(item.v));
      }, item.v);
      b.setAttribute("aria-pressed", item.v === current ? "true" : "false");
      list.appendChild(b);
      return b;
    });
    function mark(on) {
      var picked = Array.isArray(on) ? on : [on];
      rows.forEach(function (b, i) {
        b.setAttribute("aria-pressed", picked.indexOf(items[i].v) === -1 ? "false" : "true");
      });
    }
    pop.appendChild(list);
    return mark;
  }

  /** A slider with a live readout, for weight and line height. */
  function slider(min, max, step, current, unit, onInput) {
    var row = document.createElement("div");
    row.className = "bar2";
    var input = document.createElement("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = current;
    var out = document.createElement("span");
    out.className = "val";
    out.textContent = current + unit;
    // Live: the element changes under the pointer, so there is nothing to commit.
    input.addEventListener("input", function () {
      out.textContent = input.value + unit;
      hold();
      onInput(input.value);
    });
    input.addEventListener("change", release);
    row.appendChild(input);
    row.appendChild(out);
    pop.appendChild(row);
  }

  /** A number field, for size and tracking. */
  function number(min, max, step, current, unit, onInput, label) {
    var row = document.createElement("div");
    row.className = "bar2";
    if (label) {
      var caption = document.createElement("span");
      caption.className = "field-label";
      caption.textContent = label;
      row.appendChild(caption);
    }
    var input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = current;
    var out = document.createElement("span");
    out.className = "val";
    out.textContent = unit;
    input.addEventListener("input", function () {
      // Blank while typing is not a value; wait for the field to be usable.
      if (input.value === "") return;
      var v = Number(input.value);
      out.textContent = v + unit;
      hold();
      onInput(v);
    });
    input.addEventListener("change", release);
    row.appendChild(input);
    row.appendChild(out);
    pop.appendChild(row);
  }

  /**
   * A shadow, written out as the shorthand.
   *
   * CSS has no box-shadow-offset-x. The longhands that look like one
   * (box-shadow-blur and box-shadow-color) exist only inside an @property
   * registration, and the offsets and spread have none at all — the browser
   * drops an unknown property on the floor, so writing five invented ones draws
   * no shadow at all. One shorthand is the honest way.
   *
   * [x, y, blur, spread, colour], with x/y/blur/spread absent meaning 0 — the
   * same defaults getComputedStyle hands back for a "none" shadow.
   */
  function shadow(values) {
    // Nothing to cast: four zero lengths and a colour draw nothing, so the
    // property is emptied instead and the element is left as the page had it.
    var flat = !values[0] && !values[1] && !values[2] && !values[3];
    set("box-shadow", flat ? "" : values[0] + "px " + values[1] + "px " + values[2] + "px " + values[3] + "px " + values[4]);
  }

  /** One value off a computed `box-shadow`, read the way the browser wrote it. */
  function shadowOf(prop, fallback) {
    var v = get("box-shadow-" + prop).trim();
    if (!v) return fallback;
    var n = parseFloat(v);
    // A colour, or anything the shorthand spelled: handed back as it stands.
    return isNaN(n) ? v : n;
  }

  /**
   * The four filters as one `filter` value, each at its own default unless the
   * element already uses it.
   *
   * A filter list is not additive the way a shadow's lengths are not: writing
   * `filter: brightness(120%)` would throw away a blur the user set earlier, so
   * every filter is rebuilt from the four the editor owns. Only those are kept —
   * a filter the page brought along is dropped the first time a slider moves,
   * which is a real limitation and only visible on a page that filters itself.
   */
  function filters() {
    var out = {};
    FILTERS.forEach(function (f) {
      if (!f.prop) return;
      // What this session wrote, read off the inline style, not off the cascade.
      // getComputedStyle mid-drag is a snapshot: re-reading it while a slider is
      // moving is how a blur gets thrown away by the next filter's drag. The
      // inline value is exactly what we wrote, and the record keeps it revertable.
      // A filter the page brought along lives in the cascade, so it is the
      // fallback rather than the source.
      var inline = selected.style.getPropertyValue(f.prop);
      // The filter's own parentheses have to be escaped here (see FILTERS.find):
      // unescaped they are a capture group and the pattern matches nothing.
      var found = String(inline || get(f.prop) || "none").match(new RegExp(f.find));
      out[f.key] = found ? Number(found[1]) : f.fallback;
    });
    return out;
  }

  function setFilter(key, value) {
    var f = FILTERS.filter(function (x) { return x.key === key; })[0];
    var all = filters();
    // A number, not the string a range input hands over: the "is it at its
    // default" test below is a strict compare, and "0" !== 0 is true, so a
    // filter dragged back to its default would be written out as blur(0px) and
    // never leave the element.
    all[key] = Number(value);
    // A filter sitting at its default is left out of the list, so dragging one
    // back to where it started leaves no filter behind at all.
    var list = FILTERS.filter(function (x) { return x.prop && all[x.key] !== x.fallback; })
      .map(function (x) { return x.write + "(" + all[x.key] + x.unit + ")"; });
    set(f.prop, list.length ? list.join(" ") : "");
  }

  /**
   * A colour control: the native picker, and nothing else.
   *
   * No palette of our own. A colour that is not in the design system of the
   * site being edited is a colour that appears nowhere in it, and offering four
   * of ours on every site is worse than offering none — one click from a teal
   * brand to a plum that belongs to us. So the only colour offered is the one
   * the element already has, and anything new is the browser own picker, which
   * is where the OS eyedropper lives.
   */
  function colour(prop, current, onPick) {
    var bar = document.createElement("div");
    bar.className = "bar2";
    var swatch = document.createElement("input");
    swatch.type = "color";
    // The UA hands a swatch #000 when the value it is given is not a hex, and
    // a black box for an element whose colour is a name or an rgb() reads as a
    // bug rather than as a value. Left as the UA default on purpose: a guess
    // would be a colour we invented, which is the thing this control removed.
    if (/^#[0-9a-f]{6}$/i.test(current)) swatch.value = current;
    swatch.title = "Pick a colour";
    swatch.setAttribute("aria-label", "Pick a colour");
    swatch.addEventListener("input", function () {
      hold();
      onPick(swatch.value);
    });
    swatch.addEventListener("change", release);
    bar.appendChild(swatch);
    pop.appendChild(bar);
  }

  /** Everything the payload writes goes through here, so nothing is ever lost. */
  function set(prop, value) {
    if (!selected) return;
    apply(prop, value);
    place(selBox, selected.getBoundingClientRect());
    tally();
  }

  /**
   * A slider for one of the four filters, from the row above: the range, the step
   * and the unit all live with the filter they belong to, so adding a filter is
   * one entry in FILTERS and one control that calls this.
   */
  function filterSlider(key) {
    var f = FILTERS.filter(function (x) { return x.key === key; })[0];
    slider(f.min, f.max, f.step, filters()[key], f.unit, function (v) { setFilter(key, Number(v)); });
  }

  // A direction, align or gap without a box is nothing: flex, unless the
  // element already is a box — read fresh each time, so an earlier pick in
  // the same control still counts.
  function ensureBox() {
    var current = mode();
    if (current === "absolute") {
      setMode("flex");
      return;
    }
    var display = String(get("display") || "").trim();
    if (display !== "flex" && display !== "grid") {
      set("position", "");
      set("display", current === "stack" ? "flex" : current);
      if (current === "stack") set("flex-direction", "column");
    }
  }

  function mode() {
    var rec = selected && record(selected);
    if (rec && rec.layoutMode) return rec.layoutMode;
    if (String(get("position") || "").trim() === "absolute") return "absolute";
    var display = String(get("display") || "").trim();
    if (display === "flex" || display === "inline-flex") return "flex";
    if (display === "grid" || display === "inline-grid") return "grid";
    return "stack";
  }

  function setMode(value) {
    var rec = record(selected);
    var previous = mode();
    rec.layoutMode = value;
    if (value === "absolute") {
      set("display", "block");
      set("position", "absolute");
    } else if (value === "stack") {
      set("position", "");
      set("display", "flex");
      set("flex-direction", "column");
    } else {
      set("position", "");
      set("display", value);
      if (value === "flex" && previous === "stack") set("flex-direction", "row");
    }
  }

  function alignValue(value, fallback) {
    var v = String(value || "").trim();
    if (v === "start") v = "flex-start";
    if (v === "end") v = "flex-end";
    return v === "flex-start" || v === "center" || v === "flex-end" ? v : fallback;
  }

  var CONTROLS = {
    mode: function () {
      var at = MODES.indexOf(mode());
      setMode(MODES[(at + 1) % MODES.length]);
      buildRow();
      show("");
    },
    family: function () {
      options(faces(), get("font-family"), function (v) { set("font-family", v); }, function (f) {
        return f.label;
      });
    },
    weight: function () {
      slider(100, 900, 100, num("font-weight", 400), "", function (v) { set("font-weight", v); });
    },
    size: function () {
      number(8, 200, 1, num("font-size", 16), "px", function (v) { set("font-size", v + "px"); });
    },
    line: function () {
      slider(0.8, 3, 0.05, num("line-height", 1.3), "", function (v) { set("line-height", v); });
    },
    tracking: function () {
      // A slider, because tracking is judged by eye and a drag is faster than
      // typing: -4 to 16 covers every letterform anyone ships, and the negative
      // half is where large type needs it.
      slider(-4, 16, 0.1, num("letter-spacing", 0), "px", function (v) { set("letter-spacing", v + "px"); });
    },
    align: function () {
      icons(ALIGNS, get("text-align") || "left", function (v) {
        set("text-align", v);
        return v; // alignment is single-choice: this one is now the only one on
      });
    },
    decorate: function () {
      icons(DECORATIONS, String(get("text-decoration-line") || "").split(/\s+/), function (v) {
        return decorate(v);
      });
    },
    color: function () {
      // paintSwatch too, so the bar on the icon keeps up with what was just
      // picked instead of waiting for the next selection to change it.
      colour("color", hex(), function (v) { set("color", v); paintSwatch(); });
    },
    fill: function () {
      colour("background-color", get("background-color"), function (v) {
        set("background-color", v);
      });
    },
    border: function () {
      colour("border-color", get("border-color"), function (v) {
        set("border-color", v);
      });
      // A colour on a border that has no width is a colour nobody sees, so the
      // width is offered too. A hairline, in the ramp: thick enough to read,
      // thin enough not to shout.
      slider(0, 12, 1, num("border-width", 0), "px", function (v) {
        set("border-width", v + "px");
        set("border-style", v ? "solid" : "");
      });
    },
    shadow: function () {
      var read = function () {
        return [
          shadowOf("offset-x", 0),
          shadowOf("offset-y", 0),
          shadowOf("blur", 0),
          shadowOf("spread", 0),
          // No colour of our own to fall back on: the page own shadow colour, or
        ];
      };
      var values = read();
      // Four sliders, one per length, laid out as a list rather than one row of
      // four: a row of four drags is four narrow targets for a control judged by
      // eye, and a shadow is read down a column anyway.
      [
        { i: 0, label: "X", min: -40, max: 40 },
        { i: 1, label: "Y", min: -40, max: 40 },
        { i: 2, label: "Blur", min: 0, max: 80 },
        { i: 3, label: "Spread", min: -40, max: 40 },
      ].forEach(function (field) {
        slider(field.min, field.max, 1, values[field.i], "px", function (v) {
          // A number, not the string the input hands over: "0" is truthy, so the
          // check for a shadow worth writing would never fire.
          values[field.i] = Number(v);
          shadow(values);
        });
      });
      var swatch = document.createElement("input");
      swatch.type = "color";
      if (/^#[0-9a-f]{6}$/i.test(values[4])) swatch.value = values[4];
      swatch.title = "Shadow colour";
      swatch.addEventListener("input", function () {
        values[4] = swatch.value;
        hold();
        shadow(values);
      });
      swatch.addEventListener("change", release);
      var bar = document.createElement("div");
      bar.className = "bar2";
      var name = text("Colour");
      bar.appendChild(name);
      bar.appendChild(swatch);
      pop.appendChild(bar);
    },
    // Direction on its own: row or column. Flex-only, but a grid is left
    // alone — the property is harmless there and yanking the mode surprises.
    direction: function () {
      // Establish the flex box first. Otherwise ensureBox() applies the stack's
      // column default after the user's row/column choice and loses that choice.
      ensureBox();
      icons(DIRECTIONS, String(get("flex-direction") || "row").trim(), function (v) {
        set("flex-direction", v);
        return [v];
      });
    },
    // The same 3x3 interaction maps to the right CSS axes for each layout.
    alignment: function () {
      var currentMode = mode();
      // Stack is the editor's column layout even though a non-flex element's
      // computed flex-direction is the CSS default, row.
      var direction = currentMode === "stack"
        ? "column"
        : String(get("flex-direction") || "row").trim();
      var current;
      if (currentMode === "grid") {
        current = alignValue(get("justify-items"), "start") + ":" + alignValue(get("align-items"), "start");
      } else {
        var main = alignValue(get("justify-content"), "flex-start");
        var cross = alignValue(get("align-items"), "flex-start");
        current = direction === "column" ? cross + ":" + main : main + ":" + cross;
      }
      icons(ALIGN_GRID, current, function (v) {
        var parts = v.split(":");
        if (currentMode === "grid") {
          set("justify-items", parts[0] === "flex-start" ? "start" : parts[0] === "flex-end" ? "end" : parts[0]);
          set("align-items", parts[1]);
        } else if (direction === "column") {
          set("align-items", parts[0]);
          set("justify-content", parts[1]);
        } else {
          set("justify-content", parts[0]);
          set("align-items", parts[1]);
        }
        ensureBox();
        return [v];
      }, "grid3");
    },
    wrap: function () {
      // Keep this control usable for existing `inline-flex` elements too. The
      // mode is normalized to flex, then the value is written after the box is
      // established; setting it in the opposite order can be lost on mode change.
      if (mode() !== "flex") setMode("flex");
      icons(WRAPS, String(get("flex-wrap") || "nowrap").trim(), function (v) {
        setMode("flex");
        set("flex-wrap", v);
        return [v];
      });
    },
    gap: function () {
      slider(0, 48, 1, num("gap", 0), "px", function (v) {
        set("gap", v + "px");
        ensureBox();
      });
    },
    columns: function () {
      var current = String(get("grid-template-columns") || "").match(/repeat\(\s*(\d+)/i);
      if (mode() !== "grid") setMode("grid");
      number(1, 12, 1, current ? Number(current[1]) : 1, "", function (v) {
        set("grid-template-columns", "repeat(" + v + ", minmax(0, 1fr))");
      }, "Columns");
    },
    rows: function () {
      var current = String(get("grid-template-rows") || "").match(/repeat\(\s*(\d+)/i);
      if (mode() !== "grid") setMode("grid");
      number(1, 12, 1, current ? Number(current[1]) : 1, "", function (v) {
        set("grid-template-rows", "repeat(" + v + ", minmax(0, 1fr))");
      }, "Rows");
    },
    columnGap: function () {
      if (mode() !== "grid") setMode("grid");
      slider(0, 48, 1, num("column-gap", 0), "px", function (v) {
        set("column-gap", v + "px");
      });
    },
    rowGap: function () {
      if (mode() !== "grid") setMode("grid");
      slider(0, 48, 1, num("row-gap", 0), "px", function (v) {
        set("row-gap", v + "px");
      });
    },
    bounds: function () {
      ["top", "right", "bottom", "left"].forEach(function (prop) {
        var row = document.createElement("div");
        row.className = "bar2";
        var label = document.createElement("span");
        label.className = "field-label";
        label.textContent = prop.charAt(0).toUpperCase() + prop.slice(1);
        row.appendChild(label);
        var input = document.createElement("input");
        input.type = "number";
        input.min = -1000;
        input.max = 1000;
        input.step = 1;
        input.value = num(prop, 0);
        input.addEventListener("input", function () {
          if (input.value !== "") set(prop, Number(input.value) + "px");
        });
        row.appendChild(input);
        var unit = text("px");
        row.appendChild(unit);
        pop.appendChild(row);
      });
    },
    width: function () {
      number(0, 2000, 1, num("width", 0), "px", function (v) { set("width", v + "px"); }, "Width");
    },
    height: function () {
      number(0, 2000, 1, num("height", 0), "px", function (v) { set("height", v + "px"); }, "Height");
    },
    blur: function () { filterSlider("blur"); },
    brightness: function () { filterSlider("brightness"); },
    greyscale: function () { filterSlider("greyscale"); },
    contrast: function () { filterSlider("contrast"); },
  };

  /** What an element currently has, from the cascade or from a change we made. */
  function get(prop) {
    if (!selected) return "";
    var view = window.getComputedStyle(selected);
    return view ? view.getPropertyValue(prop) : "";
  }

  /** The same, for any element rather than the selection. */
  function viewOf(node) {
    var view = window.getComputedStyle(node);
    return {
      getPropertyValue: function (prop) {
        return view ? view.getPropertyValue(prop) : "";
      },
    };
  }

  /** The same, as a number, with a sensible default when it cannot be read. */
  function num(prop, fallback) {
    var v = parseFloat(get(prop));
    return isNaN(v) ? fallback : v;
  }

  /**
 * Toggle one decoration among the others.
 *
 * text-decoration-line is a space-separated list, so underline and strikethrough
 * are both legitimate on the same words. Picking one adds it, picking it again
 * takes it off, and the list is only emptied when nothing is left.
 */
function decorate(el) {
  var current = String(get("text-decoration-line") || "none")
    .split(/\s+/)
    .filter(function (v) { return v && v !== "none"; });
  var at = current.indexOf(el);
  if (at === -1) current.push(el);
  else current.splice(at, 1);
  set("text-decoration-line", current.join(" "));
  return current;
}

/** The dock itself: seven icons, a `+`, and only one control open at a time. */
  /** Is this control on show for the selected element? The row itself is the
      only list that matters now that it is rebuilt per element. */
  function icon(key) {
    return slot(key);
  }

  /** The dock's button for a key: icons in the row, plus the `+` at the end. */
  function slot(key) {
    for (var i = 0; i < row.children.length; i++) {
      if (row.children[i].dataset.key === key) return row.children[i];
    }
    return null;
  }

  /** Open this control, or close it if it is the one already open. */
  function toggle(key) {
    var open = pop.children[0] && slot(key).getAttribute("aria-expanded") === "true";
    show(open ? "" : key);
  }

  var BASE_ICONS = ICONS.slice(); // the type controls, the ones always there on text
  // The container dock mirrors the requested table. Mode is always present;
  // every other button is rebuilt from the current mode.
  var BOX_ICONS = {
    stack: [
      { key: "direction", label: "Direction", glyph: svg(BOX_GLYPHS.direction) },
      { key: "gap", label: "Gap", glyph: svg(BOX_GLYPHS.gap) },
      { key: "alignment", label: "Alignment", glyph: svg(BOX_GLYPHS.alignment) },
    ],
    flex: [
      { key: "direction", label: "Direction", glyph: svg(BOX_GLYPHS.direction) },
      { key: "wrap", label: "Wrap", glyph: svg(BOX_GLYPHS.wrap) },
      { key: "alignment", label: "Alignment", glyph: svg(BOX_GLYPHS.alignment) },
      { key: "gap", label: "Gap", glyph: svg(BOX_GLYPHS.gap) },
    ],
    grid: [
      { key: "columns", label: "Columns", glyph: svg(BOX_GLYPHS.columns) },
      { key: "rows", label: "Rows", glyph: svg(BOX_GLYPHS.rows) },
      { key: "columnGap", label: "Column gap", glyph: svg(BOX_GLYPHS.columnGap) },
      { key: "rowGap", label: "Row gap", glyph: svg(BOX_GLYPHS.rowGap) },
      { key: "alignment", label: "Alignment", glyph: svg(BOX_GLYPHS.alignment) },
    ],
    absolute: [
      { key: "bounds", label: "Top / Right / Bottom / Left", glyph: svg(BOX_GLYPHS.position) },
      { key: "width", label: "Width", glyph: svg(BOX_GLYPHS.width) },
      { key: "height", label: "Height", glyph: svg(BOX_GLYPHS.height) },
    ],
  };
  // The element the row was last built for, so a re-click on the same words keeps it.
  var rowFor = null;

  /** The controls on show: the seven (text only), plus whatever was added to this element. */
  function buildRow() {
    while (row.firstChild) row.removeChild(row.firstChild);
    // The element's own additions, in the order they were added to it. Read off
    // the change record rather than a global: the whole point of the `+` is that
    // the dock does not clutter, and a control added to one element has no
    // business sitting on every other one.
    (selected ? addedTo(selected) : []).forEach(function (key) {
      var item = ADD.filter(function (a) { return a.key === key; })[0];
      if (item) row.appendChild(button("ic", item.glyph, item.label, function () { toggle(key); }, key));
    });
    // Text keeps its type controls. Containers get the mode cycle followed by
    // exactly the controls listed for that mode.
    var definitions = selectedKind === "container" ? BOX_ICONS[mode()].slice() : BASE_ICONS;
    if (selectedKind === "container") {
      var currentMode = mode();
      row.appendChild(button(
        "ic",
        svg(MODE_GLYPHS[currentMode] || MODE_GLYPHS.stack),
        "Layout mode: " + (MODE_LABELS[currentMode] || "Stack"),
        function () { toggle("mode"); },
        "mode"
      ));
    }
    definitions.forEach(function (definition) {
      row.appendChild(button("ic", definition.glyph, definition.label, function () {
        toggle(definition.key);
      }, definition.key));
    });
    addBtn = button("ic add", svg('<path d="M9 3.5v11M3.5 9h11"/>'), "Add a control", function () {
      toggle("+");
    }, "+");
    row.appendChild(addBtn);
  }

  /** Which optional controls this element has been given, in the order added. */
  function addedTo(el) {
    var rec = record(el);
    return rec.added || [];
  }

  /** The row starts empty: buildRow() fills it for whichever element is selected. */
  buildRow();

  /**
   * The `+` at the end of the row: pick a control and it joins this element's
   * row, where it looks like it was always there.
   *
   * Appended last, and a control picked from it goes in before it, so adding one
   * grows the row leftwards from the button that added it — the icons already
   * there do not move under the pointer that just clicked.
   */
  function addOne() {
    // The list of what can be added, with the ones this element already has
    // gone: an icon that is there cannot be added twice.
    options(
      ADD.filter(function (item) { return !icon(item.key); })
          .map(function (item) { return { v: item.key, label: item.label, stack: "system-ui,sans-serif" }; }),
      "",
      function (key) {
        var item = ADD.filter(function (a) { return a.key === key; })[0];
        if (!item || !selected || icon(key)) return;
        // Recorded on the element, so this control belongs to this element and
        // comes back only for it.
        var rec = record(selected);
        rec.added = (rec.added || []).concat(key);
        buildRow();
        toggle(key); // straight into the control that was just picked
      }
    );
  }

  /** Show the dock for a text or container selection, and keep its control open
      across a re-click on the same element, which is the click that starts a drag. */
  function syncDock() {
    var on = (selectedKind === "text" || selectedKind === "container") && !!selected;
    dock.hidden = !on;
    // Rebuilt on every selection, because the row is the selected element's own
    // dock: the seven type controls, the `+`, and only what this element has been
    // given. Built here rather than in select() so a re-click on the same words,
    // which keeps the control open, does not throw the row away mid-drag.
    // Rebuilt whenever the selection moves to a different element, because the
    // row belongs to the element: its seven type controls, the `+`, and only
    // what this element has been given. Tracked by which element the row was
    // built for, so a re-click on the same words keeps the control that is open.
    if (on && rowFor !== selected) {
      buildRow();
      rowFor = selected;
    }
    if (!on) show("");
  }

  /* --------------------------------------------------------------- review */

  // Properties Edityy writes for its own sake, never as an edit: the focus ring
  // it hides on the words being typed into.
  var OWN = { outline: true };
  var SOURCE_ATTR = "data-edityy-src";

  /**
   * What one record really changed, or null.
   *
   * Compared with what was there before, not with whether a control was touched:
   * a slider dragged out and back is no edit, and listing it would send a coding
   * agent after a change that is not there.
   */
  function diff(rec) {
    var props = [];
    Object.keys(rec.props).forEach(function (prop) {
      if (OWN[prop]) return;
      var before = rec.set[prop] ? rec.props[prop] : "";
      var after = rec.el.style.getPropertyValue(prop);
      if (after === before) return;
      props.push({ prop: prop, before: rec.was[prop] || before, after: after });
    });
    var text = rec.text !== null && rec.el.textContent !== rec.text
      ? { before: rec.text, after: rec.el.textContent }
      : null;
    return props.length || text ? { props: props, text: text } : null;
  }

  /**
   * A CSS selector that finds this element again: its id, a test id, or the
   * tag path down from the nearest one, with :nth-of-type only where a tag has
   * siblings of the same name. Short on purpose — it is read by a person or an
   * agent searching the code, not only by querySelector.
   */
  function selectorFor(el) {
    var esc = window.CSS && window.CSS.escape
      ? window.CSS.escape
      : function (v) { return String(v).replace(/[^\w-]/g, "\\$&"); };
    var parts = [];
    var node = el;
    while (node && node.tagName && node !== document.body && node !== document.documentElement && parts.length < 8) {
      if (node.id) {
        parts.unshift("#" + esc(node.id));
        break;
      }
      var tag = node.tagName.toLowerCase();
      var testId = node.getAttribute && node.getAttribute("data-testid");
      if (testId) {
        parts.unshift(tag + '[data-testid="' + String(testId).replace(/"/g, '\\"') + '"]');
        break;
      }
      var parent = node.parentElement;
      if (parent && parent.children) {
        var same = 0;
        var index = 0;
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName !== node.tagName) continue;
          same++;
          if (parent.children[i] === node) index = same;
        }
        if (same > 1) tag += ":nth-of-type(" + index + ")";
      }
      parts.unshift(tag);
      node = parent;
    }
    return parts.join(" > ");
  }

  /**
   * Where the element was written, when the Vite plugin stamped it: its own
   * location, or the nearest ancestor's when it was made by a component.
   */
  function sourceOf(el) {
    for (var node = el; node && node.getAttribute; node = node.parentElement) {
      var at = node.getAttribute(SOURCE_ATTR);
      if (at) return { at: at, own: node === el };
    }
    return null;
  }

  /** Every edit, as plain data: what a person, an agent or a file can use. */
  function report() {
    var out = [];
    changes.forEach(function (rec) {
      var d = diff(rec);
      if (!d) return;
      var src = sourceOf(rec.el);
      out.push({
        label: nameOf(rec.el).trim(),
        selector: selectorFor(rec.el),
        source: src ? src.at : null,
        sourceIsOwn: src ? src.own : false,
        props: d.props,
        text: d.text,
        rec: rec,
      });
    });
    return out;
  }

  /** The same, as Markdown written for a coding agent to act on. */
  function markdown(items) {
    if (!items.length) return "";
    var page = window.location && window.location.href;
    var out = [
      "# Visual edits from Edityy",
      "",
      "Apply these edits to the source code" + (page ? " of " + page : "") + ". " +
        "Change the code that renders each element, in the styling approach the project already uses " +
        "(CSS, CSS modules, Tailwind classes, styled components), not with inline styles.",
      "",
    ];
    items.forEach(function (item, i) {
      out.push("## " + (i + 1) + ". " + item.label);
      out.push("");
      out.push("- Selector: `" + item.selector + "`");
      if (item.source) {
        out.push("- Source: `" + item.source + "`" + (item.sourceIsOwn ? "" : " (the nearest element with a known location)"));
      }
      item.props.forEach(function (c) {
        out.push("- `" + c.prop + "`: `" + (c.before || "unset") + "` → `" + (c.after || "unset") + "`");
      });
      if (item.text) out.push("- Text: " + JSON.stringify(item.text.before) + " → " + JSON.stringify(item.text.after));
      out.push("");
    });
    return out.join("\n");
  }

  /** Keep the number on the edits button in step with the edits. */
  function tally() {
    keep();
    var n = report().length;
    countBadge.hidden = !n;
    countBadge.textContent = n ? String(n) : "";
    // An open list shows the edits, so redraw it when they change. Do not redraw
    // it while the user types: a redraw on each key resets the scroll position of
    // the list.
    if (review.getAttribute("aria-expanded") === "true" && !editing) show("changes");
  }

  /**
   * The edits, one line per element: its name selects it, the arrow reverts it,
   * and one button copies them all for a coding agent.
   */
  function listChanges() {
    var items = report();
    var list = document.createElement("div");
    list.className = "list";
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "note";
      empty.appendChild(text("No edits yet. Change something on the page and it is listed here."));
      list.appendChild(empty);
    }
    items.forEach(function (item) {
      var line = document.createElement("div");
      line.className = "chg";
      var n = item.props.length + (item.text ? 1 : 0);
      var name = button("opt", "", "Select " + item.label, function () {
        var el = item.rec.el;
        select(el, { el: el, kind: kind(el) });
        show("changes");
      }, "");
      name.appendChild(text(item.label + " · " + n + (n === 1 ? " edit" : " edits")));
      var undo = button("ic", svg('<path d="M4 7h7a4 4 0 0 1 0 8H8M7 4 4 7l3 3"/>'), "Revert " + item.label, function () {
        if (item.rec.el === editing) stopEditing();
        revert(item.rec);
        // The row is this element's, and what it was given went with the revert.
        if (item.rec.el === selected) {
          rowFor = null;
          syncDock();
          refit();
        }
        show("changes");
      }, "");
      line.appendChild(name);
      line.appendChild(undo);
      list.appendChild(line);
    });
    pop.appendChild(list);

    var actions = document.createElement("div");
    actions.className = "bar2";
    var copy = button("cta", "", "Copy the edits as a prompt for a coding agent", function () {
      copyText(markdown(report()), function (ok) {
        copy.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(function () { copy.textContent = "Copy for an agent"; }, 1600);
      });
    }, "copy");
    copy.appendChild(text("Copy for an agent"));
    copy.disabled = !items.length;
    actions.appendChild(copy);
    pop.appendChild(actions);
  }

  /** Put a string on the clipboard, by the API where there is one. */
  function copyText(value, done) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(value).then(
        function () { done(true); },
        function () { done(copyByHand(value)); }
      );
      return;
    }
    done(copyByHand(value));
  }

  /** The old way, for a page without the clipboard API (plain http, older browsers). */
  function copyByHand(value) {
    try {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;left:-9999px;top:0";
      pop.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      pop.removeChild(area);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  review.addEventListener("click", function () {
    show(review.getAttribute("aria-expanded") === "true" ? "" : "changes");
  });

  /** The edits as Markdown, for scripts and for anything that wants them. */
  window.__edityy_changes = function () {
    return markdown(report());
  };

  /* -------------------------------------------------------------- session */

  // A reload or a hot update throws the page away and every inline style with
  // it. The edits are kept in sessionStorage, per path, while the mode is on,
  // and put back when the payload mounts again. Storage can be missing or throw
  // (a private window, blocked site data), so every touch is guarded and the
  // editor works the same without it — it just forgets on reload.
  function storeKey() {
    var path = window.location && window.location.pathname;
    return "edityy:" + (path || "/");
  }

  function storage() {
    try {
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  }

  /** Save the mode and its edits, or forget them once the mode is off. */
  function keep() {
    var store = storage();
    if (!store) return;
    try {
      if (!active) {
        store.removeItem(storeKey());
        return;
      }
      var edits = [];
      changes.forEach(function (rec) {
        var props = {};
        var any = false;
        Object.keys(rec.props).forEach(function (prop) {
          if (OWN[prop]) return;
          props[prop] = {
            before: rec.props[prop],
            set: rec.set[prop],
            was: rec.was[prop],
            now: rec.el.style.getPropertyValue(prop),
          };
          any = true;
        });
        var text = rec.text !== null && rec.el.textContent !== rec.text ? { before: rec.text, after: rec.el.textContent } : null;
        if (!any && !text && !(rec.added && rec.added.length)) return;
        edits.push({ selector: selectorFor(rec.el), props: props, text: text, added: rec.added || [] });
      });
      store.setItem(storeKey(), JSON.stringify({ v: 1, edits: edits }));
    } catch (e) {
      /* full or blocked: the edits still work, they just do not survive a reload */
    }
  }

  /**
   * Put a saved session back: the edits on the elements they were made to, and
   * the mode on. An element that is no longer on the page takes its edits with it.
   */
  function resume() {
    var store = storage();
    var saved = null;
    try {
      saved = store && JSON.parse(store.getItem(storeKey()) || "null");
    } catch (e) {
      saved = null;
    }
    if (!saved || saved.v !== 1 || !Array.isArray(saved.edits)) return;
    saved.edits.forEach(function (edit) {
      var el = null;
      try {
        el = document.querySelector ? document.querySelector(edit.selector) : null;
      } catch (e) {
        el = null; // a selector the page no longer parses the same way
      }
      if (!el || host.contains && host.contains(el)) return;
      var rec = record(el);
      Object.keys(edit.props || {}).forEach(function (prop) {
        var p = edit.props[prop];
        rec.props[prop] = p.before;
        rec.set[prop] = !!p.set;
        rec.was[prop] = p.was;
        if (p.now) el.style.setProperty(prop, p.now);
        else el.style.removeProperty(prop);
      });
      // Text only where it is still one run of words: anything else would
      // destroy elements a framework has rendered inside it since.
      if (edit.text && isLeafText(el) && el.textContent === edit.text.before) {
        rec.text = edit.text.before;
        el.textContent = edit.text.after;
      }
      if (edit.added && edit.added.length) rec.added = edit.added.slice();
    });
    enter();
    tally(); // the count on the edits button, for the edits just put back
  }

  /* ----------------------------------------------------------------- mode */

  /** Park the orb's centre, the single origin every pointer transform is from. */
  function anchor() {
    var box = launch.getBoundingClientRect();
    anchorX = box.left + box.width / 2;
    anchorY = box.top + box.height / 2;
  }

  /**
   * The orb and the pointer are one element with one transform.
   *
   * `scale()` is the whole of the state: at 1 it is the orb in its corner, at
   * POINT it is the dot under the pointer. CSS transitions between the two, so
   * clicking the orb is what starts the shrink and the travel together.
   */
  function moveTo(sx, sy) {
    launch.style.transform =
      "translate(" + (sx - anchorX) + "px," + (sy - anchorY) + "px) scale(" + (active ? POINT : 1) + ")";
  }

  function enter() {
    active = true;
    keep();
    anchor();
    // Scale from the orb before it travels, so the shrink reads as the beginning
    // of the morph rather than a jump.
    moveTo(anchorX, anchorY);
    label.style.opacity = "0";
    // The button is no longer a button: the pointer takes over, and a click that
    // lands on the dot must reach the page below it.
    launch.style.pointerEvents = "none";
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    // input, not keydown: keydown fires before the browser has changed the
    // words, so measuring there catches the element as it was. This one fires
    // after, which is when the frame has to be re-measured.
    document.addEventListener("input", onEdit, true);
    // The frames are viewport-fixed like everything else, so a scroll moves the
    // element out from under them and they must go with it.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", refit, true);
  }

  function exit() {
    active = false;
    // Travel home and grow back into the orb in one transition.
    moveTo(anchorX, anchorY);
    label.style.opacity = "";
    launch.style.pointerEvents = "";
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("input", onEdit, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", refit, true);
    // Nothing to revert today — no UI writes styles yet — but the backend is
    // here and exiting must always put the page back exactly as it was.
    stopEditing();
    changes.slice().forEach(revert);
    history = [];
    future = [];
    select(null);
    hideHover();
    keep(); // the mode is off: nothing to bring back on the next load
  }

  /** The hover frame is only meaningful while the pointer is still on it. */
  function hideHover() {
    hoverBox.hidden = true;
  }

  /**
   * The page scrolled: the frames are fixed to the viewport, so the element has
   * moved and the selection frame has to move with it. The hover frame is
   * dropped instead, because where the pointer now is has nothing to do with
   * what it was over a moment ago.
   */
  /**
   * The words changed while they were being edited — typed, pasted, deleted.
   *
   * The frame is a fixed box drawn at the last measured size, so a line added
   * leaves the box a line too short and a deletion leaves it too tall. Measured
   * on the next tick, because the browser reflows the element after this event.
   */
  function onEdit() {
    typedAt = Date.now();
    if (editing) setTimeout(refit, 0);
    tally();
  }

  function onScroll() {
    refit();
    hideHover();
  }
  /**
   * Put the selection frame back where the element now is.
   *
   * One place, called from everything that can move the element: a scroll (the
   * frame is viewport-fixed, so the element slides out from under it), a resize,
   * a change this session made, and a keystroke. Typing is the case that is easy
   * to miss — the text grows or shrinks, the box does not, and the frame ends up
   * around words that are no longer there.
   */
  function refit() {
    if (selected) place(selBox, selected.getBoundingClientRect());
  }
  function onMove(e) {
    // The orb follows the pointer with no lag: a dot that trails is a dot the
    // user aims past. The one place the shadow root takes a real listener, since
    // the page's own mousemove never has to fire.
    launch.style.transform =
      "translate(" + (e.clientX - anchorX) + "px," + (e.clientY - anchorY) + "px) scale(" + POINT + ")";
    var el = textAt(e.clientX, e.clientY);
    if (!el) {
      hideHover();
      return;
    }
    place(hoverBox, el.getBoundingClientRect());
    hoverBox.hidden = false;
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

  /** Escape backs out one level: the open control first, then the mode. */
  function onKey(e) {
    if (e.key === "Escape") {
      if (!pop.hidden) show("");
      else exit();
      return;
    }
    // ⌘Z / Ctrl+Z undoes, ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y redoes.
    var mod = e.metaKey || e.ctrlKey;
    var k = String(e.key || "").toLowerCase();
    var isUndo = mod && k === "z" && !e.shiftKey;
    var isRedo = mod && ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey && !e.metaKey));
    if (!isUndo && !isRedo) return;
    // Typed words are the browser's to undo: it keeps the caret and the text
    // history, which a style undo knows nothing about. So while the caret is in
    // words typed into since the last drag, the key goes to the browser.
    var top = isUndo ? history[history.length - 1] : future[future.length - 1];
    if (editing && (!top || typedAt > top.at)) return;
    if (isUndo ? undo() : redo()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  launch.addEventListener("click", function (e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    if (active) exit();
    else enter();
  });

  (document.body || document.documentElement).appendChild(host);

  // Not now, and not at load either: a framework hydrating the page compares its
  // own markup with the DOM, and an edit put back before it is done is a
  // mismatch it reports (React does, and keeps going after load). An idle
  // callback runs once the page's scheduled work has drained, which is after
  // hydration; the timeout keeps a busy page from never getting its edits back.
  var settle = function () {
    if (window.requestIdleCallback) window.requestIdleCallback(resume, { timeout: 3000 });
    else setTimeout(resume, 300);
  };
  if (document.readyState === "complete") setTimeout(settle, 0);
  else if (window.addEventListener) window.addEventListener("load", function () { setTimeout(settle, 0); });
})();