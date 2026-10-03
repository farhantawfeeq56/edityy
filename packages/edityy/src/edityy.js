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
    '<textarea id="fText" rows="2" spellcheck="false"></textarea>',
    '<div class="grid">',
    '<label>Font<select id="fFamily"></select></label>',
    '<label>Size (px)<input id="fSize" type="number" min="6" max="200" step="1"></label>',
    '<label>Weight<select id="fWeight"></select></label>',
    '<label>Line height<input id="fLine" type="number" min="0.5" max="4" step="0.05"></label>',
    '<label>Tracking (px)<input id="fSpacing" type="number" min="-8" max="20" step="0.1"></label>',
    '<label>Align<select id="fAlign"></select></label>',
    '<label>Case<select id="fTransform"></select></label>',
    '<label>Decoration<select id="fDecoration"></select></label>',
    '<label>Colour<input id="fColor" type="color"></label>',
    "</div>",
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
  var WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
  var ALIGNS = [["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]];
  var CASES = [
    ["none", "As typed"],
    ["uppercase", "UPPERCASE"],
    ["lowercase", "lowercase"],
    ["capitalize", "Capitalize Each Word"],
  ];
  var DECORATIONS = [
    ["none", "None"],
    ["underline", "Underline"],
    ["line-through", "Line through"],
    ["overline", "Overline"],
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
  fill($("fFamily"), FONTS);
  fill($("fWeight"), WEIGHTS.map(function (w) { return [w, w]; }));
  fill($("fAlign"), ALIGNS);
  fill($("fTransform"), CASES);
  fill($("fDecoration"), DECORATIONS);

  // Every control maps to one CSS longhand, so applying a value and recording
  // what was there before are the same code path.
  var CONTROLS = [
    ["fFamily", "font-family"],
    ["fSize", "font-size"],
    ["fWeight", "font-weight"],
    ["fLine", "line-height"],
    ["fSpacing", "letter-spacing"],
    ["fAlign", "text-align"],
    ["fTransform", "text-transform"],
    ["fDecoration", "text-decoration"],
    ["fColor", "color"],
  ];
  CONTROLS.forEach(function (pair) {
    var input = $(pair[0]);
    // Every control listens for the same event. `input` is the one that fires
    // while a number is being typed into and while a colour is being dragged.
    input.addEventListener("input", function () {
      if (selected) apply(pair[1], input.value ? withUnit(pair[1], input.value) : "");
    });
  });
  $("fText").addEventListener("input", function (e) {
    if (selected) setText(selected, e.target.value);
  });
  $("done").addEventListener("click", exit);
  $("revertAll").addEventListener("click", function () {
    changes.slice().forEach(revert);
  });

  /** The two lengths the panel takes as bare pixels; everything else is a keyword. */
  function withUnit(prop, value) {
    return prop === "font-size" || prop === "letter-spacing" ? value + "px" : value;
  }

  var active = false;
  var selected = null;
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
  function textAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body && el !== document.documentElement) {
      if (hasOwnText(el)) return el;
      el = el.parentElement;
    }
    return null;
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
    var value = function (prop) {
      return (cs ? cs.getPropertyValue(prop) : "") || el.style.getPropertyValue(prop);
    };
    var family = value("font-family").replace(/["']/g, "").replace(/\s+/g, " ").trim();
    // Matched on the leading family, not the whole stack: a resolved stack never
    // equals its source, and `var()` never resolves at all. `var()` is skipped
    // when reading the list, because it is a reference, not a family name.
    var first = family.split(",")[0].trim().toLowerCase();
    $("fFamily").value = FONTS.filter(function (f) {
      var lead = f[1].split(",").map(function (part) {
        return part.trim();
      }).filter(function (part) {
        return !part.startsWith("var(");
      })[0];
      return lead.replace(/["']/g, "").toLowerCase() === first;
    })[0]?.[0] ?? "";
    $("fSize").value = parseFloat(value("font-size")) || "";
    $("fWeight").value = value("font-weight").split(" ")[0];
    $("fLine").value = parseFloat(value("line-height")) / (parseFloat(value("font-size")) || 1) || "";
    $("fSpacing").value = parseFloat(value("letter-spacing")) || "";
    $("fAlign").value = value("text-align");
    $("fTransform").value = value("text-transform");
    $("fDecoration").value = value("text-decoration-line");
    var hex = toHex(value("color"));
    if (hex) $("fColor").value = hex;
    var field = $("fText");
    field.value = el.textContent;
    // Only a leaf can be rewritten wholesale; replacing the text of an element
    // that holds markup would delete it.
    field.disabled = !isLeafText(el);
    field.title = field.disabled ? "This element holds markup — pick a plain text element" : "";
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