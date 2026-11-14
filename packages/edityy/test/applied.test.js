// Checks for the applied mark: a full mark_applied tells the open page to
// adopt its paint, so the change shows with no refresh. Run: npm test
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { clearCanvas, readAsks, writeChanges } from "../src/index.js";
import { handle } from "../src/mcp.js";
import { readAppliedAt } from "../src/store.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-applied-"));
const call = (root, method, params, id = 1) => handle({ jsonrpc: "2.0", id, method, params }, root);

test("a full mark writes the applied mark, and the asks queue carries it", async () => {
  const root = tmp();
  await writeChanges({ changes: [{ selector: "h1" }] }, root);
  const marked = await call(root, "tools/call", { name: "mark_applied", arguments: {} });
  assert.match(marked.result.content[0].text, /no refresh is needed/);
  const at = await readAppliedAt(root);
  assert.match(at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal((await readAsks(root)).appliedAt, at);
});

test("a partial mark writes no applied mark", async () => {
  const root = tmp();
  await writeChanges({ changes: [{ selector: "h1" }, { selector: "p" }] }, root);
  await call(root, "tools/call", { name: "mark_applied", arguments: { ids: ["c-1"] } });
  assert.equal(await readAppliedAt(root), null);
  assert.equal((await readAsks(root)).appliedAt, null);
});

test("a clear removes a stale applied mark", async () => {
  const root = tmp();
  await writeChanges({ changes: [{ selector: "h1" }] }, root);
  await call(root, "tools/call", { name: "mark_applied", arguments: {} });
  assert.ok(await readAppliedAt(root));
  await clearCanvas(root);
  assert.equal(await readAppliedAt(root), null);
});
