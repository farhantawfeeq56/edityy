// Checks for chat-initiated canvas previews (src/previews.js). Run: npm test
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  checkPreview,
  checkPreviewHtml,
  clearPreviews,
  decidePreview,
  placePreview,
  previewText,
  readActivePreview,
  readPreview,
  readPreviews,
} from "../src/previews.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-previews-"));
const insert = {
  instruction: "add a pricing section",
  action: "insert",
  position: "inside-end",
  html: '<section class="pricing"><h2>Plans</h2></section>',
};

test("a preview is placed, read back, and decided", async () => {
  const root = tmp();
  assert.equal(await readActivePreview(root), null);
  const preview = await placePreview(insert, root);
  assert.match(preview.id, /^e-/);
  assert.equal(preview.status, "active");
  assert.equal((await readActivePreview(root)).id, preview.id);
  assert.equal((await readPreviews(root)).active, preview.id);
  assert.equal((await readPreview(preview.id, root)).instruction, "add a pricing section");
  assert.equal((await readPreviews(root)).history.length, 1);

  const kept = await decidePreview(preview.id, "keep", root);
  assert.equal(kept.status, "kept");
  assert.equal((await readActivePreview(root)).id, preview.id, "a kept preview stays readable for get_preview");

  await decidePreview(preview.id, "discard", root);
  assert.equal(await readActivePreview(root), null, "a discarded preview leaves the canvas path");
  assert.equal((await readPreviews(root)).history[0].status, "discarded");

  await clearPreviews(root);
  assert.equal(await readActivePreview(root), null);
  assert.deepEqual(await readPreviews(root), { active: null, history: [] });
});

test("a new preview replaces the active one and history stays capped", async () => {
  const root = tmp();
  const first = await placePreview(insert, root);
  const second = await placePreview({ ...insert, instruction: "make it darker" }, root);
  assert.equal((await readActivePreview(root)).id, second.id);
  const history = (await readPreviews(root)).history;
  assert.equal(history[0].id, second.id, "newest first");
  assert.ok(history.some((item) => item.id === first.id), "the old one stays in history");
});

test("each action checks what it needs, and nothing else passes", () => {
  const styles = {
    instruction: "thinner",
    action: "styles",
    selector: "main > div",
    variations: [
      { label: "thin", props: [{ property: "scrollbar-width", value: "thin" }] },
      { label: "words", props: [], text: "new words" },
    ],
  };
  const checked = checkPreview(styles);
  assert.equal(checked.variations[1].text, "new words");

  const bad = [
    null,
    {},
    { ...insert, instruction: "" },
    { ...insert, action: "dance" },
    { ...insert, position: "middle" },
    { ...insert, html: '<script>alert(1)</script>' },
    { ...insert, html: '<div onclick="go()">x</div>' },
    { ...insert, html: '<iframe src="x"></iframe>' },
    { ...insert, html: '<a href="javascript:go()">x</a>' },
    { ...insert, html: '<form><input></form>' },
    { ...insert, html: '<div style="color: red">x</div>' },
    { ...insert, html: "just words" },
    { ...insert, html: "<!-- hi --><div>x</div>" },
    { ...styles, selector: "" },
    { ...styles, variations: [] },
    { ...styles, variations: [{ label: "", props: [] }] },
    { ...styles, variations: [{ label: "x", props: [], text: "   " }] },
    { instruction: "u", action: "update", selector: "p" },
    { instruction: "u", action: "update", selector: "p", props: [{ property: "--x", value: "1" }] },
    { instruction: "u", action: "remove" },
  ];
  for (const value of bad) assert.throws(() => checkPreview(value), { status: 400 }, JSON.stringify(value)?.slice(0, 80));
  for (const value of ["<div>x</div>", "<DIV CLASS=\"a\">x</DIV>", "<img src=\"/a.png\" alt=\"a\">", "<a href=\"/plans\">go</a>"]) {
    assert.equal(checkPreviewHtml(value), value);
  }
});

test("the agent reads a short preview, not the page", async () => {
  const root = tmp();
  const preview = await placePreview(insert, root);
  const text = previewText(await readPreview(preview.id, root));
  assert.match(text, new RegExp(preview.id));
  assert.match(text, /add a pricing section/);
  assert.match(text, /Anchor: end of main/);
  assert.match(text, /Plans/);
  await assert.rejects(decidePreview("e-nope", "keep", root), /Unknown preview id/);
  await assert.rejects(decidePreview(preview.id, "maybe", root), /keep or discard/);
});
