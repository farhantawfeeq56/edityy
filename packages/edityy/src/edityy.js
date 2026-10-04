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
 *    That is the whole interface for now — selection with no panel attached.
 *    `kind()` classifies what was picked as text, container or media before
 *    anything else happens, and `root.selection()` reports it.
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
    // `all:initial` severs inheritance, so the payload names a font itself. It must
    // not name the host's: this package runs on other people's codebases, and a
    // face invented here would not match the site being edited. The machine own
    // UI face dresses the chrome instead — the controls are Edityy's, not the page's.
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;color:#3a283c}",
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
    ".ic svg{width:18px;height:18px;display:block}",
    // Type controls are their own glyphs: a letterform says "this is about type"
    // faster than any abstract mark could.
    ".g{font-size:15px;font-weight:600;line-height:1;pointer-events:none}",
    ".g.serif{font-family:Georgia,\"Times New Roman\",serif;font-weight:400;font-size:16px}",
    ".g.heavy{font-weight:800}",
    ".g.thin{font-size:13px}",
    ".pop{min-width:200px;padding:8px;background:#f9f2ee;border:1px solid #3a283c1a;",
    // Above the dock, not under it: the dock never moves, but the page does, and
    // a control that opens downward gets swallowed by the viewport.
    "border-radius:12px;box-shadow:0 1px 1px #3a283c14,0 10px 24px #3a283c1f;",
    "animation:popIn .16s ease-out}",
    "@keyframes popIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
    ".list{display:flex;flex-direction:column;gap:1px;max-height:216px;overflow-y:auto}",
    // One row per option: a face shows itself, an alignment shows its own lines.
    ".opt{display:block;width:100%;text-align:left;border:0;border-radius:8px;padding:7px 10px;",
    "background:transparent;color:#3a283c;font:500 14px/1.2 inherit;cursor:pointer;",
    "transition:background .12s ease,color .12s ease}",
    ".opt:hover{background:#3a283c0f}",
    ".opt[aria-pressed=true]{background:#3a283c;color:#f9f2ee}",
    ".opts{display:flex;gap:2px;padding:2px}",
    ".bar2{display:flex;align-items:center;gap:10px;padding:6px}",
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
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy"><span id="label">Edityy</span></button>',
    '<div class="frame" id="hover" hidden></div>',
    '<div class="frame" id="sel" hidden></div>',
    "<div id=\"dock\" hidden>",
    '<div class="pop" id="pop" hidden></div>',
    '<div class="row" id="row"></div>',
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
    var rec = { el: el, props: {}, set: {}, text: null };
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
    if (!(prop in rec.props)) {
      rec.props[prop] = selected.style.getPropertyValue(prop);
      rec.set[prop] = new RegExp("(?:^|;)\\s*" + prop + "\\s*:").test(selected.style.cssText);
    }
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
      // Put back exactly what was there: the value, or nothing at all if the
      // property had never been set on this element.
      if (rec.set[prop] && rec.props[prop]) rec.el.style.setProperty(prop, rec.props[prop]);
      else rec.el.style.removeProperty(prop);
    });
    if (rec.text !== null) rec.el.textContent = rec.text;
    changes = changes.filter(function (other) {
      return other !== rec;
    });
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

  /** Draw the selection frame. There is no panel to place, so this is all a
      selection does for now: the frame is the whole visible result. */
  function select(el, hit) {
    selected = el;
    // The kind comes from the pick, because a form control is text by way of the
    // walk rather than by way of `kind()`: it has no text node of its own.
    selectedKind = el && hit ? hit.kind : null;
    if (!el) {
      selBox.hidden = true;
      syncDock();
      return;
    }
    selBox.hidden = false;
    place(selBox, el.getBoundingClientRect(), el);
    syncDock();
  }

  // What is selected, and what it was classified as. Nothing reads this yet —
  // there is no panel — but it is the seam any UI starts from, so it stays.
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
    // Each control is as wide as it needs to be. The shared min-width is only a
    // floor: a list of faces is wide, a row of four icons is not, and stretching
    // a slider to the width of the widest control just leaves dead space.
    pop.style.minWidth = "";
    pop.style.width = "";
    ICONS.forEach(function (icon) {
      var b = row.children[ICONS.indexOf(icon)];
      b.setAttribute("aria-expanded", icon.key === key ? "true" : "false");
    });
    if (!key) {
      pop.hidden = true;
      return;
    }
    pop.hidden = false;
    CONTROLS[key]();
  }

  /** The options a single control can choose from, with a tick on the current one. */
  function options(items, current, onPick, label) {
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
        onPick(value);
        mark(value);
      }, value);
      // The label is added rather than passed in, because a face name is text and
      // text is a node — there is no markup to parse it out of.
      b.appendChild(text(label(item)));
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
        if (rows[j].getAttribute("aria-pressed") !== null) {
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
function icons(items, current, onPick) {
    var list = document.createElement("div");
    list.className = "opts";
    var rows = items.map(function (item) {
      var b = button("ic", svg(item.icon), item.label || item.v, function () {
        // Stays open like every other control: these are things you try twice,
        // and the tick moves so you can see which one is on.
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
      onInput(input.value);
    });
    row.appendChild(input);
    row.appendChild(out);
    pop.appendChild(row);
  }

  /** A number field, for size and tracking. */
  function number(min, max, step, current, unit, onInput) {
    var row = document.createElement("div");
    row.className = "bar2";
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
      onInput(v);
    });
    row.appendChild(input);
    row.appendChild(out);
    pop.appendChild(row);
  }

  /** Everything the payload writes goes through here, so nothing is ever lost. */
  function set(prop, value) {
    if (!selected) return;
    apply(prop, value);
    place(selBox, selected.getBoundingClientRect());
  }

  var CONTROLS = {
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

/** The dock itself: seven icons, and only one control open at a time. */
  ICONS.forEach(function (icon) {
    row.appendChild(
      button("ic", icon.glyph, icon.label, function () {
        // One open control at a time. Clicking the icon of the control that is
        // already open closes it; clicking any other replaces what was open.
        var open = pop.children[0] && row.children[ICONS.indexOf(icon)].getAttribute("aria-expanded") === "true";
        show(open ? "" : icon.key);
      }, icon.key)
    );
  });

  /** Show the dock only for a text selection, and keep its control open across a
      re-click on the same words, which is the click that starts a drag. */
  function syncDock() {
    var on = selectedKind === "text";
    dock.hidden = !on;
    if (!on) show("");
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
    // The frames are viewport-fixed like everything else, so a scroll moves the
    // element out from under them and they must go with it.
    window.addEventListener("scroll", hideHover, true);
    window.addEventListener("resize", onResize, true);
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
    hoverBox.hidden = true;
  }

  /** A resize can reflow the selection out from under its frame. */
  function onResize() {
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
    }
  }

  launch.addEventListener("click", function (e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    if (active) exit();
    else enter();
  });

  (document.body || document.documentElement).appendChild(host);
})();