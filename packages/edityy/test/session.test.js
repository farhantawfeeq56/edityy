// A keep from before the last clear must not recreate the canvas.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { clearCanvas } from "../src/index.js";
import { clearSessionFor, readSession, writeSession } from "../src/session.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-session-"));
const edit = { selector: "main", comment: "try this" };

test("a keep that left before the clear is refused and writes nothing", async () => {
  const root = tmp();
  await writeSession({ path: "/", edits: [edit], regions: [] }, root);
  assert.equal((await readSession("/", root)).honored, "");
  const { clearedAt } = await clearCanvas(root);
  assert.ok(clearedAt, "the clear left a marker");
  await assert.rejects(writeSession({ path: "/", edits: [edit], regions: [] }, root), (error) => error.status === 409);
  assert.equal(await readSession("/", root), null, "the stale keep wrote nothing");
});

test("a keep that honored the clear is accepted", async () => {
  const root = tmp();
  const { clearedAt } = await clearCanvas(root);
  await writeSession({ path: "/", honored: clearedAt, edits: [edit], regions: [] }, root);
  const back = await readSession("/", root);
  assert.equal(back.edits.length, 1);
  assert.equal(back.honored, clearedAt);
});

test("clearSessionFor keeps another page's canvas", async () => {
  const root = tmp();
  await writeSession({ path: "/other", edits: [edit], regions: [] }, root);
  assert.equal(await clearSessionFor("/", root), false);
  assert.equal((await readSession("/other", root)).edits.length, 1, "the other page keeps its canvas");
  assert.equal(await clearSessionFor("/other", root), true);
  assert.equal(await readSession("/other", root), null);
  assert.equal(await clearSessionFor("/missing", root), false, "nothing to clear");
});
