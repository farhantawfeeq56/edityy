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

  /** Find the + button that reveals an optional control, by its display name. */
  const plusFor = (name) => {
    for (const sec of root.nodes.pane?.children ?? []) {
      for (const line of sec.children.slice(1)) {
        if (line.className !== "addLine") continue;
        if (line.children[0]?.title === "Add " + name) return line.children[0];
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
        if (input.kind === "seg") {
          for (const fn of input.reset.bubbles.click.bubble) fn({});
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
  assert.equal(app.root.inputs["@text"].value, "Edityy");
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
    assert.equal(app.control("font-family").value, "Plus Jakarta Sans");
    app.hover(plain);
    app.clickPage();
    assert.equal(app.control("font-family").value, "Georgia");
  });
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
  assert.match(app.root.nodes.target.textContent, /h1/);
});

test("editing a control applies one inline style and records one change", () => {
  const { run, text } = fakeDom();
  const app = run();
  const heading = text("h1", "Edityy", {}, { left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30 });
  quiet(() => {
    app.click();
    app.hover(heading);
    app.clickPage();
    app.type("font-size", "48");
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
    app.segment("text-align", "center");
    app.add("color", "Colour");
    app.type("color", "#ff0000");
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
    app.root.inputs["@text"].value = "after";
    app.root.inputs["@text"].bubbles.input.bubble.forEach((fn) => fn({ target: { value: "after" } }));
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
    app.segment("text-align", "center");
    app.clear("text-align");
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
    app.segment("text-align", "center");
    app.root.inputs["@text"].value = "after";
    app.root.inputs["@text"].bubbles.input.bubble.forEach((fn) => fn({ target: { value: "after" } }));
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
    app.type("font-size", "48");
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

test("every property of a text element is offered", () => {
  const { run, text } = fakeDom();
  const app = run();
  const p = text("p", "body");
  quiet(() => {
    app.click();
    app.hover(p);
    app.clickPage();
  });
  for (const prop of [
    "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
    "text-align", "text-transform", "text-decoration", "@text",
  ]) {
    assert.ok(app.control(prop), `${prop} has a control`);
  }
  // Appearance is additive, so those controls do not exist until the + is used.
  for (const prop of ["color", "background", "border", "box-shadow"]) {
    assert.equal(app.control(prop), undefined, `${prop} waits behind +`);
  }
  // A paragraph is not a flex container, so it is never offered one.
  assert.equal(app.control("flex-direction"), undefined);
  assert.equal(app.control("grid-template-columns"), undefined);
});

test("flex controls appear only on something that is actually flex", () => {
  // A fresh DOM per case: the payload guards on window.__edityy, so a second run
  // against the same window would mount nothing.
  const plain = fakeDom();
  const app = plain.run();
  const block = plain.el("div");
  quiet(() => {
    app.click();
    app.hover(block);
    app.clickPage();
  });
  // "must come only when needed": not offered, not hidden — absent.
  assert.equal(app.control("flex-direction"), undefined, "a block div has no flex controls");
  assert.equal(app.control("justify-content"), undefined);

  const flexed = fakeDom();
  const app2 = flexed.run();
  const flexBox = flexed.el("div", {}, { display: "flex" });
  quiet(() => {
    app2.click();
    app2.hover(flexBox);
    app2.clickPage();
  });
  assert.ok(app2.control("flex-direction"), "a flex div does");
  assert.ok(app2.control("justify-content"));
  assert.ok(app2.control("align-items"));
  assert.equal(app2.control("grid-template-columns"), undefined, "but not grid");
});

test("grid controls appear only on something that is actually grid", () => {
  const { run, el } = fakeDom();
  const app = run();
  const grid = el("div", {}, { display: "grid" });
  quiet(() => {
    app.click();
    app.hover(grid);
    app.clickPage();
  });
  for (const prop of ["grid-template-columns", "grid-template-rows", "grid-auto-flow", "grid-column", "grid-row"]) {
    assert.ok(app.control(prop), prop);
  }
  assert.equal(app.control("flex-direction"), undefined);
});

test("min/max are behind a toggle and come only when it is pressed", () => {
  const { run, el } = fakeDom();
  const app = run();
  const div = el("div");
  quiet(() => {
    app.click();
    app.hover(div);
    app.clickPage();
  });
  assert.equal(app.control("min-width"), undefined, "quiet until asked for");
  assert.equal(app.control("max-width"), undefined);
  assert.equal(app.control("min-height"), undefined);
  assert.equal(app.control("max-height"), undefined);

  // Press the one switch in the Size header.
  const size = app.root.nodes.pane.children[0];
  const toggle = size.children[0].children.find((n) => n.className === "tog");
  assert.ok(toggle, "a Min / max switch exists");
  quiet(() => toggle.bubbles.click.bubble.forEach((fn) => fn({})));
  for (const prop of ["min-width", "max-width", "min-height", "max-height"]) {
    assert.ok(app.control(prop), `${prop} appears once the switch is on`);
  }
});

test("optional appearance stays behind + until it is added", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("div"));
    app.clickPage();
  });
  const before = Object.keys(app.root.inputs);
  for (const prop of ["background", "border", "box-shadow", "opacity", "border-top-left-radius"]) {
    assert.equal(before.includes(prop), false, `${prop} is not in the tree yet`);
  }
  // Press the + on the Fill row.
  app.add("background", "Fill");
  assert.ok(app.control("background"), "adding it brings only its own control");
  assert.equal(app.control("border"), undefined, "the others stay quiet");
});

test("media is offered object fit, and never padding or gap", () => {
  const { run, el } = fakeDom();
  const app = run();
  quiet(() => {
    app.click();
    app.hover(el("img"));
    app.clickPage();
  });
  assert.ok(app.control("object-fit"));
  assert.ok(app.control("object-position"));
  assert.ok(app.control("width"));
  assert.equal(app.control("padding-left"), undefined, "an image has no padding");
  assert.equal(app.control("row-gap"), undefined);
  assert.equal(app.control("font-size"), undefined);
  assert.equal(app.control("@text"), undefined);
});

test("any schema property applies and records like a typography one", () => {
  const { run, el } = fakeDom();
  const app = run();
  const card = el("div");
  quiet(() => {
    app.click();
    app.hover(card);
    app.clickPage();
    app.type("padding-left", "24");
    app.add("border-radius", "Radius");
    app.type("border-top-left-radius", "12");
  });
  assert.equal(card.style.getPropertyValue("padding-left"), "24");
  assert.equal(card.style.getPropertyValue("border-top-left-radius"), "12");
  assert.equal(String(app.root.nodes.count.textContent), "1", "one element, one entry");
});

test("a shorthand side is recorded under its own longhand", () => {
  const { run, el } = fakeDom();
  const app = run();
  const box = el("div");
  quiet(() => {
    app.click();
    app.hover(box);
    app.clickPage();
    app.type("padding-top", "8");
    app.type("padding-bottom", "8");
  });
  // Two longhands, two entries: nothing is written as the `padding` shorthand,
  // so reverting one side cannot disturb the other.
  assert.equal(box.style.getPropertyValue("padding-top"), "8");
  assert.equal(box.style.getPropertyValue("padding-bottom"), "8");
  assert.equal(box.style.getPropertyValue("padding"), "");
});

test("an element with no text can still be selected for styling", () => {
  const { run, el } = fakeDom();
  const app = run();
  const wrapper = el("div");
  quiet(() => {
    app.click();
    app.hover(wrapper);
    app.clickPage();
  });
  // Styling a container is the whole point of an element inspector, so an element
  // without its own text is still a legal target.
  assert.equal(app.root.nodes.panel.hidden, false);
  assert.match(app.root.nodes.target.textContent, /div/);
});

test("the text field is disabled when the element holds markup", () => {
  const { run, el } = fakeDom();
  const app = run();
  const wrapper = el("p");
  wrapper.childNodes = [{ nodeType: 1, nodeValue: "" }];
  quiet(() => {
    app.click();
    app.hover(wrapper);
    app.clickPage();
  });
  assert.equal(app.root.inputs["@text"], undefined, "a container has no content field at all");
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