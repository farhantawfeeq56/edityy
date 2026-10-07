// Checks for the MCP server (src/mcp.js) and the `edityy mcp` command.
// Run: npm test
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CHANGES_FILE, writeChanges } from "../src/index.js";
import { handle } from "../src/mcp.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-mcp-"));
const call = (root, method, params, id = 1) => handle({ jsonrpc: "2.0", id, method, params }, root);

test("initializes as a tools server and lists its two tools", async () => {
  const init = await call(tmp(), "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal(init.result.serverInfo.name, "edityy");
  const list = await call(tmp(), "tools/list");
  assert.deepEqual(list.result.tools.map((t) => t.name), ["get_visual_changes", "clear_visual_changes"]);
  for (const tool of list.result.tools) assert.equal(tool.inputSchema.type, "object");
});

test("a notification gets no answer, and an unknown method an error", async () => {
  assert.equal(await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, tmp()), null);
  assert.equal((await call(tmp(), "resources/list")).error.code, -32601);
  assert.equal((await handle({ id: 1, method: "x" }, tmp())).error.code, -32600);
});

test("hands over the saved edits, then clears them", async () => {
  const root = tmp();
  const none = await call(root, "tools/call", { name: "get_visual_changes", arguments: {} });
  assert.match(none.result.content[0].text, /No saved edits/);

  await writeChanges({ page: "http://localhost:5173/", markdown: "# Visual edits from Edityy\n\n## 1. h1", changes: [{ selector: "h1" }] }, root);
  const got = await call(root, "tools/call", { name: "get_visual_changes", arguments: {} });
  assert.match(got.result.content[0].text, /from http:\/\/localhost:5173\//);
  assert.match(got.result.content[0].text, /# Visual edits from Edityy/);

  const cleared = await call(root, "tools/call", { name: "clear_visual_changes", arguments: {} });
  assert.match(cleared.result.content[0].text, /Cleared/);
  assert.equal(existsSync(join(root, CHANGES_FILE)), false);
});

test("an unknown tool is an invalid-params error", async () => {
  assert.equal((await call(tmp(), "tools/call", { name: "nope" })).error.code, -32602);
});

test("`edityy mcp` speaks newline-delimited JSON-RPC on stdio", async () => {
  const root = tmp();
  await writeChanges({ markdown: "# Visual edits", changes: [{ selector: "p" }] }, root);
  const child = spawn(process.execPath, [new URL("../src/cli.js", import.meta.url).pathname, "mcp", "--root", root]);
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
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_visual_changes", arguments: {} } });
  await done;
  child.kill();
  assert.deepEqual(answers.map((a) => a.id), [1, 2, 3], "answers in order, none for the notification");
  assert.match(answers[2].result.content[0].text, /# Visual edits/);
});
