/*
 * The `edityy init` setup. One command writes everything the project needs:
 *
 *   npx edityy init            write the setup for this project
 *   npx edityy init --remove   take it back out
 *   npx edityy doctor          check the setup, and the MCP server with it
 *
 * A file this command creates carries MARK on its first line, and the rules it
 * appends to AGENTS.md sit between BEGIN and END markers. --remove deletes only
 * what carries them, so a file the user wrote is never touched.
 *
 * Next.js needs no edit to next.config.ts: proxy.ts answers both endpoints
 * itself, which is why this command only ever creates files there.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./cli.js", import.meta.url));

/** The first line of every file this command writes, and how --remove finds it. */
const MARK = "// edityy: written by `npx edityy init`. Run `npx edityy init --remove` to delete it.";

/** The markers around the rules this command appends to AGENTS.md. */
const BEGIN = "<!-- BEGIN edityy (written by `npx edityy init`) -->";
const END = "<!-- END edityy -->";

const CHANGES = "/__edityy/changes";
const VARIATIONS = "/__edityy/variations";

const RULES = `${BEGIN}
## Edityy

The user edits the running site with Edityy, not the code. Two tools come from
the Edityy MCP server.

- **vartest.** When the user types \`vartest\`, call \`get_variation_request\`.
  Read it every time: an answer for an older request is refused. Then answer
  with the number of variations it asks for, and call \`place_variations\`. Use
  plain CSS declarations only, and do not edit files for this.
- **Visual edits.** When the user asks for the edits they saved from the site,
  call \`get_visual_changes\`, apply them to the source code, then call
  \`clear_visual_changes\`.
- **The server.** If these tools are missing, the Edityy MCP server is not
  connected. Tell the user to run \`npx edityy mcp\`.
${END}
`;

/** The Vite config, when the command has to print it instead of writing it. */
const VITE_SNIPPET = `import { edityy } from "edityy/vite";

export default defineConfig({
  plugins: [edityy()],
});`;

/** The middleware, for a server this command does not recognise. */
const OTHER_SNIPPET = `import { edityy } from "edityy";

createServer(edityy()).listen(3000);`;

/* ------------------------------------------------------------- the project */

/** The package.json of the project, or an empty object when there is none. */
async function readManifest(root) {
  try {
    return JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

/** The dev server the project runs, from its dependencies. */
function frameworkOf(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) return "next";
  // Every one of these runs a Vite dev server, so the Vite plugin serves them.
  if (deps.vite || deps.astro || deps.nuxt || deps["@sveltejs/kit"] || deps["@remix-run/dev"] || deps["solid-start"]) return "vite";
  return "other";
}

/** The Vite config file, whichever extension the project gave it. */
function viteConfigName(root) {
  return ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"].find(
    (name) => existsSync(join(root, name)),
  );
}

/** Where Next.js keeps the files it runs before the app: the root, or `src`. */
function nextBase(root) {
  return existsSync(join(root, "src", "app")) ? join(root, "src") : root;
}

/* ---------------------------------------------------------------- the files */

const instrumentationClient = () => `${MARK}
if (process.env.NODE_ENV === "development") import("edityy/client");
`;

const proxy = () => `${MARK}
import { changesRoute, variationsRoute } from "edityy";

type Handler = (request: Request) => Response | Promise<Response>;

const changes = changesRoute();
const variations = variationsRoute() as unknown as Record<string, Handler | undefined>;

/**
 * The Edityy endpoints answer here, so next.config.ts needs no rewrite. Other
 * paths pass through. The handlers answer 404 outside \`next dev\`.
 */
export function proxy(request: Request) {
  const path = new URL(request.url).pathname;
  if (path === "${CHANGES}") return request.method === "POST" ? changes(request) : undefined;
  const handler = path === "${VARIATIONS}" ? variations[request.method] : null;
  return handler ? handler(request) : undefined;
}

export const config = { matcher: ["/__edityy/:path*"] };
`;

/** Write a file this command owns, and leave it alone when it already says this. */
async function put(file, body) {
  if (existsSync(file)) {
    const before = await readFile(file, "utf8");
    if (before === body) return "already";
    if (!before.startsWith(MARK)) return "yours"; // the user wrote this file
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
  return "written";
}

/** The MCP entry every client understands. */
const mcpEntry = () => ({ command: "npx", args: ["edityy", "mcp"] });

/** Add edityy to a client's JSON config, and keep the servers already in it. */
async function putMcp(file) {
  let before = null;
  if (existsSync(file)) {
    try {
      before = JSON.parse(await readFile(file, "utf8"));
    } catch {
      return "unreadable"; // not valid JSON: leave it to the user
    }
  }
  const servers = { ...(before?.mcpServers ?? {}) };
  if (servers.edityy) return "already";
  servers.edityy = mcpEntry();
  const body = `${JSON.stringify({ ...before, mcpServers: servers }, null, 2)}\n`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
  return "written";
}

/** Take one server out of a client's JSON config, and the file when it empties. */
async function dropMcp(file) {
  if (!existsSync(file)) return "absent";
  let config = null;
  try {
    config = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return "unreadable";
  }
  if (!config?.mcpServers?.edityy) return "absent";
  delete config.mcpServers.edityy;
  const empty = Object.keys(config.mcpServers).length === 0 && Object.keys(config).length === 1;
  if (empty) {
    await rm(file);
    return "removed";
  }
  await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
  return "removed";
}

/** Where the rules go: the agent file the project already has, or a new one. */
function rulesFile(root) {
  return ["AGENTS.md", "CLAUDE.md"].map((name) => join(root, name)).find((file) => existsSync(file)) ?? join(root, "AGENTS.md");
}

/** Add the rules between the markers, and replace a block an older run left. */
async function putRules(root) {
  const file = rulesFile(root);
  const before = existsSync(file) ? await readFile(file, "utf8") : "";
  const from = before.indexOf(BEGIN);
  const to = before.indexOf(END);
  if (from !== -1 && to !== -1) {
    if (before.slice(from, to + END.length) === RULES.trimEnd()) return "already";
    const after = before.slice(0, from) + RULES.trimEnd() + before.slice(to + END.length);
    await writeFile(file, after);
    return "written";
  }
  const gap = before.length && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  await writeFile(file, `${before}${gap}${RULES}`);
  return "written";
}

/** Take the rules out, and their markers with them. */
async function dropRules(root) {
  const file = rulesFile(root);
  if (!existsSync(file)) return "absent";
  const before = await readFile(file, "utf8");
  const from = before.indexOf(BEGIN);
  const to = before.indexOf(END);
  if (from === -1 || to === -1) return "absent";
  const after = (before.slice(0, from) + before.slice(to + END.length)).replace(/\n{3,}$/, "\n");
  if (after.trim() === "") {
    await rm(file);
    return "removed";
  }
  await writeFile(file, after);
  return "removed";
}

/** Add the plugin to a Vite config, or say the file needs the user's hand. */
async function putVite(root, name) {
  const file = join(root, name);
  const before = await readFile(file, "utf8");
  if (/\bedityy\b/.test(before)) return { state: "already", note: "the plugin is in it" };
  if (!/plugins\s*:\s*\[/.test(before)) return { state: "manual", note: `add the plugin to ${name}`, snippet: VITE_SNIPPET };
  // The import is hoisted, so the top of the file is safe as long as nothing
  // before it has to run first. A comment or another import does not.
  let after = before.replace(/plugins\s*:\s*\[/, (found) => `${found}edityy(), `);
  after = `import { edityy } from "edityy/vite";\n${after}`;
  await writeFile(file, after);
  return { state: "written", note: name };
}

/** Take the plugin back out of the Vite config. */
async function dropVite(root, name) {
  const file = join(root, name);
  if (!existsSync(file)) return "absent";
  const before = await readFile(file, "utf8");
  const after = before.replace('import { edityy } from "edityy/vite";\n', "").replace("edityy(), ", "");
  if (after === before) return "absent";
  await writeFile(file, after);
  return "removed";
}

/* --------------------------------------------------------------- the steps */

/** A file body without the marker line, for showing a file the user must write. */
function bodyWithoutMark(body) {
  return body.startsWith(MARK) ? body.slice(MARK.length + 1) : body;
}

/**
 * What the project needs. `steps` is what the caller prints.
 */
export async function plan(root = process.cwd()) {
  const at = resolve(root);
  const pkg = await readManifest(at);
  const framework = frameworkOf(pkg);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const steps = [];
  const add = (state, what, note) => steps.push({ state, what, note });

  if (!deps.edityy) add("todo", "install the package", "npm i -D edityy");

  if (framework === "next") {
    const base = nextBase(at);
    const files = [
      { file: join(base, "instrumentation-client.ts"), body: instrumentationClient(), what: "mount the launcher" },
      { file: join(base, "proxy.ts"), body: proxy(), what: "answer the endpoints" },
    ];
    for (const entry of files) steps.push({ state: "pending", what: entry.what, note: entry.file.slice(at.length + 1), entry });
    add("done", "next.config.ts", "no edit needed");
  } else if (framework === "vite") {
    const name = viteConfigName(at);
    if (name) steps.push({ state: "pending", what: "add the Vite plugin", note: name, vite: name });
    else add("manual", "add the Vite plugin", "no vite.config file at the project root", VITE_SNIPPET);
  } else {
    add("manual", "add the middleware", "this dev server is not Next.js or Vite", OTHER_SNIPPET);
  }

  // The agent side. A client with a config file this command knows gets the
  // server written; one it does not recognise gets the entry to paste.
  const claude = [".claude", "CLAUDE.md", ".mcp.json"].some((name) => existsSync(join(at, name)));
  const cursor = existsSync(join(at, ".cursor"));
  if (claude) steps.push({ state: "pending", what: "add the MCP server", note: ".mcp.json", mcp: join(at, ".mcp.json") });
  if (cursor) steps.push({ state: "pending", what: "add the MCP server", note: ".cursor/mcp.json", mcp: join(at, ".cursor", "mcp.json") });
  if (!claude && !cursor) add("manual", "add the MCP server", "no agent config found", JSON.stringify({ mcpServers: { edityy: mcpEntry() } }, null, 2));
  steps.push({ state: "pending", what: "teach the agent vartest", note: rulesFile(at).slice(at.length + 1), rules: true });

  return { root: at, framework, steps, needsInstall: !deps.edityy };
}

/** Write the setup, and answer what happened to each step. */
export async function init({ root = process.cwd(), install = true } = {}) {
  const at = resolve(root);
  // A folder with no package.json is not a project: writing agent files into it
  // is a mistake, not a setup.
  if (!existsSync(join(at, "package.json"))) {
    return { root: at, framework: "none", steps: [{ state: "manual", what: "run this in your project", note: `no package.json in ${at}` }], installer: null };
  }
  const { framework, steps, needsInstall } = await plan(at);
  const done = [];
  let installer = null;

  for (const step of steps) {
    if (step.state !== "pending") {
      done.push(step);
      continue;
    }
    if (step.entry) {
      const state = await put(step.entry.file, step.entry.body);
      // A file the user wrote stays as it is, so the report shows what to add
      // to it instead of claiming the step is done.
      done.push({ ...step, state, snippet: state === "yours" ? bodyWithoutMark(step.entry.body) : undefined });
    }
    if (step.vite) {
      const { state, note, snippet } = await putVite(at, step.vite);
      done.push({ ...step, state, note: note ?? step.note, snippet });
    }
    if (step.mcp) done.push({ ...step, state: await putMcp(step.mcp) });
    if (step.rules) done.push({ ...step, state: await putRules(at) });
  }

  // The files are useless without the package, so add it when it is missing.
  // A finished install is not a step the user still has to do.
  if (install && needsInstall) {
    installer = await run("install -D edityy", at);
    const step = done.find((entry) => entry.state === "todo");
    if (step && installer.ok) {
      step.state = "done";
      step.note = "edityy installed";
    }
  }

  return { root: at, framework, steps: done, installer };
}

/** Take back everything the markers show this command wrote. */
export async function remove({ root = process.cwd() } = {}) {
  const at = resolve(root);
  const out = [];
  const note = (state, what) => out.push({ state, what });

  for (const base of [at, join(at, "src")]) {
    for (const name of ["instrumentation-client.ts", "proxy.ts"]) {
      const file = join(base, name);
      if (!existsSync(file)) continue;
      if (!(await readFile(file, "utf8")).startsWith(MARK)) {
        note("yours", file.slice(at.length + 1));
        continue;
      }
      await rm(file);
      note("removed", file.slice(at.length + 1));
    }
  }
  const name = viteConfigName(at);
  if (name) note(await dropVite(at, name), name);
  note(await dropMcp(join(at, ".mcp.json")), ".mcp.json");
  note(await dropMcp(join(at, ".cursor", "mcp.json")), ".cursor/mcp.json");
  note(await dropRules(at), rulesFile(at).slice(at.length + 1));
  return { root: at, steps: out };
}

/* --------------------------------------------------------------- the check */

/**
 * Ask the MCP server for its tools over stdio. A written config file proves
 * nothing; this does. It gives up after a few seconds.
 */
export async function checkMcp(root = process.cwd(), timeout = 5000) {
  return new Promise((resolveCheck) => {
    const child = spawn(process.execPath, [CLI, "mcp"], { cwd: resolve(root), stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    let result = null; // set once, and answered when the server has stopped
    const stop = (answer) => {
      if (result) return;
      result = answer;
      child.kill();
    };
    const timer = setTimeout(() => stop({ ok: false, error: "the server did not answer" }), timeout);
    child.on("error", (error) => stop({ ok: false, error: error.message }));
    // Answered on exit, not on kill: the caller may remove the project folder
    // next, and a live server still holds it open on Windows.
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolveCheck(result ?? { ok: false, error: `the server exited with ${code}` });
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let at;
      while ((at = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        let message = null;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id === 1 && message.result) send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
        if (message.id === 2 && message.result?.tools) stop({ ok: true, tools: message.result.tools.map((tool) => tool.name) });
      }
    });
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "edityy-doctor", version: "1" } },
    });
    /** Write one message, and give up when the server is already gone. */
    function send(message) {
      try {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      } catch (error) {
        stop({ ok: false, error: error.message });
      }
    }
  });
}

/** Check the setup again, for a project that was set up before. */
export async function doctor({ root = process.cwd() } = {}) {
  const at = resolve(root);
  const { framework, steps } = await plan(at);
  const found = [];
  for (const step of steps) {
    const file = step.entry?.file ?? step.mcp ?? (step.vite ? join(at, step.vite) : step.rules ? rulesFile(at) : null);
    if (!file) {
      found.push({ what: step.what, note: step.note, state: step.state });
      continue;
    }
    const state = !existsSync(file) ? "missing" : /edityy|edityy\/vite|BEGIN edityy/.test(await readFile(file, "utf8")) ? "ok" : "missing";
    found.push({ what: step.what, note: step.note, state });
  }
  return { root: at, framework, steps: found, mcp: await checkMcp(at) };
}

/* ------------------------------------------------------------------- shell */

/** Run a command in the project, and answer whether it worked. */
function run(line, cwd) {
  return new Promise((resolveRun) => {
    // One string with no argument list: shell quoting is the only way `npm`
    // starts on Windows, and the command is a constant here.
    const child = spawn(`npm ${line}`, { cwd, stdio: "inherit", shell: true });
    child.on("error", (error) => resolveRun({ ok: false, error: error.message }));
    child.on("exit", (code) => resolveRun({ ok: code === 0, code }));
  });
}
