// Regression check for the launcher payload this package ships
// (src/edityy.js). Run: npm test
//
// The script is plain browser JS with no imports, so it can be run against a
// hand-rolled DOM stub instead of pulling in a browser or a DOM library.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");

/** Just enough DOM for the launcher: elements, one shadow root, one event. */
function fakeDom() {
  const listeners = {};
  const button = {
    style: {},
    textContent: "",
    title: "",
    type: "",
    addEventListener: (type, fn) => ((listeners[type] ??= []).push(fn)),
  };
  const root = {
    innerHTML: "",
    querySelector: () => button,
  };
  let shadowRootAttached = false;
  const host = {
    attributes: {},
    style: { cssText: "" },
    setAttribute: (k, v) => (host.attributes[k] = v),
    attachShadow: () => {
      shadowRootAttached = true;
      return root;
    },
  };
  const body = { children: [], appendChild: (el) => body.children.push(el) };
  const dispatched = [];
  const win = {
    dispatched,
    dispatchEvent: (event) => dispatched.push(event.type),
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
    console: { log: () => {} },
  };
  const document = { body, createElement: () => host };
  return { win, document, button, root, host, dispatched, attached: () => shadowRootAttached };
}

function run() {
  const dom = fakeDom();
  new Function("window", "document", "CustomEvent", source)(dom.win, dom.document, dom.win.CustomEvent);
  return dom;
}

/** Keeps the launcher's own console.log out of the test output. */
function quiet() {
  const log = console.log;
  console.log = () => {};
  return () => (console.log = log);
}

test("mounts a launcher that ignores pointer events outside the button", () => {
  const { host, root, attached } = run();
  assert.equal(host.attributes["data-edityy"], "");
  assert.match(host.style.cssText, /position:fixed/);
  assert.match(host.style.cssText, /z-index:2147483647/);
  assert.match(host.style.cssText, /pointer-events:none/);
  assert.equal(attached(), true, "styles must be isolated in a shadow root");
  assert.match(root.innerHTML, /right:24px;bottom:24px/);
  assert.match(root.innerHTML, /border-radius:50%/);
  assert.match(root.innerHTML, /pointer-events:auto/); // only the button takes clicks
});

test("the button is a real button with an accessible name", () => {
  const { root } = run();
  assert.match(root.innerHTML, /<button type="button"/);
  assert.match(root.innerHTML, /aria-label="Open Edityy"/);
  assert.match(root.innerHTML, />Edityy<\/button>/);
});

test("clicking dispatches the seam event", () => {
  const dom = fakeDom();
  const clicks = [];
  dom.button.addEventListener = (type, fn) => type === "click" && clicks.push(fn);
  new Function("window", "document", "CustomEvent", source)(dom.win, dom.document, dom.win.CustomEvent);
  const restore = quiet();
  clicks[0]();
  restore();
  assert.deepEqual(dom.dispatched, ["edityy:launcher-click"]);
});

test("loading twice mounts only one launcher", () => {
  const dom = fakeDom();
  const load = new Function("window", "document", "CustomEvent", source);
  load(dom.win, dom.document, dom.win.CustomEvent);
  const restore = quiet();
  load(dom.win, dom.document, dom.win.CustomEvent);
  restore();
  assert.equal(dom.document.body.children.length, 1);
});