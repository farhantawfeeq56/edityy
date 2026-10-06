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
        const v = el.style.getPropertyValue(prop) || el.computed?.[prop] || "";
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
      if (was) was.children.splice(was.children.indexOf(child), 1);
      child.parentElement = node;
      node.children.splice(at === -1 ? node.children.length : at, 0, child);
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
    addEventListener: (type, fn) => (bubble(node, type).push(fn)),
    removeEventListener: (type, fn) => {
      const bucket = bubble(node, type);
      bucket.splice(bucket.indexOf(fn), 1);
    },
    getBoundingClientRect: () => attrs.rect ?? { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
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
    },
    get innerHTML() {
      return root._html;
    },
    nodes: {},
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
  const body = { appendChild: (node) => appended.push(node), childNodes: [] };

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
    new Function("window", "document", "CustomEvent", source)(win, doc, win.CustomEvent);
    return {
      win,
      doc,
      root,
      host: appended[0],
      appended,
      launch: () => root.nodes.launch,
      click: () => click([root.nodes.launch, appended[0], doc]),
      /** Click the page, not the shadow host. */
      clickPage: () => click([hovered ?? doc, doc]),
      /** Click inside the editing panel, whose path runs through the host. */
      clickPanel: () => click([root.nodes.panel, appended[0], doc]),
      /** Fire a document event, as the browser would. */
      fire: (type, event = {}) => {
        for (const fn of [...bucket(doc, type, "capture"), ...bucket(doc, type, "bubble")]) fn(event);
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
  // The package runs on other codebases, so it must not carry a font stack that
  // would only be right on one of them. The machine's own UI face is the safe one:
  // it exists everywhere, and the host page's typography belongs to the page.
  assert.match(css, /font-family:system-ui,-apple-system,/, "the machine's UI face");
  assert.doesNotMatch(css, /Plus Jakarta Sans/, "nothing named after one site");
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
    // One step in, still at the orb: scale only, no travel.
    assert.match(app.launch().style.transform, /translate\(0px,0px\) scale\(0\.16\)$/, "the shrink starts where the orb is");
    app.hover(text("p", "body"));
    app.fire("mousemove", { clientX: 40, clientY: 90 });
  });
  // Then it tracks the pointer, translated from the orb's own centre.
  assert.equal(
    app.launch().style.transform,
    "translate(-1140px,-658px) scale(0.16)",
  );
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
  });
  assert.equal(app.launch().style.transform, "translate(0px,0px) scale(1)");
  assert.equal(app.launch().style.pointerEvents, "", "the orb takes clicks again");
  assert.equal(app.root.nodes.label.style.opacity, "");
  assert.equal(app.countDoc("click"), 0, "the page is released");
});

test("the hover frame stands off the element", () => {
  const { run, text } = fakeDom();
  const app = run();
  // The frame starts 4px clear of the element, so the box is Edityy's and
  // not the page's own edge.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  const hover = app.root.nodes.hover.style;
  assert.equal(hover.left, "96px");
  assert.equal(hover.top, "46px");
  assert.equal(hover.width, "128px");
  assert.equal(hover.height, "56px");
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

test("the box is one continuous violet border on all four sides", () => {
  const { run, text } = fakeDom();
  const app = run();
  // 120x48 at (100,50). The frame stands off 4px, so it covers 96..224 by
  // 46..102: 128 wide, 56 tall.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  const sel = app.root.nodes.sel;
  assert.equal(sel.hidden, false);
  assert.equal(sel.children.length, 0, "one border, not a stack of pieces");
  assert.equal(sel.style.left, "96px");
  assert.equal(sel.style.top, "46px");
  assert.equal(sel.style.width, "128px");
  assert.equal(sel.style.height, "56px");
  // One colour, one unbroken stroke on every side, and a corner radius.
  assert.match(app.root.innerHTML, /border:2px solid #d79eac/, "one violet border, all four sides");
  assert.match(app.root.innerHTML, /border-radius:4px/, "the ramp sm radius");
  assert.match(app.root.innerHTML, /background:transparent/, "nothing painted inside");
});

/** Select a node and report how it was classified. */
const kindOf = (app, node) => {
  app.hover(node);
  app.clickPage();
  return app.root.selection().kind;
};

/** Select some text and open the dock, as picking words does. Enters the mode
    first if it is not already in it, since some callers are already inside. */
const selectText = (app) => {
  if (!app.countDoc("click")) quiet(() => app.click());
  const p = app.el("p", { text: "hello" });
  app.hover(p);
  app.clickPage();
  return p;
};

/** Press a dock icon by its key. */
const press = (app, key) => {
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === key);
  for (const fn of icon.bubbles.click.bubble) fn({});
  return icon;
};

/** Pick a named row out of the open control. */
const pickOption = (pop, title) => {
  const row = pop.children.flatMap((c) => c.children).find((b) => b.title === title);
  assert.ok(row, `no option "${title}" in the open control`);
  for (const fn of row.bubbles.click.bubble) fn({});
  return row;
};

/** Move the popover's nth slider to a value, as a user would drag it. */
const drag = (open, index, value) => {
  const input = open.children[index].children[0];
  assert.ok(input, `no slider at ${index}`);
  input.value = value;
  for (const fn of input.bubbles.input.bubble) fn({});
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
  // `*{color:#3a283c}` matches the glyph itself, so an active button's paper
  // colour never reaches it: without an explicit inherit the Aa is plum on plum
  // and disappears. Both glyph kinds need it, one by letterform one by svg.
  assert.match(css, /\.g\{[^}]*color:inherit/, "the letterform glyph");
  assert.match(css, /\.ic svg\{[^}]*color:inherit/, "and the drawn ones");
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
  assert.match(css, /\.list\{[^}]*scrollbar-color:#3a283c40 transparent/, "on the ramp");
  assert.match(css, /\.list::-webkit-scrollbar-thumb\{/, "and for the engines that need it");
});

test("the dock opens on text and container, stays shut on media", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("div"));
    app.clickPage();
  });
  assert.equal(app.root.nodes.dock.hidden, false, "a container gets the dock too");
  assert.deepEqual(
    app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "gap", "alignment", "+"],
    "Stack controls match the table"
  );
  const box = app.root.selection().el;

  // Mode is the only cyclic control: Stack -> Flex -> Grid -> Absolute -> Stack.
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "wrap", "alignment", "gap", "+"]);
  assert.equal(box.style.getPropertyValue("display"), "flex");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "columns", "rows", "columnGap", "rowGap", "alignment", "+"]);
  assert.equal(box.style.getPropertyValue("display"), "grid");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "bounds", "width", "height", "+"]);
  assert.equal(box.style.getPropertyValue("position"), "absolute");
  quiet(() => press(app, "mode"));
  assert.deepEqual(app.root.nodes.row.children.map((b) => b.dataset.key),
    ["mode", "direction", "gap", "alignment", "+"]);

  quiet(() => press(app, "alignment"));
  assert.equal(app.root.nodes.pop.children[0].children.length, 9, "alignment is a 3x3 grid");
  quiet(() => press(app, "mode"));
  quiet(() => press(app, "wrap"));
  assert.equal(app.root.nodes.pop.children[0].children.length, 3, "flex wrap options");
  quiet(() => press(app, "alignment"));
  assert.equal(app.root.nodes.pop.children[0].children.length, 9, "flex alignment grid");
  for (const fn of app.root.nodes.pop.children[0].children[2].bubbles.click.bubble) fn({});
  assert.equal(box.style.getPropertyValue("justify-content"), "flex-end", "flex horizontal alignment");
  assert.equal(box.style.getPropertyValue("align-items"), "flex-start", "flex vertical alignment");
  quiet(() => press(app, "wrap"));
  for (const fn of app.root.nodes.pop.children[0].children[1].bubbles.click.bubble) fn({});
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap", "flex wrap");
  quiet(() => press(app, "mode"));
  quiet(() => press(app, "columns"));
  assert.equal(app.root.nodes.pop.children[0].children.find((n) => n.type === "number").type, "number");
  const columnsInput = app.root.nodes.pop.children[0].children.find((n) => n.type === "number");
  columnsInput.value = "3";
  for (const fn of columnsInput.bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("grid-template-columns"), "repeat(3, minmax(0, 1fr))");
  quiet(() => press(app, "columnGap"));
  const columnGapInput = app.root.nodes.pop.children[0].children.find((n) => n.type === "range");
  columnGapInput.value = "16";
  for (const fn of columnGapInput.bubbles.input.bubble) fn({});
  assert.equal(box.style.getPropertyValue("column-gap"), "16px");
  quiet(() => press(app, "alignment"));
  for (const fn of app.root.nodes.pop.children[0].children[8].bubbles.click.bubble) fn({});
  assert.equal(box.style.getPropertyValue("justify-items"), "end", "grid horizontal alignment");
  assert.equal(box.style.getPropertyValue("align-items"), "flex-end", "grid vertical alignment");
  quiet(() => press(app, "mode"));
  quiet(() => press(app, "bounds"));
  assert.equal(app.root.nodes.pop.children.length, 4, "absolute edges");
  quiet(() => press(app, "mode"));
  quiet(() => press(app, "mode"));
  quiet(() => press(app, "mode"));
  quiet(() => selectText(app));
  assert.equal(app.root.nodes.dock.hidden, false, "words are");
  // Seven type icons and the `+`, each with a name for a tooltip.
  const row = app.root.nodes.row;
  assert.equal(row.children.length, 9);
  assert.deepEqual(
    row.children.map((b) => b.dataset.key),
    ["family", "weight", "size", "line", "tracking", "align", "decorate", "color", "+"]
  );
  for (const icon of row.children) assert.match(icon.attributes["aria-label"], /\w/);
  // Six drawn as SVG and two as letterforms: Aa is the face panel's own mark.
  // The stub does not parse markup, so this reads what the payload handed over —
  // and the A with a swatch under it is the colour of the words. Enough to catch a
  // glyph that ships empty, which is how the icons went missing.
  const glyphs = row.children.map((b) => b.innerHTML);
  assert.equal(glyphs.filter((g) => g.includes("<svg")).length, 7, "six type icons and the +");
  assert.deepEqual(
    glyphs.filter((g) => g.startsWith("<i")).map((g) => g.replace(/<[^>]+>/g, "")),
    ["Aa", "A"]
  );
  assert.match(app.root.innerHTML, /#dock\{[^}]*position:fixed/, "fixed, so it does not scroll away");
  assert.match(app.root.innerHTML, /#dock\{[^}]*bottom:24px/, "and it sits at the bottom of the viewport");
  // The control opens above the icon row, or the viewport eats it.
  const markup = app.root.innerHTML;
  assert.ok(markup.indexOf('id="pop"') < markup.indexOf('id="row"'), "the control is above the dock");
  assert.match(app.root.innerHTML, /#dock\{[^}]*flex-direction:column/, "stacked by the dock itself");
});

test("wrap and direction establish flex before applying the choice", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    press(app, "mode");
    press(app, "wrap");
  });
  assert.equal(box.style.getPropertyValue("display"), "flex");
  assert.equal(box.style.getPropertyValue("flex-direction"), "row");
  pickOption(app.root.nodes.pop, "Wrap");
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap");
  quiet(() => {
    press(app, "mode");
    press(app, "mode");
    press(app, "mode");
    press(app, "direction");
  });
  pickOption(app.root.nodes.pop, "Column");
  assert.equal(box.style.getPropertyValue("flex-direction"), "column");
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
  pickOption(app.root.nodes.pop, "Wrap reverse");
  assert.equal(box.style.getPropertyValue("display"), "flex");
  assert.equal(box.style.getPropertyValue("flex-wrap"), "wrap-reverse");
});

test("one control opens at a time, under the dock, and Escape closes it", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => selectText(app));
  const pop = app.root.nodes.pop;
  assert.equal(pop.hidden, true, "nothing is open to begin with");
  quiet(() => press(app, "align"));
  assert.equal(pop.hidden, false);
  assert.equal(app.root.nodes.row.children[5].attributes["aria-expanded"], "true");
  assert.equal(app.root.nodes.row.children[0].attributes["aria-expanded"], "false");
  // Four alignments, each drawn as its own lines rather than a word.
  assert.equal(pop.children[0].children.length, 4);
  assert.match(shown(pop), /<path d="M3 5h12M3 9h8M3 13h12"/, "each alignment drawn as its own lines");
  // Opening another one replaces it rather than stacking.
  quiet(() => press(app, "size"));
  assert.equal(
    pop.children.flatMap((c) => c.children).some((b) => b.getAttribute?.("aria-label") === "center"),
    false,
    "the old control is gone"
  );
  // Escape backs out one level: the control first, then the mode.
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(pop.hidden, true, "the control closes");
  assert.equal(app.root.nodes.dock.hidden, false, "but the dock stays");
  quiet(() => app.fire("keydown", { key: "Escape" }));
  assert.equal(app.root.nodes.dock.hidden, true, "and the next Escape leaves the mode");
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
  assert.ok(
    pop.children[0].children.every((b) => b.style.cssText.startsWith("font-family:")),
    "each option wears the face it offers"
  );
  assert.deepEqual(
    pop.children[0].children.map((b) => b.getAttribute("aria-label")),
    ["System UI", "Helvetica", "Georgia", "Times New Roman", "Courier New"],
    "the machine's own faces, and nothing invented"
  );
  // Weight is a slider from the lightest to the heaviest.
  quiet(() => press(app, "weight"));
  const range = fields(pop)[0];
  assert.equal(range.type, "range");
  assert.equal(range.min, "100", "the lightest weight");
  assert.equal(range.max, "900", "to the heaviest");
  // Size is a number, because 44 is typed rather than dragged for.
  quiet(() => press(app, "size"));
  const number = fields(pop)[0];
  assert.equal(number.type, "number");
  // Tracking is a slider too: it is judged by eye, and a drag beats typing.
  quiet(() => press(app, "tracking"));
  const track = fields(pop)[0];
  assert.equal(track.type, "range");
  assert.equal(track.min, "-4", "tight, as large type needs");
  assert.equal(track.max, "16", "to wide, as small caps need");
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
  quiet(() => press(app, "size"));
  const input = app.root.nodes.pop.children[0].children[0];
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
  quiet(() => press(app, "align"));
  const opts = pop.children[0].children;
  // Pick the second alignment. The control stays: comparing two values means
  // looking at the page with the choices still there.
  for (const fn of opts[1].bubbles.click.bubble) fn({});
  assert.equal(pop.hidden, false, "still open after a choice");
  assert.equal(p.style.getPropertyValue("text-align"), "center");
  assert.equal(opts[1].getAttribute("aria-pressed"), "true", "the tick moved");
  assert.equal(opts[0].getAttribute("aria-pressed"), "false");
  // It closes on another primary icon, or on the same one again.
  quiet(() => press(app, "align"));
  assert.equal(pop.hidden, true, "the same icon again closes it");
  quiet(() => press(app, "size"));
  assert.equal(pop.hidden, false);
  quiet(() => press(app, "weight"));
  assert.equal(pop.hidden, false, "another icon replaces it rather than stacking");
  assert.equal(fields(pop)[0].type, "range", "and it is the new control that is showing");
});

test("picking a face writes the whole stack to the element", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "family"));
  const opts = app.root.nodes.pop.children[0].children;
  for (const fn of opts[1].bubbles.click.bubble) fn({});
  // The stack, not the bare name: "Helvetica" alone resolves to whatever the
  // machine substitutes, while "Helvetica,Arial,sans-serif" is a real choice.
  assert.equal(p.style.getPropertyValue("font-family"), "Helvetica,Arial,sans-serif");
  assert.equal(app.root.nodes.pop.hidden, false, "and the list stays open");
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

test("an open control survives a click back on the same words", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "weight"));
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

test("selecting text makes the words editable where they sit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  assert.equal(p.getAttribute("contenteditable"), "plaintext-only");
  // plaintext-only, not true: pasting must not paste markup into the page.
  assert.notEqual(p.getAttribute("contenteditable"), "true");
});

test("selecting something else takes the caret off the old words", () => {
  const { run } = fakeDom();
  const app = run();
  const first = selectText(app);
  const second = app.el("h1", { text: "Edityy" });
  app.hover(second);
  app.clickPage();
  assert.equal(first.getAttribute("contenteditable"), undefined, "the old element is handed back");
  assert.equal(second.getAttribute("contenteditable"), "plaintext-only");
});

test("exiting the mode gives the words back to the page", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
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

test("an element with child elements takes no caret, because typing would take them", () => {
  const { run, el } = fakeDom();
  const app = run();
  // A heading holding an <em>: text to the dock, but its words are not leaf text
  // and setText() would rewrite textContent and lose the emphasis.
  const heading = el("h1");
  const em = el("em");
  em.childNodes = [{ nodeType: 3, nodeValue: "there" }];
  // childNodes is what a real DOM keeps element children in too.
  heading.childNodes = [{ nodeType: 3, nodeValue: "Be " }, em];
  heading.children = [em];
  em.parentElement = heading;
  heading.textContent = "Be there";
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  assert.equal(app.root.selection().kind, "text", "still text, so the dock opens");
  assert.equal(heading.getAttribute("contenteditable"), undefined, "but the words are not rewritten");
});

test("the words being edited get no second ring on top of Edityy's own frame", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  // The browser draws a focus ring on any focused element. Edityy already draws
  // a selection frame, so the words ended up with two outlines, one of them not
  // ours. The frame is the ring.
  assert.equal(p.style.getPropertyValue("outline"), "none");
});

test("an element's own inline outline survives being edited", () => {
  const { run } = fakeDom();
  const app = run();
  quiet(() => app.click());
  const p = app.el("p", { text: "hello", style: { outline: "2px solid red" } });
  app.hover(p);
  quiet(() => app.clickPage());
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
  // The payload must not rewrite textContent to make an element editable: that
  // destroys the text node and the browser drops the caret at the start, so
  // clicking the middle of a line always typed at the beginning.
  assert.equal(p.textContent, "hello", "the words were not rewritten");
  assert.equal(p.childNodes.length, 1, "and the node the caret sits in still exists");
});

test("the selection frame follows the element as it grows and shrinks", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  p.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 });
  quiet(() => {
    press(app, "size");
    // The dock writes a style, which reflows the element.
  });
  const frame = app.root.nodes.sel;
  assert.equal(frame.style.width, "108px", "measured after the change");
  // Now it changes height — words wrapping onto another line, say.
  p.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 140, width: 100, height: 120 });
  // input, not keydown: keydown fires before the browser has changed the
  // words, so measuring there would catch the element as it was.
  quiet(() => app.fire("input", { target: p }));
  return new Promise((done) =>
    setTimeout(() => {
      assert.equal(frame.style.height, "128px", "the box grew with the text");
      assert.equal(frame.style.top, "16px");
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
  assert.equal(app.root.nodes.sel.style.top, "16px", "4px standoff");
  // Scrolling moves the element up the viewport; the frame is viewport-fixed and
  // has to move with it or it is left behind, pointing at nothing.
  p.getBoundingClientRect = () => ({ left: 10, top: -180, right: 110, bottom: -140, width: 100, height: 40 });
  quiet(() => app.scroll());
  assert.equal(app.root.nodes.sel.style.top, "-184px", "the frame moved with the page");
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

test("text colour writes color, which is the colour of the words", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => press(app, "color"));
  const swatch = inputOf(pop(app), "color");
  assert.ok(swatch, "a colour control");
  swatch.value = "#86546b";
  for (const fn of swatch.bubbles.input.bubble) fn({});
  assert.equal(p.style.getPropertyValue("color"), "#86546b");
  // The text fill IS the text colour; fill is the box behind it.
  assert.equal(p.style.getPropertyValue("background-color"), "", "the background is not touched");
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
  // A colour on a zero-width border paints nothing at all.
  // The width slider is the second row: the colour bar is the first.
  drag(pop(app), 1, 2);
  assert.equal(p.style.getPropertyValue("border-width"), "2px");
  assert.equal(p.style.getPropertyValue("border-style"), "solid", "a width with no style is still nothing");

  drag(pop(app), 1, 0);
  assert.equal(p.style.getPropertyValue("border-width"), "0px");
  assert.equal(p.style.getPropertyValue("border-style"), "", "and no style left behind");
});

test("no colour of ours is offered, because a site has never heard of our palette", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  quiet(() => press(app, "color"));
  const open = pop(app);
  // The native picker and nothing else. Offering our own ramp put one click
  // between a teal brand and a plum that belongs to us.
  assert.equal(all(open).filter((n) => n.className === "ic swatch").length, 0, "no swatches of ours");
  assert.equal(all(open).filter((n) => n.type === "color").length, 1, "just the browser picker");
  const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");
  // Nothing invents a colour to fall back on: an element whose colour is a name
  // or an rgb() leaves the UA default alone rather than showing a colour of ours.
  assert.doesNotMatch(source, /swatch\.value = .*#3a283c/, "no plum standing in for an unknown colour");
});

test("the text-colour glyph wears the element own colour, not one of ours", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  p.style.setProperty("color", "rgb(0, 105, 92)");
  app.hover(p);
  app.clickPage();
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === "color");
  // The bar under the A is a readout of this site. Painting it plum on every
  // site claims the site is that colour.
  assert.doesNotMatch(icon.innerHTML, /background:#3a283c/, "no colour baked into the glyph");
  // There is nowhere left to read a hex: style.color and getComputedStyle both
  // answer rgb(), so the only route back to a hex is converting what the page
  // wrote — which is arithmetic, not invention.
  p.style.setProperty("color", "rgb(0, 105, 92)");
  assert.match(icon.innerHTML, /id="swatch-color"/, "a bar that shows the element own colour");
});


test("each element keeps its own additions", () => {
  const { run } = fakeDom();
  const app = run();
  const first = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Blur");
  });
  const second = app.el("h1", { text: "Second" });
  app.hover(second);
  app.clickPage();
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Contrast");
  });
  const keys = () => app.root.nodes.row.children.map((b) => b.dataset.key);
  assert.deepEqual(keys(), ["contrast", "family", "weight", "size", "line", "tracking", "align", "decorate", "color", "+"]);

  app.hover(first);
  app.clickPage();
  assert.deepEqual(
    keys(),
    ["blur", "family", "weight", "size", "line", "tracking", "align", "decorate", "color", "+"],
    "the first element keeps only its own",
  );
});

test("an icon's stroke follows the button, so an open control's icon stays visible", () => {
  const { run } = fakeDom();
  const app = run();
  const css = app.root.innerHTML;
  // `*{color:...}` reaches the <path> as well as the <svg>, and a path stroked
  // with currentColor resolves against its OWN colour — so a universal colour
  // painted every icon the same plum, and an open control is that plum: an icon
  // the exact colour of its own background. The colour goes on :host instead.
  assert.doesNotMatch(css, /\*\{[^}]*color:#3a283c/, "no universal colour to leak onto the paths");
  assert.match(css, /:host\{all:initial;color:#3a283c\}/, "the colour is on the host rule, in the same declaration as all:initial — which resets colour itself");
  assert.match(css, /\.ic svg\{[^}]*stroke:currentColor/, "and the paths are stroked from it");
});

test("the dock ends in a + that adds a control to the row", () => {
  const { run } = fakeDom();
  const app = run();
  selectText(app);
  const row = app.root.nodes.row;
  const plus = row.children[row.children.length - 1];
  assert.equal(plus.dataset.key, "+", "the + is the last thing in the row");
  assert.match(plus.innerHTML, /<path d="M9 3\.5v11M3\.5 9h11"/, "a plus sign, drawn");
  const before = row.children.length;
  quiet(() => press(app, "+"));
  // What it offers is the five additions, as a list under the dock.
  const pop = app.root.nodes.pop;
  assert.deepEqual(
    pop.children[0].children.map((b) => b.title),
    ["Shadow", "Blur", "Brightness", "Greyscale", "Contrast", "Fill", "Border", "Padding", "Margin"],
  );
  // Picking one puts it in the row, and opens the control that was just picked.
  quiet(() => pickOption(pop, "Blur"));
  assert.equal(row.children.length, before + 1);
  const added = row.children.find((b) => b.dataset.key === "blur");
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
    pickOption(app.root.nodes.pop, "Blur");
    press(app, "+");
  });
  const names = app.root.nodes.pop.children[0].children.map((b) => b.title);
  // Blur is gone because this element has it; the two new box controls are still
  // on offer, since only Blur was ever added.
  assert.deepEqual(names, ["Shadow", "Brightness", "Greyscale", "Contrast", "Fill", "Border", "Padding", "Margin"]);
});

test("a filter slider writes the filter, and leaves the others alone", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Brightness");
  });
  drag(pop(app), 0, 180);
  assert.match(p.style.getPropertyValue("filter"), /brightness\(180%\)/);
  assert.doesNotMatch(p.style.getPropertyValue("filter"), /blur\(/, "nothing else invented");
});

test("a decimal filter survives being read back, because half a pixel is a step", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Blur");
  });
  drag(pop(app), 0, 4);
  drag(pop(app), 0, 0.5);
  assert.equal(p.style.getPropertyValue("filter"), "blur(0.5px)", "an integer-only read loses this");
});

test("a filter back at its default leaves no filter behind", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Greyscale");
  });
  drag(pop(app), 0, 100);
  assert.match(p.style.getPropertyValue("filter"), /grayscale\(100%\)/);
  // A string, as a range input reports it: "0" !== 0, so a filter dragged home
  // would be written as grayscale(0%) and never leave.
  drag(pop(app), 0, "0");
  assert.equal(p.style.getPropertyValue("filter"), "", "the filter is gone, not zero");
});

test("a shadow is written as one shorthand, because the offsets have no longhand", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Shadow");
  });
  const bars = app.root.nodes.pop.children;
  assert.equal(bars.length, 5, "four lengths and a colour");
  // Strings, as a range input reports them: "0" is truthy, so a shadow that
  // casts nothing would be written as 0px 0px 0px 0px and never clear.
  drag(pop(app), 1, "10"); // y offset
  drag(pop(app), 2, "24"); // blur
  // Five invented properties would draw nothing at all: CSS has no
  // box-shadow-offset-x outside an @property registration.
  assert.match(p.style.getPropertyValue("box-shadow"), /10px 24px/, "x, y, blur, spread, colour");
  assert.equal(p.style.getPropertyValue("box-shadow-offset-x"), "", "and no invented longhand");
  // Back to nothing: four zeroes and a colour cast nothing, so nothing is written.
  for (const i of [0, 1, 2, 3]) drag(pop(app), i, "0");
  assert.equal(p.style.getPropertyValue("box-shadow"), "", "no shadow left behind");
});

test("two filters coexist, because one drag must not throw the other away", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Blur");
    drag(pop(app), 0, 8);
    press(app, "+");
    pickOption(app.root.nodes.pop, "Greyscale");
    drag(pop(app), 0, 100);
  });
  // The stub hands back the inline value verbatim, where a browser would hand
  // back "none" for the filter that is not there yet — which is the case this
  // has to survive.
  assert.match(p.style.getPropertyValue("filter"), /blur\(8px\)/);
  // Spelled "grayscale", not "greyscale": Chrome never implemented the standard
  // name, and one unknown function invalidates the whole list — asking for it
  // would take the blur down with it.
  assert.match(p.style.getPropertyValue("filter"), /grayscale\(100%\)/);
});

test("every change is still undone on exit", () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Blur");
    drag(pop(app), 0, 12);
  });
  assert.match(p.style.getPropertyValue("filter"), /blur\(12px\)/);
  quiet(() => app.fire("keydown", { key: "Escape" })); // the control
  quiet(() => app.fire("keydown", { key: "Escape" })); // then the mode
  assert.equal(p.style.getPropertyValue("filter"), "", "the page is back as it was");
});









/** Type a size into the open size control, as a user would. */
const setSize = (app, px) => {
  const icon = app.root.nodes.row.children.find((b) => b.dataset.key === "size");
  if (icon.getAttribute("aria-expanded") !== "true") quiet(() => press(app, "size"));
  const input = app.root.nodes.pop.children[0].children[0];
  input.value = String(px);
  for (const fn of input.bubbles.input.bubble) fn({});
  for (const fn of input.bubbles.change?.bubble ?? []) fn({}); // the field is left
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
  quiet(() => {
    const input = app.root.nodes.pop.children[0].children[0];
    input.value = "16";
  });
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
  const p = selectText(app);
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
    pickOption(app.root.nodes.pop, "Blur");
  });
  for (const v of [2, 4, 6, 8]) drag(pop(app), 0, v);
  await tick();
  assert.match(p.style.getPropertyValue("filter"), /blur\(8px\)/);
  key(app, "z", { metaKey: true });
  assert.equal(p.style.getPropertyValue("filter"), "", "straight back to no filter");
});

test("a border's width and style are undone together", async () => {
  const { run } = fakeDom();
  const app = run();
  const p = selectText(app);
  quiet(() => {
    press(app, "+");
    pickOption(app.root.nodes.pop, "Border");
  });
  const width = fields(pop(app)).find((n) => n.type === "range");
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
  const p = selectText(app);
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
  const p = selectText(app);
  p.id = "intro";
  setSize(app, 40);
  p.textContent = "hello again";
  app.fire("input", {});
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
  quiet(() => again.fire("keydown", { key: "Escape" }));
  assert.equal(fresh.style.getPropertyValue("font-size"), "");
  assert.equal(fresh.textContent, "hello");
  assert.equal(store.getItem("edityy:/"), null);
});

test("an edit whose element is gone is dropped, not applied somewhere else", async () => {
  const store = memoryStorage();
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

test("padding moves all four sides at once, or one side on its own", async () => {
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
  const all = fields(pop(app));
  const range = all.find((n) => n.type === "range");
  range.value = "24";
  for (const fn of range.bubbles.input.bubble) fn({});
  for (const fn of range.bubbles.change.bubble) fn({});
  for (const side of ["top", "right", "bottom", "left"]) {
    assert.equal(box.style.getPropertyValue("padding-" + side), "24px", side);
  }
  const numbers = all.filter((n) => n.type === "number");
  assert.deepEqual(numbers.map((n) => n.value), ["24", "24", "24", "24"], "the fields follow the slider");
  assert.equal(numbers[1].getAttribute("aria-label"), "Right padding");
  await tick();

  numbers[1].value = "8";
  for (const fn of numbers[1].bubbles.input.bubble) fn({});
  for (const fn of numbers[1].bubbles.change.bubble) fn({});
  assert.equal(box.style.getPropertyValue("padding-right"), "8px");
  assert.equal(box.style.getPropertyValue("padding-left"), "24px");
  await tick();

  key(app, "z", { metaKey: true });
  assert.equal(box.style.getPropertyValue("padding-right"), "24px", "one side undoes alone");
  key(app, "z", { metaKey: true });
  assert.equal(box.style.getPropertyValue("padding-top"), "", "and the four sides undo together");
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
