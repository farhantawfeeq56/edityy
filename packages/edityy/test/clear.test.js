// Checks for clear_all: one call empties every Edityy file and marks the clear.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { clearCanvas, readAsks } from "../src/index.js";
import { placePreview, writePreviewRequest } from "../src/previews.js";
import { readClearedAt, store } from "../src/store.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-clear-"));

test("a clear removes every file and marks when it happened", async () => {
  const root = tmp();
  await writePreviewRequest({ id: "p-1", instruction: "make it bigger" }, root);
  await placePreview({ instruction: "make it bigger", action: "remove", selector: "main aside" }, root);
  await store(root, ".edityy/session.json", { version: 1, savedAt: new Date().toISOString(), path: "/", edits: [], regions: [], markTop: 0 });
  assert.equal(await readClearedAt(root), null, "nothing cleared yet");
  const cleared = await clearCanvas(root);
  assert.equal(cleared.removed.previewRequests, 1);
  assert.equal(cleared.removed.previews, 1);
  assert.match(cleared.clearedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(await readClearedAt(root), cleared.clearedAt);
  const asks = await readAsks(root);
  assert.equal(asks.ok, true);
  assert.deepEqual(asks.previewRequests, []);
  assert.deepEqual(asks.previews, []);
  assert.equal(asks.clearedAt, cleared.clearedAt, "the page poll carries the mark");
});

test("a second clear on an empty canvas still marks, with zero rows", async () => {
  const root = tmp();
  const cleared = await clearCanvas(root);
  assert.deepEqual(Object.values(cleared.removed), [0, 0, 0, 0, 0, 0]);
  assert.match(cleared.clearedAt, /^\d{4}-\d{2}-\d{2}T/);
});
