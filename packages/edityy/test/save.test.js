// Checks for the save endpoint: POST /__edityy/changes writes .edityy/changes.json.
// Run: npm test
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CHANGES_FILE, CHANGES_PATH, changesRoute, edityy, writeChanges } from "../src/index.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-save-"));
const payload = { page: "http://localhost:5173/", markdown: "# Visual edits", changes: [{ selector: "h1", props: [] }] };

/** A Node request carrying a body, as a dev server hands it over. */
function request(body, headers = {}, method = "POST") {
  const req = new EventEmitter();
  req.url = CHANGES_PATH;
  req.method = method;
  req.headers = { host: "localhost:5173", "content-type": "application/json", ...headers };
  setImmediate(() => {
    if (body !== undefined) req.emit("data", Buffer.from(body));
    req.emit("end");
  });
  return req;
}

/** Send one request through the middleware and wait for its answer. */
function send(root, req) {
  return new Promise((resolve) => {
    const res = {
      writeHead(status) {
        res.status = status;
      },
      end(body) {
        resolve({ status: res.status, body: JSON.parse(body) });
      },
    };
    edityy({ root })(req, res, () => resolve({ passed: true }));
  });
}

test("writes the edits into the project, with a .gitignore that keeps them out of git", async () => {
  const root = tmp();
  const out = await send(root, request(JSON.stringify(payload), { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" }));
  assert.deepEqual(out, { status: 200, body: { ok: true, path: CHANGES_FILE } });
  const saved = JSON.parse(readFileSync(join(root, CHANGES_FILE), "utf8"));
  assert.equal(saved.version, 1);
  assert.equal(saved.page, payload.page);
  assert.equal(saved.markdown, payload.markdown);
  assert.deepEqual(saved.changes, payload.changes);
  assert.match(saved.savedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(readFileSync(join(root, ".edityy/.gitignore"), "utf8"), "*\n");
});

test("refuses another site, a form post, a GET and a body that is not edits", async () => {
  const root = tmp();
  const body = JSON.stringify(payload);
  assert.equal((await send(root, request(body, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await send(root, request(body, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await send(root, request(body, { origin: "null" }))).status, 403);
  assert.equal((await send(root, request(body, { "content-type": "application/x-www-form-urlencoded" }))).status, 415);
  assert.equal((await send(root, request(undefined, {}, "GET"))).status, 405);
  assert.equal((await send(root, request("{not json"))).status, 400);
  assert.equal((await send(root, request(JSON.stringify({ changes: "x" })))).status, 400);
  assert.equal(existsSync(join(root, CHANGES_FILE)), false, "nothing was written");
});

test("refuses a body past the size limit", async () => {
  const root = tmp();
  const big = JSON.stringify({ changes: [{ x: "y".repeat(1024 * 1024 + 10) }] });
  assert.equal((await send(root, request(big))).status, 413);
});

test("save: false leaves the path to the app", async () => {
  const req = request(JSON.stringify(payload));
  const out = await new Promise((resolve) => edityy({ save: false })(req, {}, () => resolve("next")));
  assert.equal(out, "next");
});

test("the route handler does the same for Next.js", async () => {
  const root = tmp();
  const POST = changesRoute({ root });
  const ok = await POST(
    new Request("http://localhost:3000/__edityy/changes", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
      body: JSON.stringify(payload),
    })
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, path: CHANGES_FILE });
  assert.ok(existsSync(join(root, CHANGES_FILE)));

  const evil = await POST(
    new Request("http://localhost:3000/__edityy/changes", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", host: "localhost:3000" },
      body: JSON.stringify(payload),
    })
  );
  assert.equal(evil.status, 403);
});

test("writeChanges keeps only what it expects", async () => {
  const root = tmp();
  await writeChanges({ changes: [], page: 42, markdown: null, extra: "x" }, root);
  const saved = JSON.parse(readFileSync(join(root, CHANGES_FILE), "utf8"));
  assert.equal(saved.page, null);
  assert.equal(saved.markdown, "");
  assert.equal(saved.extra, undefined);
});
