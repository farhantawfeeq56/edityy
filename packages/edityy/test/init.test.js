// Checks for `edityy init`: the files it writes, the second run, and --remove.
// Run: npm test
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkMcp, doctor, init, remove } from "../src/init.js";

/** A project with the files a framework needs, and nothing else. */
function project(files) {
  const root = mkdtempSync(join(tmpdir(), "edityy-init-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), body);
  }
  return root;
}

const next = (extra = {}) =>
  project({ "package.json": JSON.stringify({ dependencies: { next: "16.0.0" } }), ...extra });
const vite = (extra = {}) =>
  project({ "package.json": JSON.stringify({ devDependencies: { vite: "8.0.0" } }), ...extra });
const read = (root, name) => readFileSync(join(root, name), "utf8");
const state = (steps, what) => steps.find((step) => step.what === what)?.state;

test("a Next.js project gets the two files it needs, and next.config.ts is not touched", async () => {
  const config = "const nextConfig = {};\nexport default nextConfig;\n";
  const root = next({ "next.config.ts": config });
  const { steps } = await init({ root, install: false });

  assert.match(read(root, "instrumentation-client.ts"), /NODE_ENV === "development".*edityy\/client/);
  const proxy = read(root, "proxy.ts");
  assert.match(proxy, /changesRoute/);
  assert.match(proxy, /variationsRoute/);
  assert.match(proxy, /request.method === "POST" \? changes\(request\)/);
  assert.match(proxy, /matcher: \["\/__edityy\/:path\*"\]/);
  assert.equal(read(root, "next.config.ts"), config, "the user's config is never edited");
  assert.equal(state(steps, "next.config.ts"), "done");
  rmSync(root, { recursive: true, force: true });
});

test("a second run writes nothing and changes nothing", async () => {
  const root = next({ "next.config.ts": "export default {};\n" });
  await init({ root, install: false });
  const before = read(root, "proxy.ts");
  const { steps } = await init({ root, install: false });

  assert.equal(read(root, "proxy.ts"), before);
  assert.equal(state(steps, "answer the endpoints"), "already");
  assert.equal(state(steps, "mount the launcher"), "already");
  assert.equal(state(steps, "teach the agent vartest"), "already");
  rmSync(root, { recursive: true, force: true });
});

test("a file the user wrote is kept, not overwritten", async () => {
  const mine = "// my own bootstrap\nexport const x = 1;\n";
  const root = next({ "instrumentation-client.ts": mine });
  const { steps } = await init({ root, install: false });

  assert.equal(read(root, "instrumentation-client.ts"), mine);
  const step = steps.find((entry) => entry.what === "mount the launcher");
  assert.equal(step.state, "yours");
  assert.match(step.snippet, /import\("edityy\/client"\)/, "the report says what to add to the file");
  rmSync(root, { recursive: true, force: true });
});

test("a Vite project gets the plugin line once, and only once", async () => {
  const config = 'import { defineConfig } from "vite";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n';
  const root = vite({ "vite.config.ts": config });
  await init({ root, install: false });
  const once = read(root, "vite.config.ts");

  assert.match(once, /^import \{ edityy \} from "edityy\/vite";/);
  assert.match(once, /plugins: \[edityy\(\), react\(\)\]/);
  await init({ root, install: false });
  assert.equal(read(root, "vite.config.ts"), once, "the second run adds nothing");
  rmSync(root, { recursive: true, force: true });
});

test("a Vite config the command does not recognise is left alone and printed", async () => {
  const config = 'import { defineConfig } from "vite";\nexport default defineConfig({});\n';
  const root = vite({ "vite.config.ts": config });
  const { steps } = await init({ root, install: false });

  assert.equal(read(root, "vite.config.ts"), config);
  const step = steps.find((entry) => entry.vite || entry.what === "add the Vite plugin");
  assert.equal(step.state, "manual");
  assert.match(step.snippet, /edityy\(\)/);
  rmSync(root, { recursive: true, force: true });
});

test("a project that is neither Next.js nor Vite gets the snippet and is not written to", async () => {
  const root = project({ "package.json": JSON.stringify({ dependencies: { express: "4.0.0" } }) });
  const { steps } = await init({ root, install: false });

  assert.equal(state(steps, "add the middleware"), "manual");
  assert.deepEqual(existsSync(join(root, "proxy.ts")), false);
  rmSync(root, { recursive: true, force: true });
});

test("the rules join the agent file and keep the text already in it", async () => {
  const mine = "# House rules\n\nUse tabs.\n";
  const root = next({ "AGENTS.md": mine });
  await init({ root, install: false });
  const after = read(root, "AGENTS.md");

  assert.match(after, /^# House rules\n\nUse tabs\.\n/);
  assert.match(after, /BEGIN edityy/);
  assert.match(after, /vartest/);
  assert.equal(after.match(/BEGIN edityy/g).length, 1, "one block, even after a second run");
  rmSync(root, { recursive: true, force: true });
});

test("the MCP entry is added beside the servers the user already has", async () => {
  const other = JSON.stringify({ mcpServers: { other: { command: "other" } } }, null, 2);
  const root = next({ ".claude": "", ".mcp.json": other });
  await init({ root, install: false });
  const config = JSON.parse(read(root, ".mcp.json"));

  assert.deepEqual(config.mcpServers.other, { command: "other" });
  assert.deepEqual(config.mcpServers.edityy, { command: "npx", args: ["edityy", "mcp"] });
  rmSync(root, { recursive: true, force: true });
});

test("--remove takes back what it wrote and keeps what the user wrote", async () => {
  const mine = "// my own bootstrap\n";
  const root = next({ "instrumentation-client.ts": mine, "AGENTS.md": "# House rules\n" });
  await init({ root, install: false });
  const { steps } = await remove({ root });

  assert.equal(existsSync(join(root, "proxy.ts")), false);
  assert.equal(read(root, "instrumentation-client.ts"), mine, "the user's file stays");
  assert.equal(read(root, "AGENTS.md"), "# House rules\n");
  assert.equal(state(steps, "instrumentation-client.ts"), "yours", "the user's file is reported, not deleted");
  assert.equal(state(steps, "proxy.ts"), "removed");
  rmSync(root, { recursive: true, force: true });
});

test("--remove drops only the edityy server, and the file with it when nothing is left", async () => {
  const other = JSON.stringify({ mcpServers: { other: { command: "other" } } }, null, 2);
  const root = next({ ".claude": "", ".mcp.json": other });
  await init({ root, install: false });
  await remove({ root });
  assert.deepEqual(JSON.parse(read(root, ".mcp.json")).mcpServers, { other: { command: "other" } });

  const alone = next({ ".claude": "" });
  await init({ root: alone, install: false });
  await remove({ root: alone });
  assert.equal(existsSync(join(alone, ".mcp.json")), false);
  rmSync(root, { recursive: true, force: true });
  rmSync(alone, { recursive: true, force: true });
});

test("the MCP server answers a handshake with its four tools", async () => {
  const root = project({ "package.json": "{}" });
  const result = await checkMcp(root, 15000);

  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.tools.sort(), ["clear_visual_changes", "get_variation_request", "get_visual_changes", "place_variations"]);
  rmSync(root, { recursive: true, force: true });
});

test("a folder with no package.json is left alone", async () => {
  const root = mkdtempSync(join(tmpdir(), "edityy-init-"));
  const { steps } = await init({ root, install: false });

  assert.equal(steps[0].state, "manual");
  assert.deepEqual(existsSync(join(root, "AGENTS.md")), false);
  rmSync(root, { recursive: true, force: true });
});

test("doctor reports the files a project is missing", async () => {
  const root = next({});
  const before = await doctor({ root });
  assert.equal(before.steps.find((step) => step.note === "proxy.ts").state, "missing");

  await init({ root, install: false });
  const after = await doctor({ root });
  assert.equal(after.steps.find((step) => step.note === "proxy.ts").state, "ok");
  rmSync(root, { recursive: true, force: true });
});
