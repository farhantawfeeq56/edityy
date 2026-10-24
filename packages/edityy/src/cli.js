#!/usr/bin/env node
/*
 * The `edityy` command.
 *
 *   edityy init [--root <dir>] [--remove] [--no-install]   write the setup
 *   edityy doctor [--root <dir>]                           check the setup
 *   edityy mcp [--root <dir>]                              stdio MCP server
 */
import { resolve } from "node:path";

const [command, ...rest] = process.argv.slice(2);
/* --root takes the value after it; every other flag is a plain switch. */
const value = (name) => {
  const at = rest.indexOf(name);
  return at === -1 ? undefined : resolve(rest[at + 1] ?? ".");
};
const root = value("--root") ?? process.cwd();
const has = (name) => rest.includes(name);

const LABEL = { written: "written", already: "already", removed: "removed", absent: "nothing", yours: "kept", todo: "todo", manual: "manual", done: "ok", ok: "ok", missing: "missing", unreadable: "yours", check: "check", pending: "pending" };

/** One line per step: what happened, what it was, and the file it is about. */
function report(steps) {
  const width = Math.max(...steps.map((step) => (step.what ?? "").length));
  for (const step of steps) {
    process.stdout.write(`  ${(LABEL[step.state] ?? step.state).padEnd(9)}${(step.what ?? "").padEnd(width + 2)}${step.note ?? ""}\n`);
    if (step.snippet) process.stdout.write(`\n${step.snippet.replace(/^/gm, "      ")}\n\n`);
  }
}

if (command === "init") {
  const { init, remove } = await import("./init.js");
  if (has("--remove")) {
    const { steps } = await remove({ root });
    process.stdout.write("Edityy removed from this project.\n");
    report(steps);
    process.exitCode = steps.some((step) => step.state === "unreadable") ? 1 : 0;
  } else {
    const { framework, steps, installer } = await init({ root, install: !has("--no-install") });
    process.stdout.write(`${framework === "next" ? "Next.js" : framework === "vite" ? "Vite" : "This"} project: ${root}\n\n`);
    report(steps);
    if (installer && !installer.ok) {
      process.stdout.write(`\nThe install did not finish. Run: npm i -D edityy\n`);
    }
    const left = steps.filter((step) => step.state === "manual" || step.state === "yours" || step.state === "todo");
    process.stdout.write(
      left.length
        ? `\n${left.length} step(s) need your hand, above. Then start your dev server.\n`
        : `\nDone. Start your dev server, then open the page.\n`,
    );
    process.stdout.write("Restart your agent session, and approve the Edityy server when it asks.\n");
    process.exitCode = left.length ? 1 : 0;
  }
} else if (command === "doctor") {
  const { doctor } = await import("./init.js");
  const { framework, steps, mcp } = await doctor({ root });
  process.stdout.write(`${framework === "next" ? "Next.js" : framework === "vite" ? "Vite" : "This"} project: ${root}\n\n`);
  report(steps);
  process.stdout.write(
    mcp.ok
      ? `\n  ok       MCP server                  ${mcp.tools.join(", ")}\n`
      : `\n  missing  MCP server                  ${mcp.error}\n`,
  );
  const missing = steps.filter((step) => step.state === "missing" || step.state === "manual" || step.state === "todo").length + (mcp.ok ? 0 : 1);
  process.exitCode = missing ? 1 : 0;
} else if (command === "mcp") {
  const { serve } = await import("./mcp.js");
  serve({ root });
} else {
  process.stderr.write(
    "Usage: edityy <command>\n\n" +
      "  init [--root <dir>] [--remove] [--no-install]   Write the setup for this project\n" +
      "  doctor [--root <dir>]                           Check the setup, MCP server included\n" +
      "  mcp [--root <dir>]                              Serve the saved edits to a coding agent over MCP\n",
  );
  process.exitCode = command ? 1 : 0;
}
