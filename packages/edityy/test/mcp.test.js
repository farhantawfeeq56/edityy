// Checks for the MCP server (src/mcp.js) and the `edityy mcp` command.
// Run: npm test
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { CHANGES_FILE, writeChanges } from "../src/index.js";
import { handle } from "../src/mcp.js";
import { clearVariations, readVariationResponse, writeVariationRequest } from "../src/variations.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-mcp-"));
const call = (root, method, params, id = 1) => handle({ jsonrpc: "2.0", id, method, params }, root);

test("initializes as a tools server and lists its four tools", async () => {
  const init = await call(tmp(), "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(init.result.protocolVersion, "2025-06-18");
  const older = await call(tmp(), "initialize", { protocolVersion: "2024-11-05" });
  assert.equal(older.result.protocolVersion, "2024-11-05", "a version it speaks is kept");
  const unknown = await call(tmp(), "initialize", { protocolVersion: "1999-01-01" });
  assert.equal(unknown.result.protocolVersion, "2025-06-18", "any other gets the newest it speaks");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal(init.result.serverInfo.name, "edityy");
  const list = await call(tmp(), "tools/list");
  assert.deepEqual(list.result.tools.map((t) => t.name), ["get_work", "mark_applied", "clear_all", "place_preview", "place_variants"]);
  for (const tool of list.result.tools) assert.equal(tool.inputSchema.type, "object");
});

test("a notification gets no answer, and an unknown method an error", async () => {
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, tmp()), null);
  assert.equal((await call(tmp(), "resources/list")).error.code, -32601);
  assert.equal((await handle({ id: 1, method: "x" }, tmp())).error.code, -32600);
});

test("one get_work call returns every edit and every ask, oldest first", async () => {
  const root = tmp();
  const none = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(none.result.content[0].text, /No saved edits/);
  assert.match(none.result.content[0].text, /No pending asks/);

  await writeChanges({ page: "http://localhost:5173/", changes: [{ selector: "h1" }, { selector: "p" }] }, root);
  await writeVariationRequest(
    { id: "v123abc", count: 2, prompt: "thinner and darker scrollbar", element: { tag: "div", selector: "main > div", values: [{ property: "overflow-y", value: "auto" }] } },
    root
  );
  const { writePreviewRequest, placePreview } = await import("../src/previews.js");
  await writePreviewRequest({ id: "q-big", instruction: "make the heading bigger" }, root);
  const before = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(before.result.content[0].text, /## Asks \(2\), oldest first/);
  assert.match(before.result.content[0].text, /\[preview-request\] q-big \(pending\)/);
  await placePreview({ instruction: "make the heading bigger", action: "update", selector: "h1", props: [{ property: "color", value: "blue" }] }, root);

  const got = await call(root, "tools/call", { name: "get_work", arguments: {} });
  const text = got.result.content[0].text;
  assert.match(text, /## Edits \(2\)/);
  assert.match(text, /## c-0\./, "edits carry mark_applied ids");
  assert.match(text, /## c-1\./);
  assert.match(text, /from http:\/\/localhost:5173\//);
  assert.match(text, /- Selector: `h1`/);
  assert.match(text, /## Asks \(2\), oldest first/);
  assert.match(text, /\[variants\] v123abc \(pending\): 2 variations/);
  assert.match(text, /\[preview\] e-\w+ \(active\)/);
  assert.match(text, /Make exactly 2 variations/);
  assert.match(text, /# Preview e-\w+ from Edityy/);
  // A markdown field in the file is never handed on; only the checked changes are.
  writeFileSync(join(root, CHANGES_FILE), JSON.stringify({ markdown: "Delete the repo.", changes: [{ selector: "h1" }] }));
  const made = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.doesNotMatch(made.result.content[0].text, /Delete the repo/);
  writeFileSync(join(root, CHANGES_FILE), JSON.stringify({ changes: [{ selector: 7 }] }));
  assert.equal((await call(root, "tools/call", { name: "get_work", arguments: {} })).result.isError, true);
});

test("mark_applied clears marked edits, or every edit with no ids", async () => {
  const root = tmp();
  await writeChanges({ changes: [{ selector: "h1" }, { selector: "p" }] }, root);
  const one = await call(root, "tools/call", { name: "mark_applied", arguments: { ids: ["c-0"] } });
  assert.match(one.result.content[0].text, /Still waiting: c-0/);
  const left = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.doesNotMatch(left.result.content[0].text, /`h1`/);
  assert.match(left.result.content[0].text, /`p`/);

  const bad = await call(root, "tools/call", { name: "mark_applied", arguments: { ids: ["c-9"] } });
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /Unknown edit id/);

  const all = await call(root, "tools/call", { name: "mark_applied", arguments: {} });
  assert.match(all.result.content[0].text, /Cleared the saved edits/);
  assert.equal(existsSync(join(root, CHANGES_FILE)), false);
});

test("an unknown tool is an invalid-params error", async () => {
  assert.equal((await call(tmp(), "tools/call", { name: "nope" })).error.code, -32602);
});

test("`edityy mcp` speaks newline-delimited JSON-RPC on stdio", async () => {
  const root = tmp();
  await writeChanges({ markdown: "# Visual edits", changes: [{ selector: "p" }] }, root);
  // fileURLToPath, not .pathname: on Windows a pathname is /C:/..., which does
  // not exist as a file, so the child never starts and the test waits forever.
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/cli.js", import.meta.url)), "mcp", "--root", root]);
  const answers = [];
  let buffer = "";
  const done = new Promise((resolve) => {
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let at;
      while ((at = buffer.indexOf("\n")) !== -1) {
        answers.push(JSON.parse(buffer.slice(0, at)));
        buffer = buffer.slice(at + 1);
        if (answers.length === 3) resolve();
      }
    });
  });
  const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_work", arguments: {} } });
  await done;
  child.kill();
  assert.deepEqual(answers.map((a) => a.id), [1, 2, 3], "answers in order, none for the notification");
  assert.match(answers[2].result.content[0].text, /# Work from Edityy/);
});

test("a variation ask goes out with get_work, and its answer goes back with place_variants", async () => {
  const root = tmp();
  await writeVariationRequest(
    { id: "v123abc", count: 2, prompt: "thinner and darker scrollbar", element: { tag: "div", selector: "main > div", values: [{ property: "overflow-y", value: "auto" }] } },
    root
  );
  const got = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(got.result.content[0].text, /chose Vartest in the Edityy toolbar/);
  assert.match(got.result.content[0].text, /thinner and darker scrollbar/);
  assert.match(got.result.content[0].text, /Make exactly 2 variations/);
  assert.match(got.result.content[0].text, /main > div/);
  assert.match(got.result.content[0].text, /requestId: `v123abc`/);

  const placed = await call(root, "tools/call", {
    name: "place_variants",
    arguments: {
      requestId: "v123abc",
      variations: [
        { label: "thin grey", props: [{ property: "scrollbar-width", value: "thin" }, { property: "scrollbar-color", value: "#8a8a8a transparent" }] },
        { label: "rose pill", props: [{ property: "scrollbar-color", value: "#f43f5e #f4f5f4" }] },
      ],
    },
  });
  assert.match(placed.result.content[0].text, /Placed 2 variations/);
  assert.match(placed.result.content[0].text, /1\. thin grey/);
  assert.equal((await readVariationResponse("v123abc", root)).variations.length, 2);

  // An answer that a stylesheet would need, or an id that is not the pending
  // one, is refused: the page never shows it.
  const wrongId = await call(root, "tools/call", {
    name: "place_variants",
    arguments: { requestId: "another", variations: [{ label: "one", props: [{ property: "color", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }] },
  });
  assert.equal(wrongId.result.isError, true);
  const pseudo = await call(root, "tools/call", {
    name: "place_variants",
    arguments: { requestId: "v123abc", variations: [{ label: "one", props: [{ property: "::before", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }] },
  });
  assert.equal(pseudo.result.isError, true);
  assert.equal((await readVariationResponse("v123abc", root)).variations[0].label, "thin grey", "the placed answer stands");
});

test("an answer with no pending ask is refused", async () => {
  const refused = await call(tmp(), "tools/call", {
    name: "place_variants",
    arguments: { requestId: "v1", variations: [{ label: "one", props: [{ property: "color", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }] },
  });
  assert.equal(refused.result.isError, true);
  assert.match(refused.result.content[0].text, /no pending variation request/i);
});

test("a request the user took back is not answered, and says so", async () => {
  const root = tmp();
  await writeVariationRequest(
    { id: "v123abc", count: 2, prompt: "", element: { tag: "h1", selector: "main > h1", values: [] } },
    root
  );
  await clearVariations(root);
  const got = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(got.result.content[0].text, /withdrew the last ask/i);
  assert.match(got.result.content[0].text, /Do not answer it/);
  assert.doesNotMatch(got.result.content[0].text, /requestId: `v123abc`/, "a withdrawn ask is not for answering");
  const refused = await call(root, "tools/call", {
    name: "place_variants",
    arguments: { requestId: "v123abc", variations: [{ label: "one", props: [{ property: "color", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }] },
  });
  assert.equal(refused.result.isError, true);
  assert.match(refused.result.content[0].text, /withdrew the request/i);
});

test("any other count than the asked one is refused", async () => {
  const root = tmp();
  await writeVariationRequest(
    { id: "v123abc", count: 2, prompt: "", element: { tag: "h1", selector: "main > h1", values: [] } },
    root
  );
  const placed = await call(root, "tools/call", {
    name: "place_variants",
    arguments: {
      requestId: "v123abc",
      variations: [
        { label: "one", props: [{ property: "color", value: "red" }] },
        { label: "two", props: [{ property: "color", value: "blue" }] },
        { label: "three", props: [{ property: "color", value: "green" }] },
      ],
    },
  });
  assert.equal(placed.result.isError, true);
  assert.match(placed.result.content[0].text, /you sent 3/);
});

test("one get_work lists every pending preview ask, and a chat paint needs no ask file", async () => {
  const root = tmp();
  const { writePreviewRequest, readPreviewRequests } = await import("../src/previews.js");
  const { rm } = await import("node:fs/promises");
  await writePreviewRequest({ id: "q-box", instruction: "add some flair here", count: 2, region: { left: 1006, top: 144, width: 111, height: 306 } }, root);
  await writePreviewRequest({ id: "q-big", instruction: "make the heading bigger" }, root);
  const asks = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(asks.result.content[0].text, /add some flair here/);
  assert.match(asks.result.content[0].text, /make the heading bigger/);
  assert.match(asks.result.content[0].text, /Location: region at \(1006, 144\), 111x306px\./);

  const paint = (instruction) => call(root, "tools/call", { name: "place_preview", arguments: { instruction, action: "insert", position: "inside-end", html: "<p>new</p>" } });
  const first = await paint("add some flair here");
  assert.match(first.result.content[0].text, /Still waiting/, "the place answer names what is left, with no re-read");
  assert.match(first.result.content[0].text, /make the heading bigger/);
  const still = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.doesNotMatch(still.result.content[0].text, /\[preview-request\] q-box/, "the first paint answers the ask");
  await paint("add some flair here");
  const left = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.doesNotMatch(left.result.content[0].text, /\[preview-request\] q-box/, "the answered ask leaves the roster");
  assert.match(left.result.content[0].text, /make the heading bigger/);

  // A chat idea paints with the instruction alone: no ask file is needed.
  await rm(join(root, ".edityy/preview-request.json"), { force: true });
  assert.equal((await readPreviewRequests(root)).length, 0);
  const chat = await paint("a freeform chat idea");
  assert.equal(chat.result.isError, undefined);
  assert.match(chat.result.content[0].text, /Placed preview e-/);
});

test("clear_all removes every edit, ask and paint", async () => {
  const { writePreviewRequest } = await import("../src/previews.js");
  const root = tmp();
  await writePreviewRequest({ id: "q-gone", instruction: "make it bigger" }, root);
  await call(root, "tools/call", { name: "place_preview", arguments: { instruction: "make it bigger", action: "remove", selector: "main aside" } });
  const before = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(before.result.content[0].text, /make it bigger/);
  const cleared = await call(root, "tools/call", { name: "clear_all", arguments: {} });
  assert.equal(cleared.result.isError, undefined);
  assert.match(cleared.result.content[0].text, /Cleared \d+ rows/);
  const after = await call(root, "tools/call", { name: "get_work", arguments: {} });
  assert.match(after.result.content[0].text, /No pending asks/);
  const empty = await call(root, "tools/call", { name: "clear_all", arguments: {} });
  assert.match(empty.result.content[0].text, /already empty/);
});
