#!/usr/bin/env node
/*
 * The `edityy` command. One subcommand today:
 *
 *   edityy mcp [--root <dir>]   stdio MCP server for the saved edits
 */
import { resolve } from "node:path";

const [command, ...rest] = process.argv.slice(2);

if (command === "mcp") {
  const at = rest.indexOf("--root");
  const root = at === -1 ? process.cwd() : resolve(rest[at + 1] ?? ".");
  const { serve } = await import("./mcp.js");
  serve({ root });
} else {
  process.stderr.write("Usage: edityy mcp [--root <dir>]\n\n  mcp   Serve the edits saved from the page to a coding agent over MCP (stdio).\n");
  process.exitCode = command ? 1 : 0;
}
