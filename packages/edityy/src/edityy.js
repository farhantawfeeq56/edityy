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
    // `all:initial` severs inheritance, so the payload names the site's own font
    // itself. --font-sans is the app's stack (Plus Jakarta Sans first); the bare
    // family name covers a host that has the font without the token.
    "*{box-sizing:border-box;font-family:var(--font-sans,\"Plus Jakarta Sans\",ui-sans-serif,system-ui,sans-serif);color:#3a283c}",
    "[hidden]{display:none}", // a shadow root has no UA stylesheet, so `hidden` is ours to honour
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
    // A frame drawn around an element, fully transparent: only its bars and lines
    // are painted, so the element underneath is never covered or tinted.
    ".frame{position:fixed;pointer-events:none;z-index:1}",
    "[hidden]{display:none!important}", // also for .frame: display:block would beat it
    // Stroke weight of every piece: 2px, so the accent bars read as the dominant
    // layer exactly as a design tool's outline does.
    ".line{position:absolute;height:2px;background:#000}",
    ".bar{position:absolute;height:2px;border-radius:2px;background:#d79eac}",
    "@media (prefers-reduced-motion:reduce){#launch,#label{transition:none}}",
    "</style>",
    '<button type="button" id="launch" title="Edityy launcher" aria-label="Open Edityy"><span id="label">Edityy</span></button>',
    '<div class="frame" id="hover" hidden></div>',
    '<div class="frame" id="sel" hidden></div>',
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

  // The box drawn around an element. It stands off the element by 4px on every
  // side, so the frame is unmistakably Edityy's and not the page's own edge.
  //
  // It is a stack of small divs rather than one styled border, because the whole
  // look is in how each edge is split: accent bars at each end and the middle,
  // with a solid black line filling the gaps between them and stopping short of
  // each bar, so there is clear space between the two colours. Sixteen divs do
  // that in a dozen lines; a border-image would be more code for the same
  // picture.
  var GAP = 4;
  // Accent bars are 16px, which is what turns a bar at a corner into an L. An
  // element narrower than that simply has no gap to fill and keeps one short bar
  // per edge — the right answer, not a degenerate one — so the pattern never
  // depends on the size of what it is drawn around.
  var BAR = 16;
  // Where each accent bar sits along its edge, as a fraction of its own length
  // between the two end bars: flush left, centred, flush right.
  var SPOTS = [0, 0.5, 1];
  // The four edges, and which way each one runs. Their children are built in this
  // order — the gap line first, the three bars over it — so the bars land on top.
  var SIDES = [["top", true], ["left", false], ["bottom", true], ["right", false]];

  /** Build the bars of one frame. Two frames, one shape — they cannot drift. */
  function build(frame) {
    SIDES.forEach(function (side) {
      var line = document.createElement("i");
      // One element per edge, filling the gap between the two end bars. Black,
      // because this line has to read on any surface the host page puts behind
      // it; the accent bars are what carry the design.
      line.className = "line";
      frame.appendChild(line);
      SPOTS.forEach(function () {
        var bar = document.createElement("i");
        bar.className = "bar";
        frame.appendChild(bar);
      });
    });
  }

  /** Pin one frame to a target's rectangle. */
  function place(frame, rect) {
    var box = {
      left: rect.left - GAP,
      top: rect.top - GAP,
      width: rect.width + GAP * 2,
      height: rect.height + GAP * 2,
    };
    SIDES.forEach(function (side, s) {
      var horizontal = side[1];
      // How far along the box this edge runs, and where across it sits: the top
      // and left edges start at the box origin, the bottom and right ones at the
      // far end of it.
      var across = horizontal ? box.width : box.height;
      var depth = horizontal ? box.height : box.width;
      var origin = horizontal ? box.left : box.top;
      var cross =
        (horizontal ? box.top : box.left) + (side[0] === "top" || side[0] === "left" ? 0 : depth);
      var line = frame.children[s * 4];
      // Only the gap between the two end bars: it stops short of each one, and
      // that space is what keeps the accent and the black from reading as a
      // single line. Zero when the edge is too short to have a gap at all.
      var gap = Math.max(0, across - BAR * 2);
      if (horizontal) {
        line.style.left = origin + BAR + "px";
        line.style.top = cross + "px";
        line.style.width = gap + "px";
      } else {
        line.style.left = cross + "px";
        line.style.top = origin + BAR + "px";
        line.style.height = gap + "px";
      }
      SPOTS.forEach(function (spot, i) {
        var bar = frame.children[s * 4 + 1 + i];
        var offset = origin + (across - BAR) * spot;
        if (horizontal) {
          bar.style.left = offset + "px";
          bar.style.top = cross + "px";
          bar.style.width = BAR + "px";
        } else {
          bar.style.left = cross + "px";
          bar.style.top = offset + "px";
          bar.style.height = BAR + "px";
        }
      });
    });
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
      return;
    }
    selBox.hidden = false;
    place(selBox, el.getBoundingClientRect(), el);
  }

  // What is selected, and what it was classified as. Nothing reads this yet —
  // there is no panel — but it is the seam any UI starts from, so it stays.
  root.selection = function () {
    return selected ? { el: selected, kind: selectedKind } : null;
  };

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

  function onKey(e) {
    if (e.key === "Escape") exit();
  }

  launch.addEventListener("click", function (e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    if (active) exit();
    else enter();
  });

  // Both frames are built the same way, once, at mount — a gap line and three
  // accent bars per edge. Last, because it needs everything above defined.
  build(hoverBox);
  build(selBox);

  (document.body || document.documentElement).appendChild(host);
})();