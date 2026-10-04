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
  const computed = (el) => ({
    getPropertyValue: (prop) => el.style.getPropertyValue(prop) || el.computed?.[prop] || "",
  });
  /** Listener buckets, keyed by phase: capture runs before bubble. */
  const bucket = (node, type, phase) => ((node.bubbles ??= {})[type] ??= {})[phase] ??= [];
  const bubble = (node, type) => bucket(node, type, "bubble");

  const el = (tag, attrs = {}, style = {}) => {
    const node = {
    tagName: tag.toUpperCase(),
    style: {
      cssText: "",
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
    textContent: attrs.text ?? "",
    value: attrs.value ?? "",
    title: "",
    hidden: false,
    offsetWidth: 270,
    offsetHeight: 300,
    offsetLeft: 0,
    offsetTop: 0,
    setPointerCapture() {},
    releasePointerCapture() {},
    childNodes: [],
    children: [],
    disabled: false,
    className: "",
    setAttribute: (k, v) => (attrs[k] = v),
    getAttribute: (k) => attrs[k],
    appendChild: (child) => {
      created.push(child);
      node.children.push(child);
      return child;
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
      /** The black that fills the gap on one edge of a frame. */
      line: (edge, frame = "sel") => root.nodes[frame].children[edge * 4],
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

test("the launcher wears the site's own font", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // Plus Jakarta Sans, the face DESIGN.md and the app ship. `all:initial` on the
  // host severs inheritance, so the payload has to name it — with the token
  // first so the app's loaded face wins, and the bare family as the fallback.
  assert.match(css, /font-family:var\(--font-sans,\\?"?\+?Plus Jakarta Sans/, "Jakarta via the app token");
  assert.doesNotMatch(css, /font-family:system-ui/, "not a bare system-ui stack");
  assert.match(css, /font:600 14px\/1\.1 inherit/, "the orb inherits that face, on the ramp");
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

test("the frame stands off the element and rounds with the ramp", () => {
  const { run, text } = fakeDom();
  const app = run();
  // The dash run starts 4px clear of the element, so the frame is Edityy's and
  // not the page's own edge.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  assert.equal(app.line(0, "hover").style.top, "46px");
  assert.equal(app.line(0, "hover").style.left, "112px");
  assert.equal(app.line(0, "hover").style.width, "96px");
  assert.equal(app.line(1, "hover").style.left, "96px");
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

test("the box is accent bars at the corners and midpoints, black filling the gaps", () => {
  const { run, text } = fakeDom();
  const app = run();
  // 120x48 at (100,50). The frame stands off 4px, so it covers 96..224 by 46..102:
  // 128 wide, 56 tall. Top-left bar at x=96 y=46, top-right at x=208.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
  });
  const sel = app.root.nodes.sel;
  assert.equal(sel.hidden, false);
  // Four edges, each a dash run plus three 16px accent bars.
  assert.equal(sel.children.length, 16);
  for (const edge of [0, 1, 2, 3]) {
    assert.equal(app.line(0).className, "line");
    for (const spot of [0, 1, 2]) assert.equal(app.bar(edge, spot).className, "bar");
  }
  assert.equal(app.bar(0, 0).style.left, "96px", "flush with the left end of the top edge");
  assert.equal(app.bar(0, 0).style.top, "46px");
  assert.equal(app.bar(0, 2).style.left, "208px", "and 16px in from the right, so the cap lands on the corner");
  assert.equal(app.bar(0, 1).style.left, "152px", "the middle bar, centred on a 128px edge");
  assert.equal(app.bar(0, 1).style.width, "16px");
  // Vertical edges are positioned the other way round.
  assert.equal(app.bar(1, 0).style.left, "96px");
  assert.equal(app.bar(1, 0).style.top, "46px");
  assert.equal(app.bar(1, 2).style.top, "86px", "16px up from the bottom of a 56px edge");
  // The black fills exactly the gap between the two end bars, touching neither.
  assert.equal(app.line(0).style.left, "112px");
  assert.equal(app.line(0).style.width, "96px");
  assert.equal(app.line(2).style.top, "102px", "the bottom edge, at the far side of the box");
  assert.equal(app.line(3).style.left, "224px", "and the right edge at the far side of it");
  // Solid black; the accent bars carry the design on top of it.
  assert.match(app.root.innerHTML, /\.line\{[^}]*background:#000/, "solid, not dashed");
  assert.match(app.root.innerHTML, /\.bar\{[^}]*background:#d79eac/, "the accent is the dominant layer");
  assert.match(app.root.innerHTML, /\.line\{[^}]*height:2px/, "the same stroke weight as the bars");
});

test("the pattern stays the same on a small element", () => {
  const { run, text } = fakeDom();
  const app = run();
  // 20x12: the frame is 28x20 from -4, so the end bars meet and the dash line is
  // still there underneath them.
  const line = text("p", "body", {}, { left: 0, top: 0, right: 20, bottom: 12, width: 20, height: 12 });
  quiet(() => {
    app.click();
    app.hover(line);
    app.clickPage();
  });
  assert.equal(app.bar(0, 1).style.left, "2px", "the middle bar is still centred on the element");
  assert.equal(app.line(0).style.width, "0px", "no gap means no black, not a squashed one");
  assert.equal(app.root.nodes.sel.children.length, 16, "and the same sixteen pieces either way");
});

/** Select a node and report how it was classified. */
const kindOf = (app, node) => {
  app.hover(node);
  app.clickPage();
  return app.root.selection().kind;
};

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

test("text beats the container it sits in", () => {
  const { run, text, el } = fakeDom();
  const app = run();
  const card = el("section");
  const heading = text("h1", "Edityy");
  heading.parentElement = card;
  quiet(() => {
    app.click();
    assert.equal(kindOf(app, heading), "text");
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

