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
 * 2. A temporary editing mode. Hover outlines any element that has text of its
 *    own, click selects it, and a panel next to the selection edits its text and
 *    its typography. Every change is applied inline to the live element and
 *    recorded as a proposal: the panel lists them, each can be reverted, and
 *    leaving the mode reverts everything.
 *
 * Nothing is written anywhere. The codebase is the source of truth; this file
 * only changes the page in memory, until a reload.
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
  // A full-viewport host that ignores pointer events: the panel and the boxes can
  // grow over the site without ever coming between the user and the page.
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
    // family name covers a host that has the font without the token, and the
    // rest keeps the panel readable anywhere.
    "*{box-sizing:border-box;font-family:var(--font-sans,\"Plus Jakarta Sans\",ui-sans-serif,system-ui,sans-serif);color:#3a283c}",
    "[hidden]{display:none}", // a shadow root has no UA stylesheet, so `hidden` is ours to honour
    // Or `#launch` while the mode is off. Hidden once it is on: a custom cursor
  // takes over, and DESIGN.md wants controls to have no footprint until needed.
  "#launch{position:fixed;right:24px;bottom:24px;width:56px;height:56px;",
    "border-radius:50%;border:0;margin:0;padding:0;cursor:pointer;pointer-events:auto;z-index:3;",
    "display:grid;place-items:center;font:600 15px/1 inherit;color:#f9f2ee;",
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
    "#panel{position:fixed;pointer-events:auto;z-index:5;width:270px;max-height:calc(100vh - 24px);",
    "overflow:auto;padding:12px;border:1px solid #3a283c1a;border-radius:16px;background:#f9f2eecc;",
    "backdrop-filter:blur(8px);box-shadow:0 1px 1px #3a283c14,0 6px 12px #3a283c1f;font-size:12px;",
    // The scale-and-fade DESIGN.md's interaction model asks for on entry.
    "animation:rise .16s cubic-bezier(.2,.8,.3,1)}",
    "@keyframes rise{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:none}}",
    "@media (prefers-reduced-motion:reduce){#panel{animation:none}#cursor{transition:none}}",
    ".head{display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:grab;touch-action:none}",
    ".head:active{cursor:grabbing}",
    "#target{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}",
    "#done{border:1px solid #3a283c;border-radius:8px;background:#3a283c;color:#f9f2ee;padding:4px 8px;cursor:pointer}",
    "label{display:block;margin-top:8px;font-weight:500;color:#86546b}",
    "textarea,input,select{display:block;width:100%;margin-top:4px;padding:5px 6px;font:inherit;",
    "color:#3a283c;border:1px solid #3a283c26;border-radius:8px;background:#f9f2ee}",
    "textarea{resize:vertical}",
    "input[type=range]{padding:0}",
    "input[type=color]{height:26px;padding:2px}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}",
    /* Tabs: one visible surface at a time, so a section that isn't open costs
       nothing. This is DESIGN.md's "unrevealed controls have no footprint". */
    "#tabs{display:flex;gap:4px;margin:0 0 10px;border-bottom:1px solid #3a283c1a}",
    "#tabs button{flex:1;border:0;border-radius:8px 8px 0 0;background:transparent;color:#86546b;",
    "padding:5px 0;font:500 11px/1.2 inherit;cursor:pointer}",
    "#tabs button[aria-selected=true]{background:#d79eac33;color:#3a283c}",
    "#pane-text hr{border:0;border-top:1px solid #3a283c1a;margin:10px 0 0}",
    /* Shorthand rows: one property, four fields. Empty means "leave it alone", so
       `margin: 8px` needs one box filled, not four. */
    ".row{margin-top:8px}",
    ".row>b{display:block;font-weight:500;color:#86546b;margin-bottom:3px}",
    ".quad{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}",
    ".pair{display:grid;grid-template-columns:1fr 1fr;gap:4px}",
    "input[type=text]{padding:4px 5px;font:inherit;font-size:11px}",
    "details.sec{margin-top:6px;border:1px solid #3a283c1a;border-radius:8px;background:#3a283c08}",
    "details.sec>summary{cursor:pointer;padding:6px 8px;font-weight:500;border-radius:8px}",
    "#changes{margin-top:12px;border-top:1px solid #3a283c1a;padding-top:8px}",
    "#changes summary{cursor:pointer;font-weight:600}",
    "#list{margin:8px 0 0;padding:0;list-style:none}",
    "#list li{display:flex;align-items:center;gap:6px;padding:3px 0}",
    "#list span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#86546b}",
    "#list button{border:1px solid #3a283c26;border-radius:8px;background:#f9f2ee;padding:2px 6px;cursor:pointer}",
    "#revertAll{width:100%;margin-top:8px;border:1px solid #3a283c;border-radius:8px;background:#ecc5c9;padding:5px;cursor:pointer}",
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy">Edityy</button>',
    '<div id="cursor" hidden></div>',
    '<div class="box" id="hover"></div>',
    '<div class="box" id="sel"></div>',
    '<div id="panel" hidden>',
    '<div class="head" id="grip" title="Drag to move"><span id="target"></span><button type="button" id="done" title="Exit edit mode (Esc)">Done</button></div>',
    '<nav id="tabs"></nav>',
    '<section id="pane-text">',
    '<textarea id="fText" rows="2" spellcheck="false"></textarea>',
    '<div class="grid" id="typeGrid"></div>',
    "</section>",
    '<section id="pane-box" hidden></section>',
    '<details id="changes"><summary>Changes (<span id="count">0</span>)</summary>',
    '<ul id="list"></ul><button type="button" id="revertAll">Revert all changes</button></details>',
    "</div>",
  ].join("");

  var $ = function (id) {
    return root.getElementById(id);
  };
  var launch = $("launch");
  var cursor = $("cursor");
  var hoverBox = $("hover");
  var selBox = $("sel");
  var panel = $("panel");

  // The font stacks a machine already has. No webfonts: the editor must not
  // change what the page loads, only what it looks like. The first entry is the
  // site's own face, taken from the app's own token wherever it sets one.
  var FONTS = [
    ["Plus Jakarta Sans", "var(--font-sans), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"],
    ["System UI", "system-ui, sans-serif"],
    ["Arial", "Arial, Helvetica, sans-serif"],
    ["Georgia", "Georgia, 'Times New Roman', serif"],
    ["Monospace", "ui-monospace, SFMono-Regular, Menlo, monospace"],
    ["Trebuchet MS", "'Trebuchet MS', Tahoma, sans-serif"],
    ["Quicksand", "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, sans-serif"],
    ["Baskerville", "Baskerville, Garamond, serif"],
    ["Impact", "Impact, Haettenschweiler, sans-serif"],
  ];

  /** Fill a select from [value, label] pairs, with a blank first option. */
  function fill(select, pairs) {
    select.innerHTML = '<option value=""></option>';
    pairs.forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
  }

  /* ------------------------------------------------------------- the panel */

  // Every control in the panel, in one table. A row is a CSS property and the
  // widgets to drive it; building the UI from this is what keeps a 40-property
  // inspector from becoming 40 hand-written inputs. `apply()` already handles
  // every one of them, so a new property is one line here and nothing else.
  //
  // kind: text | number | color | select | check | shadow | gradient
  // sides: for shorthands, which longhands the boxes map to, in order.
  var ENUMS = {
    display: ["block", "inline", "inline-block", "flex", "inline-flex", "grid", "inline-grid", "flow-root", "contents", "none"],
    position: ["static", "relative", "absolute", "fixed", "sticky"],
    overflow: ["visible", "hidden", "scroll", "auto", "clip"],
    direction: ["ltr", "rtl"],
    wrap: ["nowrap", "wrap", "wrap-reverse"],
    justify: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly", "stretch", "start", "end", "normal", "baseline"],
    align: ["flex-start", "center", "flex-end", "stretch", "baseline", "start", "end", "normal", "self-start", "self-end"],
    weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    blend: ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"],
    timing: ["ease", "ease-in", "ease-out", "ease-in-out", "linear", "step-start", "step-end"],
  };

  var SCHEMA = [
    { id: "text", label: "Text", rows: [
      { p: "font-family", k: "select", o: FONTS },
      { p: "font-size", k: "number", px: 1 },
      { p: "font-weight", k: "select", o: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] },
      { p: "line-height", k: "number" },
      { p: "letter-spacing", k: "number", px: 1 },
      { p: "text-align", k: "select", o: [["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]] },
      { p: "text-transform", k: "select", o: [["none", "As typed"], ["uppercase", "UPPERCASE"], ["lowercase", "lowercase"], ["capitalize", "Capitalize"]] },
      { p: "text-decoration", k: "select", o: [["none", "None"], ["underline", "Underline"], ["line-through", "Line through"], ["overline", "Overline"]] },
      { p: "color", k: "color" },
    ] },
    { id: "layout", label: "Layout", rows: [
      { p: "width", k: "text" }, { p: "height", k: "text" },
      { p: "min-width", k: "text" }, { p: "min-height", k: "text" },
      { p: "max-width", k: "text" }, { p: "max-height", k: "text" },
      { p: "display", k: "select", o: ENUMS.display },
      { p: "position", k: "select", o: ENUMS.position },
      { p: "z-index", k: "number" },
      { p: "overflow", k: "select", o: ENUMS.overflow },
    ] },
    { id: "spacing", label: "Spacing", rows: [
      { p: "margin", k: "quad", s: ["margin-top", "margin-right", "margin-bottom", "margin-left"] },
      { p: "padding", k: "quad", s: ["padding-top", "padding-right", "padding-bottom", "padding-left"] },
      { p: "gap", k: "pair", s: ["row-gap", "column-gap"] },
    ] },
    { id: "flex", label: "Flex & grid", rows: [
      { p: "flex-direction", k: "select", o: [["row", "row"], ["row-reverse", "row-reverse"], ["column", "column"], ["column-reverse", "column-reverse"]] },
      { p: "flex-wrap", k: "select", o: ENUMS.wrap },
      { p: "justify-content", k: "select", o: ENUMS.justify },
      { p: "align-items", k: "select", o: ENUMS.align },
      { p: "align-content", k: "select", o: ENUMS.justify },
      { p: "flex-grow", k: "number" }, { p: "flex-shrink", k: "number" },
      { p: "flex-basis", k: "text" }, { p: "order", k: "number" },
      { p: "grid-template-columns", k: "text" }, { p: "grid-template-rows", k: "text" },
      { p: "grid-auto-flow", k: "select", o: [["row", "row"], ["column", "column"], ["row dense", "row dense"], ["column dense", "column dense"]] },
      { p: "grid-column", k: "text" }, { p: "grid-row", k: "text" },
      { p: "place-items", k: "text" }, { p: "place-content", k: "text" },
    ] },
    { id: "appearance", label: "Appearance", rows: [
      { p: "background", k: "color" },
      { p: "background-image", k: "text", ph: "url(...) or linear-gradient(...)" },
      { p: "background-size", k: "select", o: [["", ""], ["cover", "cover"], ["contain", "contain"], ["auto", "auto"]] },
      { p: "background-position", k: "text" }, { p: "background-repeat", k: "select", o: [["no-repeat", "no-repeat"], ["repeat", "repeat"], ["repeat-x", "repeat-x"], ["repeat-y", "repeat-y"]] },
      { p: "background-blend-mode", k: "select", o: ENUMS.blend },
      { p: "border", k: "text", ph: "1px solid ..." },
      { p: "border-radius", k: "quad", s: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"] },
      { p: "box-shadow", k: "shadow" },
      { p: "opacity", k: "number", min: 0, max: 1, step: 0.01 },
      { p: "backdrop-filter", k: "text", ph: "blur(8px)" },
      { p: "filter", k: "text", ph: "blur(2px)" },
    ] },
    { id: "effects", label: "Effects", rows: [
      { p: "transform", k: "text" },
      { p: "rotate", k: "text" }, { p: "scale", k: "text" }, { p: "translate", k: "text" },
      { p: "transform-origin", k: "text" },
      { p: "transition", k: "text" },
      { p: "transition-duration", k: "number", px: 1 },
      { p: "transition-timing-function", k: "select", o: ENUMS.timing },
      { p: "animation", k: "text" },
      { p: "animation-duration", k: "number", px: 1 },
      { p: "animation-timing-function", k: "select", o: ENUMS.timing },
    ] },
  ];

  /** Every input, by the property it drives. fillControls reads from this. */
  var inputs = {};
  root.inputs = inputs; // the panel's own registry, readable for debugging

  /** One input, wired to apply(). Built once, never rebuilt. */
  function field(row, prop, placeholder) {
    var input;
    if (row.k === "select") {
      input = document.createElement("select");
      fill(input, typeof row.o[0] === "string" ? row.o.map(function (v) { return [v, v]; }) : row.o);
    } else {
      input = document.createElement("input");
      input.type = row.k === "check" ? "checkbox" : row.k === "color" ? "color" : row.k === "number" ? "number" : "text";
      if (row.k === "number") {
        if (row.min !== undefined) input.min = row.min;
        if (row.max !== undefined) input.max = row.max;
        input.step = row.step ?? 1;
      }
    }
    if (placeholder) input.placeholder = placeholder;
    input.title = prop;
    inputs[prop] = input;
    input.addEventListener("input", function () {
      if (selected) apply(prop, input.value ? units(row, prop, input.value) : "");
    });
    return input;
  }

  /** Bare numbers are pixels for lengths; ratios and z-index are unitless. */
  function units(row, prop, value) {
    if (row.k !== "number") return value;
    // Line height is the one number that is a ratio, and the panel shows it that
    // way whatever the stylesheet stores.
    if (prop === "line-height") return String(value);
    return row.px ? value + "px" : value;
  }

  /** A labelled row: one property, one or four boxes. */
  function buildRow(row) {
    var wrap = document.createElement("div");
    wrap.className = "row";
    var caption = document.createElement("b");
    caption.textContent = row.p;
    wrap.appendChild(caption);

    if (row.k === "quad" || row.k === "pair") {
      var grid = document.createElement("div");
      grid.className = row.k === "quad" ? "quad" : "pair";
      row.s.forEach(function (side) {
        var input = field({ k: "text" }, side, "");
        input.placeholder = side.split("-")[1].slice(0, 3);
        grid.appendChild(input);
      });
      wrap.appendChild(grid);
      return wrap;
    }

    wrap.appendChild(field(row, row.p, row.ph));
    return wrap;
  }

  /** The whole inspector, from SCHEMA. Sections start closed. */
  function buildPanel() {
    var tabs = $("tabs");
    SCHEMA.forEach(function (section, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = section.label;
      tab.setAttribute("aria-selected", String(i === 0));
      tab.addEventListener("click", function () {
        showSection(section.id);
      });
      tabs.appendChild(tab);
    });

    $("pane-text").appendChild(document.createElement("hr"));
    var grid = $("typeGrid");
    // The first section's rows live on the always-visible text pane; the rest
    // live in a details element per section, so an unopened one costs nothing.
    SCHEMA.forEach(function (section) {
      var host = section.id === "text" ? grid : sectionHost(section);
      section.rows.forEach(function (row) {
        host.appendChild(buildRow(row));
      });
    });
  }

  function sectionHost(section) {
    var details = document.createElement("details");
    details.className = "sec";
    details.setAttribute("data-section", section.id);
    var summary = document.createElement("summary");
    summary.textContent = section.label;
    details.appendChild(summary);
    $("pane-box").appendChild(details);
    return details;
  }

  function showSection(id) {
    Array.prototype.forEach.call($("tabs").children, function (tab, i) {
      tab.setAttribute("aria-selected", String(SCHEMA[i].id === id));
    });
    $("pane-text").hidden = id !== "text";
    $("pane-box").hidden = id === "text";
    if (id === "text") return;
    // Exactly one section open: the one being looked at. Closing it is what makes
    // the panel stay small no matter how many properties it holds.
    Array.prototype.forEach.call($("pane-box").children, function (details) {
      details.open = details.getAttribute("data-section") === id;
    });
  }

  buildPanel();
  showSection("text"); // Text opens first; every other section stays collapsed

  // Every control maps to one CSS longhand, so applying a value and recording
  // what was there before are the same code path. Typed controls get their units
  // from their schema row, not from a hardcoded list that would grow forever.
  $("fText").addEventListener("input", function (e) {
    // Guarded on the classification, not on the field being disabled: a
    // container or a media element never gets its text rewritten, however the
    // event arrived.
    if (selected && selectedKind === "text") setText(selected, e.target.value);
  });
  $("done").addEventListener("click", exit);
  $("revertAll").addEventListener("click", function () {
    changes.slice().forEach(revert);
  });

  var active = false;
  var selected = null;
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

  /** The nearest ancestor-or-self of the point that holds its own text. */
  /**
   * The element under the pointer, preferring one with text.
   *
   * Text wins because that is what a click means in a text editor. With no text
   * anywhere, the raw target is returned so containers stay styleable — an
   * element inspector that could only reach text would not be one. The elements
   * that make up Edityy's own chrome are never returned.
   */
  /**
 * What kind of thing is this element? Three buckets, nothing else.
 *
 * Decided before anything is selected, because the three need different handling
 * and guessing later is how a media element ends up with a text cursor in it.
 *
 *   media     — it *is* the media: img, svg, video, canvas, and the host it loads
 *   text      — it holds words of its own
 *   container — everything else: structure, layout, components
 *
 * Order matters. An <img alt="..."> is media, not text: the alt is a
 * description of the media, not copy anyone can edit.
 */
  function kind(el) {
    if (!el) return null;
    var tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "video" || tag === "audio" || tag === "canvas" || tag === "picture") {
      return "media";
    }
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

  /** A short, human way to name an element in the changes list. */
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

  function apply(prop, value) {
    var rec = record(selected);
    if (!(prop in rec.props)) rec.props[prop] = selected.style.getPropertyValue(prop);
    if (value) selected.style.setProperty(prop, value);
    else selected.style.removeProperty(prop); // back to the stylesheet's value
    render();
  }

  function setText(el, value) {
    var rec = record(el);
    if (rec.text === null) rec.text = el.textContent;
    el.textContent = value;
    render();
  }

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
    if (selected === rec.el) fillControls(selected);
    render();
  }

  /* ---------------------------------------------------------------- panel */

  function render() {
    $("count").textContent = changes.length;
    var list = $("list");
    list.textContent = "";
    changes.forEach(function (rec) {
      var item = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = label(rec.el);
      name.title = name.textContent;
      var undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Revert";
      undo.addEventListener("click", function () {
        revert(rec);
      });
      item.appendChild(name);
      item.appendChild(undo);
      list.appendChild(item);
    });
    positionPanel(); // the list just changed the panel's height
  }

  /** Show the selection's current values, so the panel reads as its state. */
  function fillControls(el) {
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    var computed = function (prop) {
      return (cs ? cs.getPropertyValue(prop) : "") || el.style.getPropertyValue(prop);
    };
    // One pass over the table, not a hand-written line per control: the schema
    // already knows which property each input belongs to.
    Object.keys(inputs).forEach(function (prop) {
      var input = inputs[prop];
      var raw = computed(prop);
      // Colours arrive as rgb() or hsl() from getComputedStyle; the swatch only
      // understands #rrggbb, so anything else leaves the swatch alone.
      if (input.type === "color") {
        var hex = toHex(raw);
        if (hex) input.value = hex;
        return;
      }
      input.value = raw === "none" && input.tagName === "SELECT" ? "" : raw;
    });
    // Font family is the one property the generic pass gets wrong: a resolved
    // stack never equals its source and `var()` never resolves, so the choice is
    // matched on the leading family name instead.
    var family = computed("font-family").replace(/["\x27]/g, "").replace(/\s+/g, " ").trim();
    var first = family.split(",")[0].trim().toLowerCase();
    var font = inputs["font-family"];
    if (font) {
      font.value = FONTS.filter(function (f) {
        return f[1].split(",").map(function (part) {
          return part.trim();
        }).filter(function (part) {
          return !part.startsWith("var(");
        })[0].replace(/["\x27]/g, "").toLowerCase() === first;
      })[0]?.[0] ?? "";
    }
    // Line height reads as a number because that is how anyone thinks of it; the
    // stylesheet stores it unitless or as a length.
    var lh = inputs["line-height"];
    if (lh) {
      var size = parseFloat(computed("font-size"));
      var line = parseFloat(computed("line-height"));
      if (line && size) lh.value = Math.round((line / size) * 100) / 100;
    }
    var field = $("fText");
    field.value = selectedKind === "media" ? "" : el.textContent;
    // Only a text element can be rewritten, and only a leaf one: replacing the
    // text of an element that holds markup would delete it. A container has no
    // text of its own to replace, and media has none at all.
    field.disabled = selectedKind !== "text" || !isLeafText(el);
    field.title =
      selectedKind === "media"
        ? "Media has no text to edit"
        : selectedKind === "container"
          ? "A container has no text of its own — click the words inside it"
          : isLeafText(el)
            ? ""
            : "This element holds markup — pick a plain text element";
  }

  /** #rgb or #rrggbb as #rrggbb, or nothing when it is not a plain colour. */
  function toHex(color) {
    var rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map(function (n) {
      return (+n).toString(16).padStart(2, "0");
    }).join("");
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
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

  var dragged = false; // the panel has been moved by hand; stop re-parking it

  /** Park the panel beside the selection, inside the viewport. */
  function positionPanel() {
    if (!selected) return;
    var rect = selected.getBoundingClientRect();
    place(selBox, rect, selected);
    if (dragged) return;
    var w = panel.offsetWidth || 270;
    var h = panel.offsetHeight || 300;
    var left = rect.right + 12;
    if (left + w > window.innerWidth - 12) left = rect.left - w - 12;
    if (left < 12) left = 12;
    var top = rect.top;
    if (top + h > window.innerHeight - 12) top = Math.max(12, window.innerHeight - 12 - h);
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  }

  /* ------------------------------------------------------------------ drag */

  /** The panel travels wherever it is dropped, clamped to stay on screen. */
  var grip = $("grip");
  var drag = null;

  grip.addEventListener("pointerdown", function (e) {
    if (e.target === $("done")) return; // the button keeps its own click
    e.preventDefault();
    dragged = true;
    drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
    grip.setPointerCapture(e.pointerId);
  });

  root.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var w = panel.offsetWidth;
    var h = panel.offsetHeight;
    panel.style.left = Math.min(Math.max(12, e.clientX - drag.dx), Math.max(12, window.innerWidth - w - 12)) + "px";
    panel.style.top = Math.min(Math.max(12, e.clientY - drag.dy), Math.max(12, window.innerHeight - h - 12)) + "px";
  });

  root.addEventListener("pointerup", function () {
    drag = null;
  });

  function select(el) {
    selected = el;
    // Classified here, once, before any control is filled: the kind decides what
    // the panel offers and whether the text field is usable at all.
    selectedKind = el ? kind(el) : null;
    $("target").textContent = el ? label(el) : "";
    panel.hidden = !el;
    if (!el) {
      selBox.style.display = "none";
      return;
    }
    selBox.style.display = "block";
    dragged = false; // a fresh selection parks beside itself again
    fillControls(el);
    positionPanel();
  }

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
    window.addEventListener("resize", positionPanel, true);
  }

  function exit() {
    active = false;
    launch.hidden = false;
    cursor.hidden = true;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", hideHover, true);
    window.removeEventListener("resize", positionPanel, true);
    changes.slice().forEach(revert);
    select(null);
    hideHover();
  }

  /** The hover frame is only meaningful while the pointer is still on it. */
  function hideHover() {
    hoverBox.style.display = "none";
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
    // Our own panel is part of the editing UI: it keeps its clicks.
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    // Everything else is swallowed: a link must not navigate, and the page's own
    // handlers must not run against an element that is mid-edit.
    e.preventDefault();
    e.stopPropagation();
    select(textAt(e.clientX, e.clientY));
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