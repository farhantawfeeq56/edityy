// Checks for the payload this package ships (src/edityy.js). Run: npm test
//
// The script is plain browser JS with no imports, so it is run against a
// hand-rolled DOM stub instead of pulling in a browser or a DOM library.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");

/**
 * Just enough DOM for the payload: elements with attributes, classes, styles and
 * children, one shadow root keyed by id, document-level events and viewport
 * hit-testing. `hover(x, y)` is what the user pointing at the page does.
 */
function fakeDom() {
  const created = [];
  let hovered = null;

  /** What the browser would report: inline style wins, else the inherited map. */
  const computed = (el) => {
    const view = {
      getPropertyValue: (prop) => {
        const v = el.style.getPropertyValue(prop) || el.computed?.[prop] || (prop === "display" ? "block" : "");
        // A browser hands back the initial value of anything unset, and the
        // payload reads filters and shadows back: `filter: none` is what tells it
        // no filter is on, where "" says nothing at all.
        return v || (prop === "filter" || prop.startsWith("box-shadow") ? "none" : "");
      },
    };
    // The payload reads .fontFamily directly when it looks at the page own
    // typography, so it has to be there and not only behind getPropertyValue.
    Object.defineProperty(view, "fontFamily", {
      get: () => view.getPropertyValue("font-family"),
    });
    return view;
  };
  /** Listener buckets, keyed by phase: capture runs before bubble. */
  const bucket = (node, type, phase) => ((node.bubbles ??= {})[type] ??= {})[phase] ??= [];
  const bubble = (node, type) => bucket(node, type, "bubble");

  const el = (tag, attrs = {}, style = {}) => {
    const node = {
    tagName: tag.toUpperCase(),
    className: attrs.class ?? "",
    style: {
      // What a browser's cssText holds: the inline declarations, as written.
      // Set directly, it is that string; otherwise it follows setProperty(), so
      // the payload's "was this set at all?" check sees what a browser shows.
      get cssText() {
        return this._css ?? Object.entries(this._props).map(([k, v]) => `${k}: ${v};`).join(" ");
      },
      set cssText(v) {
        this._css = v;
      },
      display: "",
      left: "",
      top: "",
      width: "",
      height: "",
      _props: style,
      setProperty(k, v) {
        this._props[k] = v;
      },
      getPropertyValue(k) {
        return this._props[k] ?? "";
      },
      removeProperty(k) {
        delete this._props[k];
      },
    },
    attributes: attrs,
    dataset: {},
    innerHTML: "",
    textContent: attrs.text ?? "",
    value: attrs.value ?? "",
    title: "",
    hidden: false,
    // Form fields coerce what they are given, as the DOM does, so a test sees the
    // string the browser would show rather than the number the payload passed.
    set type(v) {
      this._type = v;
    },
    get type() {
      return this._type;
    },
    set min(v) {
      this._min = String(v);
    },
    get min() {
      return this._min;
    },
    set max(v) {
      this._max = String(v);
    },
    get max() {
      return this._max;
    },
    set step(v) {
      this._step = String(v);
    },
    get step() {
      return this._step;
    },
    offsetWidth: 270,
    offsetHeight: 300,
    offsetLeft: 0,
    offsetTop: 0,
    setPointerCapture() {},
    releasePointerCapture() {},
    focus() {},
    blur() {},
    select() {},
    childNodes: [],
    children: [],
    disabled: false,
    className: "",
    setAttribute: (k, v) => (attrs[k] = v),
    removeAttribute: (k) => delete attrs[k],
    getAttribute: (k) => attrs[k],
    appendChild: (child) => {
      // A child has one parent. Without this the popover keeps every control ever
      // built, because the payload clears it with innerHTML and then appends.
      const before = child.parentElement;
      if (before) before.children.splice(before.children.indexOf(child), 1);
      child.parentElement = node;
      created.push(child);
      node.children.push(child);
      return child;
    },
    removeChild: (child) => {
      node.children.splice(node.children.indexOf(child), 1);
      child.parentElement = null;
      return child;
    },
    insertBefore: (child, before) => {
      const at = node.children.indexOf(before);
      const was = child.parentElement;
      const old = was ? was.children.indexOf(child) : -1;
      if (was) was.children.splice(old, 1);
      child.parentElement = node;
      node.children.splice(at === -1 ? node.children.length : at > old && was === node ? at - 1 : at, 0, child);
      created.push(child);
      return child;
    },
    remove: function () {
      return node.parentElement && node.parentElement.removeChild(node);
    },
    // A live HTMLCollection, not an array: the payload must not assume slice().
    get firstChild() {
      return node.children[0] ?? null;
    },
    get nextSibling() {
      if (!node.parentElement) return null;
      return node.parentElement.children[node.parentElement.children.indexOf(node) + 1] ?? null;
    },
    addEventListener: (type, fn) => (bubble(node, type).push(fn)),
    removeEventListener: (type, fn) => {
      const bucket = bubble(node, type);
      bucket.splice(bucket.indexOf(fn), 1);
    },
    // Its own listeners only: the payload fires an input on the field it turns,
    // and every listener that writes an edit is on that field.
    dispatchEvent: (event) => {
      for (const fn of bubble(node, event.type)) fn(event);
      return true;
    },
    getBoundingClientRect: () => attrs.rect ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
    // The stub has no selector engine. One query is answered — a class name,
    // found by walking the children it built — which is the only shape the
    // payload asks for: whether a control's own list is open.
    querySelectorAll: (selector) => {
      if (!selector.startsWith(".")) return [];
      const cls = selector.slice(1);
      const found = [];
      const walk = (n) => (n.children ?? []).forEach((c) => {
        if (String(c.className).split(/\s+/).includes(cls)) found.push(c);
        walk(c);
      });
      walk(node);
      return found;
    },
    composedPath: () => attrs.path ?? [],
    };
    node.bubbles = {};
    return node;
  };

  /** A text element in the page: a real node with a text child. */
  const text = (tag, text, style = {}, rect = { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }) => {
    const node = el(tag, { text, rect });
    node.childNodes = [{ nodeType: 3, nodeValue: text }];
    node.style._props = style;
    return node;
  };

  /** Find the + button that reveals an optional control, by its display name.
      The row is name then +, so the button is the last child. */
  const plusFor = (name) => {
    for (const sec of root.nodes.pane?.children ?? []) {
      for (const line of sec.children.slice(1)) {
        if (line.className !== "addLine") continue;
        const btn = line.children[line.children.length - 1];
        if (btn?.className === "plus" && btn.title === "Add " + name) return btn;
      }
    }
    return null;
  };

  const root = {
    // The payload assigns innerHTML; a browser parses it. The stub does the
    // minimum of that: it registers an element for every id in the markup, so an
    // id that is never written fails loudly instead of being invented on demand.
    _html: "",
    set innerHTML(value) {
      root._html = value;
      root.declare(...[...String(value).matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
      // `hidden` in the markup, as a browser would honour it. Without this every
      // element claims to be visible and the payload believes its own popover is
      // already open. The tag is a throwaway: `nodeName` keeps this from matching
      // `nodeType`, whose 1 would make every node look hidden.
      for (const match of String(value).matchAll(/<(\w+)([^>]*)>/g)) {
        var attrs = match[2];
        var id = attrs.match(/\bid="([^"]+)"/);
        if (id && /\shidden(\s|$|=)/.test(attrs)) root.nodes[id[1]].hidden = true;
      }
      // The selection frame's markers, like every id above: a browser
      // parses this markup, so register the children the payload built.
      var frame = root.nodes["sel"];
      if (frame) {
        frame.children = [...String(value).matchAll(/<i\s+([^>]*)>/g)].map((m) =>
          el("i", { class: "frame-marker", "data-corner": m[1].match(/data-corner="([^"]+)"/)?.[1] ?? "" }));
      }
    },
    get innerHTML() {
      return root._html;
    },
    nodes: {},
    children: [],
    appendChild: (child) => {
      child.parentElement = root;
      root.children.push(child);
      created.push(child);
      return child;
    },
    bubbles: {},
    // Every input the payload builds, keyed by the CSS property it drives.
    inputs: {},
    addEventListener: (type, fn) => (root.bubbles[type] ??= []).push(fn),
    removeEventListener: (type, fn) => {
      root.bubbles[type] = (root.bubbles[type] ?? []).filter((f) => f !== fn);
    },
    // Real ids only: the panel's markup is parsed from innerHTML in a browser,
    // but the stub never parses it. Handing back a node for an id that was never
    // declared would hide exactly the bug where the payload reaches for a control
    // the panel no longer has.
    getElementById: (id) => {
      if (root.nodes[id]) return root.nodes[id];
      throw new Error(`no element with id "${id}" — the payload asks for something the panel does not have`);
    },
    /** Declare an id the innerHTML would have created. */
    declare: (...ids) => ids.forEach((id) => (root.nodes[id] ??= el("div", { id }))),
  };
  // Every created element can host a shadow root and it is always this one: the
  // payload only ever attaches one, and tests need the nodes it finds by id.
  const withShadow = (node) => ((node.attachShadow = () => root), node);

  const appended = [];
  const body = {
    appendChild: (node) => {
      appended.push(node);
      body.children.push(node);
      node.parentElement = body;
      return node;
    },
    removeChild: (node) => {
      const at = body.children.indexOf(node);
      if (at !== -1) body.children.splice(at, 1);
      node.parentElement = null;
      return node;
    },
    children: [],
    childNodes: [],
  };

  const win = {
    innerWidth: 1200,
    innerHeight: 800,
    dispatched: [],
    dispatchEvent: (event) => win.dispatched.push(event.type),
    addEventListener: (type, fn) => bucket(win, type, "bubble").push(fn),
    removeEventListener: (type, fn) => {
      const list = bucket(win, type, "bubble");
      list.splice(list.indexOf(fn), 1);
    },
    getComputedStyle: (el) => computed(el),
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    console: { log: () => {} },
  };


  const doc = {
    body,
    documentElement: el("html"),
    createElement: (tag) => withShadow(el(tag)),
    // Text nodes, which the payload builds labels out of. They hold a value and
    // nothing else: a label is a label.
    createTextNode: (value) => ({ nodeType: 3, nodeValue: String(value) }),
    // The page's own stylesheets, so the font list can be read the way a browser
    // would expose them. Empty by default: a test that cares sets its own.
    styleSheets: [],
    querySelectorAll: () => [],
    // The node a selector finds, which the replaced-element case asks for.
    querySelector: () => doc.found,
    fonts: [],
    elementFromPoint: () => hovered,
    addEventListener: (type, fn, capture) => bucket(doc, type, capture ? "capture" : "bubble").push(fn),
    removeEventListener: (type, fn, capture) => {
      const list = bucket(doc, type, capture ? "capture" : "bubble");
      list.splice(list.indexOf(fn), 1);
    },
  };

  /** A click, as the user produces it. `path` is the composed path it travels. */
  function click(path) {
    let stopped = false;
    let prevented = false;
    const event = {
      clientX: 1,
      clientY: 1,
      composedPath: () => path,
      stopPropagation: () => (stopped = true),
      stopImmediatePropagation: () => {},
      preventDefault: () => (prevented = true),
    };
    const handlers = (node) => {
      const b = node.bubbles?.click;
      return [...(b?.capture ?? []), ...(b?.bubble ?? [])];
    };
    // Capture from the window down, then bubble back up: the order a real event
    // has. Only nodes on the path see it, and the launcher stopping propagation
    // is what keeps the document handler from ever seeing a click on the button.
    const chain = [win, ...created, ...Object.values(root.nodes), doc];
    outer: for (const node of chain) {
      if (!path.includes(node)) continue;
      for (const fn of handlers(node)) {
        fn(event);
        if (stopped) break outer;
      }
    }
    return { stopped, prevented };
  }

  function run() {
    // Re-running the payload with the same window is the "loaded twice" case:
    // it guards on `window.__edityy` and must mount nothing the second time.
    // fetch is passed in, so no test reaches the network: a test that needs the
    // font catalog sets win.fetch before it runs the payload.
    new Function("window", "document", "CustomEvent", "fetch", source)(win, doc, win.CustomEvent, win.fetch);
    return {
      win,
      doc,
      root,
      host: appended[0],
      appended,
      launch: () => root.nodes.launch,
      action: (name) => {
        const button = root.nodes["element-menu"].children[0].children.find(
          (item) => item.getAttribute("aria-label") === name,
        );
        assert.ok(button, `no element action "${name}"`);
        for (const fn of button.bubbles.click.bubble) fn({});
      },
      click: () => click([root.nodes.launch, appended[0], doc]),
      /** Click the page, not the shadow host. */
      clickPage: (clientX = 1, clientY = 1, shiftKey = false) => {
        const path = [hovered ?? doc, doc];
        const event = {
          clientX,
          clientY,
          shiftKey,
          composedPath: () => path,
          preventDefault() {},
          stopPropagation() {},
        };
        for (const fn of [...bucket(doc, "click", "capture"), ...bucket(doc, "click", "bubble")]) fn(event);
      },
      /** Click inside the editing panel, whose path runs through the host. */
      clickPanel: () => click([root.nodes.panel, appended[0], doc]),
      /** Fire a document event, as the browser would. */
      fire: (type, event = {}) => {
        for (const fn of [...bucket(doc, type, "capture"), ...bucket(doc, type, "bubble")]) fn(event);
      },
      move: (clientX, clientY) => {
        for (const fn of [...bucket(doc, "mousemove", "capture"), ...bucket(doc, "mousemove", "bubble")]) fn({ clientX, clientY });
      },
      /** One of a frame's bars, in the order the payload built them: run first
          for each edge, then the three accent bars over it. */
      bar: (edge, spot) => root.nodes.sel.children[edge * 4 + 1 + spot],
      line: (edge, frame = "sel") => root.nodes[frame].children[edge * 4],
      placeholder: null,
      countDoc: (type) => bucket(doc, type, "capture").length,
      /** Grab the panel's header, then move and release it. */
      grab: (event) =>
        quiet(() => {
          for (const fn of root.nodes.grip.bubbles.pointerdown.bubble) fn({ ...event, target: root.nodes.target, preventDefault() {} });
        }),
      dragTo: (clientX, clientY) => {
        for (const fn of root.bubbles.pointermove ?? []) fn({ clientX, clientY });
        for (const fn of root.bubbles.pointerup ?? []) fn({ clientX, clientY });
      },
      hover: (node) => {
        hovered = node;
      },
      /** Scroll the page, as the wheel or the scrollbar would. */
      scroll: () => {
        for (const fn of bucket(win, "scroll", "bubble")) fn({});
      },
      /** A page element with text in it, as the pointer would find one. */
      el: (tag, attrs) => text(tag, attrs?.text ?? "", attrs?.style ?? {}, attrs?.rect),
      /** Drive a plain input by the CSS property it owns, as a user would. */
      type: (prop, value) => {
        const input = root.inputs[prop];
        input.value = value;
        for (const fn of input.bubbles.input.bubble) fn({});
      },
      /** Remove a property entirely, as clearing its box would. */
      clear: (prop) => {
        const input = root.inputs[prop];
        if (input.kind === "cycle") {
          for (const fn of input.node.bubbles.click.bubble) fn({});
          return;
        }
        input.value = "";
        for (const fn of input.bubbles.input.bubble) fn({});
      },
      /** Click a segment of a segmented control. */
      segment: (prop, value) => {
        const group = root.inputs[prop];
        const btn = (group.children ?? []).find((b) => b.title === value);
        for (const fn of btn.bubbles.click.bubble) fn({});
      },
      /** Click a cycle button until it reads a value, however many steps that is.
          A cycle starts wherever the element already was, so counting clicks from
          zero would overshoot. */
      cycle: (prop, value) => {
        const slot = root.inputs[prop];
        const btn = slot.node;
        const want = slot.row.o.find((o) => o[0] === value)?.[1];
        for (let i = 0; i <= slot.row.o.length; i++) {
          if (btn.textContent === want) break;
          for (const fn of btn.bubbles.click.bubble) fn({});
        }
      },
      /** Type into one side of the padding box. */
      pad: (side, value) => {
        const wrap = root.inputs["@pad"].wrap;
        const input = wrap.children.find((n) => n.getAttribute?.("data-side") === side);
        input.value = value;
        for (const fn of input.bubbles.input.bubble) fn({});
      },
      /** Type a hex into the hex box of a colour composite. */
      setHex: (prop, value) => {
        const wrap = root.inputs[prop].wrap;
        const hex = wrap.children[1];
        hex.value = value;
        for (const fn of hex.bubbles.input.bubble) fn({});
      },
      /** Press the + that reveals an optional control, then return it. */
      add: (prop, name) => {
        const plus = plusFor(name);
        for (const fn of plus.bubbles.click.bubble) fn({});
        return root.inputs[prop];
      },
      /** The control that owns a property, for asserting what it read. */
      control: (prop) => root.inputs[prop],
      /** The + button that would add an optional property, by its name. */
      querySelectorPlus: (name) => plusFor(name),
    };
  }

  return { run, el, text, doc, win, appended };
}

/** Keeps the payload's own console output out of the test output. */
function quiet(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

test("mounts a launcher that ignores pointer events outside the button", () => {
  const { run } = fakeDom();
  const { host, root } = run();
  assert.equal(host.attributes["data-edityy"], "");
  assert.match(host.style.cssText, /position:fixed/);
  assert.match(host.style.cssText, /z-index:2147483647/);
  assert.match(host.style.cssText, /pointer-events:none/);
  assert.match(root.innerHTML, /right:24px;bottom:24px/);
  assert.match(root.innerHTML, /border-radius:50%/);
  assert.match(root.innerHTML, /pointer-events:auto/); // only the button takes clicks
});

test("the button is a real button with an accessible name", () => {
  const { run } = fakeDom();
  const { root } = run();
  assert.match(root.innerHTML, /<button type="button" id="launch"/);
  assert.match(root.innerHTML, /aria-label="Open Edityy"/);
  assert.match(root.innerHTML, /<span id="label">Edityy<\/span><\/button>/);
});

test("the chrome wears its own face, not the host page's", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // The chrome names the Edityy face, and takes the page's copy of it through
  // --edityy-font when the page keeps it behind a hashed name. The machine's own
  // UI face is the floor, and no webfont is fetched.
  assert.match(css, /font-family:var\(--edityy-font,"Plus Jakarta Sans"\),system-ui,-apple-system,/,
    "Jakarta through the chrome's hook, with the machine's UI face as the floor");
  assert.doesNotMatch(css, /fonts\.googleapis\.com|@font-face/, "and no font is fetched");
  assert.doesNotMatch(css, /--font-sans/, "and no token only this codebase sets");
  assert.match(css, /font:600 14px\/1\.1 inherit/, "the orb's own weight and size");
});

test("loading twice mounts only one launcher", () => {
  const { run } = fakeDom();
  const app = run();
  run();
  assert.equal(app.appended.length, 1);
});

test("clicking the launcher dispatches the seam event and enters edit mode", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  assert.deepEqual(app.win.dispatched, ["edityy:launcher-click"]);
  assert.equal(app.countDoc("click"), 1, "the page is captured in edit mode");
});

test("the orb itself becomes the pointer, shrinking into a point", () => {
  const { run, text } = fakeDom();
  const app = run();
  // A 56px orb centred at (1180, 748): right 24 from a 1200 wide viewport, and
  // 24 up from the bottom of 800.
  app.launch().getBoundingClientRect = () => ({ left: 1152, top: 720, right: 1208, bottom: 776, width: 56, height: 56 });
  quiet(() => {
    app.click();
    // One step in, still at the orb: the scale is the shrink, and the
    // translate has not moved yet.
    assert.equal(app.launch().style.scale, "0.16", "the shrink starts where the orb is");
    assert.equal(app.launch().style.translate, "0px 0px", "and it has not travelled yet");
    app.hover(text("p", "body"));
    app.fire("mousemove", { clientX: 40, clientY: 90 });
  });
  // Then it tracks the pointer, translated from the orb's own centre.
  assert.equal(app.launch().style.translate, "-1140px -658px", "the dot is where the pointer is, now");
  assert.equal(app.launch().style.scale, "0.16");
  assert.equal(app.launch().style.pointerEvents, "none", "the dot is not a button any more");
  assert.equal(app.root.nodes.label.style.opacity, "0", "the word fades on the way down");
});

test("the pointer travels home and grows back into the orb on exit", () => {
  const { run, text } = fakeDom();
  const app = run();
  app.launch().getBoundingClientRect = () => ({ left: 1152, top: 720, right: 1208, bottom: 776, width: 56, height: 56 });
  quiet(() => {
    app.click();
    app.hover(text("p", "body"));
    app.fire("mousemove", { clientX: 40, clientY: 90 });
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(app.launch().style.translate, "0px 0px", "the dot is home");
  assert.equal(app.launch().style.scale, "1", "and it is the orb again");
  assert.equal(app.launch().style.pointerEvents, "", "the orb takes clicks again");
  assert.equal(app.root.nodes.label.style.opacity, "");
  assert.equal(app.countDoc("click"), 0, "the page is released");
});

test("many pointer moves in one frame find and measure once", () => {
  const { run, text, win } = fakeDom();
  const frames = [];
  win.requestAnimationFrame = (fn) => frames.push(fn);
  const app = run();
  const heading = text("h1", "Edityy");
  let measured = 0;
  const rect = heading.getBoundingClientRect;
  heading.getBoundingClientRect = () => (measured++, rect());
  quiet(() => {
    app.click();
    app.hover(heading);
    for (let x = 0; x < 5; x++) app.fire("mousemove", { clientX: x, clientY: 10 });
  });
  assert.equal(app.launch().style.translate, "4px 10px", "the dot is where the pointer is, now");
  assert.equal(measured, 0, "nothing measured before the frame");
  assert.equal(frames.length, 1, "one frame asked for");
  quiet(() => frames.shift()());
  assert.equal(measured, 1);
  assert.equal(app.root.nodes.hover.hidden, false);
});

test("the hover frame stands off the element", () => {
  const { run, text } = fakeDom();
  const app = run();
  // The line straddles the element's edge, so the frame starts 0.75px clear of
  // it — half the approved 1.5px weight.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  const hover = app.root.nodes.hover.style;
  assert.equal(hover.left, "99.25px");
  assert.equal(hover.top, "49.25px");
  assert.equal(hover.width, "121.5px");
  assert.equal(hover.height, "49.5px");
});

test("a text element wins over the container around it", () => {
  const { run, text, el } = fakeDom();
  const app = run();
  const card = el("section");
  const heading = text("h1", "Edityy");
  card.childNodes = [heading];
  card.parentElement = null;
  heading.parentElement = card;
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  // Clicking the words selects the words, not the box they sit in.
  assert.equal(app.root.selection().el, heading);
  assert.equal(app.root.selection().kind, "text");
});

test("shift-click adds and removes elements without a count, and Shift+Arrow does not extend selection", () => {
  const { run, el } = fakeDom();
  const app = run();
  const first = el("div");
  const second = el("p", { text: "Second" });
  quiet(() => {
    app.click();
    app.hover(first);
    app.clickPage();
    app.hover(second);
    app.clickPage(1, 1, true);
  });
  assert.equal(app.root.nodes.dock.hidden, true);
  assert.equal(app.root.nodes.row.hidden, true);
  assert.equal(app.root.nodes.sel.hidden, false);
  assert.equal(app.root.children.filter((node) => node.className.startsWith("frame") && !node.hidden).length, 1);
  quiet(() => app.fire("keydown", { key: "ArrowRight", shiftKey: true }));
  assert.equal(app.root.nodes.dock.hidden, true, "Shift+Arrow does not add to the selection");
  quiet(() => app.clickPage(1, 1, true));
  assert.equal(app.root.nodes.dock.hidden, false, "removing one element returns to single selection");
  assert.equal(app.root.nodes.row.hidden, false);
});

test("Shift+A applies column auto layout to sibling selections and restores them on exit", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main");
  const first = el("div");
  const gap = el("aside");
  const second = el("p", { text: "Second" });
  parent.appendChild(first);
  parent.appendChild(gap);
  parent.appendChild(second);
  quiet(() => {
    app.click();
    app.hover(first);
    app.clickPage();
    app.hover(second);
    app.clickPage(1, 1, true);
    app.fire("keydown", { key: "A", shiftKey: true, preventDefault() {}, stopPropagation() {} });
  });
  const wrapper = parent.children[0];
  assert.equal(app.root.nodes.pop.hidden, true, "Shift+A runs the action without opening choices");
  assert.equal(wrapper.tagName, "DIV");
  assert.equal(wrapper.style.getPropertyValue("display"), "flex");
  assert.equal(wrapper.style.getPropertyValue("flex-direction"), "column");
  assert.deepEqual(wrapper.children, [first, second]);
  assert.deepEqual(parent.children, [wrapper, gap]);
  assert.equal(app.root.selection().el, wrapper);
  assert.equal(app.root.nodes.row.children[0].attributes["aria-label"], "Layout mode: Flex");
  // The prompt says what to build and what goes in it, by the places in the code.
  const prompt = app.win.__edityy_changes();
  assert.match(prompt, /- Added: a new `div` with `display: flex; flex-direction: column;`/);
  assert.match(prompt, /- Wraps: `main > div`, `main > p`/);
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.deepEqual(parent.children, [first, gap, second], "exit restores the original element order");
});

test("Shift+A without a selection does not open an action menu", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.fire("keydown", { key: "A", shiftKey: true, preventDefault() {}, stopPropagation() {} });
  });
  assert.equal(app.root.nodes.dock.hidden, false, "the dock is still up");
  assert.equal(app.root.nodes.row.hidden, true, "no controls: nothing is selected");
  assert.equal(app.root.nodes.pop.hidden, true, "and no list opens");
});

test("an element with no text is still selectable", () => {
  const { run, el } = fakeDom();
  const app = run();
  const wrapper = el("div");
  quiet(() => {
    app.click();
    app.hover(wrapper);
    app.clickPage();
  });
  // A container is a legal target: the frame goes on it and it is classified.
  assert.equal(app.root.selection().el, wrapper);
  assert.equal(app.root.selection().kind, "container");
  assert.equal(app.root.nodes.sel.hidden, false);
});

test("small selections hide only handles on their short dimensions", () => {
  const { run, text } = fakeDom();
  const app = run();
  const dot = text("span", "x", {}, { left: 100, top: 50, right: 116, bottom: 66, width: 16, height: 16 });
  quiet(() => {
    app.click();
    app.hover(dot);
    app.clickPage();
  });
  assert.equal(app.root.nodes.sel.className, "frame short narrow");
  assert.match(app.root.innerHTML, /\.frame\.short \[data-edge=left\],\.frame\.short \[data-edge=right\]/);
  assert.match(app.root.innerHTML, /\.frame\.narrow \[data-edge=top\],\.frame\.narrow \[data-edge=bottom\]/);
  assert.match(app.root.innerHTML, /\.frame-marker\.corner\{width:7\.5px;height:7\.5px;border-radius:50%\}/);
});

test("the bounding box is one solid frame with four corner markers", () => {
  const { run, text } = fakeDom();
  const app = run();
  // 120x48 at (100,50). The line straddles the edge, and the bar starts at the
  // approved 1.5px, so the frame covers 99.25..220.75 by 49.25..97.75: 121.5 by
  // 49.5.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  const sel = app.root.nodes.sel;
  assert.equal(sel.hidden, false);
  assert.equal((app.root.innerHTML.match(/class="frame-marker/g) || []).length, 8, "four corner handles and four edge handles");
  assert.equal(sel.style.left, "99.25px");
  assert.equal(sel.style.top, "49.25px");
  assert.equal(sel.style.width, "121.5px");
  assert.equal(sel.style.height, "49.5px");
  // The design's own stroke: a dark solid line outside the element, no corner
  // radius, nothing painted inside it. The colour is the palette ink or paper,
  // chosen by the luminance behind the box, so the stylesheet only has the
  // ink fallback.
  assert.match(app.root.innerHTML, /border:1\.5px solid var\(--frame,var\(--ink\)\)/, "one solid frame, all four sides");
  assert.match(app.root.innerHTML, /border-radius:0/, "no corner radius");
  assert.match(app.root.innerHTML, /background:transparent/, "nothing painted inside");
  // Eight handles: four corners and four edges.
  assert.match(app.root.innerHTML, /<i class="frame-marker corner" data-corner="top left"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker corner" data-corner="top right"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker corner" data-corner="bottom left"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker corner" data-corner="bottom right"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker edge" data-edge="left"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker edge" data-edge="right"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker edge horizontal" data-edge="top"><\/i>/);
  assert.match(app.root.innerHTML, /<i class="frame-marker edge horizontal" data-edge="bottom"><\/i>/);
  // The handles are the line in multiples, each its own fixed size.
  assert.match(app.root.innerHTML, /\.frame-marker\.corner\{width:7\.5px;height:7\.5px;border-radius:50%\}/, "corner discs five lines across");
  assert.match(app.root.innerHTML, /\.frame-marker\.edge\{width:4\.5px;height:min\(24px,40%\);border-radius:2\.25px\}/, "edge bars three lines thick, sixteen long, ends round");
  assert.match(app.root.innerHTML, /\.frame-marker\.edge\.horizontal\{width:min\(24px,40%\);height:4\.5px\}/, "the same bar on a top or bottom edge");
  assert.match(app.root.innerHTML, /\.frame-marker\{position:absolute;background:var\(--frame,var\(--ink\)\);pointer-events:none\}/, "the handles wear the same colour as the line, and let a click through to the page");
  assert.match(app.root.innerHTML, /\[data-edge=left\]\{left:-3px\}\[data-edge=right\]\{right:-3px\}/, "vertical handles center on the side stroke");
  assert.match(app.root.innerHTML, /\[data-edge=top\]\{top:-3px\}\[data-edge=bottom\]\{bottom:-3px\}/, "horizontal handles center on the top and bottom strokes");
  assert.match(app.root.innerHTML, /\[data-corner="top left"\]\{left:-3\.75px;top:-3\.75px\}/, "a corner disc is centered on its corner");
});

test("the box wears the ramp value that opposes the colour under it", () => {
  const { run, text } = fakeDom();
  const app = run();
  const panel = text("div", "hi", { "background-color": "rgb(16, 32, 48)" },
    { left: 10, top: 10, right: 210, bottom: 60, width: 200, height: 50 });
  quiet(() => {
    app.click();
    app.hover(panel);
    app.clickPage();
  });
  const sel = app.root.nodes.sel;
  assert.equal(sel.style.getPropertyValue("--frame"), "#ffffff", "paper on a dark panel");
  // A true negative of the page's paper would be pure black, which the ramp
  // does not have. An unpainted background is the page's own canvas: light, so
  // the line is ink.
  const bare = text("p", "plain", {}, { left: 0, top: 0, right: 80, bottom: 20, width: 80, height: 20 });
  quiet(() => {
    app.hover(bare);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#16233a");
  // A light background keeps the line in ink rather than inventing a hue.
  const paper = text("div", "hi", { "background-color": "rgb(249, 242, 238)" },
    { left: 10, top: 10, right: 210, bottom: 60, width: 200, height: 50 });
  quiet(() => {
    app.hover(paper);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#16233a", "ink on paper");
  // A transparent element takes the colour of the nearest ancestor that paints
  // one, because that is the colour the box actually lies on.
  const child = text("span", "x", {}, { left: 20, top: 20, right: 60, bottom: 40, width: 40, height: 20 });
  panel.appendChild(child);
  quiet(() => {
    app.hover(child);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#ffffff");
});

/** Select a node and report how it was classified. */
const kindOf = (app, node) => {
  app.hover(node);
  app.clickPage();
  return app.root.selection().kind;
};

/** Select some text and open the dock, as picking words does. Enters the mode
    first if it is not already in it, since some callers are already inside. */
const selectText = (app, edit = false) => {
  if (!app.countDoc("click")) quiet(() => app.click());
  const p = app.el("p", { text: "hello" });
  app.hover(p);
  app.clickPage();
  if (edit) app.action("Edit text");
  return p;
};

/** Press a dock icon by its key. */
const press = (app, key) => {
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === key);
  for (const fn of icon.bubbles.click.bubble) fn({});
  return icon;
};

/** Pick a named row out of the open control. A row that shows its own words
    wears them as its accessible name, not as a title repeating them. */
const pickOption = (pop, title) => {
  const row = pop.children.flatMap((c) => c.children).find((b) => b.getAttribute?.("aria-label") === title);
  assert.ok(row, `no option "${title}" in the open control`);
  assert.ok(!row.title, "a row that says its own name keeps no second tooltip");
  for (const fn of row.bubbles.click.bubble) fn({});
  return row;
};

/** Type a number into a named field of the open control. */
const typeInto = (pop, name, value) => {
  const input = all(pop).find((n) => n.getAttribute?.("aria-label") === name);
  assert.ok(input, `no field "${name}" in the open control`);
  input.value = String(value);
  for (const fn of input.bubbles.input.bubble) fn({});
  for (const fn of input.bubbles.change.bubble) fn({});
  return input;
};

/** The open control, as the dock holds it. */
const pop = (app) => app.root.nodes.pop;

/** Every node a container holds, however deep. */
const all = (el) => [el, ...(el.children ?? []).flatMap(all)];
/** The first input of a type in an open control. */
const inputOf = (open, type) => all(open).find((n) => n.type === type);
/** The text of a container, which the stub does not accumulate for us. */
const shown = (el) =>
  [el.tagName === undefined ? (el.nodeValue ?? "") : el.innerHTML,
   ...(el.children ?? []).flatMap((c) => [c.nodeValue ?? "", shown(c)])]
    .filter(Boolean)
    .join("");

/** Every input a container holds, however deep. A text node has no tag, so it is
    skipped rather than treated as a field. */
const fields = (el) =>
  [el, ...(el.children ?? []).flatMap(fields)].filter((n) => n.tagName === "INPUT");



test("the open icon stays visible on its own dark background", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // `*{color:#16233a}` matches the glyph itself, so an active button's paper
  // colour never reaches it: without an explicit inherit the glyph is ink on
  // ink and disappears. The drawn one takes the colour down from the box the
  // icon is drawn in.
  assert.match(css, /\.ic>svg\{[^}]*color:inherit/, "the drawn glyphs");
});

test("each control is as wide as it needs to be, not a shared width", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // A min-width is what made a row of four icons as wide as a list of face
  // names, with dead paper either side of the icons.
  assert.doesNotMatch(css, /\.pop\{[^}]*min-width/, "no floor on the popover");
  assert.doesNotMatch(css, /\.pop\{[^}]*width:/, "and no width either");
  // Rows shrink to their label rather than filling the list.
  assert.match(css, /\.opt\{[^}]*width:max-content/, "a row is as wide as its own text");
});

test("the scrolling list brings its own scrollbar", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // The list scrolls, and inside a shadow root it would otherwise show whatever
  // the host page styles its scrollbars with.
  assert.match(css, /\.list\{[^}]*overflow-y:auto/, "it scrolls");
  assert.match(css, /\.list\{[^}]*scrollbar-width:thin/, "a hairline, not the UA default");
  assert.match(css, /\.list\{[^}]*scrollbar-color:var\(--ink-25\) transparent/, "on the ramp");
  assert.match(css, /\.list::-webkit-scrollbar-thumb\{/, "and for the engines that need it");
});

test("the primary dock fills on hover and on select, and draws its own tooltip", async () => {
  const { run } = fakeDom();
  const app = run();
  const css = app.root.innerHTML;
  assert.match(css, /\.row\[data-glide\]:before\{opacity:1/, "one hover fill travels along the row");
  assert.match(css, /\.ic\[aria-expanded=true\]\{background:var\(--ink-12\);color:var\(--ink\)\}/, "a selected control wears the open fill");
  assert.match(css, /\.pop\{[^}]*background:var\(--paper\)/, "the secondary dock wears the paper surface");
  quiet(() => selectText(app));
  const row = app.root.nodes.row;
  const tip = app.root.nodes.tip;
  const spacing = row.children.find((b) => b.dataset.key === "spacing");
  assert.equal(tip.hidden, true, "no tooltip to begin with");
  for (const fn of row.bubbles.pointerover.bubble) fn({ target: spacing });
  assert.notEqual(row.dataset.glide, undefined, "the fill comes in under the control");
  assert.equal(tip.hidden, true, "a pointer that only crosses the dock lights nothing");
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(tip.hidden, false, "a control the pointer stays on shows one");
  assert.equal(tip.textContent, "Typography spacing", "in the words of its own label");
  quiet(() => press(app, "spacing"));
  assert.equal(tip.hidden, true, "the open panel hides it");
  quiet(() => press(app, "spacing"));
  for (const fn of row.bubbles.pointerout.bubble) fn({ target: spacing, relatedTarget: null });
  assert.equal(tip.hidden, true, "and it goes when the pointer does");
});

test("a control that already says what it is needs no tooltip", async () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => selectText(app));
  const row = app.root.nodes.row;
  const tip = app.root.nodes.tip;
  const spacing = row.children.find((b) => b.dataset.key === "spacing");
  // A control that shows its own words: the number in the box is the number a
  // tip would say.
  spacing.textContent = "12";
  for (const fn of row.bubbles.pointerover.bubble) fn({ target: spacing });
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.equal(tip.hidden, true, "the words on the control are the tip");
});

test("a chip wears a mark, not words, so it keeps its tip", async () => {
  const { run, el } = fakeDom();
  const app = run();
  const img = el("img");
  quiet(() => {
    app.click();
    app.hover(img);
    app.clickPage();
  });
  const row = app.root.nodes.row;
  const tip = app.root.nodes.tip;
  // The W and the H of the two lengths, and the × between a grid's counts, are
  // marks: they say which field this is, not what it is.
  const width = row.children.find((b) => b.dataset.key === "width");
  quiet(() => { for (const fn of row.bubbles.pointerover.bubble) fn({ target: width }); });
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.equal(tip.hidden, false, "the empty length says its own name");
  assert.equal(tip.textContent, "Width");
});

test("the dot under the cursor is not a third of a second behind it", () => {
  const { run } = fakeDom();
  const app = run();
  const css = app.root.innerHTML;
  const rule = css.match(/#launch\{[^}]*\}/)[0];
  // The scale is the shrink, and the scale is transitioned. The translate is
  // the tracking, and the tracking is not: a dot that eases into place is a
  // dot the cursor has left.
  assert.match(rule, /transition:scale var\(--move\)/, "the shrink is transitioned");
  assert.doesNotMatch(rule, /transition:[^;}]*translate/, "the tracking is not");
  // The way home is the one move that travels.
  assert.match(css, /#launch\[data-home\]\{[^}]*transition:translate/, "the dot travels home");
});

test("the element menu's actions draw the dock's tooltip, in their own words", async () => {
  const { run } = fakeDom();
  const app = run();
  const tip = app.root.nodes.tip;
  const menu = app.root.nodes["element-menu"];
  selectText(app);
  const move = menu.children[0].children.find((b) => b.getAttribute("aria-label") === "Move");
  assert.equal(move.getAttribute("title"), undefined, "no native title beside the drawn tip");
  assert.equal(tip.hidden, true, "nothing is shown to begin with");
  for (const fn of menu.bubbles.pointerover.bubble) fn({ target: move });
  assert.equal(tip.hidden, true, "the first of the group waits");
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert.equal(tip.hidden, false, "an action the pointer stays on shows one");
  assert.equal(tip.textContent, "Move", "in the words of that action");
  for (const fn of menu.bubbles.pointerout.bubble) fn({ target: move, relatedTarget: null });
  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.equal(tip.hidden, true, "and it goes when the pointer does");
});

test("one thing is open at a time, so two panels never stand on each other", () => {
  const { run } = fakeDom();
  const app = run();
  const pop = app.root.nodes.pop;
  selectText(app);
  const select = all(app.root.nodes.row.children.find((b) => b.dataset.key === "size"))
    .find((node) => String(node.className) === "custom-select");
  const trigger = all(select).find((node) => String(node.className).startsWith("custom-select-trigger"));
  const list = all(select).find((node) => String(node.className) === "custom-select-menu");
  quiet(() => press(app, "spacing"));
  assert.equal(pop.hidden, false, "a control is open");
  for (const fn of trigger.bubbles.click.bubble) fn({});
  assert.equal(pop.hidden, true, "the list in the row closes the control it would stand on");
  assert.equal(list.hidden, false, "and stands alone");
  quiet(() => press(app, "spacing"));
  assert.equal(pop.hidden, false, "a control opens");
  assert.equal(list.hidden, true, "and the list closes with it");
});

test("the secondary dock centres on its control and corners at the row's ends", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const row = app.root.nodes.row;
  const dock = app.root.nodes.dock;
  const pop = app.root.nodes.pop;
  dock.getBoundingClientRect = () => ({ left: 100, top: 700, width: 400, height: 50 });
  row.children.forEach((b, i) => {
    b.getBoundingClientRect = () => ({ left: 100 + i * 40, top: 700, width: 34, height: 34 });
  });
  pop.offsetWidth = 200;
  quiet(() => press(app, "family"));
  assert.equal(pop.style.left, "0px", "the first control is the left corner");
  quiet(() => press(app, "family"));
  quiet(() => press(app, "color"));
  // The colour control's centre is 137px into the dock, so the 200px panel
  // starts 37px to the left of the dock.
  assert.equal(pop.style.left, "37px", "a middle control sets the centre");
  quiet(() => press(app, "color"));
  quiet(() => press(app, "+"));
  assert.equal(pop.style.left, "200px", "the last control is the right corner");
  // A narrow viewport: the dock is as wide as the viewport less 12px a side,
  // and its row wraps rather than running off both edges.
  const css = app.root.innerHTML;
  assert.match(css, /#dock\{[^}]*width:max-content;max-width:calc\(100vw - 24px\)/);
  assert.match(css, /\.row\{[^}]*flex-wrap:wrap;min-width:0/);
  assert.match(css, /\.pop\{[^}]*max-inline-size:min\(420px,calc\(100vw - 24px\)\)/);
  // The panel stays 12px inside the viewport, however near the edge its control is.
  quiet(() => press(app, "+"));
  app.win.innerWidth = 360;
  dock.getBoundingClientRect = () => ({ left: 12, top: 700, width: 336, height: 80 });
  row.children.forEach((b) => {
    b.getBoundingClientRect = () => ({ left: 300, top: 700, width: 34, height: 34 });
  });
  pop.offsetWidth = 300;
  quiet(() => press(app, "color"));
  assert.equal(pop.style.left, "36px", "its right edge 12px in from the viewport's");
});

test("a dock that comes back takes clicks again", () => {
  const { run, text } = fakeDom();
  const app = run();
  const dock = app.root.nodes.dock;
  let exit;
  dock.animate = () => (exit = { cancel() {} });
  quiet(() => {
    app.click();
    app.hover(text("p", "body"));
    app.clickPage();
  });
  assert.equal(dock.hidden, false);
  // The mode ends: the dock leaves, and takes no clicks while it goes.
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(dock.style.pointerEvents, "none", "a dock on its way out is leaving");
  exit.onfinish();
  assert.equal(dock.hidden, true);
  // Back for another element: the dock is the same node, so the clicks have to
  // come back with it. Left as none, every press in the row lands on the page.
  quiet(() => {
    app.click();
    app.hover(text("p", "second"));
    app.clickPage();
  });
  assert.equal(dock.hidden, false);
  assert.equal(dock.style.pointerEvents, "", "the row takes clicks again");
});

test("the + stands behind a hairline of its own", () => {  const { run } = fakeDom();
  const app = run();
  selectText(app);
  // The hairline is the button's own mark: a child of the row would be one more
  // stop for the arrows to land on, and nothing to focus.
  assert.match(app.root.innerHTML, /\.ic\.add:before\{content:""[^}]*width:1px/, "a hairline stands to the left of the +");
  assert.equal(app.root.nodes.row.children.some((node) => !node.dataset.key), false, "the row is buttons only");
});

test("the dock opens on text, container and media", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("div"));
    app.clickPage();
  });
  assert.equal(app.root.nodes.dock.hidden, false, "a container gets the dock too");
  assert.equal(app.root.nodes.row.children[0].attributes["aria-label"], "Layout mode: Default");
  assert.deepEqual(
    app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "gap", "alignment", "+"],
    "existing containers retain their default controls"
  );
  const box = app.root.selection().el;
  // A computed template arrives already expanded, with its line names kept: the
  // count is the list of tracks, not the repeat() the page may have written.
  box.computed = { "grid-template-columns": "[left] 1fr [mid] 1fr [right]", "grid-template-rows": "none" };

  // The mode cycle omits Stack and starts at Flex.
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "wrap", "alignment", "gap", "+"]);
  assert.equal(box.style.getPropertyValue("display"), "flex");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "grid", "gap", "+"], "a grid wears its counts in the row");
  assert.equal(box.style.getPropertyValue("display"), "grid");
  // The size is the pair of counts in the row itself, with nothing to open; a
  // grid that names no tracks of its own says "auto".
  const gridInputs = () => fields(app.root.nodes.row.children.find((b) => b.dataset.key === "grid"));
  assert.equal(gridInputs().length, 2, "columns and rows share one field");
  assert.equal(gridInputs()[0].value, "2", "columns read off the resolved track list");
  assert.equal(gridInputs()[1].value, "", "a grid that names no rows of its own is auto");
  assert.equal(gridInputs()[1].placeholder, "auto");
  gridInputs()[0].value = "3";
  for (const fn of gridInputs()[0].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("grid-template-columns"), "repeat(3, minmax(0, 1fr))");
  gridInputs()[1].value = "2";
  for (const fn of gridInputs()[1].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("grid-template-rows"), "repeat(2, minmax(0, 1fr))");
  gridInputs()[1].value = "";
  for (const fn of gridInputs()[1].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("grid-template-rows"), "", "a blank count is auto");
  quiet(() => press(app, "gap"));
  const gapInputs = fields(app.root.nodes.pop).filter((n) => n.type === "number");
  assert.equal(gapInputs.length, 2, "row and column gaps share one control");
  gapInputs[0].value = "16";
  for (const fn of gapInputs[0].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("column-gap"), "16px");
  gapInputs[1].value = "12";
  for (const fn of gapInputs[1].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("row-gap"), "12px");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "top", "right", "bottom", "left", "+"], "each offset has its own field");
  assert.equal(box.style.getPropertyValue("position"), "absolute");
  // The offsets are fields in the row, with nothing to open, and a side that
  // names no offset says "auto".
  const offsetInputs = () => ["top", "right", "bottom", "left"].map((key) =>
    fields(app.root.nodes.row.children.find((b) => b.dataset.key === key))[0]);
  assert.equal(offsetInputs().every(Boolean), true, "top, right, bottom and left");
  assert.equal(offsetInputs()[0].value, "", "a side with no offset is auto");
  assert.equal(offsetInputs()[2].placeholder, "auto");
  offsetInputs()[0].value = "24";
  for (const fn of offsetInputs()[0].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("top"), "24px");
  offsetInputs()[3].value = "-40";
  for (const fn of offsetInputs()[3].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("left"), "-40px");
  offsetInputs()[0].value = "";
  for (const fn of offsetInputs()[0].bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("top"), "", "a blank side is auto");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "wrap", "alignment", "gap", "+"]);

  quiet(() => press(app, "alignment"));
  const cells = app.root.nodes.pop.children[0].children;
  assert.equal(cells.length, 9, "alignment is a 3x3 grid");
  assert.equal(cells.some((b) => b.innerHTML.includes("<svg")), false, "a cell is the control, not a mark in a frame");
  assert.equal(cells[0].attributes["aria-pressed"], "true", "the cell that is on is filled");
  for (const fn of cells[2].bubbles.click.bubble) fn({});
  assert.equal(box.style.getPropertyValue("justify-content"), "flex-end", "flex horizontal alignment");
  assert.equal(box.style.getPropertyValue("align-items"), "flex-start", "flex vertical alignment");
  assert.equal(cells[2].attributes["aria-pressed"], "true", "the fill moves to the cell that was picked");
  assert.equal(cells[0].attributes["aria-pressed"], "false", "and the cell it left is empty again");
  quiet(() => press(app, "wrap"));
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap", "flex wrap");
  assert.equal(app.root.nodes.pop.hidden, true, "the cycle opens nothing");
  quiet(() => press(app, "mode"));
  quiet(() => selectText(app));
  assert.equal(app.root.nodes.dock.hidden, false, "words are");
  // Typography values are visible in the primary dock. Spacing replaces the
  // separate line-height and letter-spacing controls.
  const row = app.root.nodes.row;
  assert.equal(row.children.length, 8);
  assert.deepEqual(
    row.children.map((b) => b.dataset.key),
    ["family", "size", "weight", "color", "align", "spacing", "decorate", "+"]
  );
  for (const icon of row.children) assert.match(icon.attributes["aria-label"], /\w/);
  assert.equal(row.children.find((b) => b.dataset.key === "family").firstChild.nodeValue, "System UI");
  assert.equal(row.children.find((b) => b.dataset.key === "size").children[0].value, 16);
  assert.match(row.children.find((b) => b.dataset.key === "spacing").innerHTML, /<svg/);
  assert.match(app.root.innerHTML, /#dock\{position:fixed;left:50%;bottom:24px;transform:translateX\(-50%\)/,
    "fixed at the bottom centre, whatever the element does");
  // The open control sits above the icon row, and the row places it from the
  // control that opened it.
  assert.match(app.root.innerHTML, /\.pop\{[^}]*position:absolute[^}]*bottom:calc\(100% \+ 8px\)/,
    "the control opens over the dock");
  // The menu is its own card at the element, not a row of the dock.
  assert.match(app.root.innerHTML, /\.element-menu\{position:fixed/);
});

test("a layout mode change glides the row instead of cutting", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("div"));
    app.clickPage();
  });
  const row = app.root.nodes.row;
  // The dock is centred, so a narrower row also moves right: the box starts
  // where the row was and ends where the row is now.
  const places = [
    { left: 100, top: 700, width: 200, height: 36 },
    { left: 140, top: 700, width: 120, height: 36 },
  ];
  let at = 0;
  row.getBoundingClientRect = () => places[Math.min(at++, 1)];
  const runs = [];
  const record = function (frames, options) {
    runs.push({ node: this, frames, options });
    return runs[runs.length - 1];
  };
  const made = app.doc.createElement;
  app.doc.createElement = (tag) => {
    const node = made(tag);
    node.animate = record;
    return node;
  };
  row.animate = record;
  quiet(() => press(app, "mode"));

  const box = runs.find((r) => r.node === row && r.frames[0].width);
  assert.ok(box, "the box takes its new width");
  assert.equal(box.frames[0].width, "200px", "it starts where the row was");
  assert.equal(box.frames[1].width, "120px", "and ends where the row is now");
  assert.equal(row.style.flexWrap, "nowrap", "the row is a window on its controls while it moves");
  // The controls of the mode that is left are still on screen while they go, so
  // the change is a change of content and not a replacement of the toolbar.
  const still = runs.find((r) => String(r.node.className).includes("still"));
  assert.ok(still, "the old controls cross over");
  assert.equal(still.node.attributes["aria-hidden"], "true", "and out of the reader's way");
  assert.deepEqual(
    still.node.children.map((b) => b.dataset.key),
    ["mode", "direction", "gap", "alignment", "+"]
  );
  still.onfinish();
  assert.equal(still.node.parentElement, null, "they leave when the motion is done");
  box.onfinish();
  assert.equal(row.style.flexWrap, "", "the row takes its wrapping back");
  assert.equal(row.style.overflow, "");
  // The mode control is in both rows, so it is the same control: it travels.
  const travel = runs.find((r) => r.node.dataset?.key === "mode" && r.frames[0].transform);
  assert.ok(travel, "a control both modes have travels to its new place");
  const added = runs.find((r) => r.node.dataset?.key === "wrap" && r.frames[0].opacity === 0);
  assert.ok(added, "a control the mode adds arrives");
});

test("the pointer's fill waits for the row the mode change left", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("div"));
    app.clickPage();
  });
  const row = app.root.nodes.row;
  row.getBoundingClientRect = () => ({ left: 100, top: 700, width: 200, height: 36 });
  row.animate = () => null;
  quiet(() => press(app, "mode"));
  // The pointer is still over the row, on a control that was built a moment ago
  // and is not the one the fill was measured on.
  const over = (target) => {
    for (const fn of row.bubbles.pointerover.bubble) fn({ target, relatedTarget: null });
  };
  over(row.children[1]);
  assert.equal(row.dataset.glide, undefined, "the fill stays down while the pointer is parked");
  assert.equal(row.style.getPropertyValue("--glide-x"), "", "and it is not measured on the old row");
  // It comes back when the pointer moves, on the control it is on now.
  for (const fn of row.bubbles.pointermove.bubble) fn({ target: row.children[1] });
  assert.notEqual(row.dataset.glide, undefined, "a pointer that moves fills the control under it");
});

test("wrap and direction are cycle buttons, and establish flex first", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    press(app, "mode");
  });
  assert.equal(box.style.getPropertyValue("display"), "flex");
  // Each click moves to the next value, and nothing opens.
  quiet(() => press(app, "wrap"));
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap", "nowrap moves to wrap");
  assert.equal(app.root.nodes.pop.hidden, true, "the cycle opens nothing");
  quiet(() => press(app, "wrap"));
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap-reverse", "the next click moves on");
  quiet(() => press(app, "wrap"));
  assert.equal(box.style.getPropertyValue("flex-wrap"), "nowrap", "the list wraps at the end");
  quiet(() => press(app, "direction"));
  assert.equal(box.style.getPropertyValue("flex-direction"), "column", "row moves to column");
  quiet(() => press(app, "direction"));
  assert.equal(box.style.getPropertyValue("flex-direction"), "row", "and back");
  // The button shows the value the element already had, so the dock says which
  // one is on without opening anything.
  const column = el("div", {}, { display: "flex", "flex-direction": "column" });
  quiet(() => {
    app.hover(column);
    app.clickPage();
  });
  const direction = app.root.nodes.row.children.find((b) => b.dataset.key === "direction");
  assert.equal(direction.attributes["aria-label"], "Column");
  assert.match(direction.innerHTML, /<svg/);
});

test("inline-flex containers expose the wrap control", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div", {}, { display: "inline-flex" });
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
  });
  assert.ok(app.root.nodes.row.children.find((button) => button.dataset.key === "wrap"));
  press(app, "wrap");
  assert.equal(box.style.getPropertyValue("display"), "flex");
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap", "the click cycles the value");
});

test("one control opens at a time, under the dock, and Escape closes it", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app, true);
  const pop = app.root.nodes.pop;
  assert.equal(pop.hidden, true, "nothing is open to begin with");
  quiet(() => press(app, "spacing"));
  assert.equal(pop.hidden, false);
  assert.equal(app.root.nodes.row.children[5].attributes["aria-expanded"], "true");
  assert.equal(app.root.nodes.row.children[0].attributes["aria-expanded"], "false");
  assert.equal(fields(pop).length, 2, "spacing has letter and line fields");
  // Inline size editing does not open a second surface.
  const size = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  assert.equal(pop.hidden, false, "spacing remains open while size stays inline");
  assert.equal(size.children[0].type, "number");
  // Escape backs out one level: the control first, then the mode.
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(pop.hidden, true, "the control closes");
  assert.equal(app.root.nodes.dock.hidden, false, "but the dock stays");
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(app.root.nodes.dock.hidden, false, "Escape closes text editing");
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(app.root.nodes.dock.hidden, true, "the next Escape leaves the mode");
});


test("each control opens the shape it needs", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => selectText(app));
  const pop = app.root.nodes.pop;
  // Family is a list read off the page itself, and each option wears the face it
  // offers. The stub's probe measures nothing, so what is left is the floor the
  // payload keeps for a page that names no fonts — which is the point: no list of
  // fonts is baked in, and the one on screen here is not the one in the source.
  quiet(() => press(app, "family"));
  assert.equal(pop.children[0].type, "search", "a search field over the list");
  assert.ok(
    pop.children[1].children.every((b) => b.style.cssText.startsWith("font-family:")),
    "each option wears the face it offers"
  );
  assert.deepEqual(
    pop.children[1].children.map((b) => b.getAttribute("aria-label")),
    ["System UI", "Helvetica", "Georgia", "Times New Roman", "Courier New"],
    "the machine's own faces, and nothing invented"
  );
  // A system face with no discovered weights disables the weight control.
  assert.equal(app.root.nodes.row.children.find((b) => b.dataset.key === "weight").disabled, true);
  // Size is editable and offers common pixel values.
  const sizeButton = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  for (const fn of sizeButton.bubbles.click.bubble) fn({});
  const number = sizeButton.children[0];
  assert.ok(number, "size control remains available after opening the font list");
  assert.equal(number.type, "number");
  assert.equal(sizeButton.children.some((n) => n.className === "custom-select"), true);
  // Both spacing values share one control.
  quiet(() => press(app, "spacing"));
  assert.deepEqual(fields(pop).map((input) => input.type), ["number", "number"]);
  // Decoration is a row of icons, named rather than spelled as CSS values.
  quiet(() => press(app, "decorate"));
  const marks = pop.children[0].children;
  assert.deepEqual(
    marks.map((b) => b.getAttribute("aria-label")),
    ["Underline", "Strikethrough", "Italic"]
  );
  assert.deepEqual(
    marks.map((b) => b.dataset.key),
    ["underline", "line-through", "italic"],
    "each one writes the property it draws"
  );
  assert.ok(marks.every((b) => b.innerHTML.includes("<svg")), "each one drawn, not written");
});


test("a change is applied to the element and remembered for exit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const input = app.root.nodes.row.children.find((b) => b.dataset.key === "size").children[0];
  input.value = "42";
  for (const fn of input.bubbles.input.bubble) fn({});
  assert.equal(p.style.getPropertyValue("font-size"), "42px");
  assert.equal(app.root.selection().el, p, "and it is still the same element");
  // Escape closes the control, then leaves the mode, which puts the page back.
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(p.style.getPropertyValue("font-size"), "", "exit reverts everything it wrote");
  assert.equal(app.root.nodes.dock.hidden, true);
});

test("picking an option keeps the control open, and moves the tick", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const pop = app.root.nodes.pop;
  const align = app.root.nodes.row.children.find((b) => b.dataset.key === "align");
  for (const fn of align.bubbles.click.bubble) fn({});
  assert.equal(pop.hidden, true, "alignment cycles without opening a panel");
  assert.equal(p.style.getPropertyValue("text-align"), "center");
  const size = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  for (const fn of size.bubbles.click.bubble) fn({});
  assert.equal(pop.hidden, true, "size stays inline");
});

test("picking a face writes the whole stack to the element", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "family"));
  const opts = app.root.nodes.pop.children[1].children;
  for (const fn of opts[1].bubbles.click.bubble) fn({});
  // The stack, not the bare name: "Helvetica" alone resolves to whatever the
  // machine substitutes, while "Helvetica,Arial,sans-serif" is a real choice.
  assert.equal(p.style.getPropertyValue("font-family"), "Helvetica,Arial,sans-serif");
  assert.equal(app.root.nodes.pop.hidden, false, "and the list stays open");
});

test("Google Fonts load only when asked for, and each request is made once", async () => {
  const dom = fakeDom();
  const requests = [];
  let answer = () => Promise.reject(new Error("offline"));
  dom.win.fetch = (url) => (requests.push(url), answer());
  const app = dom.run();
  const links = () => dom.doc.documentElement.children.filter((n) => n.tagName === "LINK");
  const tick = () => new Promise((r) => setImmediate(r));
  const reopen = async () => {
    quiet(() => press(app, "family"));
    if (app.root.nodes.pop.hidden) quiet(() => press(app, "family"));
    await tick();
  };
  const pop = app.root.nodes.pop;

  const p = selectText(app);
  assert.equal(requests.length, 0, "nothing is fetched until the family control opens");
  assert.equal(links().length, 0, "and no font file is asked for");

  // A failed catalog keeps the page's own faces and says so. The next open tries again.
  await reopen();
  assert.equal(requests.length, 1);
  assert.equal(pop.children[1].children.length, 5, "the system faces are still there");
  assert.match(pop.children[2].textContent, /did not load/);

  answer = async () => ({
    ok: true,
    json: async () => [
      { family: "Inter", category: "sans-serif", weights: [400, 700], axes: [{ tag: "wght", min: 100, max: 900 }], styles: ["italic", "normal"] },
      { family: "Lora", category: "serif", weights: [300, 400, 700], styles: ["normal"] },
      { family: "Material Icons", category: "icons", weights: [400], styles: ["normal"] },
    ],
  });
  quiet(() => press(app, "family")); // close
  await reopen();
  assert.equal(requests.length, 2, "the retry");
  const rows = () => pop.children[1].children.map((b) => b.getAttribute("aria-label"));
  // The catalog answers the search, not the open: at rest the list is the
  // page's own faces and the face the element wears now.
  assert.deepEqual(rows(), ["System UI", "Helvetica", "Georgia", "Times New Roman", "Courier New"], "no catalog rows at rest");
  assert.equal(links().length, 0, "no preview is requested for rows nobody sees");
  assert.equal(pop.children[0].placeholder, "Search for more fonts");
  assert.doesNotMatch(pop.children[2].textContent, /Search for more fonts/);

  // Open again: the catalog is kept, not requested again.
  quiet(() => press(app, "family"));
  await reopen();
  assert.equal(requests.length, 2);
  assert.equal(links().length, 0);

  // Typing asks for more: the catalog answers the search.
  pop.children[0].value = "lo";
  for (const fn of pop.children[0].bubbles.input.bubble) fn({});
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(rows(), ["Lora"]);
  assert.equal(links().length, 1, "one preview request for the rows drawn");
  assert.match(links()[0].href, /family=Lora&text=/);

  // A pick writes the stack and loads the whole family, once.
  pickOption(pop, "Lora");
  assert.equal(p.style.getPropertyValue("font-family"), '"Lora",serif');
  assert.equal(links().length, 2);
  assert.equal(links()[1].href, "https://fonts.googleapis.com/css2?family=Lora:wght@300;400;700&display=swap");
  pickOption(pop, "Lora");
  assert.equal(links().length, 2, "a second pick makes no second request");

  // Reopening offers the face the element wears, even when the page does not
  // declare it, so the list always has a way back to it.
  await reopen();
  assert.equal(rows()[0], "Lora");
  // The project does not load Lora, so the agent is told to add it.
  assert.match(app.win.__edityy_changes(), /- Font: `Lora` is a Google font that the project does not load\./);
  quiet(() => press(app, "weight"));
  assert.equal(fields(pop)[0].type, "number", "fixed fonts keep weight editable");
  assert.equal(all(pop).some((node) => node.className === "custom-select"), true, "fixed weights use a custom dropdown");
  fields(pop)[0].value = "650";
  for (const fn of fields(pop)[0].bubbles.input.bubble) fn({});
  assert.equal(p.style.getPropertyValue("font-weight"), "650");

  // A system face after it needs nothing added, so the note goes.
  await reopen();
  pop.children[0].value = "georgia";
  for (const fn of pop.children[0].bubbles.input.bubble) fn({});
  await new Promise((r) => setTimeout(r, 150));
  pickOption(pop, "Georgia");
  assert.doesNotMatch(app.win.__edityy_changes(), /Google font/);
});

test("decorations stack, because CSS lets them", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "decorate"));
  const marks = app.root.nodes.pop.children[0].children;
  const pick = (i) => {
    for (const fn of marks[i].bubbles.click.bubble) fn({});
  };
  // Underline, then strikethrough on the same words: both are legal at once.
  quiet(() => pick(0));
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "underline");
  quiet(() => pick(1));
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "underline line-through");
  assert.equal(marks[0].getAttribute("aria-pressed"), "true", "the first is still on");
  assert.equal(marks[1].getAttribute("aria-pressed"), "true", "and so is the second");
  // Picking one again takes only that one off.
  quiet(() => pick(0));
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "line-through");
  assert.equal(marks[1].getAttribute("aria-pressed"), "true");
  // Emptying the list leaves the property unset, not set to "none".
  quiet(() => pick(1));
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "");
  assert.equal(app.root.nodes.pop.hidden, false, "the control is still open throughout");
});

test("italic writes font-style, not a decoration", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "decorate"));
  const marks = app.root.nodes.pop.children[0].children;
  const pick = (i) => {
    for (const fn of marks[i].bubbles.click.bubble) fn({});
  };
  quiet(() => pick(0));
  quiet(() => pick(2));
  assert.equal(p.style.getPropertyValue("font-style"), "italic");
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "underline", "italic is not in the list");
  assert.equal(marks[0].getAttribute("aria-pressed"), "true", "underline is still on");
  assert.equal(marks[2].getAttribute("aria-pressed"), "true");
  // Reopened on the same words, the italic button shows that it is on.
  quiet(() => press(app, "decorate"));
  quiet(() => press(app, "decorate"));
  const again = app.root.nodes.pop.children[0].children;
  assert.equal(again[2].getAttribute("aria-pressed"), "true", "italic is kept");
  for (const fn of again[2].bubbles.click.bubble) quiet(() => fn({}));
  assert.equal(p.style.getPropertyValue("font-style"), "");
  assert.equal(p.style.getPropertyValue("text-decoration-line"), "underline");
});

test("an open control survives a click back on the same words", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "spacing"));
  assert.equal(app.root.nodes.pop.hidden, false);
  // Clicking the same element again is the click that would start a drag, so the
  // dock must not close under the pointer.
  quiet(() => app.clickPage());
  assert.equal(app.root.nodes.pop.hidden, false, "still open");
  assert.equal(app.root.selection().el, p);
});

test("an element is classified before it is selected, as one of three", () => {
  const { run, text, el } = fakeDom();
  const app = run();
  quiet(() => app.click());
  assert.equal(kindOf(app, text("h1", "Edityy")), "text");
  assert.equal(kindOf(app, el("div")), "container");
  assert.equal(kindOf(app, el("img")), "media");
  assert.equal(kindOf(app, el("svg")), "media");
  assert.equal(kindOf(app, el("video")), "media");
  assert.equal(kindOf(app, el("canvas")), "media");
});

test("media beats the words around it", () => {
  const { run, el } = fakeDom();
  const app = run();
  const img = el("img");
  // alt text is a description of the image, not copy anyone can edit
  img.childNodes = [{ nodeType: 3, nodeValue: "Logo" }];
  quiet(() => {
    app.click();
    assert.equal(kindOf(app, img), "media");
  });
});

test("image selection wears the image's own controls in the dock's row", () => {
  const { run, el } = fakeDom();
  const app = run();
  const img = el("img");
  quiet(() => {
    app.click();
    app.hover(img);
    app.clickPage();
  });
  assert.equal(app.root.nodes.dock.hidden, false);
  const row = app.root.nodes.row;
  assert.deepEqual(row.children.map((button) => button.dataset.key), ["width", "height", "radius", "+"]);
  // The two lengths are fields in the row, so an exact size is typed into them.
  quiet(() => typeInto(row, "Width in pixels", 240));
  assert.equal(img.style.getPropertyValue("width"), "240px");
  quiet(() => typeInto(row, "Height in pixels", 160));
  assert.equal(img.style.getPropertyValue("height"), "160px");
  // The list beside the field holds the one word a length can say: auto, which
  // hands the image back to the size the page gives it.
  const list = all(row.children[0]).find((node) => String(node.className) === "custom-select");
  const trigger = all(list).find((node) => node.getAttribute?.("aria-label") === "Width options");
  assert.deepEqual(
    all(list).filter((node) => String(node.className) === "custom-option").map((node) => node.getAttribute("aria-label")),
    ["Auto"],
    "auto is the list's only word"
  );
  quiet(() => { for (const fn of trigger.bubbles.click.bubble) fn({}); });
  const auto = all(list).find((node) => node.getAttribute?.("aria-label") === "Auto");
  quiet(() => { for (const fn of auto.bubbles.click.bubble) fn({}); });
  assert.equal(img.style.getPropertyValue("width"), "", "auto is the page's own width again");
  // A press on the value — on the word auto too — lands in the field, with the
  // figure picked, so the next keystroke is the number that replaces it.
  const width = all(row.children[0]).find((node) => node.getAttribute?.("aria-label") === "Width in pixels");
  let focused = 0;
  width.focus = () => focused++;
  quiet(() => { for (const fn of width.bubbles.click.bubble) fn({ preventDefault() {} }); });
  assert.equal(focused, 1, "the caret is in the field");
  quiet(() => press(app, "radius"));
  typeInto(pop(app), "Radius", 18);
  assert.equal(img.style.getPropertyValue("border-radius"), "18px");
  // Opacity is added with the `+`, in place of the fill an image has no use for.
  quiet(() => press(app, "+"));
  const choices = all(pop(app)).filter((node) => String(node.className) === "opt").map((node) => node.dataset.key);
  assert.ok(choices.includes("opacity"), "opacity is one of the choices");
  assert.ok(!choices.includes("fill"), "and the fill is not");
  quiet(() => pickOption(pop(app), "Opacity"));
  assert.ok(row.children.some((button) => button.dataset.key === "opacity"), "opacity joined the row");
  // Picking it from the `+` opens its field, as a picked control does.
  typeInto(pop(app), "Opacity", 45);
  assert.equal(img.style.getPropertyValue("opacity"), 0.45);
});

test("a control wears a mark of its own: radius is not the border's, blur not opacity's", () => {
  const { run, el } = fakeDom();
  const app = run();
  const img = el("img");
  const row = app.root.nodes.row;
  const mark = (key) => (all(row).find((node) => node.dataset?.key === key)?.innerHTML ?? "").match(/<svg[\s\S]*<\/svg>/)?.[0];
  quiet(() => {
    app.click();
    app.hover(img);
    app.clickPage();
    press(app, "+");
    pickOption(pop(app), "Border");
  });
  // The border joins the row beside the radius: two squares there would read as
  // two of the same control.
  assert.ok(mark("border"), "the border joined the row");
  assert.notEqual(mark("radius"), mark("border"), "the corner is drawn apart from the border");
  quiet(() => {
    press(app, "+");
    pickOption(pop(app), "Shadow");
  });
  // The shadow's blur is a field in the open panel, and the drop on the row is
  // opacity's: they are on screen at the same time.
  const blur = all(pop(app)).find((node) => node.getAttribute?.("aria-label") === "Blur").parentElement;
  assert.notEqual(blur.children[0].innerHTML, mark("opacity"), "the blur is drawn apart from the drop");
});

test("every structural tag is a container", () => {
  const { run, el } = fakeDom();
  const app = run();
  // The container bucket is deliberately not a list in the source; these are the
  // tags the design calls out, checked so the "everything else" fallback keeps
  // meaning what it says as the page grows new wrappers.
  const CONTAINERS = [
    "div", "section", "main", "header", "footer", "nav", "article", "aside",
    "form", "fieldset", "details", "summary", "dialog",
    "figure", "figcaption", "label",
    "blockquote", "pre", "hr",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "ol", "ul", "li",
    "input", "textarea", "select", "option",
  ];
  quiet(() => {
    app.click();
    for (const tag of CONTAINERS) {
      assert.equal(kindOf(app, el(tag)), "container", tag);
    }
  });
});

test("a control holding words is text, because that is the copy being read", () => {
  const { run, text } = fakeDom();
  const app = run();
  const save = text("button", "Save");
  const link = text("a", "Read more");
  quiet(() => {
    app.click();
    assert.equal(kindOf(app, save), "text");
    assert.equal(kindOf(app, link), "text");
  });
});

test("whitespace alone is not text", () => {
  const { run, el } = fakeDom();
  const app = run();
  const spacer = el("div");
  spacer.childNodes = [{ nodeType: 3, nodeValue: "   \n " }];
  quiet(() => {
    app.click();
    assert.equal(kindOf(app, spacer), "container");
  });
});

test("svg <text> is text, because that is the only place it can be edited", () => {
  const { run, el } = fakeDom();
  const app = run();
  const node = el("text");
  node.childNodes = [{ nodeType: 3, nodeValue: "Chart" }];
  quiet(() => {
    app.click();
    assert.equal(kindOf(app, node), "text");
  });
});

test("deselecting reports no kind at all", () => {
  const { run, text } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    kindOf(app, text("p", "hi"));
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(app.root.selection(), null);
});

test("the element menu takes clicks again after its exit animation", () => {
  const { run } = fakeDom();
  const app = run();
  const menu = app.root.nodes["element-menu"];
  let exit;
  menu.animate = () => (exit = { cancel() {} });
  const first = app.el("p", { text: "First" });
  const second = app.el("p", { text: "Second" });
  quiet(() => {
    app.click();
    app.hover(first);
    app.clickPage();
    app.hover(null);
    app.clickPage();
  });
  assert.equal(menu.style.pointerEvents, "none", "the departing card ignores clicks");
  exit.onfinish();
  quiet(() => {
    app.hover(second);
    app.clickPage();
  });
  assert.equal(menu.hidden, false);
  assert.equal(menu.style.pointerEvents, "", "the new card accepts clicks");
});

test("selecting text shows actions without editing until Edit text is chosen", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, false);
  assert.equal(p.getAttribute("contenteditable"), undefined);
  assert.equal(app.root.nodes["element-menu"].hidden, false);
  assert.deepEqual(app.root.nodes["element-menu"].children[0].children.map((button) => button.getAttribute("aria-label")), ["Edit text", "Move", "Comment", "Variations", "Delete"]);
  app.action("Edit text");
  assert.equal(p.getAttribute("contenteditable"), "plaintext-only");
  // The menu stays, with the one button that ends the edit.
  const done = app.root.nodes["element-menu"].children[0].children[0];
  assert.equal(done.getAttribute("aria-label"), "Done editing the text");
  quiet(() => { for (const fn of done.bubbles.click.bubble) fn({}); });
  assert.equal(p.getAttribute("contenteditable"), undefined, "Done gives the words back");
  assert.deepEqual(app.root.nodes["element-menu"].children[0].children.map((button) => button.getAttribute("aria-label")), ["Edit text", "Move", "Comment", "Variations", "Delete"], "and the actions are back");
});

test("a comment is written on the element and reaches the agent's Markdown", () => {
  const { run } = fakeDom();
  const app = run();
  const menu = app.root.nodes["element-menu"];
  const pressButton = (target) => {
    for (const fn of target.bubbles.click.bubble) fn({});
  };
  const inMenu = (label) => menu.children[0].children
    .flatMap((child) => (child.children.length ? child.children : [child]))
    .find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  selectText(app);
  app.action("Comment");
  const area = menu.children[0].children[0];
  assert.equal(area.getAttribute("aria-label"), "Comment", "the box opens a field to write in");
  area.value = "  make this bigger  ";
  pressButton(inMenu("Save comment"));
  assert.deepEqual(menu.children[0].children.map((b) => b.getAttribute("aria-label")), ["Edit text", "Move", "Comment", "Variations", "Delete"], "the buttons are back");
  assert.match(app.win.__edityy_changes(), /- Comment: "make this bigger"/);
  // Reopening shows what was written, and an emptied field takes it off again.
  app.action("Comment");
  assert.equal(menu.children[0].children[0].value, "make this bigger");
  // A scroll re-places the box, it must not rebuild it and take the words.
  menu.children[0].children[0].value = "half written";
  app.scroll();
  assert.equal(menu.children[0].children[0].value, "half written");
  menu.children[0].children[0].value = "";
  pressButton(inMenu("Save comment"));
  assert.doesNotMatch(app.win.__edityy_changes(), /Comment/);
  // Escape backs out of the box without saving.
  app.action("Comment");
  menu.children[0].children[0].value = "never saved";
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(inMenu("Save comment"), undefined, "the buttons are back");
  assert.doesNotMatch(app.win.__edityy_changes(), /never saved/);
});

test("selecting text makes the words editable where they sit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  assert.equal(p.getAttribute("contenteditable"), "plaintext-only");
  // plaintext-only, not true: pasting must not paste markup into the page.
  assert.notEqual(p.getAttribute("contenteditable"), "true");
});

test("selecting something else stops the active text edit", () => {
  const { run } = fakeDom();
  const app = run();
  const first = selectText(app);
  const second = app.el("h1", { text: "Edityy" });
  app.hover(second);
  app.clickPage();
  assert.equal(first.getAttribute("contenteditable"), undefined, "the old element is handed back");
  assert.equal(second.getAttribute("contenteditable"), undefined, "selection does not start text editing");
});

test("exiting the mode gives the words back to the page", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(p.getAttribute("contenteditable"), undefined);
});

test("a container gets no caret, because its children are not text to rewrite", () => {
  const { run, el } = fakeDom();
  const app = run();
  const card = el("section");
  quiet(() => {
    app.click();
    app.hover(card);
    app.clickPage();
  });
  assert.equal(card.getAttribute("contenteditable"), undefined);
});

test("element actions delete reversibly, and disable unavailable targets", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main");
  const selected = el("section");
  const sibling = el("aside");
  const child = el("p", { text: "Child" });
  parent.appendChild(selected);
  parent.appendChild(sibling);
  selected.appendChild(child);
  quiet(() => {
    app.click();
    app.hover(selected);
    app.clickPage();
  });
  app.action("Delete");
  assert.equal(parent.children.includes(selected), false);
  assert.match(app.win.__edityy_changes(), /- Removed: section/);
  assert.equal(app.root.nodes.count.textContent, "1", "the edits button counts the delete");
  // A deleted element is off the page, so its line in the edits list cannot select it.
  const deleted = openEdits(app).children[0].children[0].children[0];
  assert.equal(deleted.disabled, true);
  quiet(() => { for (const fn of deleted.bubbles.click.bubble) fn({}); });
  assert.equal(app.root.selection(), null);
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.deepEqual(parent.children, [selected, sibling], "exit restores the deleted element before its sibling");
});

test("an element whose words are split by a child element is editable, and exit puts the child back", () => {
  const { run, el } = fakeDom();
  const app = run();
  // A heading holding an <em>: text to the dock, and editable, because the words
  // are edited in place and the markup is put back when the mode is left.
  const heading = el("h1");
  const em = el("em");
  em.childNodes = [{ nodeType: 3, nodeValue: "there" }];
  // childNodes is what a real DOM keeps element children in too.
  heading.childNodes = [{ nodeType: 3, nodeValue: "Be " }, em];
  heading.children = [em];
  em.parentElement = heading;
  heading.textContent = "Be there";
  heading.innerHTML = "Be <em>there</em>";
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  assert.equal(app.root.selection().kind, "text", "still text, so the dock opens");
  const edit = app.root.nodes["element-menu"].children[0].children[0];
  assert.equal(edit.disabled, false, "Edit text is offered");
  app.action("Edit text");
  assert.equal(heading.getAttribute("contenteditable"), "plaintext-only");
  // The words change and the browser drops the <em> with them. Both are set
  // here because this stub keeps textContent and innerHTML apart, where a real
  // DOM derives the first from the second.
  heading.textContent = "Be gone";
  heading.innerHTML = "Be gone";
  app.fire("keydown", { key: "Escape" });
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(heading.innerHTML, "Be <em>there</em>", "the child element comes back");
});

test("the caret goes to the end of the words, not where the click landed", () => {
  const { run, el } = fakeDom();
  const app = run();
  const p = el("p", { text: "hello there" });
  p.childNodes = [{ nodeType: 3, nodeValue: "hello there" }];
  const placed = [];
  app.doc.createRange = () => ({
    selectNodeContents: (node) => placed.push(["contents", node]),
    collapse: (toEnd) => placed.push(["collapse", toEnd]),
  });
  app.win.getSelection = () => ({
    removeAllRanges: () => placed.push(["clear"]),
    addRange: () => placed.push(["add"]),
  });
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  app.action("Edit text");
  assert.deepEqual(placed, [["contents", p], ["collapse", false], ["clear"], ["add"]]);
});

test("the words being edited get no second ring on top of Edityy's own frame", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  // The browser draws a focus ring on any focused element. Edityy already draws
  // a selection frame, so the words ended up with two outlines, one of them not
  // ours. The frame is the ring.
  assert.equal(p.style.getPropertyValue("outline"), "none");
});

test("a click in the words being typed is the caret's, and a click elsewhere ends the edit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  const menu = app.root.nodes["element-menu"];
  // The click is swallowed by the page handler normally. In the words being
  // typed it must not be: the browser has to place the caret where it landed.
  app.hover(p);
  app.clickPage();
  assert.equal(p.getAttribute("contenteditable"), "plaintext-only", "the words are still being typed");
  assert.equal(menu.hidden, false, "and the menu is still there");
  assert.equal(menu.children[0].children[0].getAttribute("aria-label"), "Done editing the text");

  const other = app.el("h2", { text: "other" });
  app.hover(other);
  app.clickPage();
  assert.equal(p.getAttribute("contenteditable"), undefined, "a click elsewhere hands the words back");
  assert.equal(app.root.selection().el, other);
});

test("an element's own inline outline survives being edited", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  const p = app.el("p", { text: "hello", style: { outline: "2px solid red" } });
  app.hover(p);
  quiet(() => app.clickPage());
  app.action("Edit text");
  assert.equal(p.style.getPropertyValue("outline"), "none", "no focus ring while editing");
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(p.style.getPropertyValue("outline"), "2px solid red", "its own outline, not ours");
});

test("selecting other words and leaving leaves no outline on the first", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const q = app.el("p", { text: "other" });
  app.hover(q);
  quiet(() => app.clickPage());
  assert.equal(p.style.getPropertyValue("outline"), "", "back to the stylesheet once the caret moves on");
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(p.style.getPropertyValue("outline"), "");
  assert.equal(q.style.getPropertyValue("outline"), "");
});

test("typing edits in place, where the caret was put", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  app.action("Edit text");
  // The payload must not rewrite textContent to make an element editable: that
  // destroys the text node and the browser drops the caret at the start, so
  // clicking the middle of a line always typed at the beginning.
  assert.equal(p.textContent, "hello", "the words were not rewritten");
  assert.equal(p.childNodes.length, 1, "and the node the caret sits in still exists");
});

test("moving a selected element uses the insertion indicator and restores its position on cancel", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main", { rect: { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } });
  const first = el("div", { rect: { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 } });
  const second = el("p", { text: "Second", rect: { left: 0, top: 40, right: 100, bottom: 70, width: 100, height: 30 } });
  const outer = el("section", { rect: { left: 220, top: 0, right: 420, bottom: 200, width: 200, height: 200 } });
  const other = el("div", { rect: { left: 220, top: 0, right: 420, bottom: 200, width: 200, height: 200 } });
  parent.appendChild(first);
  parent.appendChild(second);
  parent.appendChild(outer);
  outer.appendChild(other);
  quiet(() => {
    app.click();
    app.hover(first);
    app.clickPage();
  });
  app.action("Move");
  assert.equal(parent.children.includes(first), false, "the moving item leaves its old slot during placement");
  assert.equal(app.root.nodes.dock.hidden, true, "the dock yields to the placement cursor");
  assert.equal(app.root.nodes.sel.hidden, true, "the element in the air has no frame");
  app.hover(other);
  app.move(300, 100);
  assert.equal(app.root.nodes.insert.hidden, false);
  app.clickPage(300, 100);
  assert.deepEqual(parent.children, [second, outer]);
  assert.deepEqual(other.children, [first], "move can reparent an element into another container");
  assert.match(app.win.__edityy_changes(), /- Moved to: `/);
  assert.equal(app.root.nodes.count.textContent, "1", "the edits button counts the move");
  app.action("Delete");
  const prompt = app.win.__edityy_changes();
  assert.match(prompt, /- Selector: `main > div`/, "a delete after a move names the place in the code");
  assert.doesNotMatch(prompt, /- Moved to:/, "a deleted element is reported as removed, not moved");
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.deepEqual(parent.children, [first, second, outer], "exit restores the original DOM position");
  assert.deepEqual(other.children, [], "exit restores the original parent");
});

test("moving into a grid places the element between the items of one row", () => {
  const { run, el } = fakeDom();
  const app = run();
  const page = el("main", { rect: { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 } });
  const moved = el("p", { text: "Moved", rect: { left: 0, top: 0, right: 300, bottom: 20, width: 300, height: 20 } });
  const grid = el("section", { rect: { left: 0, top: 40, right: 300, bottom: 160, width: 300, height: 120 } });
  grid.computed = { display: "grid" };
  const cards = [0, 1, 2, 3].map((i) => {
    const left = (i % 3) * 100;
    const top = 40 + Math.floor(i / 3) * 60;
    return el("article", { rect: { left, top, right: left + 90, bottom: top + 50, width: 90, height: 50 } });
  });
  page.appendChild(moved);
  page.appendChild(grid);
  cards.forEach((card) => grid.appendChild(card));
  quiet(() => {
    app.click();
    app.hover(moved);
    app.clickPage();
  });
  app.action("Move");
  // The pointer is in the gap between the second and third cards of the first
  // row. Read by y alone, that is in front of the first card.
  app.hover(grid);
  app.move(195, 60);
  assert.equal(app.root.nodes.insert.style.left, "195px", "the line stands in the gap between the cards");
  app.clickPage(195, 60);
  assert.deepEqual(grid.children, [cards[0], cards[1], moved, cards[2], cards[3]]);
});

test("the selection frame follows the element as it grows and shrinks", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  p.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 });
  quiet(() => {
    press(app, "size");
    // The dock writes a style, which reflows the element.
  });
  const frame = app.root.nodes.sel;
  assert.equal(frame.style.width, "101.5px", "measured after the change, one line wide");
  // Now it changes height — words wrapping onto another line, say.
  p.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 140, width: 100, height: 120 });
  // input, not keydown: keydown fires before the browser has changed the
  // words, so measuring there would catch the element as it was.
  quiet(() => app.fire("input", { target: p }));
  return new Promise((done) =>
    setTimeout(() => {
      assert.equal(frame.style.height, "121.5px", "the box grew with the text");
      assert.equal(frame.style.top, "19.25px");
      done();
    }, 5),
  );
});

test("the selection frame follows the page when it scrolls", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  p.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 });
  quiet(() => app.hover(p), app.clickPage());
  assert.equal(app.root.nodes.sel.style.top, "19.25px", "half the 1.5px line outside the element");
  // Scrolling moves the element up the viewport; the frame is viewport-fixed and
  // has to move with it or it is left behind, pointing at nothing.
  p.getBoundingClientRect = () => ({ left: 10, top: -180, right: 110, bottom: -140, width: 100, height: 40 });
  quiet(() => app.scroll());
  assert.equal(app.root.nodes.sel.style.top, "-180.75px", "the frame moved with the page");
});

test("the selection frame follows the page when it moves the element on its own", () => {
  const { run, win } = fakeDom();
  const frames = [];
  win.requestAnimationFrame = (fn) => frames.push(fn);
  const observers = [];
  win.ResizeObserver = class {
    constructor(report) {
      this.report = report;
      this.targets = [];
      observers.push(this);
    }
    observe(el) {
      this.targets.push(el);
    }
    disconnect() {
      this.targets = [];
    }
  };
  const app = run();
  const watcher = observers[0];
  const section = app.el("section");
  const p = app.el("p", { text: "hello" });
  section.appendChild(p);
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  assert.deepEqual(watcher.targets, [p, section], "the element and every box around it");
  const at = (top) => (p.getBoundingClientRect = () => ({ left: 10, top, right: 110, bottom: top + 40, width: 100, height: 40 }));
  const report = (el, height) => watcher.report([{ target: el, contentRect: { width: 100, height } }]);
  at(20);
  // The first report of each box is its size when it was watched.
  quiet(() => report(p, 40) || report(section, 300));
  assert.equal(frames.length, 0, "nothing measured for a box that did not change");
  // Content above loads: the box around the element grows, and the element moves down.
  at(140);
  quiet(() => report(section, 420) || report(section, 420));
  assert.equal(frames.length, 1, "one frame asked for");
  quiet(() => frames.shift()());
  assert.equal(app.root.nodes.sel.style.top, "139.25px", "the frame moved with the element");
  // An image that loads in a fixed box moves the element without a resize.
  at(200);
  quiet(() => app.fire("load"));
  quiet(() => frames.shift()());
  assert.equal(app.root.nodes.sel.style.top, "199.25px");
  // A new selection lets go of the boxes of the old one.
  const other = app.el("h2", { text: "other" });
  quiet(() => app.hover(other) || app.clickPage());
  assert.deepEqual(watcher.targets, [other]);
  // Leaving lets go of every box.
  quiet(() => app.fire("keydown", { key: "Escape" }) || app.fire("keydown", { key: "Escape" }));
  assert.deepEqual(watcher.targets, []);
  assert.equal(app.countDoc("load"), 0);
});

test("scrolling drops the hover frame, whose element has nothing to do with the pointer now", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy");
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  assert.equal(app.root.nodes.hover.hidden, false);
  quiet(() => app.scroll());
  assert.equal(app.root.nodes.hover.hidden, true);
});

test("text colour opens the picker, and writes rgba when it is see-through", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const colorButton = app.root.nodes.row.children.find((b) => b.dataset.key === "color");
  const pop = app.root.nodes.pop;
  const fire = (node, type, event = {}) => {
    for (const fn of node.bubbles[type]?.bubble ?? []) fn(event);
  };
  for (const fn of colorButton.bubbles.click.bubble) fn({});
  assert.equal(pop.className, "pop color", "the picker paints its own surface");
  const panel = pop.children[0];
  const byLabel = (label) => all(panel).find((n) => n.getAttribute?.("aria-label") === label);
  // A colour typed into the value field, and a value that cannot be read.
  const typed = byLabel("Colour value");
  typed.value = "#325578";
  fire(typed, "change");
  assert.equal(p.style.getPropertyValue("color"), "#325578");
  assert.equal(p.style.getPropertyValue("background-color"), "", "the text fill is the text colour, and the box behind it is not");
  typed.value = "not a colour";
  fire(typed, "change");
  assert.equal(p.style.getPropertyValue("color"), "#325578", "what cannot be read changes nothing");
  // The hue is a real range input behind the drawing, so the keyboard has it.
  const hue = byLabel("Hue");
  hue.value = "0";
  fire(hue, "input");
  assert.match(p.style.getPropertyValue("color"), /^#[0-9a-f]{6}$/, "the hue writes a colour");
  assert.notEqual(p.style.getPropertyValue("color"), "#325578");
  // The field is dragged, and its bottom edge is brightness 0.
  const field = all(panel).find((n) => String(n.className) === "field");
  field.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  fire(field, "pointerdown", { clientX: 50, clientY: 100 });
  assert.equal(p.style.getPropertyValue("color"), "#000000", "brightness 0 is black");
  // Any transparency is written as rgba: a hex cannot say it.
  const alpha = byLabel("Alpha");
  alpha.value = "50";
  fire(alpha, "input");
  assert.equal(p.style.getPropertyValue("color"), "rgba(0, 0, 0, 0.5)");
  alpha.value = "100";
  fire(alpha, "input");
  assert.equal(p.style.getPropertyValue("color"), "#000000", "and solid again it is a hex");
  for (const fn of colorButton.bubbles.click.bubble) fn({});
  assert.equal(pop.hidden, true, "clicking colour again closes the picker");
});

test("fill and border are the box, and are behind the + rather than in the dock", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const keys = () => app.root.nodes.row.children.map((b) => b.dataset.key);
  assert.ok(!keys().includes("fill"), "not in the primary dock");
  assert.ok(!keys().includes("border"), "nor border");

  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Fill");
  });
  let swatch = inputOf(pop(app), "color");
  swatch.value = "#d79eac";
  for (const fn of swatch.bubbles.input.bubble) fn({});
  assert.equal(p.style.getPropertyValue("background-color"), "#d79eac");
  assert.equal(p.style.getPropertyValue("color"), "", "fill is not the text colour");

  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  swatch = inputOf(pop(app), "color");
  swatch.value = "#3a283c";
  for (const fn of swatch.bubbles.input.bubble) fn({});
  assert.equal(p.style.getPropertyValue("border-color"), "#3a283c");
});

test("a border colour comes with a width, or it is a colour nobody sees", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  // A colour on a zero-width border paints nothing at all. The width is a
  // field, and the colour bar stands above it.
  typeInto(pop(app), "Border width", 2);
  assert.equal(p.style.getPropertyValue("border-width"), "2px");
  assert.equal(p.style.getPropertyValue("border-style"), "solid", "a width with no style is still nothing");

  typeInto(pop(app), "Border width", 0);
  assert.equal(p.style.getPropertyValue("border-width"), "0px");
  assert.equal(p.style.getPropertyValue("border-style"), "", "and no style left behind");
});

test("a border sits inside the box, on its edge, or outside it", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(pop(app), "Border");
  });
  typeInto(pop(app), "Border width", 4);
  assert.equal(p.style.getPropertyValue("border-width"), "4px", "inside is a border");
  assert.equal(p.style.getPropertyValue("border-style"), "solid");
  assert.equal(p.style.getPropertyValue("box-sizing"), "border-box", "an inside line takes its room from the box");

  /** Open the position list and take one of its words. The panel is drawn again
      when the line moves, so it is found again each time. */
  const sit = (value) => {
    const wrap = all(pop(app)).find((node) => String(node.className) === "custom-select");
    const trigger = all(wrap).find((node) => String(node.className).startsWith("custom-select-trigger"));
    for (const fn of trigger.bubbles.click.bubble) fn({});
    const choice = all(wrap).find((node) => node.dataset?.key === value);
    assert.ok(choice, `no \\"${value}\\" in the list`);
    for (const fn of choice.bubbles.click.bubble) fn({});
  };

  quiet(() => sit("outside"));
  assert.equal(p.style.getPropertyValue("border-width"), "", "outside is not the border any more");
  assert.match(p.style.getPropertyValue("outline"), /^4px solid/, "the line is an outline, on the box edge");
  assert.equal(p.style.getPropertyValue("outline-offset"), "", "nothing pulled in");

  quiet(() => sit("center"));
  assert.equal(p.style.getPropertyValue("outline-offset"), "-2px", "the middle straddles the edge");

  quiet(() => sit("inside"));
  assert.equal(p.style.getPropertyValue("border-width"), "4px", "and back to the border it was");
  assert.equal(p.style.getPropertyValue("outline"), "", "with the outline gone");
});

test("a number turns under the wheel and under a sideways drag", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  const input = all(pop(app)).find((n) => n.getAttribute?.("aria-label") === "Border width");
  let stopped = 0;
  const wheel = (notches) => {
    for (const fn of input.bubbles.wheel.bubble) {
      fn({ deltaY: notches, preventDefault: () => (stopped += 1) });
    }
  };
  const drag = (to) => {
    for (const fn of input.bubbles.pointerdown.bubble) fn({ pointerType: "mouse", button: 0, clientX: 100, preventDefault() {} });
    for (const fn of input.bubbles.pointermove.bubble) fn({ clientX: to });
    for (const fn of input.bubbles.pointerup.bubble) fn({});
  };

  wheel(-1);
  assert.equal(p.style.getPropertyValue("border-width"), "1px", "one notch is one step");
  assert.equal(stopped, 1, "the value takes the wheel, so the page does not scroll");

  // 4px of travel is one step, the same step the wheel and the arrows take.
  drag(140);
  assert.equal(p.style.getPropertyValue("border-width"), "11px");
  assert.equal(input.value, "11");

  // The floor holds however far the drag goes.
  drag(-2000);
  assert.equal(p.style.getPropertyValue("border-width"), "0px");
  assert.equal(input.value, "0");

  // A press that never moves is the precise way in: the value is not turned.
  for (const fn of input.bubbles.pointerdown.bubble) fn({ pointerType: "mouse", button: 0, clientX: 100, preventDefault() {} });
  for (const fn of input.bubbles.pointerup.bubble) fn({});
  assert.equal(input.value, "0", "a click is entry, not adjustment");
});

test("no colour of ours stands in for one the page never wrote", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  quiet(() => press(app, "color"));
  const open = pop(app);
  // The picker draws its own controls. The range inputs behind them are the
  // keyboard's, and the one native picker is the button beside the hue.
  assert.equal(all(open).filter((n) => String(n.className) === "knob").length, 3, "a drawn slider each: saturation, brightness, hue");
  assert.equal(all(open).filter((n) => n.type === "color").length, 1, "and one native picker, opened from the button");
  const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");
  // Nothing invents a colour to fall back on: an element whose colour is a name
  // or an rgb() leaves the UA default alone rather than showing a colour of ours.
  assert.doesNotMatch(source, /swatch\.value = .*#3a283c/, "no ink standing in for an unknown colour");
});

test("the text-colour glyph wears the element own colour, not one of ours", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  p.style.setProperty("color", "rgb(0, 105, 92)");
  app.hover(p);
  app.clickPage();
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === "color");
  // The bar under the A is a readout of this site. Painting it ink on every
  // site claims the site is that colour.
  assert.doesNotMatch(icon.innerHTML, /background:#16233a/, "no colour baked into the glyph");
  // There is nowhere left to read a hex: style.color and getComputedStyle both
  // answer rgb(), so the only route back to a hex is converting what the page
  // wrote — which is arithmetic, not invention.
  p.style.setProperty("color", "rgb(0, 105, 92)");
  assert.match(icon.innerHTML, /id="swatch-color"/, "a chip that shows the element own colour");
  assert.doesNotMatch(icon.innerHTML, /<svg/, "the colour alone, with no glyph over it");
});


test("each element keeps its own additions", () => {
  const { run } = fakeDom();
  const app = run();
  const first = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Shadow");
  });
  const second = app.el("h1", { text: "Second" });
  app.hover(second);
  app.clickPage();
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  const keys = () => app.root.nodes.row.children.map((b) => b.dataset.key);
  assert.deepEqual(keys(), ["family", "size", "weight", "color", "align", "spacing", "decorate", "border", "+"], "a control that arrives from the + lands beside it");

  app.hover(first);
  app.clickPage();
  assert.deepEqual(
    keys(),
    ["family", "size", "weight", "color", "align", "spacing", "decorate", "shadow", "+"],
    "the first element keeps only its own",
  );
});

test("an icon's fill follows the button, so an open control's icon stays visible", () => {
  const { run } = fakeDom();
  const app = run();
  const css = app.root.innerHTML;
  selectText(app);
  // Any dock icon: the rule under test is the wrapper every one of them comes
  // from, not the glyph in it.
  const glyph = app.root.nodes.row.children.find((b) => b.dataset.key === "align").innerHTML;
  // `*{color:...}` reaches the <path> as well as the <svg>, and a path painted
  // with currentColor resolves against its OWN colour — so a universal colour
  // painted every icon the same ink, and an open control is that ink: an icon
  // the exact colour of its own background. The colour goes on :host instead.
  assert.doesNotMatch(css, /\*\{[^}]*color:#16233a/, "no universal colour to leak onto the paths");
  assert.match(css, /:host\{all:initial;color:var\(--ink\)\}/, "the colour is on the host rule, in the same declaration as all:initial — which resets colour itself");
  assert.match(css, /\.ic>svg\{[^}]*color:inherit/, "and the icons take that colour from the button");
  // Scoped to the icon the control holds: a Lucide glyph is its own svg inside that
  // one, and a rule that reached it would draw the glyph 18 units wide in a 256 box.
  assert.doesNotMatch(css, /\.ic svg\{/, "no rule reaches the box a glyph is drawn in");
  assert.match(glyph, /fill="currentColor"/, "a Lucide path paints itself with it");
});

test("every icon draws a Lucide glyph, not the name it is asked for by", () => {
  const { run, el } = fakeDom();
  const app = run();
  selectText(app);
  // A glyph that is named but missing from GLYPHS renders its own name, which is
  // silent everywhere else: this is the one place that would catch it.
  const drawn = (markup) => {
    // A name with no glyph behind it renders as its own text, and an empty box
    // renders as nothing at all: both are silent everywhere else.
    assert.match(markup, /aria-hidden="true">\s*<[a-z]/, `nothing was drawn: ${markup}`);
    assert.match(markup, /<(path|rect|circle|line|polyline|ellipse|polygon)[\s/]/, `no shape drawn: ${markup}`);
    assert.match(markup, /stroke="currentColor"/, `not a Lucide glyph: ${markup}`);
  };
  // The family button is a name and the size button is a field: both are text by
  // design, so only the buttons that carry an icon are checked.
  const row = app.root.nodes.row.children.filter((b) => b.innerHTML.includes("<svg"));
  assert.ok(row.length >= 4, "the row should be mostly icons");
  for (const button of row) drawn(button.innerHTML);
  // The element menu and the row's `+` are drawn the same way. The two glyphs the
  // shadow root itself is built with are already in its markup, so they are read
  // there: a name with no glyph behind it would sit there as its own text.
  drawn(app.root.nodes["element-menu"].children[0].children[0].innerHTML);
  drawn(row[row.length - 1].innerHTML);
  assert.doesNotMatch(app.root.innerHTML, />"[a-z-]+"</, "no name rendered as a glyph");

  // The alignment control is nine cells with no glyph in them: the cell is the
  // mark, and the one that is picked is filled.
  assert.match(source, /var ALIGN_CELLS = \[\s*\{ v: "flex-start:flex-start", label: "Top left" \}/, "the nine cells are named once");
  assert.doesNotMatch(source, /ALIGN_GRID|ALIGN_FRAME/, "no mark is drawn inside a cell");

  // The container dock is the other place a glyph is picked per control.
  const box = el("div");
  quiet(() => {
    app.hover(box);
    app.clickPage();
  });
  assert.equal(app.root.selection().kind, "container");
  const alignment = app.root.nodes.row.children.find((b) => b.dataset.key === "alignment");
  drawn(alignment.innerHTML);
});

test("the dock opens with nothing selected, and offers no Add choice", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  assert.equal(app.root.selection(), null);
  assert.equal(app.root.nodes.dock.hidden, false, "the dock is up before a selection");
  assert.equal(app.root.nodes.row.hidden, true, "with no controls: nothing is selected");
  assert.equal(app.root.nodes.pop.hidden, true, "and no list opens on its own");
  assert.equal(app.root.nodes.create, undefined, "there is no Add element button");
});

test("the dock ends in a + that adds a control to the row", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const row = app.root.nodes.row;
  const plus = row.children[row.children.length - 1];
  assert.equal(plus.dataset.key, "+", "the + is the last thing in the row");
  assert.match(plus.innerHTML, /<path d="M5 12h14"/, "a plus, drawn");
  const before = row.children.length;
  quiet(() => press(app, "+"));
  // What it offers is the additions, as a list under the dock.
  const pop = app.root.nodes.pop;
  assert.deepEqual(
    pop.children[0].children.map((b) => b.getAttribute("aria-label")),
    ["Shadow", "Fill", "Border", "Padding", "Margin"],
  );
  // Picking one puts it in the row, and opens the control that was just picked.
  quiet(() => pickOption(pop, "Shadow"));
  assert.equal(row.children.length, before + 1);
  const added = row.children.find((b) => b.dataset.key === "shadow");
  assert.ok(added, "the new icon is in the row");
  assert.equal(added.getAttribute("aria-expanded"), "true", "and its control is open");
  assert.ok(added.innerHTML.startsWith("<svg"), "drawn like every other icon");
});

test("a control can only be added once", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Shadow");
    press(app, "+");
  });
  const names = app.root.nodes.pop.children[0].children.map((b) => b.getAttribute("aria-label"));
  // Shadow is gone because this element has it; the box controls are still
  // on offer, since only Shadow was ever added.
  assert.deepEqual(names, ["Fill", "Border", "Padding", "Margin"]);
});

test("a shadow is one shorthand, and the words wear their own", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Shadow");
  });
  const grid = pop(app).children[0];
  assert.equal(grid.children.length, 3, "x, y and blur: words have no spread");
  const fieldValue = (i, value) => {
    const input = grid.children[i].children[1];
    input.value = value;
    for (const fn of input.bubbles.input.bubble) fn({});
  };
  fieldValue(1, "10"); // y offset
  fieldValue(2, "24"); // blur
  // The number lives in the field, and nothing is written beside it: no unit to
  // read twice, no value said a second time.
  assert.equal(grid.children[1].children.length, 2, "a label and a field, with no unit beside them");
  assert.equal(grid.children[1].children[0].textContent, "Y");
  // A shadow on words is the letters' own: text-shadow, not the block's box.
  assert.equal(p.style.getPropertyValue("text-shadow"), "0px 10px 24px", "x, y, blur and the colour to come");
  assert.equal(p.style.getPropertyValue("box-shadow"), "", "the box is left alone");
  // Five invented properties would draw nothing at all: CSS has no
  // box-shadow-offset-x outside an @property registration.
  assert.equal(p.style.getPropertyValue("box-shadow-offset-x"), "", "and no invented longhand");
  // Back to nothing: zero lengths cast nothing, so nothing is written.
  for (const i of [0, 1, 2]) fieldValue(i, "0");
  assert.equal(p.style.getPropertyValue("text-shadow"), "", "no shadow left behind");
});

test("a box shadow keeps its spread, and opens on the one the page has", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  box.computed = { "box-shadow": "rgba(22, 35, 58, 0.25) 2px 4px 8px 6px" };
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    press(app, "+");
    pickOption(app.root.nodes.pop, "Shadow");
  });
  const grid = pop(app).children[0];
  assert.equal(grid.children.length, 4, "the offsets, the blur and the spread");
  assert.equal(grid.children[1].children[1].value, 4, "the shadow the page has is read off its shorthand");
  assert.equal(grid.children[3].children[1].value, 6, "spread included");
  const input = grid.children[3].children[1];
  input.value = "10";
  for (const fn of input.bubbles.input.bubble) fn({});
  assert.match(box.style.getPropertyValue("box-shadow"), /^2px 4px 8px 10px /, "spread sits before the colour");
});

test("every change is still undone on exit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Padding");
  });
  typeInto(pop(app), "Top and bottom padding", 12);
  assert.equal(p.style.getPropertyValue("padding-top"), "12px");
  press(app, "+");
  quiet(() => app.fire("keydown", { key: "Escape" })); // the control
  quiet(() => app.fire("keydown", { key: "Escape" })); // then the mode
  assert.equal(p.style.getPropertyValue("padding-top"), "", "the page is back as it was");
});









/** Type a size into the open size control, as a user would. */
const setSize = (app, px) => {
  const input = app.root.nodes.row.children.find((b) => b.dataset.key === "size").children[0];
  input.value = String(px);
  for (const fn of input.bubbles.input.bubble) fn({});
  for (const fn of input.bubbles.change?.bubble ?? []) fn({});
};

/** Open the edits list. */
const openEdits = (app) => {
  for (const fn of app.root.nodes.review.bubbles.click.bubble) fn({});
  return app.root.nodes.pop;
};

test("the edits button counts the elements that really changed", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  assert.equal(app.root.nodes.count.hidden, true, "nothing to count yet");
  setSize(app, 40);
  assert.equal(app.root.nodes.count.hidden, false);
  assert.equal(app.root.nodes.count.textContent, "1");
});

test("a value dragged back to where it was is not an edit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  setSize(app, 40);
  // "" is what the stylesheet had: the record knows, so the edit is gone.
  const input = app.root.nodes.row.children.find((b) => b.dataset.key === "size").children[0];
  input.value = "16";
  p.style.removeProperty("font-size");
  assert.equal(app.win.__edityy_changes(), "", "no edits, no prompt");
});

test("the edits list names each element, and reverts one without the others", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  setSize(app, 40);
  const q = app.el("h2", { text: "second" });
  app.hover(q);
  quiet(() => app.clickPage());
  setSize(app, 20);

  const open = openEdits(app);
  assert.equal(app.root.nodes.review.getAttribute("aria-expanded"), "true");
  const lines = open.children[0].children;
  assert.equal(lines.length, 2);
  assert.match(lines[0].children[0].title, /p “hello”/);
  assert.match(shown(lines[0].children[0]), /1 edit$/);

  const undo = lines[0].children[1];
  quiet(() => { for (const fn of undo.bubbles.click.bubble) fn({}); });
  assert.equal(p.style.getPropertyValue("font-size"), "", "the first is back as it was");
  assert.equal(q.style.getPropertyValue("font-size"), "20px", "the second is untouched");
  assert.equal(app.root.nodes.pop.children[0].children.length, 1, "and the list redrew");
  assert.equal(app.root.nodes.count.textContent, "1");
});

test("the edits are copied as a prompt a coding agent can act on", async () => {
  const { run } = fakeDom();
  const app = run();
  let copied = null;
  app.win.navigator = { clipboard: { writeText: async (v) => { copied = v; } } };
  const p = selectText(app, true);
  p.computed = { "font-size": "16px" };
  p.getAttribute = (k) => (k === "data-edityy-src" ? "src/App.tsx:12:7" : undefined);
  setSize(app, 40);
  p.textContent = "hello there";

  const open = openEdits(app);
  const copy = open.children[1].children[0];
  assert.equal(copy.disabled, false);
  for (const fn of copy.bubbles.click.bubble) fn({});
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(copied, app.win.__edityy_changes());
  assert.match(copied, /^# Visual edits from Edityy/);
  assert.match(copied, /not with inline styles/);
  assert.match(copied, /## 1\. p “hello there”/);
  assert.match(copied, /- Source: `src\/App\.tsx:12:7`\n/);
  assert.match(copied, /- `font-size`: `16px` → `40px`/, "before is what the page showed, not the empty inline value");
  assert.match(copied, /- Text: "hello" → "hello there"/);
  assert.doesNotMatch(copied, /outline/, "Edityy's own focus-ring change is not an edit");
  assert.equal(copy.textContent, "Copied");
});

test("an element is found again by a short selector", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => app.click());
  const list = el("ul");
  list.getAttribute = () => undefined;
  const items = [app.el("li", { text: "one" }), app.el("li", { text: "two" })];
  for (const item of items) list.appendChild(item);
  const section = el("section");
  section.id = "pricing";
  section.appendChild(list);
  app.hover(items[1]);
  quiet(() => app.clickPage());
  setSize(app, 30);
  assert.match(app.win.__edityy_changes(), /- Selector: `#pricing > ul > li:nth-of-type\(2\)`/);
});

test("with nothing edited the list says so and nothing can be copied", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const open = openEdits(app);
  assert.match(shown(open.children[0]), /No edits yet/);
  assert.equal(open.children[1].children[0].disabled, true);
});

/** Press a key with modifiers; returns whether the payload took it. */
const key = (app, k, mods = {}) => {
  let prevented = false;
  quiet(() => app.fire("keydown", { key: k, ...mods, preventDefault: () => (prevented = true), stopPropagation() {} }));
  return prevented;
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test("page fields keep keyboard shortcuts while Edityy is active", () => {
  const { run, el } = fakeDom();
  const app = run();
  const p = selectText(app);
  const field = el("input");
  const target = app.root.selection().el;
  for (const [keyName, mods] of [["ArrowRight", {}], ["A", { shiftKey: true }], ["Escape", {}], ["z", { metaKey: true }]]) {
    assert.equal(key(app, keyName, { ...mods, target: field }), false, keyName + " belongs to the page field");
    assert.equal(app.root.selection().el, target, keyName + " must not change Edityy's selection");
  }
  assert.equal(p, target);
});

test("a replaced selected element clears its editor chrome on refit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  assert.equal(app.root.nodes.sel.hidden, false);
  assert.equal(app.root.nodes.dock.hidden, false);
  p.isConnected = false;
  app.scroll();
  assert.equal(app.root.selection(), null);
  assert.equal(app.root.nodes.sel.hidden, true);
  assert.equal(app.root.nodes.row.hidden, true);
  assert.equal(app.root.nodes["element-menu"].hidden, true);
  assert.equal(app.root.nodes.hint.hidden, false);
  assert.match(app.root.nodes.hint.textContent, /replaced/);
});

test("a re-rendered element is taken up again, so the dock keeps its row", () => {
  const { run, el } = fakeDom();
  const app = run();
  const p = selectText(app);
  const again = el("p", { text: "hello" });
  // The page's own selector finds the element that replaced the first one.
  app.doc.found = again;
  p.isConnected = false;
  app.scroll();
  assert.equal(app.root.selection().el, again);
  assert.equal(app.root.nodes.row.hidden, false);
  assert.equal(app.root.nodes.sel.hidden, false);
  assert.equal(app.root.nodes.hint.hidden, true);
});

test("⌘Z undoes the last edit and ⇧⌘Z redoes it", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  setSize(app, 40);
  await tick();
  setSize(app, 50);
  await tick();
  // Two edits to the same property, each committed, are two steps.
  assert.equal(key(app, "z", { metaKey: true }), true);
  assert.equal(p.style.getPropertyValue("font-size"), "40px");
  assert.equal(key(app, "z", { ctrlKey: true }), true, "Ctrl on other systems");
  assert.equal(p.style.getPropertyValue("font-size"), "");
  assert.equal(key(app, "z", { metaKey: true }), false, "nothing left: the browser gets the key");
  assert.equal(key(app, "z", { metaKey: true, shiftKey: true }), true);
  assert.equal(p.style.getPropertyValue("font-size"), "40px");
  assert.equal(key(app, "y", { ctrlKey: true }), true);
  assert.equal(p.style.getPropertyValue("font-size"), "50px");
});

test("one drag is one step, however many inputs it fires", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  const width = all(pop(app)).find((n) => n.getAttribute?.("aria-label") === "Border width");
  assert.ok(width, "the width field is in the border control");
  for (const v of [2, 4, 6, 8]) {
    width.value = String(v);
    for (const fn of width.bubbles.input.bubble) fn({});
  }
  await tick();
  assert.equal(p.style.getPropertyValue("border-width"), "8px");
  key(app, "z", { metaKey: true });
  assert.equal(p.style.getPropertyValue("border-width"), "", "straight back to no border");
});

test("a border's width and style are undone together", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  // The border's own width field, not the picker's alpha.
  const width = all(pop(app)).find((n) => n.getAttribute?.("aria-label") === "Border width");
  assert.ok(width, "the width field is in the border control");
  width.value = "3";
  for (const fn of width.bubbles.input.bubble) fn({});
  await tick();
  assert.equal(p.style.getPropertyValue("border-style"), "solid");
  key(app, "z", { metaKey: true });
  assert.equal(p.style.getPropertyValue("border-width"), "");
  assert.equal(p.style.getPropertyValue("border-style"), "");
});

test("after typing, ⌘Z is the browser's text undo, not ours", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, true);
  setSize(app, 40);
  await tick();
  await new Promise((r) => setTimeout(r, 2));
  p.textContent = "hello!";
  app.fire("input", {});
  assert.equal(key(app, "z", { metaKey: true }), false, "left to the browser");
  assert.equal(p.style.getPropertyValue("font-size"), "40px");
});

test("a reverted element has nothing left to undo", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  setSize(app, 40);
  await tick();
  const open = openEdits(app);
  const undoBtn = open.children[0].children[0].children[1];
  quiet(() => { for (const fn of undoBtn.bubbles.click.bubble) fn({}); });
  assert.equal(key(app, "z", { metaKey: true }), false);
  assert.equal(p.style.getPropertyValue("font-size"), "");
});

/** A sessionStorage that keeps strings, as a browser's does. */
const memoryStorage = () => {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};
/** Fire the window's load event, as the browser does once the page is in. */
const load = async (win) => {
  // Idle as soon as asked: the page in a test has nothing left to hydrate.
  win.requestIdleCallback ??= (fn) => setTimeout(fn, 0);
  for (const fn of win.bubbles?.load?.bubble ?? []) fn({});
  await tick();
  await tick();
};

test("edits survive a reload, and the mode comes back on", async () => {
  const store = memoryStorage();
  const first = fakeDom();
  first.win.sessionStorage = store;
  const app = first.run();
  const p = selectText(app, true);
  p.id = "intro";
  setSize(app, 40);
  p.textContent = "hello again";
  app.fire("input", {});
  // Typing writes once the keys stop; leaving the page writes at once.
  assert.equal(JSON.parse(store.getItem("edityy:/")).edits.length, 0, "not on each key");
  for (const fn of first.win.bubbles.pagehide.bubble) fn({});
  const saved = JSON.parse(store.getItem("edityy:/"));
  assert.equal(saved.edits.length, 1);
  assert.equal(saved.edits[0].selector, "#intro");
  assert.equal(saved.edits[0].props["font-size"].now, "40px");
  assert.equal(saved.edits[0].props.outline, undefined, "Edityy's own outline is not an edit to keep");

  // The page reloads: a fresh DOM with the same element in it, as the server
  // sent it, and the same session storage.
  const second = fakeDom();
  second.win.sessionStorage = store;
  const fresh = second.text("p", "hello");
  second.doc.querySelector = (sel) => (sel === "#intro" ? fresh : null);
  const again = second.run();
  await load(second.win);
  assert.equal(fresh.style.getPropertyValue("font-size"), "40px");
  assert.equal(fresh.textContent, "hello again");
  assert.ok(again.countDoc("click") > 0, "the mode is on again");
  assert.equal(again.root.nodes.count.textContent, "1", "and the edits button counts them");
  assert.match(again.win.__edityy_changes(), /`font-size`: `[^`]*` → `40px`/);

  // And leaving the mode reverts the restored edits like any others, and
  // forgets them.
  quiet(() => {
    again.fire("keydown", { key: "Escape" }); // close initial Add choices
    again.fire("keydown", { key: "Escape" }); // exit the mode
  });
  assert.equal(fresh.style.getPropertyValue("font-size"), "");
  assert.equal(fresh.textContent, "hello");
  assert.equal(store.getItem("edityy:/"), null);
});

test("a rule kept in the session comes back with its stylesheet", async () => {
  const store = memoryStorage();
  store.setItem(
    "edityy:/",
    JSON.stringify({
      v: 1,
      edits: [
        {
          selector: "#intro",
          props: {
            "@|:hover|background": { before: "", set: false, was: "", now: "red" },
            "@(max-width: 640px)||padding": { before: "", set: false, was: "", now: "8px" },
          },
          text: null,
          added: [],
        },
      ],
    }),
  );
  const dom = fakeDom();
  dom.win.sessionStorage = store;
  const fresh = dom.text("p", "hello");
  fresh.id = "intro";
  dom.doc.querySelector = (sel) => (sel === "#intro" ? fresh : null);
  const app = dom.run();
  await load(dom.win);
  const sheets = () => dom.doc.body.children.filter((node) => node.tagName === "STYLE");
  assert.equal(sheets().length, 1, "the rule comes back in a sheet of its own");
  assert.equal(sheets()[0].textContent, "#intro:hover{background: red}\n@media (max-width: 640px){#intro{padding: 8px}}");

  // Leaving the mode takes the sheet away with the rule.
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(sheets().length, 0);
});

test("an edit whose element is gone is dropped, not applied somewhere else", async () => {  const store = memoryStorage();
  store.setItem("edityy:/", JSON.stringify({ v: 1, edits: [{ selector: "#gone", props: { color: { before: "", set: false, was: "red", now: "blue" } }, text: null, added: [] }] }));
  const dom = fakeDom();
  dom.win.sessionStorage = store;
  dom.doc.querySelector = () => null;
  const app = dom.run();
  await load(dom.win);
  assert.equal(app.win.__edityy_changes(), "");
});

test("storage that throws does not break the editor", async () => {
  const dom = fakeDom();
  Object.defineProperty(dom.win, "sessionStorage", { get() { throw new Error("SecurityError"); } });
  const app = dom.run();
  await load(dom.win);
  const p = selectText(app);
  setSize(app, 30);
  assert.equal(p.style.getPropertyValue("font-size"), "30px");
});

test("leaving the mode with no edits does not bring it back on reload", () => {
  const store = memoryStorage();
  const dom = fakeDom();
  dom.win.sessionStorage = store;
  const app = dom.run();
  quiet(() => app.click());
  assert.notEqual(store.getItem("edityy:/"), null, "on while the mode is");
  quiet(() => app.click());
  assert.equal(store.getItem("edityy:/"), null);
});

/** A small tree: section > (h2, p, img). */
const tree = (dom) => {
  const section = dom.el("section");
  section.getAttribute = () => undefined;
  const h2 = dom.text("h2", "Title");
  const p = dom.text("p", "Body");
  const img = dom.el("img");
  for (const n of [h2, p, img]) section.appendChild(n);
  const outer = dom.el("main");
  outer.appendChild(section);
  return { outer, section, h2, p, img };
};
const arrow = (app, k, mods = {}) => key(app, k, mods);

test("arrows move the selection to the parent, a child or a sibling", () => {
  const dom = fakeDom();
  const app = dom.run();
  const t = tree(dom);
  quiet(() => app.click());
  app.hover(t.img);
  quiet(() => app.clickPage());
  assert.equal(app.root.selection().el, t.img);
  assert.equal(arrow(app, "ArrowLeft"), true, "the page does not scroll");
  assert.equal(app.root.selection().el, t.p);
  quiet(() => arrow(app, "ArrowLeft", { altKey: true })); // in words, Alt is needed
  assert.equal(app.root.selection().el, t.h2);
  quiet(() => arrow(app, "ArrowUp", { altKey: true }));
  assert.equal(app.root.selection().el, t.section);
  assert.equal(app.root.selection().kind, "container");
  quiet(() => arrow(app, "ArrowUp"));
  assert.equal(app.root.selection().el, t.outer);
  assert.equal(arrow(app, "ArrowUp"), false, "nothing above: not the body");
  quiet(() => arrow(app, "ArrowDown"));
  assert.equal(app.root.selection().el, t.section);
  quiet(() => arrow(app, "ArrowDown"));
  assert.equal(app.root.selection().el, t.h2, "the first child");
});

test("in words being typed into, a bare arrow moves the caret, not the selection", () => {
  const dom = fakeDom();
  const app = dom.run();
  const t = tree(dom);
  quiet(() => app.click());
  app.hover(t.p);
  quiet(() => app.clickPage());
  app.action("Edit text");
  assert.equal(arrow(app, "ArrowUp"), false);
  assert.equal(app.root.selection().el, t.p);
});

test("an arrow on one of our own controls is the control's", () => {
  const dom = fakeDom();
  const app = dom.run();
  const t = tree(dom);
  quiet(() => app.click());
  app.hover(t.img);
  quiet(() => app.clickPage());
  assert.equal(arrow(app, "ArrowLeft", { composedPath: () => [app.host] }), false);
  assert.equal(app.root.selection().el, t.img);
});

test("padding moves all four sides at once, or one pair at a time", async () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    press(app, "+");
    pickOption(app.root.nodes.pop, "Padding");
  });
  const type = (input, value) => {
    input.value = value;
    for (const fn of input.bubbles.input.bubble) fn({});
    for (const fn of input.bubbles.change.bubble) fn({});
  };
  const link = (name) => {
    const toggle = all(pop(app)).find((n) => n.getAttribute?.("aria-label") === name);
    assert.ok(toggle, `no link "${name}"`);
    for (const fn of toggle.bubbles.click.bubble) fn({});
    return toggle;
  };
  // A field of a pair that is put away is not a control the user can see.
  const shownFields = () => fields(pop(app)).filter((n) => n.type === "number" && !n.parentElement?.hidden);
  const tied = shownFields();
  assert.deepEqual(tied.map((n) => n.getAttribute("aria-label")), ["Top and bottom padding", "Left and right padding"], "one field per pair, and no field per side");
  assert.equal(fields(pop(app)).some((n) => n.type === "range"), false, "the fields are the control: no bar beside them");
  // Each pair writes its two sides, and the other pair does not move.
  type(tied[0], "24");
  assert.equal(box.style.getPropertyValue("padding-left"), "", "the other pair is left where it was");
  await tick();
  type(tied[1], "24");
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.equal(box.style.getPropertyValue("padding-" + side), "24px", side);
  }
  await tick();

  // One field of a tied pair writes both of its sides.
  type(tied[0], "8");
  assert.equal(box.style.getPropertyValue("padding-top"), "8px");
  assert.equal(box.style.getPropertyValue("padding-bottom"), "8px", "its pair follows");
  assert.equal(box.style.getPropertyValue("padding-left"), "24px", "the other pair stays");
  assert.equal(tied[1].value, "24", "and the field beside it is untouched");
  await tick();

  // The link breaks the pair into a field per side.
  assert.equal(link("Top and bottom padding together").getAttribute("aria-pressed"), "false");
  const apart = shownFields();
  assert.deepEqual(apart.map((n) => n.getAttribute("aria-label")), ["Top padding", "Bottom padding", "Left and right padding"], "the pair is two fields now");
  assert.deepEqual(apart.map((n) => n.value), ["8", "8", "24"], "and both of them say what the pair said");
  type(apart[1], "12");
  assert.equal(box.style.getPropertyValue("padding-bottom"), "12px");
  assert.equal(box.style.getPropertyValue("padding-top"), "8px", "only the side that was typed into");
  await tick();

  key(app, "z", { metaKey: true });
  assert.equal(box.style.getPropertyValue("padding-bottom"), "8px", "one side undoes alone");
  key(app, "z", { metaKey: true });
  assert.equal(box.style.getPropertyValue("padding-bottom"), "24px", "the tied pair undoes as one");
  assert.equal(box.style.getPropertyValue("padding-top"), "24px");
  key(app, "z", { metaKey: true });
  assert.equal(box.style.getPropertyValue("padding-left"), "", "the other pair undoes as one too");
  assert.equal(box.style.getPropertyValue("padding-top"), "24px", "and leaves the first pair alone");
});

test("margin can go negative, and is reverted on exit", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    press(app, "+");
    pickOption(app.root.nodes.pop, "Margin");
  });
  const top = fields(pop(app)).filter((n) => n.type === "number")[0];
  assert.equal(top.min, "-160");
  top.value = "-12";
  for (const fn of top.bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("margin-top"), "-12px");
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(box.style.getPropertyValue("margin-top"), "");
});

test("the row is one toolbar with one tab stop, and the arrows walk it", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  assert.match(app.root.innerHTML, /id="row" role="toolbar" aria-label="Edit controls"/);
  const row = app.root.nodes.row;
  const stops = () => row.children.map((b) => b.getAttribute("tabindex"));
  assert.deepEqual(stops().filter((t) => t === "0").length, 1, "one tab stop");
  assert.equal(stops()[0], "0");
  let focused = null;
  for (const b of row.children) b.focus = () => (focused = b);
  const send = (k, target) => {
    for (const fn of row.bubbles.keydown.bubble) fn({ key: k, target, preventDefault() {}, stopPropagation() {} });
  };
  send("ArrowLeft", row.children[0]);
  assert.equal(focused, row.children[row.children.length - 1], "wraps to the end");
  assert.equal(stops()[row.children.length - 1], "0");
  send("Home", focused);
  assert.equal(focused, row.children[0]);
  send("ArrowRight", focused);
  assert.equal(focused, row.children[1]);
});

test("Escape on an open control puts focus back on its icon", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === "spacing");
  let focused = null;
  icon.focus = () => (focused = icon);
  quiet(() => press(app, "spacing"));
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(focused, icon);
  assert.equal(icon.getAttribute("tabindex"), "0", "and it holds the tab stop");
});

test("Tab from the page reaches the dock, and Tab from an open control steps into its panel", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const row = app.root.nodes.row;
  const pop = app.root.nodes.pop;
  let focused = null;
  row.children.forEach((b) => (b.focus = () => (focused = b)));
  const tab = (extra = {}) => {
    let prevented = false;
    quiet(() => app.fire("keydown", { key: "Tab", preventDefault: () => (prevented = true), stopPropagation() {}, ...extra }));
    return prevented;
  };
  // The dock is mounted after the page: Tab from the page goes to the dock,
  // not through every link on the way.
  assert.equal(tab(), true);
  assert.equal(focused, row.children[0], "the row's tab stop");
  // Inside the chrome, and backwards, Tab is the browser's: focus is not held.
  focused = null;
  assert.equal(tab({ composedPath: () => [row.children[0], app.host] }), false);
  assert.equal(tab({ shiftKey: true }), false);
  assert.equal(focused, null);
  // Tab from an open control steps into its panel.
  const icon = quiet(() => press(app, "spacing"));
  const inPanel = [];
  const mark = (n) => (n.children ?? []).forEach((c) => {
    c.focus = () => (focused = c);
    inPanel.push(c);
    mark(c);
  });
  mark(pop);
  const tabIn = () => {
    for (const fn of app.root.nodes.dock.bubbles.keydown.bubble) fn({ key: "Tab", target: icon, preventDefault() {} });
  };
  tabIn();
  assert.ok(inPanel.includes(focused), "focus is in the panel");
  assert.match(focused.tagName, /^(BUTTON|INPUT|SELECT|TEXTAREA)$/);
  // Tab off the panel's end comes back to the control; the next Tab moves on.
  const fromPanel = focused;
  focused = null;
  quiet(() => row.bubbles.focusin.bubble.forEach((fn) => fn({ target: icon, relatedTarget: fromPanel })));
  tabIn();
  assert.equal(focused, null, "not back into the panel");
  // A row rebuilt under the keyboard keeps focus on the same control.
  app.root.activeElement = row.children[2];
  const key = row.children[2].dataset.key;
  selectText(app);
  assert.equal(row.children.find((b) => b.getAttribute("tabindex") === "0").dataset.key, key);
});

test("reduced motion stops every animation and every transition", () => {
  const { run } = fakeDom();
  const app = run();
  // One rule, and it reaches everything the chrome has: every duration
  // collapses, every animation runs once and stops, every delay goes. A list
  // of selectors would have to be kept in step with the sheet by hand, and it
  // would always be one rule behind.
  assert.match(
    app.root.innerHTML,
    /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0ms!important\}\}/,
  );
});

test("Save to project posts the edits as JSON to the dev server", async () => {
  const { run } = fakeDom();
  const app = run();
  const sent = [];
  app.win.fetch = async (url, init) => {
    sent.push({ url, init });
    return { status: 200, json: async () => ({ ok: true, path: ".edityy/changes.json" }) };
  };
  selectText(app);
  setSize(app, 40);
  const open = openEdits(app);
  const save = open.children[1].children[1];
  assert.equal(save.dataset.key, "save");
  for (const fn of save.bubbles.click.bubble) fn({});
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "/__edityy/changes");
  assert.equal(sent[0].init.method, "POST");
  assert.equal(sent[0].init.headers["content-type"], "application/json");
  const body = JSON.parse(sent[0].init.body);
  assert.equal(body.changes.length, 1);
  assert.equal(body.changes[0].props[0].prop, "font-size");
  assert.equal(body.changes[0].removed, false);
  assert.equal(body.changes[0].moved, false);
  assert.equal(body.changes[0].movedTo, null);
  assert.equal(body.changes[0].rec, undefined, "no live element on the wire");
  assert.match(body.markdown, /# Visual edits from Edityy/);
  assert.equal(save.textContent, "Saved to .edityy/changes.json");
});

test("with no save endpoint the button says so", async () => {  const { run } = fakeDom();
  const app = run();
  app.win.fetch = async () => ({ status: 404, json: async () => ({}) });
  selectText(app);
  setSize(app, 40);
  const save = openEdits(app).children[1].children[1];
  for (const fn of save.bubbles.click.bubble) fn({});
  await tick();
  assert.equal(save.textContent, "No save endpoint");
});

test("an edit drops the hover frame, which was measured at the old size", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  // The pointer is still over the words, so the hover frame is up.
  for (const fn of app.doc.bubbles.mousemove.capture) fn({ clientX: 1, clientY: 1 });
  assert.equal(app.root.nodes.hover.hidden, false);
  setSize(app, 72);
  assert.equal(app.root.nodes.hover.hidden, true, "no frame at the size the words used to be");
  assert.equal(p.style.getPropertyValue("font-size"), "72px");
});

test("the dock is fixed at the bottom centre, and the menu sits at the element", () => {
  const { run } = fakeDom();
  const app = run();
  const dock = app.root.nodes.dock;
  const menu = app.root.nodes["element-menu"];
  selectText(app);
  assert.equal(dock.hidden, false, "a selection opens the dock");
  assert.equal(menu.hidden, false, "the menu is its own card");
  assert.notEqual(menu.parentElement, dock, "the menu is not a row of the dock");
  // One place for every selection: the sheet puts the dock at the bottom centre,
  // and the dock holds no coordinates of its own.
  assert.equal(dock.style.left, "");
  assert.equal(dock.style.top, "");
  // The menu is placed at the element: under it where the page has room.
  assert.equal(menu.style.left, "12px", "clamped into view");
  assert.equal(menu.style.top, "28px", "under the element");
  // A scroll and an open control move the dock nowhere, and re-place the menu.
  quiet(() => app.scroll());
  quiet(() => press(app, "spacing"));
  assert.equal(app.root.nodes.pop.hidden, false, "the control is open");
  assert.equal(dock.style.left, "", "the dock holds its one place");
  assert.match(app.root.nodes.pop.style.left, /px$/,
    "the control places the panel from its own centre");});

test("the element card stands clear of the dock and inside the viewport", () => {
  const { run } = fakeDom();
  const app = run();
  const dock = app.root.nodes.dock;
  const menu = app.root.nodes["element-menu"];
  // The card is 270 by 92; the dock is a row at the bottom centre of the 1200
  // by 800 viewport.
  menu.offsetHeight = 92;
  dock.getBoundingClientRect = () => ({ left: 400, top: 740, right: 800, bottom: 776, width: 400, height: 36 });
  const at = (left, top, height = 40) => ({ left, top, right: left + 100, bottom: top + height, width: 100, height });
  const p = selectText(app);
  const place = (rect) => {
    p.getBoundingClientRect = () => rect;
    quiet(() => app.scroll());
  };
  // Room under the element, clear of the dock: the card keeps its place there.
  place(at(500, 100));
  assert.equal(menu.style.top, "148px");
  // Under the element would come down onto the dock: the card goes above it.
  place(at(500, 600));
  assert.equal(menu.style.top, "500px", "above the element");
  // Off to one side of the dock, the bottom of the viewport is the floor.
  place(at(900, 600));
  assert.equal(menu.style.top, "648px", "under the element, beside the dock");
  // An element behind the dock: the card sits just above the dock.
  place(at(500, 745, 20));
  assert.equal(menu.style.top, "640px", "its bottom 8px over the dock");
  // Near each edge the card stays 12px inside the viewport.
  place(at(500, 0, 800));
  assert.equal(menu.style.top, "12px", "12px down from the top edge");
  place(at(1180, 900));
  assert.equal(menu.style.left, "918px", "12px in from the right edge");
  assert.equal(menu.style.top, "696px", "12px up from the bottom edge");
});

test("a variation request waits for the agent, and keys 1 to 5 switch the element", async () => {
  const { run } = fakeDom();
  const app = run();
  const sent = [];
  let polls = 0;
  const variations = [
    { label: "thin grey", props: [{ property: "scrollbar-width", value: "thin" }, { property: "scrollbar-color", value: "#8a8a8a transparent" }] },
    {
      label: "rose pill",
      props: [
        { property: "scrollbar-color", value: "#f43f5e #f4f4f5" },
        { property: "background", value: "#f4f4f5", on: ":hover" },
        { property: "padding", value: "8px", when: "(max-width: 640px)" },
      ],
    },
  ];
  app.win.fetch = async (url, init = {}) => {
    sent.push({ url, init });
    if (init.method === "POST") return { status: 200, json: async () => ({ ok: true, requestId: "v1" }) };
    if (init.method === "DELETE") return { status: 200, json: async () => ({ ok: true }) };
    polls += 1;
    // One poll with no answer, which is the wait the user sees, then the answer.
    return { status: 200, json: async () => (polls === 1 ? { ok: true, pending: true } : { ok: true, requestId: "v1", variations }) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  const el = selectText(app);
  const menu = app.root.nodes["element-menu"];
  const strip = app.root.nodes.variants;
  const inMenu = (label) => menu.children[0].children
    .flatMap((child) => (child.children.length ? child.children : [child]))
    .find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  app.action("Variations");
  const box = menu.children[0];
  const count = box.children[0].children[1];
  const area = box.children[1];
  assert.equal(box.children[0].children[0].nodeValue, "Number of variants");
  assert.equal(count.type, "number", "the box asks how many variants first");
  assert.deepEqual([count.min, count.max, count.value], ["2", "10", "3"], "three unless the user says otherwise");
  assert.equal(area.getAttribute("aria-label"), "What to vary");
  assert.equal(area.placeholder, "Optional comment, such as: thinner and darker");
  count.value = "2";
  area.value = "  thinner and darker  ";
  const ask = inMenu("Send the variations request to the agent");
  for (const fn of ask.bubbles.click.bubble) fn({});
  // The box morphs to the waiting card: the words, the keyword as a chip, where
  // to say what they want, the connect hint, and the X. The fields and Send are
  // gone.
  const waiting = menu.children[0];
  assert.equal(waiting.className, "wait");
  assert.equal(waiting.children.length, 4);
  const head = waiting.children[0];
  assert.equal(head.className, "wait-head");
  assert.equal(head.children[0].children[1].nodeValue, "Waiting for your agent");
  assert.equal(head.children[1].getAttribute("aria-label"), "Cancel the variation request");
  assert.deepEqual(waiting.children[1].children.map((node) => node.nodeValue ?? node.children[0].nodeValue), ["Ask it:", "vartest"]);
  assert.equal(waiting.children[2].children[0].nodeValue, "Say what you want in the same message.");
  assert.deepEqual(
    waiting.children[3].children.map((node) => node.nodeValue ?? node.children[0].nodeValue),
    ["Not connected? Add it:", "npx edityy mcp"],
    "how to connect the server, set off from the lines above",
  );
  assert.equal(inMenu("Send the variations request to the agent"), undefined, "the fields are put away");
  assert.equal(inMenu("What to vary"), undefined);

  await tick();
  const request = JSON.parse(sent[0].init.body);
  assert.equal(sent[0].url, "/__edityy/variations");
  assert.equal(sent[0].init.method, "POST");
  assert.equal(request.count, 2, "the number the user chose");
  assert.equal(request.prompt, "thinner and darker");
  assert.equal(request.element.tag, "p", "the tag, not the source code");
  assert.equal(request.element.selector, "p");
  assert.deepEqual(request.element.values, [{ property: "display", value: "block" }]);
  assert.ok(JSON.stringify(request.element).length < 800, "the agent gets a short context");

  await new Promise((r) => setTimeout(r, 1100)); // the page asks again after its wait
  assert.equal(polls, 2);
  assert.equal(strip.hidden, false, "the strip is up");
  assert.equal(inMenu("Send the variations request to the agent"), undefined, "the prompt box is done");
  const rows = strip.children[1].children;
  assert.equal(strip.children[1].className, "variants-list", "the rows sit in a list of their own");
  assert.deepEqual(rows.map((r) => r.getAttribute("aria-label")), ["Use thin grey", "Use rose pill"]);
  assert.deepEqual(rows.map((r) => r.children[0].children[0].nodeValue), ["1", "2"], "each row says its key");
  assert.deepEqual(rows.map((r) => r.children[1].children[0].nodeValue), ["thin grey", "rose pill"]);
  assert.equal(rows[0].getAttribute("aria-pressed"), "false", "nothing is on the element yet");
  // Keep ends the strip, and it waits for a variation to be on the element.
  const keep = strip.children[0].children.find((node) => node.getAttribute("aria-label") === "Keep the variation on the element");
  assert.equal(keep.disabled, true, "there is nothing to keep yet");
  assert.equal(strip.children[0].children[0].children[0].nodeValue, "Variations");
  assert.equal(strip.children[0].children[1].children[0].nodeValue, "p", "the strip says which element it varies");

  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(el.style.getPropertyValue("scrollbar-width"), "thin");
  assert.equal(el.style.getPropertyValue("scrollbar-color"), "#8a8a8a transparent");
  // The rows are kept: the tick moves, and the strip is not built again.
  assert.deepEqual([...strip.children[1].children], rows, "the same rows are on the strip");
  assert.equal(strip.children[1].children[0].getAttribute("aria-pressed"), "true");
  assert.equal(strip.children[1].children[1].getAttribute("aria-pressed"), "false");
  assert.equal(
    strip.children[0].children.find((node) => node.getAttribute("aria-label") === "Keep the variation on the element").disabled,
    false,
    "a variation is on the element, so it can be kept",
  );
  assert.match(app.win.__edityy_changes(), /- `scrollbar-width`: `unset` → `thin`/);

  // The next variation is the whole variation: the width goes back, it is not left over.
  quiet(() => app.fire("keydown", { key: "2" }));
  assert.equal(el.style.getPropertyValue("scrollbar-width"), "");
  assert.equal(el.style.getPropertyValue("scrollbar-color"), "#f43f5e #f4f4f5");

  // A state and a breakpoint cannot live in the element's own style, so they go
  // into a stylesheet of their own, one block for each.
  const sheets = () => app.doc.body.children.filter((node) => node.tagName === "STYLE");
  assert.equal(sheets().length, 1, "one sheet for the element");
  assert.equal(sheets()[0].textContent, "p:hover{background: #f4f4f5}\n@media (max-width: 640px){p{padding: 8px}}");
  assert.match(app.win.__edityy_changes(), /- `background` on `:hover`: `unset` → `#f4f4f5`/);
  assert.match(app.win.__edityy_changes(), /- `padding` in `@media \(max-width: 640px\)`: `unset` → `8px`/);

  // The first variation has no rule, so the sheet goes with the one that had it.
  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(sheets().length, 0, "no rule, no sheet");
  quiet(() => app.fire("keydown", { key: "2" }));

  // Escape puts the strip away, and the picks stay: they are ordinary edits.
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(strip.hidden, true);
  assert.match(app.win.__edityy_changes(), /- `scrollbar-color`: `unset` → `#f43f5e #f4f4f5`/);
  assert.equal(sheets().length, 1, "the sheet stays while its edit does");

  // Reverting the element takes the rule and its sheet away.
  const undo = openEdits(app).children[0].children[0].children[1];
  quiet(() => { for (const fn of undo.bubbles.click.bubble) fn({}); });
  assert.equal(sheets().length, 0, "a reverted element leaves no sheet behind");
  assert.equal(el.style.getPropertyValue("scrollbar-color"), "", "and no inline style");
});
