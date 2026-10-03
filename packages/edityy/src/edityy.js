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

  root.innerHTML = [
    "<style>",
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:system-ui,sans-serif;color:#111}",
    "[hidden]{display:none}", // a shadow root has no UA stylesheet, so `hidden` is ours to honour
    "#launch{position:fixed;right:24px;bottom:24px;width:56px;height:56px;",
    "border-radius:50%;border:0;margin:0;padding:0;cursor:pointer;pointer-events:auto;z-index:3;",
    "display:grid;place-items:center;font:600 15px/1 system-ui,sans-serif;",
    "background:#b7efb2;box-shadow:0 6px 24px #1113}",
    "#launch:hover{opacity:.9}",
    "#launch:focus-visible{outline:2px solid #111;outline-offset:3px}",
    "#launch[aria-pressed=true]{background:#111;color:#b7efb2}",
    ".box{position:fixed;pointer-events:none;border-radius:2px;display:none;z-index:1}",
    "#hover{border:1px dashed #1118;background:#b7efb22e}",
    "#sel{border:2px solid #111;background:transparent}",
    "#panel{position:fixed;pointer-events:auto;z-index:2;width:270px;max-height:calc(100vh - 24px);",
    "overflow:auto;padding:12px;border:1px solid #111000;border-radius:12px;background:#fbfaf9;",
    "box-shadow:0 12px 40px #1112;font-size:12px}",
    ".head{display:flex;align-items:center;gap:8px;margin-bottom:10px}",
    "#target{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}",
    "#done{border:1px solid #111;border-radius:6px;background:#111;color:#fff;padding:4px 8px;cursor:pointer}",
    "label{display:block;margin-top:8px;font-weight:500;color:#5e5c5a}",
    "textarea,input,select{display:block;width:100%;margin-top:4px;padding:5px 6px;font:inherit;",
    "color:#111;border:1px solid #11100026;border-radius:6px;background:#fff}",
    "textarea{resize:vertical}",
    "input[type=range]{padding:0}",
    "input[type=color]{height:26px;padding:2px}",
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}",
    "#changes{margin-top:12px;border-top:1px solid #11100026;padding-top:8px}",
    "#changes summary{cursor:pointer;font-weight:600}",
    "#list{margin:8px 0 0;padding:0;list-style:none}",
    "#list li{display:flex;align-items:center;gap:6px;padding:3px 0}",
    "#list span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5e5c5a}",
    "#list button{border:1px solid #11100026;border-radius:6px;background:#fff;padding:2px 6px;cursor:pointer}",
    "#revertAll{width:100%;margin-top:8px;border:1px solid #111;border-radius:6px;background:#ffef99;padding:5px;cursor:pointer}",
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy" aria-pressed="false">Edityy</button>',
    '<div class="box" id="hover"></div>',
    '<div class="box" id="sel"></div>',
    '<div id="panel" hidden>',
    '<div class="head"><span id="target"></span><button type="button" id="done" title="Exit edit mode (Esc)">Done</button></div>',
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
  var hoverBox = $("hover");
  var selBox = $("sel");
  var panel = $("panel");

  // The font stacks a machine already has. No webfonts: the editor must not
  // change what the page loads, only what it looks like.
  var FONTS = [
    ["System UI", "system-ui, sans-serif"],
    ["Sans", "Arial, Helvetica, sans-serif"],
    ["Serif", "Georgia, 'Times New Roman', serif"],
    ["Monospace", "ui-monospace, SFMono-Regular, Menlo, monospace"],
    ["Humanist", "'Trebuchet MS', Tahoma, sans-serif"],
    ["Rounded", "ui-rounded, 'Hiragino Maru Gothic ProN', Quicksand, sans-serif"],
    ["Garamond", "Garamond, Baskerville, serif"],
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
    var family = value("font-family");
    $("fFamily").value = FONTS.filter(function (f) {
      return f[1] === family;
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

  function place(el, rect) {
    el.style.left = rect.left + "px";
    el.style.top = rect.top + "px";
    el.style.width = rect.width + "px";
    el.style.height = rect.height + "px";
  }

  /** Park the panel beside the selection, inside the viewport. */
  function positionPanel() {
    if (!selected) return;
    var rect = selected.getBoundingClientRect();
    place(selBox, rect);
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

  function select(el) {
    selected = el;
    $("target").textContent = el ? label(el) : "";
    panel.hidden = !el;
    if (!el) {
      selBox.style.display = "none";
      return;
    }
    selBox.style.display = "block";
    fillControls(el);
    positionPanel();
  }

  /* ----------------------------------------------------------------- mode */

  function enter() {
    active = true;
    launch.setAttribute("aria-pressed", "true");
    launch.title = "Exit edit mode (Esc)";
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", positionPanel, true);
    window.addEventListener("resize", positionPanel, true);
  }

  function exit() {
    active = false;
    launch.setAttribute("aria-pressed", "false");
    launch.title = "Edityy launcher";
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", positionPanel, true);
    window.removeEventListener("resize", positionPanel, true);
    changes.slice().forEach(revert);
    select(null);
    hoverBox.style.display = "none";
  }

  function onMove(e) {
    var el = textAt(e.clientX, e.clientY);
    if (!el) {
      hoverBox.style.display = "none";
      return;
    }
    place(hoverBox, el.getBoundingClientRect());
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