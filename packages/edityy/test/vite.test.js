// Checks for the Vite plugin (src/vite.js). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSET_PATH, launcher } from "../src/index.js";
import edityyDefault, { edityy } from "../src/vite.js";

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
