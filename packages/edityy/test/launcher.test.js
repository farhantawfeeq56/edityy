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
    setAttribute: (k, v) => (attrs[k] = v),
    getAttribute: (k) => attrs[k],
    appendChild: (child) => {
      created.push(child);
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

  const root = {
    innerHTML: "",
    nodes: {},
    bubbles: {},
    addEventListener: (type, fn) => (root.bubbles[type] ??= []).push(fn),
    removeEventListener: (type, fn) => {
      root.bubbles[type] = (root.bubbles[type] ?? []).filter((f) => f !== fn);
    },
    getElementById: (id) => (root.nodes[id] ??= el(id === "fFamily" ? "select" : id === "fColor" ? "input" : "div", { id })),
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
  assert.match(root.innerHTML, />Edityy<\/button>/);
});

test("the launcher wears the DESIGN.md palette", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // Orb: Primary fill, On-primary label, Secondary on hover. Floating layer:
  // translucent paper with blur and a diffuse ink shadow.
  assert.match(css, /background:#3a283c/, "Primary");
  assert.match(css, /color:#f9f2ee/, "On-primary");
  assert.match(css, /#launch:hover\{background:#86546b\}/, "Secondary on hover");
  assert.match(css, /backdrop-filter:blur/, "the mist");
  // The ramp is closed: five values, nothing pure black or pure white, and none
  // of the ink + mint palette #48 replaced.
  for (const banned of [/#111[^0-9a-f]/i, /#fff[^0-9a-f]/i, /#b7efb2/i, /#ffef99/i, /#e2ddfd/i]) {
    assert.doesNotMatch(css, banned, "no colour outside the DESIGN.md ramp");
  }
});

test("the launcher wears the site's own font", () => {
  const { run } = fakeDom();
  const css = run().root.innerHTML;
  // Plus Jakarta Sans, the face DESIGN.md and the app ship. `all:initial` on the
  // host severs inheritance, so the payload has to name it — with the token
  // first so the app's loaded face wins, and the bare family as the fallback.
  assert.match(css, /font-family:var\(--font-sans,\\?"?\+?Plus Jakarta Sans/, "Jakarta via the app token");
  assert.doesNotMatch(css, /font-family:system-ui/, "not a bare system-ui stack");
  assert.match(css, /font:600 15px\/1 inherit/, "the orb inherits that face");
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
  assert.equal(app.launch().hidden, true, "the orb steps aside for the cursor");
  assert.equal(app.root.nodes.cursor.hidden, false);
  assert.equal(app.countDoc("click"), 1, "the page is captured in edit mode");
});

test("the editing cursor follows the pointer", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.fire("mousemove", { clientX: 40, clientY: 90 });
  });
  assert.equal(app.root.nodes.cursor.style.transform, "translate(40px,90px)");
});

test("the hover frame stands off the element and rounds with the ramp", () => {
  const { run, text } = fakeDom();
  const app = run();
  // A 120x48 heading: shorter side 48, so 16px is the largest ramp radius that
  // does not turn the frame into a lozenge. Inset 3px on every side.
  const heading = text("h1", "Edityy", {}, { left: 100, top: 50, right: 220, bottom: 98, width: 120, height: 48 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  const hover = app.root.nodes.hover.style;
  assert.equal(hover.left, "97px");
  assert.equal(hover.top, "47px");
  assert.equal(hover.width, "126px");
  assert.equal(hover.height, "54px");
  assert.equal(hover.borderRadius, "16px");
});

test("the frame never rounds sharper than a short element can carry", () => {
  const { run, text } = fakeDom();
  const app = run();
  // 100x20: half the short side is 10, so 16px would be a lozenge and 8 is the
  // largest ramp radius that actually fits.
  const line = text("p", "body", {}, { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 });
  quiet(() => {
    app.click();
    app.hover(line);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
  });
  assert.equal(app.root.nodes.hover.style.borderRadius, "8px");
});

test("hovering text outlines it, clicking selects it and fills the panel", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy");
  quiet(() => {
    app.click();
    app.hover(heading);
    app.fire("mousemove", { clientX: 10, clientY: 10 });
    assert.equal(app.root.nodes.hover.style.display, "block");
    app.clickPage();
  });
  assert.equal(app.root.nodes.sel.style.display, "block");
  assert.equal(app.root.nodes.panel.hidden, false);
  assert.match(app.root.nodes.target.textContent, /h1/);
  assert.equal(app.root.nodes.fText.value, "Edityy");
});

test("the font dropdown reads the selection's own family back", () => {
  const { run, text } = fakeDom();
  const app = run();
  // A resolved stack never equals the source string, so only the leading family
  // can be matched. `var()` in the inline style resolves to nothing at all.
  const heading = text("h1", "Edityy", { "font-family": "'Plus Jakarta Sans', system-ui, sans-serif" });
  const plain = text("p", "body", { "font-family": "Georgia, serif" });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
    assert.equal(app.root.nodes.fFamily.value, "Plus Jakarta Sans");
    app.hover(plain);
    app.clickPage();
    assert.equal(app.root.nodes.fFamily.value, "Georgia");
  });
});

test("an element with no text of its own is not selectable", () => {
  const { run, el } = fakeDom();
  const app = run();
  const wrapper = el("div");
  quiet(() => {
    app.click();
    app.hover(wrapper);
    app.clickPage();
  });
  assert.equal(app.root.nodes.panel.hidden, true);
});

test("editing a control applies one inline style and records one change", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy", {}, { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
    app.root.nodes.fSize.value = "48";
    app.root.nodes.fSize.bubbles.input.bubble.forEach((fn) => fn({}));
  });
  assert.equal(heading.style.getPropertyValue("font-size"), "48px");
  assert.equal(String(app.root.nodes.count.textContent), "1");
});

test("a keyword control applies the keyword, not a length", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
    app.root.nodes.fAlign.value = "center";
    app.root.nodes.fAlign.bubbles.input.bubble.forEach((fn) => fn({}));
    app.root.nodes.fColor.value = "#ff0000";
    app.root.nodes.fColor.bubbles.input.bubble.forEach((fn) => fn({}));
  });
  assert.equal(p.style.getPropertyValue("text-align"), "center");
  assert.equal(p.style.getPropertyValue("color"), "#ff0000");
});

test("the text field rewrites the element's text", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "before");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
    app.root.nodes.fText.value = "after";
    app.root.nodes.fText.bubbles.input.bubble.forEach((fn) => fn({ target: { value: "after" } }));
  });
  assert.equal(p.textContent, "after");
});

test("clearing a control puts the stylesheet's value back", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
    app.root.nodes.fAlign.value = "center";
    app.root.nodes.fAlign.bubbles.input.bubble.forEach((fn) => fn({}));
    app.root.nodes.fAlign.value = "";
    app.root.nodes.fAlign.bubbles.input.bubble.forEach((fn) => fn({}));
  });
  assert.equal(p.style.getPropertyValue("text-align"), "");
});

test("a revert restores the value that was there before the change", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "before", { "text-align": "right" });
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
    app.root.nodes.fAlign.value = "center";
    app.root.nodes.fAlign.bubbles.input.bubble.forEach((fn) => fn({}));
    app.root.nodes.fText.value = "after";
    app.root.nodes.fText.bubbles.input.bubble.forEach((fn) => fn({ target: { value: "after" } }));
    app.root.nodes.revertAll.bubbles.click.bubble.forEach((fn) => fn({}));
  });
  assert.equal(p.style.getPropertyValue("text-align"), "right"); // its own inline value
  assert.equal(p.textContent, "before");
  assert.equal(String(app.root.nodes.count.textContent), "0");
});

test("leaving edit mode reverts every change", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "before");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
    app.root.nodes.fSize.value = "48";
    app.root.nodes.fSize.bubbles.input.bubble.forEach((fn) => fn({}));
    app.fire("keydown", { key: "Escape" });
  });
  assert.equal(p.style.getPropertyValue("font-size"), "");
  assert.equal(app.root.nodes.panel.hidden, true);
  assert.equal(app.launch().hidden, false, "the orb comes back");
  assert.equal(app.root.nodes.cursor.hidden, true);
  assert.equal(app.countDoc("click"), 0, "the page is released");
});

test("the panel travels wherever it is dragged", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  const panel = app.root.nodes.panel;
  const parked = panel.style.left;
  // Grabbed 20px in from its left edge, 5px down: the panel keeps that offset.
  app.grab({ clientX: 20, clientY: 5, pointerId: 1 });
  app.dragTo(300, 200);
  assert.equal(panel.style.left, "280px");
  assert.equal(panel.style.top, "195px");
  assert.notEqual(panel.style.left, parked, "it left where it was parked");
});

test("a dragged panel is not re-parked by a scroll or a resize", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "one");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  const panel = app.root.nodes.panel;
  app.grab({ clientX: 0, clientY: 0, pointerId: 1 });
  app.dragTo(500, 400);
  const moved = panel.style.left;
  assert.notEqual(moved, "", "the drag moved it somewhere");
  app.fire("resize", {});
  assert.equal(panel.style.left, moved, "a hand-placed panel stays put");
  // A new selection re-parks it, because the new element deserves its own spot.
  const other = text("h2", "two", {}, { left: 300, top: 300, right: 500, bottom: 340, width: 200, height: 40 });
  quiet(() => {
    app.hover(other);
    app.clickPage();
  });
  assert.equal(panel.style.left, "512px", "parked beside the new selection");
});

test("clicks inside the editing panel are not swallowed by the page", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  // A click on our own panel: the page must not have stopped it, and nothing
  // must be selected.
  const { stopped, prevented } = app.clickPanel();
  assert.equal(stopped, false);
  assert.equal(prevented, false);
});