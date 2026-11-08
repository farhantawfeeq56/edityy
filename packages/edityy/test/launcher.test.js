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

  /** Both lists a browser keeps, kept in step: this stub has no element-only ones. */
  const drop = (parent, child) => {
    for (const list of [parent.children ?? [], parent.childNodes ?? []]) {
      const at = list.indexOf(child);
      if (at !== -1) list.splice(at, 1);
    }
  };

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
      if (child.parentElement) drop(child.parentElement, child);
      child.parentElement = node;
      created.push(child);
      node.children.push(child);
      node.childNodes.push(child);
      return child;
    },
    removeChild: (child) => {
      drop(node, child);
      child.parentElement = null;
      return child;
    },
    insertBefore: (child, before) => {
      const at = node.children.indexOf(before);
      const was = child.parentElement;
      const old = was ? was.children.indexOf(child) : -1;
      if (was) drop(was, child);
      child.parentElement = node;
      const where = at === -1 ? node.children.length : at > old && was === node ? at - 1 : at;
      node.children.splice(where, 0, child);
      node.childNodes.splice(where, 0, child);
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
      // The card has no row of actions any more: what it used to offer is a
      // keyboard shortcut, or the box that a click opens.
      action: (name) => {
        if (name === "Edit text") {
          for (const fn of bucket(doc, "keydown", "capture")) fn({ key: "Enter", target: doc.body, preventDefault() {}, stopPropagation() {} });
          return;
        }
        if (name === "Delete") {
          for (const fn of bucket(doc, "keydown", "capture")) fn({ key: "Delete", target: doc.body, preventDefault() {}, stopPropagation() {} });
          return;
        }
        if (name === "Comment") return; // the click that selected it opened the box
        if (name === "Done editing the text") {
          // Escape leaves the whole mode now, so ending the edit needs the
          // real Done button in the element card.
          const box = root.nodes["element-menu"].children[0];
          const done = box.children.find((item) => item.getAttribute && item.getAttribute("aria-label") === name);
          assert.ok(done, `no element action "${name}"`);
          for (const fn of done.bubbles.click.bubble) fn({});
          return;
        }
        const button = root.nodes["element-menu"].children[0].children
          .flatMap((child) => (child.children.length ? child.children : [child]))
          .find((item) => item.getAttribute("aria-label") === name);
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
  assert.match(root.innerHTML, /#launch\{[^}]*border-radius:10px/);
  assert.match(root.innerHTML, /pointer-events:auto/); // only the button takes clicks
});

test("the button is a real button with an accessible name", () => {
  const { run } = fakeDom();
  const { root } = run();
  assert.match(root.innerHTML, /<button type="button" id="launch"/);
  assert.match(root.innerHTML, /aria-label="Open Edityy"/);
  assert.match(root.innerHTML, /<img id="label" alt="Edityy logo"/);
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
  assert.match(css, /#launch img\{width:18px/, "the mark's own size");
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
  assert.equal(app.launch().hidden, true, "the pill hides and the dock stands where it stood");
  assert.match(app.root.innerHTML, /#dock\{[^}]*right:24px/, "the dock stands where the pill stood");
  quiet(() => app.click());
  assert.equal(app.countDoc("click"), 0, "a second click on the brand leaves the mode");
  assert.equal(app.root.nodes.dock.hidden, true);
  assert.equal(app.launch().hidden, false, "the pill is back");
});

test("the pill hides in edit mode and the dock stands where it stood", () => {
  const { run, text } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(text("p", "body"));
    app.fire("mousemove", { clientX: 40, clientY: 90 });
  });
  // One toolbar in the corner, never two: the pill hides while the mode is on.
  assert.equal(app.launch().hidden, true);
  assert.equal(app.root.nodes.dock.hidden, false);
  assert.match(app.root.innerHTML, /src="\/__edityy\/logo\.png"/, "the pill keeps the brand mark for the way back");
  assert.equal(app.countDoc("click"), 1, "the page is still captured in edit mode");
});

test("leaving edit mode keeps the brand pill as the way back in", () => {
  const { run, text } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(text("p", "body"));
    app.fire("mousemove", { clientX: 40, clientY: 90 });
    // One Escape leaves the whole mode: there is no unwinding to get stuck in.
    app.fire("keydown", { key: "Escape" });
  });
  // Escape leaves the mode: the dock hides and the pill is back as the way in.
  assert.equal(app.root.nodes.dock.hidden, true);
  assert.equal(app.launch().hidden, false);
  assert.equal(app.launch().style.pointerEvents || "", "");
  assert.equal(app.countDoc("click"), 0, "the page is released");
  // And the pill opens the mode again.
  quiet(() => app.click());
  assert.equal(app.countDoc("click"), 1, "the brand opens the toolbar again");
  assert.equal(app.launch().hidden, true, "and hides again while the mode is on");
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

test("shift-click adds and removes elements, and Shift+Arrow does not extend selection", () => {
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
  // The toolbar stays up with several elements selected: it is the one surface,
  // and a shift-click only changes what the selection frames.
  assert.equal(app.root.nodes.dock.hidden, false);
  assert.equal(app.root.nodes.row.hidden, false);
  assert.equal(app.root.nodes.sel.hidden, false);
  assert.equal(app.root.nodes["element-menu"].hidden, true, "no comment box for more than one element");
  quiet(() => app.fire("keydown", { key: "ArrowRight", shiftKey: true }));
  assert.equal(app.root.nodes.sel.hidden, false, "Shift+Arrow does not add to the selection");
  quiet(() => app.clickPage(1, 1, true));
  assert.equal(app.root.nodes.sel.hidden, false, "one element is still selected");
  assert.equal(app.root.nodes["element-menu"].hidden, false, "and its comment box is back");
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

test("the box wears the brand colour", () => {
  const { run, text } = fakeDom();
  const app = run();
  // The frame is the brand gold on every background: dark, light, or bare.
  const panel = text("div", "hi", { "background-color": "rgb(16, 32, 48)" },
    { left: 10, top: 10, right: 210, bottom: 60, width: 200, height: 50 });
  quiet(() => {
    app.click();
    app.hover(panel);
    app.clickPage();
  });
  const sel = app.root.nodes.sel;
  assert.equal(sel.style.getPropertyValue("--frame"), "#d4a72c", "brand on a dark panel");
  const bare = text("p", "plain", {}, { left: 0, top: 0, right: 80, bottom: 20, width: 80, height: 20 });
  quiet(() => {
    app.hover(bare);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#d4a72c", "brand on a bare canvas");
  const paper = text("div", "hi", { "background-color": "rgb(249, 242, 238)" },
    { left: 10, top: 10, right: 210, bottom: 60, width: 200, height: 50 });
  quiet(() => {
    app.hover(paper);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#d4a72c", "brand on paper");
  const child = text("span", "x", {}, { left: 20, top: 20, right: 60, bottom: 40, width: 40, height: 20 });
  panel.appendChild(child);
  quiet(() => {
    app.hover(child);
    app.clickPage();
  });
  assert.equal(sel.style.getPropertyValue("--frame"), "#d4a72c", "brand through a transparent child");
});

/** Select a node and report how it was classified. */
const kindOf = (app, node) => {
  app.hover(node);
  app.clickPage();
  return app.root.selection().kind;
};

/** Select some text and open its comment box, as picking words does. Enters the
    mode first if it is not already in it, since some callers are already inside.
    With `edit`, Enter puts the caret in the words, as the shortcut does. */
const selectText = (app, edit = false) => {
  if (!app.countDoc("click")) quiet(() => app.click());
  const p = app.el("p", { text: "hello" });
  app.hover(p);
  app.clickPage();
  if (edit) quiet(() => app.fire("keydown", { key: "Enter", target: app.doc.body }));
  return p;
};

/** Click an element and write a comment on it, as the Comment tool does. */
const commentOn = (app, node, words) => {
  app.hover(node);
  quiet(() => app.clickPage());
  const box = app.root.nodes["element-menu"].children[0];
  const area = box.children.find((c) => c.getAttribute && c.getAttribute("aria-label") === "Comment");
  area.value = words;
  const save = box.children.flatMap((child) => (child.children.length ? child.children : [child]))
    .find((b) => b.getAttribute && b.getAttribute("aria-label") === "Save comment");
  for (const fn of save.bubbles.click.bubble) fn({});
};

/** Press a dock icon by its key. */
const press = (app, key) => {
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === key);
  for (const fn of icon.bubbles.click.bubble) fn({});
  return icon;
};

/** The text of a container, which the stub does not accumulate for us. */
const shown = (el) =>
  [el.tagName === undefined ? (el.nodeValue ?? "") : el.innerHTML,
   ...(el.children ?? []).flatMap((c) => [c.nodeValue ?? "", shown(c)])]
    .filter(Boolean)
    .join("");

test("the open icon stays visible on its own dark background", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // `*{color:#25241f}` matches the glyph itself, so an active button's paper
  // colour never reaches it: without an explicit inherit the glyph is ink on
  // ink and disappears. The drawn one takes the colour down from the box the
  // icon is drawn in.
  assert.match(css, /\.ic>svg\{[^}]*color:inherit/, "the drawn glyphs");
});






test("the brand pill carries no motion of its own", () => {
  const { run } = fakeDom();
  const app = run();
  const css = app.root.innerHTML;
  const rule = css.match(/#launch\{[^}]*\}/)[0];
  // Nothing follows the pointer any more: no translate, no scale, no trip home.
  assert.doesNotMatch(rule, /translate|scale/, "the pill never moves");
  assert.doesNotMatch(css, /#launch\[data-home\]/, "nothing travels home");
});




test("a dock that comes back takes clicks again", () => {
  const { run, text } = fakeDom();
  const app = run();
  const dock = app.root.nodes.dock;
  let exit;
  dock.animate = (frames) => (exit = { cancel() {}, frames });
  quiet(() => {
    app.click();
    app.hover(text("p", "body"));
    app.clickPage();
  });
  assert.equal(dock.hidden, false);
  // The mode ends on one Escape: the dock travels back to the pill and takes
  // no clicks while it goes.
  quiet(() => {
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(dock.style.pointerEvents, "none", "a dock on its way out is leaving");
  assert.match(exit.frames[1].transform, /translateX\(12px\)/, "toward the pill it stands beside");
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


test("a click on an element opens its comment box, and Enter edits the words", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, false);
  assert.equal(p.getAttribute("contenteditable"), undefined);
  const menu = app.root.nodes["element-menu"];
  assert.equal(menu.hidden, false);
  assert.equal(menu.children[0].className, "element-comment", "the card is the comment box");
  const area = menu.children[0].children.find((c) => c.getAttribute && c.getAttribute("aria-label") === "Comment");
  assert.equal(area.getAttribute("aria-label"), "Comment");
  app.action("Edit text");
  assert.equal(p.getAttribute("contenteditable"), "plaintext-only");
  // The card stays, with the one button that ends the edit.
  const done = menu.children[0].children[0];
  assert.equal(done.getAttribute("aria-label"), "Done editing the text");
  quiet(() => { for (const fn of done.bubbles.click.bubble) fn({}); });
  assert.equal(p.getAttribute("contenteditable"), undefined, "Done gives the words back");
});

test("a comment is written on the element and reaches the agent's Markdown", () => {
  const { run } = fakeDom();
  const app = run();
  const menu = app.root.nodes["element-menu"];
  const pressButton = (target) => {
    for (const fn of target.bubbles.click.bubble) fn({});
  };
  const inMenu = (label) => {
    const walk = (node) => (node.children || []).flatMap((c) => [c, ...walk(c)]);
    return (menu.children[0] ? walk(menu.children[0]) : []).find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  };
  selectText(app);
  const area = inMenu("Comment");
  assert.equal(area.getAttribute("aria-label"), "Comment", "the click opened a field to write in");
  area.value = "  make this bigger  ";
  pressButton(inMenu("Save comment"));
  assert.equal(menu.hidden, true, "the box goes when the words are saved");
  assert.match(app.win.__edityy_changes(), /- Comment: "make this bigger"/);
  // Clicking the same element again shows what was written.
  app.clickPage();
  assert.equal(inMenu("Comment").value, "make this bigger");
  // A scroll re-places the box, it must not rebuild it and take the words.
  inMenu("Comment").value = "half written";
  app.scroll();
  assert.equal(inMenu("Comment").value, "half written", "a scroll keeps the words");
  inMenu("Comment").value = "";
  pressButton(inMenu("Save comment"));
  assert.match(app.win.__edityy_changes(), /Comment: "make this bigger"/, "an empty save keeps the old words");
  // Escape backs out of the box without saving.
  app.clickPage();
  inMenu("Comment").value = "never saved";
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(menu.hidden, true, "the box and the selection are back on the page");
  assert.doesNotMatch(app.win.__edityy_changes(), /never saved/);
});


test("the comment box stands below its element", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const menu = app.root.nodes["element-menu"];
  p.getBoundingClientRect = () => ({ left: 100, top: 700, right: 200, bottom: 740, width: 100, height: 40 });
  app.scroll();
  assert.equal(menu.hidden, false, "the box stays open");
  assert.equal(menu.style.left, "100px", "the box aligns with the element left");
  // The box stands below the element, never above it.
  assert.equal(menu.style.top, "518px", "the box stands below, clamped above the dock");
});

test("the comment box scrolls away with its element", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  const menu = app.root.nodes["element-menu"];
  const inMenu = (label) => {
    const walk = (node) => (node.children || []).flatMap((c) => [c, ...walk(c)]);
    return (menu.children[0] ? walk(menu.children[0]) : []).find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  };
  assert.equal(inMenu("Comment") !== undefined, true, "the box is open");
  p.getBoundingClientRect = () => ({ left: 10, top: -180, right: 110, bottom: -140, width: 100, height: 40 });
  app.scroll();
  assert.equal(menu.hidden, true, "the box scrolls away with its element");
  inMenu("Comment").value = "half written";
  p.getBoundingClientRect = () => ({ left: 10, top: 100, right: 110, bottom: 140, width: 100, height: 40 });
  app.scroll();
  assert.equal(menu.hidden, false, "the box returns with its element");
  assert.equal(inMenu("Comment").value, "half written", "the scroll keeps the words");
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


test("delete can be undone and redone with the keyboard", () => {
  const { run, el } = fakeDom();
  const app = run();
  const parent = el("main");
  const selected = el("section");
  const sibling = el("aside");
  parent.appendChild(selected);
  parent.appendChild(sibling);
  quiet(() => { app.click(); app.hover(selected); app.clickPage(); });
  app.action("Delete");
  assert.deepEqual(parent.children, [sibling]);
  assert.equal(key(app, "z", { ctrlKey: true }), true);
  assert.deepEqual(parent.children, [selected, sibling]);
  assert.equal(app.win.__edityy_changes(), "", "undo clears the deleted change");
  assert.equal(key(app, "z", { ctrlKey: true, shiftKey: true }), true);
  assert.deepEqual(parent.children, [sibling]);
  assert.match(app.win.__edityy_changes(), /- Removed: section/);
});


test("a text edit can be undone after editing ends", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app, false);
  app.action("Edit text");
  p.textContent = "goodbye";
  app.fire("input", {});
  app.action("Done editing the text");
  assert.equal(key(app, "z", { ctrlKey: true }), true);
  assert.equal(p.textContent, "hello");
  assert.equal(key(app, "z", { ctrlKey: true, shiftKey: true }), true);
  assert.equal(p.textContent, "goodbye");
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











test("every icon draws a Lucide glyph, not the name it is asked for by", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  // A glyph that is named but missing from GLYPHS renders its own name, which is
  // silent everywhere else: this is the one place that would catch it.
  const drawn = (markup) => {
    assert.match(markup, /aria-hidden="true">\s*<[a-z]/, `nothing was drawn: ${markup}`);
    assert.match(markup, /<(path|rect|circle|line|polyline|ellipse|polygon)[\s/]/, `no shape drawn: ${markup}`);
    assert.match(markup, /(stroke|fill)="currentColor"/, `not an icon glyph: ${markup}`);
  };
  // Three icons, drawn from the glyph table: Lucide at rest, the Tabler
  // filled twin when on.
  const icons = app.root.nodes.row.children.filter((b) => b.innerHTML.includes("<svg"));
  assert.equal(icons.length, 3, "the three tools are drawn");
  for (const button of icons) drawn(button.innerHTML);
  assert.doesNotMatch(app.root.innerHTML, />"[a-z-]+"</, "no name rendered as a glyph");
});

test("the toolbar is up with nothing selected, offering the three things it has", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  assert.equal(app.root.selection(), null);
  assert.equal(app.root.nodes.dock.hidden, false, "the toolbar is up before a selection");
  assert.equal(app.root.nodes.row.hidden, false, "and it is the whole toolbar");
  assert.equal(app.root.nodes.pop.hidden, true, "and no list opens on its own");
  const row = app.root.nodes.row.children;
  assert.deepEqual(row.map((chip) => chip.dataset.key), ["comment", "add", "edits"], "the three tools");
  assert.equal(row[2], app.root.nodes.review, "the edits list is the last segment of the same row");
  assert.equal(row[0].getAttribute("aria-pressed"), "true", "Comment is the default tool");
  assert.equal(row[1].getAttribute("aria-pressed"), "false");
  assert.equal(app.root.nodes.create, undefined, "there is no Add element button");
});

test("Edits is one of the three tools: only one is on at a time", () => {
  const { run } = fakeDom();
  const app = run();
  const row = () => app.root.nodes.row.children;
  const pressed = () => row().map((b) => b.getAttribute("aria-pressed"));
  quiet(() => app.click());
  assert.deepEqual(pressed(), ["true", "false", "false"], "Comment starts on");
  press(app, "edits");
  assert.deepEqual(pressed(), ["false", "false", "true"], "Edits takes the place of Comment");
  assert.equal(app.root.nodes.pop.hidden, false, "the list is open");
  press(app, "add");
  assert.deepEqual(pressed(), ["false", "true", "false"], "Add takes the place of Edits");
  assert.equal(app.root.nodes.pop.hidden, true, "the list is closed");
  press(app, "comment");
  assert.deepEqual(pressed(), ["true", "false", "false"], "Comment takes the place of Add");
  press(app, "edits");
  press(app, "edits");
  assert.deepEqual(pressed(), ["false", "false", "false"], "a second press on Edits leaves none on");
  const css = app.root.innerHTML;
  assert.match(css, /\.row>\.ic\[aria-pressed=true\]\{[^}]*border-color:transparent/, "the chosen tool keeps the toolbar border, not the warm one");
});

test("with no tool on, hovering the page shows no bounding box", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy");
  quiet(() => app.click());
  press(app, "comment");
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.getAttribute("aria-pressed")), ["false", "false", "false"]);
  quiet(() => {
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  assert.equal(app.root.nodes.hover.hidden, true, "browse does not frame the words under the pointer");
});

test("Alt+S drops to browse: no tool on, nothing picked", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy");
  quiet(() => app.click());
  app.hover(heading);
  quiet(() => app.clickPage());
  assert.ok(app.root.selection(), "a click picked the words first");
  quiet(() => app.fire("keydown", { key: "s", altKey: true, preventDefault() {}, stopPropagation() {} }));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.getAttribute("aria-pressed")), ["false", "false", "false"], "no tool stays on");
  assert.equal(app.root.nodes.pop.hidden, true, "nothing stays open");
  assert.equal(app.root.selection(), null, "nothing stays picked");
});

test("the grip is part of the primary toolbar, with six dots and no tooltip", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  const html = app.root.innerHTML;
  const gripAt = html.indexOf('id="grip"');
  assert.ok(gripAt !== -1, "the bar carries a grip");
  assert.ok(gripAt < html.indexOf('id="row"'), "left of the tools");
  assert.match(html, /class="grip"[^>]*aria-label="Move toolbar"/, "accessible drag handle");
  assert.doesNotMatch(html.slice(gripAt, html.indexOf("</button>", gripAt)), /title=/, "no tooltip on the grip");
  assert.match(html, /\.bar\{[^}]*border-radius:10px/, "one rounded primary surface");
  assert.match(html, /\.row\{[^}]*border-radius:10px/, "the toolbar keeps its full corners");
  assert.match(html, /\.grip\{[^}]*width:0/, "the grip takes no space at rest");
  assert.match(html, /\.grip\{[^}]*opacity:0/, "the grip stays hidden at rest");
  assert.match(html, /\.grip\{[^}]*position:absolute/, "the grip floats, outside the flow");
  assert.match(html, /#dock:hover \.bar[^}]*padding-left:24px/, "hover widens the bar left, tools undisturbed");
  assert.match(html, /#dock\[data-placed\]:hover[^}]*margin-left:-24px/, "a dragged bar grows left too, tools undisturbed");
  assert.match(html, /#dock:hover \.grip[^}]*width:30px/, "hover shows the grip in the room");
  assert.ok(!app.root.nodes.row.children.includes(app.root.nodes.grip), "grip is not a tool");
  assert.equal(app.root.nodes.grip.bubbles.pointerover, undefined, "no tooltip listener");
  const dots = (html.slice(gripAt, html.indexOf("</button>", gripAt)).match(/<circle/g) || []).length;
  assert.equal(dots, 6, "six dots");
});

test("dragging the grip moves the toolbar, and exit puts it home", () => {
  const { run } = fakeDom();
  const app = run();
  const grip = app.root.nodes.grip;
  const dock = app.root.nodes.dock;
  // The stub has no layout: the rect follows the inline place, as it would.
  dock.getBoundingClientRect = () => ({ left: parseFloat(dock.style.left) || 900, top: parseFloat(dock.style.top) || 700, right: 0, bottom: 0, width: 270, height: 40 });
  quiet(() => app.click());
  for (const fn of grip.bubbles.pointerdown.bubble) fn({ clientX: 910, clientY: 710, preventDefault() {} });
  for (const fn of grip.bubbles.pointermove.bubble) fn({ clientX: 400, clientY: 300 });
  for (const fn of grip.bubbles.pointerup.bubble) fn({});
  assert.equal(dock.style.left, "390px");
  assert.equal(dock.style.top, "290px");
  assert.equal(dock.getAttribute("data-placed"), "true", "placed, so hover pays back the widening");
  // The fade is driven by hand here, so the middle of the close can be seen.
  let fade = null;
  dock.animate = (frames) => (fade = { cancel() {}, frames });
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.ok(fade, "the close fades");
  assert.equal(dock.style.left, "390px", "the bar stands its ground while it fades");
  assert.equal(dock.getAttribute("data-placed"), "true");
  fade.onfinish();
  assert.equal(dock.hidden, true);
  assert.equal(dock.style.left, "", "home once the fade lands");
  assert.equal(dock.style.top, "");
  assert.equal(dock.getAttribute("data-placed"), undefined, "home again, corner behaviour back");
});

test("closing a dragged toolbar leaves the logo where it stood", () => {
  const { run } = fakeDom();
  const app = run();
  const grip = app.root.nodes.grip;
  const dock = app.root.nodes.dock;
  const launch = app.root.nodes.launch;
  // The stub has no layout: the rect follows the inline place, as it would.
  dock.getBoundingClientRect = () => ({ left: parseFloat(dock.style.left) || 900, top: parseFloat(dock.style.top) || 700, right: 0, bottom: 0, width: 270, height: 40 });
  quiet(() => app.click());
  for (const fn of grip.bubbles.pointerdown.bubble) fn({ clientX: 910, clientY: 710, preventDefault() {} });
  for (const fn of grip.bubbles.pointermove.bubble) fn({ clientX: 400, clientY: 300 });
  for (const fn of grip.bubbles.pointerup.bubble) fn({});
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(launch.style.left, "390px", "the pill stays where the bar stood");
  assert.equal(launch.style.top, "290px");
  quiet(() => app.click());
  assert.equal(dock.style.left, "390px", "the bar stands back up where the pill was");
  assert.equal(dock.style.top, "290px");
});

test("opening where the bar would hang off pulls it back on", () => {
  const { run } = fakeDom();
  const app = run();
  const dock = app.root.nodes.dock;
  const launch = app.root.nodes.launch;
  // The stub has no layout: the rect follows the inline place, as it would.
  dock.getBoundingClientRect = () => ({ left: parseFloat(dock.style.left) || 0, top: parseFloat(dock.style.top) || 0, right: 0, bottom: 0, width: 270, height: 40 });
  // The narrow pill fits where the wider bar does not: near the right edge.
  launch.style.left = "1150px";
  launch.style.top = "750px";
  launch.style.right = "auto";
  launch.style.bottom = "auto";
  quiet(() => app.click());
  assert.equal(dock.style.left, "922px", "the bar comes back inside the page");
  assert.equal(dock.style.top, "750px", "a side that fits stays put");
});

test("the logo pill itself drags, and a drag never opens", () => {
  const { run } = fakeDom();
  const app = run();
  const launch = app.root.nodes.launch;
  const dock = app.root.nodes.dock;
  launch.getBoundingClientRect = () => ({ left: 1130, top: 750, right: 1200, bottom: 788, width: 70, height: 38 });
  for (const fn of launch.bubbles.pointerdown.bubble) fn({ clientX: 1140, clientY: 760, preventDefault() {} });
  for (const fn of launch.bubbles.pointermove.bubble) fn({ clientX: 500, clientY: 400 });
  for (const fn of launch.bubbles.pointerup.bubble) fn({});
  assert.equal(launch.style.left, "490px", "the pill follows the hand");
  assert.equal(launch.style.top, "390px");
  // The picture never leaves the pill: it cannot start a native image drag.
  assert.match(app.root.innerHTML, /id="label"[^>]*draggable="false"/, "the logo is not natively draggable");
  assert.match(app.root.innerHTML, /#launch img\{[^}]*pointer-events:none/, "presses land on the pill, not the picture");
  quiet(() => app.click());
  assert.equal(dock.hidden, true, "letting go over the pill does not open");
  quiet(() => app.click());
  assert.equal(dock.hidden, false, "a tap still opens");
});
















test("Add is freeform: nothing is selected, and a drag saves a numbered box", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  assert.equal(app.root.selection().el, p, "a click selected the words first");
  quiet(() => press(app, "add"));
  assert.equal(app.root.selection(), null, "Add starts with nothing selected");
  assert.equal(app.root.nodes["element-menu"].hidden, true, "and no card stays open");
  // A click alone picks nothing while Add is on.
  app.hover(p);
  quiet(() => app.clickPage());
  assert.equal(app.root.selection(), null, "a click draws no box and selects nothing");
  // A drag draws the box, and the comment box opens for it.
  const path = () => [];
  quiet(() => app.fire("mousedown", { clientX: 10, clientY: 10, button: 0, composedPath: path, preventDefault() {}, stopPropagation() {} }));
  app.move(60, 50);
  assert.equal(app.root.nodes.region.hidden, false, "the box is drawn while the drag is still going, not only after it is dropped");
  quiet(() => app.fire("mouseup", { clientX: 60, clientY: 50, composedPath: path, preventDefault() {}, stopPropagation() {} }));
  const menu = app.root.nodes["element-menu"];
  assert.equal(menu.hidden, false, "the comment box opens for the box");
  assert.equal(app.root.nodes.region.hidden, false, "the box stays drawn while its comment is open");
  const inMenu = (label) => {
    const walk = (node) => (node.children || []).flatMap((c) => [c, ...walk(c)]);
    return (menu.children[0] ? walk(menu.children[0]) : []).find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  };
  const area = inMenu("Comment");
  area.value = "a hero here";
  const save = inMenu("Save comment");
  for (const fn of save.bubbles.click.bubble) fn({});
  assert.match(app.win.__edityy_changes(), /Region:/, "the box reaches the agent's Markdown");
  assert.match(app.win.__edityy_changes(), /a hero here/);
  assert.equal(app.root.nodes.marks.children.length, 1, "the box keeps its number on the page");
});

/** Open the edits list. */
const openEdits = (app) => {
  for (const fn of app.root.nodes.review.bubbles.click.bubble) fn({});
  return app.root.nodes.pop;
};

test("the edits button counts the elements that really changed", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  assert.equal(app.root.nodes.count.hidden, true, "nothing to count yet");
  commentOn(app, p, "bigger");
  assert.equal(app.root.nodes.count.hidden, false);
  assert.equal(app.root.nodes.count.textContent, "1");
});


test("the edits list names each element, and reverts one without the others", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  commentOn(app, p, "first note");
  const q = app.el("h2", { text: "second" });
  commentOn(app, q, "second note");

  const open = openEdits(app);
  assert.equal(app.root.nodes.review.getAttribute("aria-expanded"), "true");
  const lines = open.children[0].children;
  assert.equal(lines.length, 2);
  assert.match(shown(lines[0].children[0]), /1 · p “hello” · 1 edit$/);
  assert.match(shown(lines[1].children[0]), /2 · h2 “second” · 1 edit$/);

  const undo = lines[0].children[1];
  quiet(() => { for (const fn of undo.bubbles.click.bubble) fn({}); });
  assert.doesNotMatch(app.win.__edityy_changes(), /first note/, "the first comment is gone");
  assert.match(app.win.__edityy_changes(), /second note/, "the second is untouched");
  assert.equal(app.root.nodes.pop.children[0].children.length, 1, "and the list redrew");
  assert.equal(app.root.nodes.count.textContent, "1");
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
  commentOn(app, items[1], "line two");
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
  assert.equal(app.root.nodes.row.hidden, false, "the toolbar stays: it is the one surface");
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






/**
 * A dev server that keeps one canvas session in memory, as index.js does: GET
 * answers for a path, POST keeps what the page sends, DELETE forgets it.
 */
const sessionServer = () => {
  const server = { session: null, calls: [] };
  const answer = (status, body) => ({ status, json: async () => body });
  server.fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    server.calls.push({ url, method, body: init.body });
    if (!String(url).startsWith("/__edityy/session")) return answer(404, { ok: false });
    if (method === "POST") {
      server.session = JSON.parse(init.body);
      return answer(200, { ok: true, path: ".edityy/session.json" });
    }
    if (method === "DELETE") {
      server.session = null;
      return answer(200, { ok: true });
    }
    const path = new URL(url, "http://test").searchParams.get("path");
    return answer(200, { ok: true, session: server.session && server.session.path === path ? server.session : null });
  };
  return server;
};

/** Fire the window's load event, as the browser does once the page is in. */
const load = async (win) => {
  // Idle as soon as asked: the page in a test has nothing left to hydrate.
  win.requestIdleCallback ??= (fn) => setTimeout(fn, 0);
  for (const fn of win.bubbles?.load?.bubble ?? []) fn({});
  await tick();
  await tick();
  await tick();
};

test("the canvas survives a reload, and the mode comes back on", async () => {
  const server = sessionServer();
  const first = fakeDom();
  first.win.fetch = server.fetch;
  const app = first.run();
  const p = selectText(app, false);
  p.id = "intro";
  commentOn(app, p, "make it warmer");
  // A closed tab writes at once, as the page leaves.
  // The write waits for the debounce: the mode opens with an empty canvas.
  assert.equal(server.session.edits.length, 0, "the write waits for the keys to stop");
  for (const fn of first.win.bubbles.pagehide.bubble) fn({});
  await tick();
  const saved = server.session;
  assert.equal(saved.path, "/");
  assert.equal(saved.edits.length, 1);
  assert.equal(saved.edits[0].selector, "#intro");
  assert.equal(saved.edits[0].comment, "make it warmer");
  assert.equal(saved.edits[0].mark, 1, "the element keeps its number on the server");
  assert.equal(saved.edits[0].props.outline, undefined, "Edityy's own outline is not an edit to keep");

  // The page loads again, as if the dev server had restarted: the server still
  // holds the canvas, and the fresh page has the same element in it.
  const second = fakeDom();
  second.win.fetch = server.fetch;
  const fresh = second.text("p", "hello");
  fresh.id = "intro";
  second.doc.querySelector = (sel) => (sel === "#intro" ? fresh : null);
  const again = second.run();
  await load(second.win);
  assert.ok(again.countDoc("click") > 0, "the mode is on again");
  assert.equal(again.root.nodes.count.textContent, "1", "and the edits button counts them");
  assert.match(again.win.__edityy_changes(), /- Comment: "make it warmer"/);
  // The numbered mark is on the element: gold, numbered 1.
  const marks = again.root.nodes.marks.children;
  assert.equal(marks.length, 1);
  assert.equal(marks[0].children[0].nodeValue, "1");

  // Leaving the mode reverts the restored edits like any others, and forgets
  // the canvas on the server.
  quiet(() => {
    again.fire("keydown", { key: "Escape" });
    again.fire("keydown", { key: "Escape" });
  });
  assert.equal(again.win.__edityy_changes(), "");
  await tick();
  assert.equal(server.session, null);
});

test("a rule kept in the session comes back with its stylesheet", async () => {
  const server = sessionServer();
  server.session = {
    version: 1,
    savedAt: new Date().toISOString(),
    path: "/",
    markTop: 1,
    edits: [
      {
        selector: "#intro",
        props: {
          "@|:hover|background": { before: "", set: false, was: "", now: "red" },
          "@(max-width: 640px)||padding": { before: "", set: false, was: "", now: "8px" },
        },
        text: null,
        comment: null,
        added: [],
        mark: 1,
      },
    ],
    regions: [],
  };
  const dom = fakeDom();
  dom.win.fetch = server.fetch;
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

test("an edit whose element is gone is dropped, not applied somewhere else", async () => {
  const server = sessionServer();
  server.session = {
    version: 1,
    savedAt: new Date().toISOString(),
    path: "/",
    markTop: 1,
    edits: [{ selector: "#gone", props: { color: { before: "", set: false, was: "red", now: "blue" } }, text: null, comment: null, added: [], mark: 1 }],
    regions: [],
  };
  const dom = fakeDom();
  dom.win.fetch = server.fetch;
  dom.doc.querySelector = () => null;
  const app = dom.run();
  await load(dom.win);
  assert.equal(app.win.__edityy_changes(), "");
});

test("a dev server that cannot be reached does not break the editor", async () => {
  const dom = fakeDom();
  dom.win.fetch = async () => { throw new Error("Failed to fetch"); };
  const app = dom.run();
  await load(dom.win);
  const p = selectText(app);
  commentOn(app, p, "still works");
  assert.match(app.win.__edityy_changes(), /still works/);
});

test("leaving the mode forgets the canvas on the server", async () => {
  const server = sessionServer();
  const dom = fakeDom();
  dom.win.fetch = server.fetch;
  const app = dom.run();
  quiet(() => app.click());
  await tick();
  assert.notEqual(server.session, null, "kept while the mode is");
  // The brand never closes the mode: Escape leaves it.
  quiet(() => app.fire("keydown", { key: "Escape" }));
  await tick();
  assert.equal(server.session, null);
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



test("the row is one toolbar with one tab stop, and the arrows walk it", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  assert.match(app.root.innerHTML, /id="row" role="toolbar" aria-label="Edityy toolbar"/);
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
    if (url === "/__edityy/previews") return { status: 200, json: async () => ({ ok: true, pending: true }) };
    if (String(url).startsWith("/__edityy/session")) return { status: 200, json: async () => ({ ok: true }) };
    sent.push({ url, init });
    return { status: 200, json: async () => ({ ok: true, path: ".edityy/changes.json" }) };
  };
  const p = selectText(app);
  commentOn(app, p, "make it warmer");
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
  assert.equal(body.changes[0].comment, "make it warmer");
  assert.equal(body.changes[0].removed, false);
  assert.equal(body.changes[0].rec, undefined, "no live element on the wire");
  assert.match(body.markdown, /# Visual edits from Edityy/);
  assert.match(body.markdown, /- Comment: "make it warmer"/);
  assert.equal(save.textContent, "Saved to .edityy/changes.json");
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
    if (url === "/__edityy/previews") return { status: 200, json: async () => ({ ok: true, pending: true }) };
    if (String(url).startsWith("/__edityy/session")) return { status: 200, json: async () => ({ ok: true }) };
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
  const inMenu = (label) => {
    const walk = (node) => (node.children || []).flatMap((c) => [c, ...walk(c)]);
    return (menu.children[0] ? walk(menu.children[0]) : []).find((b) => b.getAttribute && b.getAttribute("aria-label") === label);
  };
  // More than one variation turns the click that opened the comment box into
  // a request for variations.
  assert.equal(app.root.nodes.row.children[0].getAttribute("aria-pressed"), "true");
  const area = inMenu("Comment");
  assert.equal(area.getAttribute("aria-label"), "Comment", "the words come first");
  assert.equal(area.placeholder, "Comment", "the same box as a comment");
  area.value = "  thinner and darker  ";
  const chip = inMenu("2 variations");
  for (const fn of chip.bubbles.click.bubble) fn({});
  const ask = inMenu("Save comment");
  for (const fn of ask.bubbles.click.bubble) fn({});
  // No waiting card: the same box stays, with a note while the agent answers.
  const asking = menu.children[0];
  assert.equal(asking.className, "element-comment");
  assert.equal(inMenu("Save comment") !== undefined, true, "the box stays");
  assert.equal(inMenu("Comment") !== undefined, true, "the words stay");

  await tick();
  const request = JSON.parse(sent[0].init.body);
  assert.equal(sent[0].url, "/__edityy/variations");
  assert.equal(sent[0].init.method, "POST");
  assert.equal(request.count, 2, "the count travels with the request");
  assert.equal(request.prompt, "thinner and darker");
  assert.equal(request.element.tag, "p", "the tag, not the source code");
  assert.equal(request.element.selector, "p");
  assert.deepEqual(request.element.values, [{ property: "display", value: "block" }]);
  assert.ok(JSON.stringify(request.element).length < 800, "the agent gets a short context");

  await new Promise((r) => setTimeout(r, 1100)); // the page asks again after its wait
  assert.equal(polls, 2);
  assert.equal(strip.hidden, false, "the strip is up");
  assert.equal(inMenu("Save comment"), undefined, "the prompt box is done");
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

  // Escape leaves the whole mode, and the picks go with it: leaving abandons
  // whatever was never saved.
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(strip.hidden, true);
  assert.equal(app.root.nodes.dock.hidden, true, "the toolbar goes with the mode");
  assert.equal(app.countDoc("click"), 0, "the page is released");
  assert.equal(app.win.__edityy_changes(), "", "unsaved picks are abandoned");
  assert.equal(sheets().length, 0, "and the sheet goes with its edit");
});

test("a panel that already left takes no ghost down with the mode", () => {
  const { run } = fakeDom();
  const app = run();
  const strip = app.root.nodes.variants;
  // Browser-faithful insertBefore: a stale child throws.
  app.root.insertBefore = function (node, before) {
    if (before && before.parentElement !== app.root) throw new Error("NotFoundError");
    node.parentElement = app.root;
    return node;
  };
  strip.parentElement = app.root;
  strip.animate = () => ({ cancel() {} });
  // The stub has no cloneNode: the ghost is a plain stand-in with the shape
  // the payload touches.
  strip.cloneNode = () => ({
    removeAttribute() {}, setAttribute() {},
    querySelectorAll: () => [], style: {},
    animate: () => ({}),
  });
  quiet(() => app.click());
  // The strip is gone from under the payload: whatever moved it, leaving the
  // mode must not throw on the ghost it leaves behind.
  strip.parentElement = null;
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(app.countDoc("click"), 0, "the mode still leaves");
});

test("a chat-placed preview paints, keeps as an edit, and discards cleanly", async () => {
  const { run } = fakeDom();
  const app = run();
  const posts = [];
  let preview = null;
  app.win.fetch = async (url, init = {}) => {
    if (url === "/__edityy/previews" && (!init.method || init.method === "GET")) {
      return { status: 200, json: async () => ({ ok: true, previews: preview ? [preview] : [] }) };
    }
    if (url === "/__edityy/previews" && init.method === "POST") posts.push(JSON.parse(init.body));
    return { status: 200, json: async () => ({ ok: true }) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  quiet(() => app.click());
  await tick();
  assert.equal(app.root.nodes.preview.hidden, true, "no preview until the agent places one");
  const el = selectText(app);
  const box = app.root.nodes.preview;
  preview = { id: "e-abc123", instruction: "make it thin", action: "styles", selector: "p", variations: [{ label: "thin", props: [{ property: "color", value: "red" }] }] };
  app.doc.querySelector = () => el;
  await tick(); await tick(); await new Promise((r) => setTimeout(r, 1100));
  assert.equal(box.hidden, false, "the preview box shows");
  assert.equal(box.children[1].children[0].nodeValue, "make it thin");
  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(el.style.getPropertyValue("color"), "red");
  const keep = box.children[box.children.length - 1].children[0];
  assert.equal(keep.disabled, false);
  for (const fn of keep.bubbles.click.bubble) fn({});
  assert.equal(box.hidden, true, "keep puts the box away");
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { id: "e-abc123", keep: true });
  assert.equal(el.style.getPropertyValue("color"), "red", "kept paint stays: it is an ordinary edit");
  assert.match(app.win.__edityy_changes(), /color.*red/);
});

test("a variant that sets words paints them like a preview", async () => {
  const { run } = fakeDom();
  const app = run();
  app.win.fetch = async (url) => {
    if (url === "/__edityy/previews") return { status: 200, json: async () => ({ ok: true, pending: true }) };
    return { status: 200, json: async () => ({ ok: true }) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  quiet(() => app.click());
  await tick();
  const el = selectText(app);
  const box = app.root.nodes.preview;
  app.doc.querySelector = () => el;
  app.win.fetch = async (url, init = {}) => {
    if (url === "/__edityy/previews") {
      if (!init.method || init.method === "GET") {
        return { status: 200, json: async () => ({ ok: true, previews: [{ id: "e-words1", instruction: "say it short", action: "styles", selector: "p", variations: [{ label: "short", props: [], text: "Start free" }] }] }) };
      }
      return { status: 200, json: async () => ({ ok: true }) };
    }
    return { status: 200, json: async () => ({ ok: true }) };
  };
  await tick(); await tick(); await new Promise((r) => setTimeout(r, 1100));
  assert.equal(box.hidden, false, "the preview box shows");
  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(el.textContent, "Start free", "variant text paints on the leaf element");
  assert.match(app.win.__edityy_changes(), /Start free/);
});

test("several previews at once get a checkbox list and one batch button", async () => {
  const { run } = fakeDom();
  const app = run();
  const posts = [];
  app.win.fetch = async (url, init = {}) => {
    if (url === "/__edityy/previews") {
      if (!init.method || init.method === "GET") {
        return { status: 200, json: async () => ({ ok: true, previews: [
          { id: "e-two1", instruction: "say it short", action: "insert", position: "inside-end", html: '<div class="edityy-note"><p>Start free</p></div>' },
          { id: "e-two2", instruction: "add a shadow", action: "update", selector: "p", props: [{ property: "box-shadow", value: "0 2px 4px black" }] },
          { id: "e-two3", instruction: "thicken the words", action: "insert", anchor: "main h2", position: "after", html: '<p class="edityy-note">Heavier</p>' },
        ] }) };
      }
      if (init.method === "POST") posts.push(JSON.parse(init.body));
      return { status: 200, json: async () => ({ ok: true }) };
    }
    return { status: 200, json: async () => ({ ok: true }) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  quiet(() => app.click());
  const el = selectText(app);
  const box = app.root.nodes.preview;
  app.doc.querySelector = () => el;
  await tick(); await tick(); await new Promise((r) => setTimeout(r, 1100));
  assert.equal(box.hidden, false, "the list shows instead of a painted preview");
  assert.match(shown(box), /Previews/);
  const items = box.children[1].children;
  assert.equal(items.length, 3, "a row per instruction");
  assert.match(shown(items[0]), /say it short/);
  const rows = items.map((item) => item.children[0]);
  const batchBtn = box.children[2].children[0];
  assert.equal(batchBtn.dataset.key, "preview-batch");
  assert.equal(box.hidden, false, "nothing painted on the canvas while several wait");
  assert.equal(el.style.getPropertyValue("font-weight"), "", "the list paints nothing until a keep decides");
  // A chevron on a row opens the place it lands, so the reader knows where.
  assert.match(shown(items[0]), /say it short/, "the fold leaves the words in place");
  const moreOne = rows[0].children[3];
  assert.equal(moreOne.dataset.key, "preview-where-1", "a chevron per row");
  const foldOne = items[0].children[1];
  assert.equal(foldOne.hidden, true, "the place starts folded");
  for (const fn of moreOne.bubbles.click.bubble) fn({});
  assert.equal(foldOne.hidden, false, "the chevron unfolds the place");
  assert.match(shown(foldOne), /End of main/, "the insert without an anchor names the end of main");
  const moreThree = rows[2].children[3];
  const foldThree = items[2].children[1];
  for (const fn of moreThree.bubbles.click.bubble) fn({});
  assert.match(shown(foldThree), /After \/main h2/, "the insert with an anchor names its place");
  // All ticked to start: the button says keep. Untick one, and it still keeps
  // the ticked ones and takes the unticked one back in the same round.
  const tickOne = rows[1].children[0];
  assert.equal(tickOne.checked, true, "every row reads ticked to start");
  tickOne.checked = false;
  for (const fn of tickOne.bubbles.change.bubble) fn({});
  assert.equal(batchBtn.textContent, "Keep all", "something is still ticked, so the button keeps");
  for (const fn of moreOne.bubbles.click.bubble) fn({});
  assert.equal(foldOne.hidden, true, "and folds again");  for (const fn of batchBtn.bubbles.click.bubble) fn({});
  assert.equal(box.hidden, true, "the batch button puts the list away");
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { decisions: [
    { id: "e-two1", keep: true },
    { id: "e-two2", keep: false },
    { id: "e-two3", keep: true },
  ] });
});

test("the batch button flips to discard-all when no row is ticked", async () => {
  const { run } = fakeDom();
  const app = run();
  const posts = [];
  app.win.fetch = async (url, init = {}) => {
    if (url === "/__edityy/previews") {
      if (!init.method || init.method === "GET") {
        return { status: 200, json: async () => ({ ok: true, previews: [
          { id: "e-drop1", instruction: "make it thin", action: "update", selector: "p", props: [{ property: "letter-spacing", value: "2px" }] },
          { id: "e-drop2", instruction: "darker again", action: "update", selector: "p", props: [] },
        ] }) };
      }
      if (init.method === "POST") posts.push(JSON.parse(init.body));
      return { status: 200, json: async () => ({ ok: true }) };
    }
    return { status: 200, json: async () => ({ ok: true }) };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  quiet(() => app.click());
  const el = selectText(app);
  const box = app.root.nodes.preview;
  app.doc.querySelector = () => el;
  await tick(); await tick(); await new Promise((r) => setTimeout(r, 1100));
  const rows = box.children[1].children.map((item) => item.children[0]);
  rows[0].children[0].checked = false;
  for (const fn of rows[0].children[0].bubbles.change.bubble) fn({});
  rows[1].children[0].checked = false;
  for (const fn of rows[1].children[0].bubbles.change.bubble) fn({});
  const batchBtn = box.children[2].children[0];
  assert.equal(batchBtn.textContent, "Discard all changes", "nothing ticked: the button takes the lot back");
  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(rows[0].children[0].checked, true, "key 1 flips the tick on the first row");
  assert.equal(batchBtn.textContent, "Keep all", "and the button flips back with it");
  quiet(() => app.fire("keydown", { key: "1" }));
  assert.equal(batchBtn.textContent, "Discard all changes", "and flips again");
  for (const fn of batchBtn.bubbles.click.bubble) fn({});
  assert.equal(box.hidden, true);
  assert.deepEqual(posts[0], { decisions: [
    { id: "e-drop1", keep: false },
    { id: "e-drop2", keep: false },
  ] });
});
