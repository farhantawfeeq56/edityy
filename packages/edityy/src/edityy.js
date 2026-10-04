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
    "backdrop-filter:blur(8px);box-shadow:0 1px 1px #3a283c14,0 6px 12px #3a283c1f;font-size:14px;",
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
    /* The inspector: dense, icon-led, one compact line per control. A labelled
       row per property ("Width: [ ]") spends a whole line on what a single glyph
       already says, and forty of them become a scroll. Here the glyph IS the
       label, the control sits beside it, and related controls share a line. */
    "#panel{width:236px}",
    ".sec{margin-top:8px}",
    ".sec:first-child{margin-top:0}",
    ".secHead{display:flex;align-items:center;gap:6px;margin-bottom:5px}",
    ".secHead>b{font:600 14px/1 inherit;letter-spacing:.04em;text-transform:uppercase;color:#86546b}",
    ".tog{margin-left:auto;border:1px solid #3a283c26;border-radius:8px;background:transparent;",
    "color:#86546b;padding:4px 8px;font:500 14px/1.2 inherit;cursor:pointer}",
    ".tog[aria-pressed=true]{background:#d79eac33;color:#3a283c}",
    ".line{display:flex;align-items:center;gap:8px;margin-bottom:2px}",
    /* The glyph carries the meaning, so the caption is a tooltip not a label. */
    ".ic{flex:0 0 16px;text-align:center;font:600 14px/1 inherit;color:#86546b}",
    ".nm{flex:0 0 auto;font:500 14px/1 inherit;color:#86546b}",
    ".line>input,.line>select{flex:1;min-width:0;margin:0;padding:4px 6px;font-size:14px;border-radius:8px}",
    ".line>input[type=color]{flex:0 0 36px;height:26px;padding:2px}",
    "input.big{font:600 14px/1 inherit}",
    ".quad,.pair{display:grid;gap:4px;flex:1;min-width:0}",
    ".quad{grid-template-columns:repeat(4,1fr)}",
    ".pair{grid-template-columns:1fr 1fr}",
    ".quad>input,.pair>input{margin:0;padding:4px;font-size:14px;border-radius:8px;text-align:center}",
    /* Segmented control: the choices are visible rather than behind a dropdown,
       and the glyph is the label. */
    ".seg{display:flex;flex:1;min-width:0;gap:2px;border:1px solid #3a283c1a;border-radius:8px;padding:2px;background:#f9f2ee}",
    ".seg>button{flex:1;min-width:0;border:0;border-radius:4px;background:transparent;color:#3a283c;",
    "padding:4px 0;font:500 14px/1 inherit;cursor:pointer;overflow:hidden;text-overflow:clip;white-space:nowrap}",
    ".seg>button:hover{background:#3a283c0f}",
    ".seg>button[aria-checked=true]{background:#3a283c;color:#f9f2ee}",
    /* Additive appearance: quiet until asked for. Having the capability does not
       mean it has to occupy attention all the time. */
    ".addLine{display:flex;align-items:center;gap:8px;margin-bottom:2px}",
    ".plus{flex:0 0 20px;width:20px;height:20px;border:1px solid #3a283c26;border-radius:8px;",
    "background:transparent;color:#86546b;font:600 14px/1 inherit;cursor:pointer;padding:0}",
    ".plus:hover{background:#d79eac33;color:#3a283c}",
    ".addLine>span{font:500 14px/1 inherit;color:#86546b}",
    "#pane>textarea{width:100%;margin:0 0 4px;font-size:14px;resize:vertical}",
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
    '<div id="pane"></div>',
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

  // A control is one of:
  //   { p, k, o?, s?, px?, min?, max?, step?, ph?, icon?, name?, only?, when?, add?, seg?, big? }
  //
  //   k      text | number | color | select | quad | pair | textarea
  //   s      the longhands a quad/pair maps to, in order
  //   only   the section appears only when this holds for the selection. No
  //          control at all is offered when it does not.
  //   when   the control hides unless this holds
  //   add    additive: behind a + until switched on
  //   seg    render as a segmented control rather than a select
  //
  // Three kinds, three schemas. An element is classified before the panel is
  // built, so an <img> is never offered padding, gap or flex direction.
  var SIZE = [
    { p: "width", k: "text", icon: "W" },
    { p: "height", k: "text", icon: "H" },
  ];
  var APPEARANCE = [
    { p: "background", k: "color", add: 1, icon: "□", name: "Fill" },
    { p: "background-image", k: "text", add: 1, icon: "▧", name: "Image", when: always, ph: "url(...) / gradient(...)" },
    { p: "border", k: "text", add: 1, icon: "▬", name: "Outline", ph: "1px solid #3a283c" },
    { p: "box-shadow", k: "text", add: 1, icon: "◑", name: "Shadow", ph: "0 1px 2px #3a283c1f" },
    { p: "backdrop-filter", k: "text", add: 1, icon: "▒", name: "Blur", ph: "blur(8px)" },
    { p: "opacity", k: "number", add: 1, min: 0, max: 1, step: 0.01, icon: "◐", name: "Opacity" },
  ];
  var RADIUS = {
    p: "border-radius",
    k: "quad",
    s: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
    add: 1,
    icon: "◜",
    name: "Radius",
  };
  var CLAMPS = [
    { p: "min-width", k: "text", icon: "W⇒", when: clamps },
    { p: "max-width", k: "text", icon: "W⇐", when: clamps },
    { p: "min-height", k: "text", icon: "H⇓", when: clamps },
    { p: "max-height", k: "text", icon: "H⇑", when: clamps },
  ];

  var SCHEMAS = {
    text: [
      {
        label: "Typography",
        rows: [
          { p: "font-family", k: "select", o: FONTS },
          { p: "font-size", k: "number", px: 1, icon: "Aa", big: 1 },
          { p: "font-weight", k: "select", o: ENUMS.weight, seg: 1 },
          { p: "line-height", k: "number", icon: "↕" },
          { p: "letter-spacing", k: "number", px: 1, icon: "↔" },
          { p: "text-align", k: "select", o: [["left", "⇤"], ["center", "↔"], ["right", "⇥"], ["justify", "☰"]], seg: 1 },
          { p: "text-transform", k: "select", o: [["none", "aa"], ["uppercase", "AA"], ["lowercase", "aa"], ["capitalize", "Aa"]], seg: 1 },
          { p: "text-decoration", k: "select", o: [["none", "—"], ["underline", "U̲"], ["line-through", "S̶"], ["overline", "̅"]], seg: 1 },
        ],
      },
      { label: "Content", rows: [{ p: "@text", k: "textarea" }] },
      { label: "Appearance", additive: true, rows: [{ p: "color", k: "color", add: 1, icon: "A", name: "Colour" }].concat(APPEARANCE, [RADIUS]) },
    ],
    container: [
      {
        label: "Size",
        rows: SIZE.concat(CLAMPS),
        // Clamps are off by default: four boxes nobody needs is noise, and no
        // switch to turn them on would make them unreachable on a plain div.
        toggle: { id: "clamps", name: "Min / max", props: ["min-width", "max-width", "min-height", "max-height"] },
      },
      { label: "Layout", rows: [{ p: "display", k: "select", o: ENUMS.display, seg: 1 }] },
      {
        label: "Flex",
        only: isFlex,
        rows: [
          { p: "flex-direction", k: "select", o: [["row", "↔"], ["row-reverse", "↖"], ["column", "↕"], ["column-reverse", "↗"]], seg: 1 },
          { p: "flex-wrap", k: "select", o: [["nowrap", "⇅"], ["wrap", "↩"]], seg: 1 },
          { p: "justify-content", k: "select", o: [["flex-start", "◤"], ["center", "◆"], ["flex-end", "◥"], ["space-between", "⇹"], ["space-around", "⇔"]], seg: 1 },
          { p: "align-items", k: "select", o: [["flex-start", "↑"], ["center", "↕"], ["flex-end", "↓"], ["stretch", "⤢"]], seg: 1 },
        ],
      },
      {
        label: "Grid",
        only: isGrid,
        rows: [
          { p: "grid-template-columns", k: "text", icon: "⇉" },
          { p: "grid-template-rows", k: "text", icon: "⇊" },
          { p: "grid-auto-flow", k: "select", o: [["row", "↔"], ["column", "↕"], ["row dense", "↔+"], ["column dense", "↕+"]], seg: 1 },
          { p: "grid-column", k: "text", icon: "⊞" },
          { p: "grid-row", k: "text", icon: "⊟" },
        ],
      },
      {
        label: "Spacing",
        rows: [
          { p: "padding", k: "quad", s: ["padding-top", "padding-right", "padding-bottom", "padding-left"], icon: "▣" },
          { p: "gap", k: "pair", s: ["row-gap", "column-gap"], icon: "⇸" },
        ],
      },
      { label: "Appearance", additive: true, rows: APPEARANCE.concat([RADIUS]) },
    ],
    media: [
      { label: "Size", rows: SIZE },
      {
        label: "Media",
        rows: [
          { p: "object-fit", k: "select", o: [["cover", "■"], ["contain", "▫"], ["fill", "□"], ["none", "▭"], ["scale-down", "▬"]], seg: 1 },
          { p: "object-position", k: "select", o: [["center", "⊙"], ["top", "↑"], ["bottom", "↓"], ["left", "←"], ["right", "→"]], seg: 1 },
        ],
      },
      { label: "Appearance", additive: true, rows: APPEARANCE.concat([RADIUS]) },
    ],
  };

  // Predicates the schema leans on. Each reads the selection's own computed
  // style, so they answer "is this element actually a flex container" rather
  // than "did someone set a flex property on it".
  function mode() {
    return computedOf(selected, "display") || "";
  }
  function isFlex() {
    return /flex/.test(mode());
  }
  function isGrid() {
    return /grid/.test(mode());
  }
  function always() {
    return true; // an additive control is offered, but stays behind its +
  }
  function clamps() {
    return !!on["clamps"];
  }

  /** Every input, by the property it drives. fillControls reads from this. */
  var inputs = {};
  root.inputs = inputs; // the panel's own registry, readable for debugging
  // What the current selection is, for whatever consumes it next. The UI does
  // not branch on this yet; it is here so the classification is inspectable
  // rather than locked inside the click handler.
  root.selection = function () {
    return selected ? { el: selected, kind: selectedKind } : null;
  };

  // Switch state for the panel's toggles, reset per selection so a section never
  // opens on one element and stays open on the next.
  var on = {};

  /** One input, wired to apply(). Registered by property for fillControls. */
  function field(row, prop, placeholder) {
    var input;
    if (row.k === "select") {
      input = document.createElement("select");
      fill(input, typeof row.o[0] === "string" ? row.o.map(function (v) { return [v, v]; }) : row.o);
    } else {
      input = document.createElement("input");
      input.type = row.k === "color" ? "color" : row.k === "number" ? "number" : "text";
      if (row.k === "number") {
        if (row.min !== undefined) input.min = row.min;
        if (row.max !== undefined) input.max = row.max;
        input.step = row.step ?? 1;
      }
    }
    if (placeholder) input.placeholder = placeholder;
    if (row.big) input.className = "big";
    input.title = prop;
    input.kind = "text";
    inputs[prop] = input;
    input.addEventListener("input", function () {
      if (selected) apply(prop, input.value ? units(row, prop, input.value) : "");
    });
    return input;
  }

  /** Bare numbers are pixels for lengths; ratios are unitless. */
  function units(row, prop, value) {
    if (row.k !== "number") return value;
    // Line height is the one number that is a ratio, and the panel shows it that
    // way whatever the stylesheet stores.
    if (prop === "line-height") return String(value);
    return row.px ? value + "px" : value;
  }

  /**
   * A segmented control: a row of small buttons instead of a select.
   *
   * A select hides its options behind a dropdown and spends a whole labelled row
   * to say what it is. A segmented control shows the choices, costs one line, and
   * the glyph is the label — which is why the schema carries symbols like ↔ and
   * ↕ instead of "justify-content".
   */
  function segmented(row, prop) {
    var group = document.createElement("div");
    group.className = "seg";
    group.title = prop;
    var buttons = [];
    row.o.forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = pair[1];
      btn.title = pair[0];
      btn.setAttribute("aria-label", prop + ": " + pair[0]);
      btn.addEventListener("click", function () {
        if (!selected) return;
        apply(prop, pair[0]);
        buttons.forEach(function (b) {
          b.setAttribute("aria-checked", String(b === btn));
        });
      });
      buttons.push(btn);
      group.appendChild(btn);
    });
    // A way back to unset. Without it the choice is one-way and there is no way
    // to hand the property back to the stylesheet — which every other control has.
    var reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "×";
    reset.title = "";
    reset.setAttribute("aria-label", prop + ": unset");
    reset.addEventListener("click", function () {
      if (!selected) return;
      apply(prop, "");
      buttons.concat(reset).forEach(function (b) {
        b.setAttribute("aria-checked", String(b === reset));
      });
    });
    group.appendChild(reset);
    group.reset = reset;
    group.kind = "seg";
    inputs[prop] = group;
    return group;
  }

  /** A shorthand row: an icon and four boxes, in one compact line. */
  function boxes(row) {
    var group = document.createElement("div");
    group.className = row.k === "quad" ? "quad" : "pair";
    row.s.forEach(function (side) {
      var input = document.createElement("input");
      input.type = "text";
      input.title = side;
      input.placeholder = side.split("-")[1].slice(0, 3);
      inputs[side] = input;
      input.addEventListener("input", function () {
        if (selected) apply(side, input.value);
      });
      group.appendChild(input);
    });
    return group;
  }

  /** An icon button that switches a group on. */
  function plus(row) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plus";
    btn.textContent = row.icon || "+";
    btn.title = "Add " + (row.name || row.p);
    btn.setAttribute("aria-label", "Add " + (row.name || row.p));
    btn.addEventListener("click", function () {
      on[row.p] = true;
      renderPanel();
    });
    return btn;
  }

  /** One control, in whichever form its schema row asks for. */
  function control(row) {
    if (row.k === "quad" || row.k === "pair") return boxes(row);
    if (row.k === "textarea") {
      var ta = document.createElement("textarea");
      ta.rows = 2;
      ta.spellcheck = false;
      ta.title = "Content";
      ta.kind = "text";
      inputs["@text"] = ta;
      ta.addEventListener("input", function () {
        if (selected && selectedKind === "text") setText(selected, ta.value);
      });
      return ta;
    }
    if (row.seg) return segmented(row, row.p);
    return field(row, row.p, row.ph);
  }

  /**
   * The panel for the current selection, built fresh each time.
   *
   * Rebuilt rather than hidden and shown, because the sections themselves depend
   * on the element: a flex group on something that is not flex should not exist
   * in the tree at all.
   */
  function renderPanel() {
    var host = $("pane");
    host.textContent = "";
    var sections = SCHEMAS[selectedKind] || SCHEMAS.container;
    sections.forEach(function (section) {
      // "must come only when needed": no control, no offer, no empty section.
      if (section.only && !section.only()) return;
      var rows = section.rows.filter(function (row) {
        return !row.when || row.when();
      });
      if (!rows.length) return;
      host.appendChild(sectionEl(section, rows));
    });
    fillControls(selected);
  }

  function sectionEl(section, rows) {
    var el = document.createElement("section");
    el.className = "sec";

    var head = document.createElement("div");
    head.className = "secHead";
    var title = document.createElement("b");
    title.textContent = section.label;
    head.appendChild(title);

    if (section.toggle) {
      var t = document.createElement("button");
      t.type = "button";
      t.className = "tog";
      t.textContent = section.toggle.name;
      t.title = "Show " + section.toggle.name;
      var paint = function () {
        t.setAttribute("aria-pressed", String(!!on[section.toggle.id]));
      };
      paint();
      t.addEventListener("click", function () {
        on[section.toggle.id] = !on[section.toggle.id];
        paint();
        renderPanel();
      });
      head.appendChild(t);
    }
    el.appendChild(head);

    rows.forEach(function (row) {
      // "must come only when added": a quiet + until the user asks for it.
      if (row.add && !on[row.p]) {
        var line = document.createElement("div");
        line.className = "addLine";
        line.appendChild(plus(row));
        var nm = document.createElement("span");
        nm.textContent = row.name || row.p;
        line.appendChild(nm);
        el.appendChild(line);
        return;
      }
      var line = document.createElement("div");
      line.className = "line";
      if (row.icon) {
        var ic = document.createElement("span");
        ic.className = "ic";
        ic.textContent = row.icon;
        ic.title = row.name || row.p;
        line.appendChild(ic);
      }
      if (row.name && row.icon) {
        var nm2 = document.createElement("span");
        nm2.className = "nm";
        nm2.textContent = row.name;
        line.appendChild(nm2);
      }
      line.appendChild(control(row));
      el.appendChild(line);
    });
    return el;
  }


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
    // One pass over the registry, not a line per control: the schema already
    // knows which property each input belongs to.
    Object.keys(inputs).forEach(function (prop) {
      var input = inputs[prop];
      if (input.kind === "seg") {
        var raw = computedOf(el, prop);
        // The reset button represents "not set here", so it reads as checked when
        // the property has no inline value to show.
        var inline = el.style.getPropertyValue(prop);
        Array.prototype.forEach.call(input.children, function (btn) {
          btn.setAttribute("aria-checked", String(btn === input.reset ? !inline : !input.reset && btn.title === raw));
        });
        return;
      }
      if (prop === "@text") {
        input.value = selectedKind === "media" ? "" : el.textContent;
        // Only a text element can be rewritten, and only a leaf one: replacing
        // the text of an element that holds markup would delete it. A container
        // has no text of its own, and media has none at all.
        input.disabled = selectedKind !== "text" || !isLeafText(el);
        input.title =
          selectedKind === "media"
            ? "Media has no text to edit"
            : selectedKind === "container"
              ? "A container has no text of its own — click the words inside it"
              : input.disabled
                ? "This element holds markup — pick a plain text element"
                : "";
        return;
      }
      if (input.kind === "text") {
        var val = computedOf(el, prop);
        // Colours arrive as rgb() or hsl() from getComputedStyle; the swatch only
        // understands #rrggbb, so anything else leaves the swatch alone.
        if (input.type === "color") {
          var hex = toHex(val);
          if (hex) input.value = hex;
          return;
        }
        input.value = val === "none" && input.tagName === "SELECT" ? "" : val;
        return;
      }
      input.value = computedOf(el, prop); // a quad/pair side
    });
    // Font family is the one property the generic pass gets wrong: a resolved
    // stack never equals its source and `var()` never resolves, so the choice is
    // matched on the leading family name instead.
    var family = computedOf(el, "font-family").replace(/["\x27]/g, "").replace(/\s+/g, " ").trim();
    var first = family.split(",")[0].trim().toLowerCase();
    var font = inputs["font-family"];
    if (font && font.kind === "text") {
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
      var size = parseFloat(computedOf(el, "font-size"));
      var line = parseFloat(computedOf(el, "line-height"));
      if (line && size) lh.value = Math.round((line / size) * 100) / 100;
    }
  }

  /** The selection's computed value for a property, falling back to its inline. */
  function computedOf(el, prop) {
    if (!el) return "";
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return (cs ? cs.getPropertyValue(prop) : "") || el.style.getPropertyValue(prop) || "";
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

  function select(el, hit) {
    selected = el;
    // The kind comes from the pick, because a form control is text by way of the
    // walk rather than by way of `kind()`: it has no text node of its own.
    selectedKind = el && hit ? hit.kind : null;
    $("target").textContent = el ? label(el) : "";
    panel.hidden = !el;
    if (!el) {
      selBox.style.display = "none";
      return;
    }
    selBox.style.display = "block";
    dragged = false; // a fresh selection parks beside itself again
    on = {}; // switches are per selection: nothing carries over to the next element
    renderPanel();
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