// Checks for the Vite plugin (src/vite.js). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ASSET_PATH, CHANGES_FILE, CHANGES_PATH, launcher } from "../src/index.js";
import edityyDefault, { edityy, stampSource } from "../src/vite.js";

/** The slice of Vite's dev server the plugin touches. */
function fakeServer() {
  const used = [];
  return { used, middlewares: { use: (fn) => used.push(fn) } };
}

test("is a dev-server-only Vite plugin", () => {
  const plugin = edityy();
  assert.equal(plugin.name, "edityy");
  assert.equal(plugin.apply, "serve", "never part of vite build");
  assert.equal(edityyDefault, edityy);
});

test("mounts the middleware, which serves the launcher", () => {
  const server = fakeServer();
  edityy().configureServer(server);
  assert.equal(server.used.length, 1);
  const res = {
    writeHead(status) {
      res.status = status;
    },
    end(body) {
      res.body = body;
    },
  };
  server.used[0]({ url: ASSET_PATH }, res, () => assert.fail("the asset is served, not passed on"));
  assert.equal(res.status, 200);
  assert.equal(res.body, launcher);
});

test("saves under Vite's root, where the source locations start", async () => {
  const root = mkdtempSync(join(tmpdir(), "edityy-vite-"));
  const plugin = edityy();
  plugin.configResolved({ root });
  const server = fakeServer();
  plugin.configureServer(server);
  const req = new EventEmitter();
  Object.assign(req, { url: CHANGES_PATH, method: "POST", headers: { host: "localhost", "content-type": "application/json" } });
  const answered = new Promise((resolve) => server.used[0](req, { writeHead() {}, end: resolve }, () => {}));
  req.emit("data", Buffer.from(JSON.stringify({ changes: [] })));
  req.emit("end");
  await answered;
  assert.ok(existsSync(join(root, CHANGES_FILE)));
});

test("passes its options to the middleware", () => {
  const server = fakeServer();
  edityy({ nonce: "abc" }).configureServer(server);
  const headers = new Map([["content-type", "text/html"]]);
  const res = {
    getHeader: (k) => headers.get(k),
    setHeader: (k, v) => headers.set(k, v),
    writeHead() {},
    end(body) {
      res.body = String(body);
    },
  };
  server.used[0]({ url: "/" }, res, () => {});
  res.end("<html><head></head></html>");
  assert.match(res.body, /nonce="abc"/);
});

/**
 * A tiny JSX "parser" for tests: finds `<name` openings in the source and
 * returns them as the ESTree nodes Vite's parser would. Enough to drive
 * stampSource() without a real parser, which CI does not install.
 */
function fakeParse(code) {
  const body = [];
  for (const m of code.matchAll(/<([A-Za-z][\w.]*)((?:\s+[\w-]+(?:="[^"]*")?)*)/g)) {
    const start = m.index;
    const nameStart = start + 1;
    const name = m[1].includes(".")
      ? { type: "JSXMemberExpression", start: nameStart, end: nameStart + m[1].length }
      : { type: "JSXIdentifier", name: m[1], start: nameStart, end: nameStart + m[1].length };
    const attributes = [...m[2].matchAll(/([\w-]+)=/g)].map((a) => ({ type: "JSXAttribute", name: { name: a[1] } }));
    body.push({ type: "JSXElement", openingElement: { type: "JSXOpeningElement", start, name, attributes } });
  }
  return { type: "Program", body };
}

test("stamps intrinsic elements with path:line:col, and nothing else", () => {
  const code = 'const A = () => (\n  <main>\n    <h1 className="t">Hi</h1>\n    <Card />\n    <motion.div />\n  </main>\n);';
  const out = stampSource(code, fakeParse(code), "src/A.jsx");
  assert.match(out, /<main data-edityy-src="src\/A\.jsx:2:3">/);
  assert.match(out, /<h1 data-edityy-src="src\/A\.jsx:3:5" className="t">/);
  assert.match(out, /<Card \/>/, "a component may drop the prop, so it gets none");
  assert.match(out, /<motion\.div \/>/);
});

test("keeps a location that is already there", () => {
  const code = '<div data-edityy-src="mine:1:1"><p>x</p></div>';
  const out = stampSource(code, fakeParse(code), "a.jsx");
  assert.equal(out.match(/data-edityy-src/g).length, 2);
  assert.match(out, /<div data-edityy-src="mine:1:1">/);
});

test("columns count UTF-16 units, as the parser's offsets do", () => {
  const code = 'const s = "😀"; const a = <b>x</b>;';
  const out = stampSource(code, fakeParse(code), "a.jsx");
  assert.match(out, /<b data-edityy-src="a\.jsx:1:27">/);
});

test("the transform stamps a JSX file through the plugin context's parser", () => {
  const plugin = edityy();
  plugin.configResolved({ root: "/app" });
  assert.equal(plugin.enforce, "pre", "before the JSX is compiled away");
  const code = "export const A = () => <div>x</div>;";
  const out = plugin.transform.call({ parse: fakeParse }, code, "/app/src/A.tsx?v=1");
  assert.match(out.code, /<div data-edityy-src="src\/A\.tsx:1:24">/);
});

test("the transform leaves alone what it should not touch", () => {
  const code = "export const A = () => <div>x</div>;";
  const ctx = { parse: fakeParse };
  assert.equal(edityy().transform.call(ctx, code, "/app/a.js"), null, "not a JSX file");
  assert.equal(edityy().transform.call(ctx, code, "/app/node_modules/x/a.jsx"), null, "a dependency");
  assert.equal(edityy({ source: false }).transform.call(ctx, code, "/app/a.jsx"), null, "turned off");
  assert.equal(edityy().transform.call({}, code, "/app/a.jsx"), null, "no parser to use");
  const throwing = { parse: () => { throw new Error("cannot parse tsx"); } };
  assert.equal(edityy().transform.call(throwing, code, "/app/a.tsx"), null, "fails open");
});
