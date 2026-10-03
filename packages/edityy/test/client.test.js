// Checks the Next.js client bootstrap: importing edityy/client mounts the
// launcher, with no route handler and no <script> tag in the layout.
//
// The payload is a browser IIFE that reads document and window as globals, so
// this test installs the smallest ones that can hold it. They are shared across
// the tests because ES modules are cached: the payload only ever evaluates once
// per process, which is exactly the once-only guarantee the launcher makes.
import assert from "node:assert/strict";
import { test } from "node:test";

const appended = [];

/** A document/window pair just big enough for the launcher to mount into. */
const dom = {
  document: {
    createElement: () => ({
      style: { cssText: "" },
      setAttribute() {},
      attachShadow() {
        return { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
      },
      appendChild(node) {
        appended.push(node);
        return node;
      },
    }),
    body: { appendChild: (node) => appended.push(node) },
    documentElement: { appendChild: (node) => appended.push(node) },
  },
  window: {},
  CustomEvent: class {},
};

for (const [key, value] of Object.entries(dom)) globalThis[key] = value;

// Import for its side effect, exactly as `instrumentationClientInject` does.
await import("../src/client.js");

test("mounts the launcher host into the document", () => {
  assert.equal(appended.length, 1, "one host element");
  assert.equal(dom.window.__edityy, true, "payload marked the page as mounted");
});

test("the host is fixed to the viewport and ignores pointer events", () => {
  const css = appended[0].style.cssText;
  assert.match(css, /position:fixed/, "fixed, so it survives scrolling");
  assert.match(css, /pointer-events:none/, "never comes between the user and the site");
});