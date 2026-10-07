/*
 * A stdio MCP server that hands a coding agent the edits saved from the page.
 *
 *   npx edityy mcp
 *
 * The page's "Save to project" writes `.edityy/changes.json` (index.js). This
 * serves that file to an agent through two tools: one reads the pending edits,
 * one clears them once they are in the code.
 *
 * MCP over stdio is newline-delimited JSON-RPC 2.0, and this server needs four
 * methods of it, so it is written out here rather than pulled in as an SDK: the
 * package keeps its zero dependencies.
 */
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { checkChanges, checkPage, markdownFor } from "./changes.js";
import { CHANGES_FILE } from "./index.js";

const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
/**
 * The MCP versions this server speaks, newest first. A client that asks for one
 * of them gets it; any other gets the newest, as the spec says.
 */
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const TOOLS = [
  {
    name: "get_visual_changes",
    description:
      "Read the visual edits the user made on their running site with Edityy and saved to the project. " +
      "Returns each edited element with a CSS selector, its source location when known, and every " +
      "property and text change as before → after. Apply them to the source code, then call " +
      "clear_visual_changes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "clear_visual_changes",
    description:
      "Delete the saved visual edits once they have been applied to the source code, so they are not applied twice.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

/**
 * The saved edits as text for the agent, or why there are none.
 *
 * The Markdown is made here from the checked changes. A `markdown` field in the
 * file is not passed on: the agent applies what it reads to the code.
 */
async function readChanges(root) {
  let saved;
  try {
    saved = JSON.parse(await readFile(join(root, CHANGES_FILE), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return "No saved edits. In the browser, open Edityy's edits list and press \"Save to project\".";
    }
    throw new Error(`Could not read ${CHANGES_FILE}: ${error.message}`);
  }
  let changes;
  try {
    changes = checkChanges(saved?.changes);
  } catch (error) {
    throw new Error(`${CHANGES_FILE} does not hold an edit list Edityy wrote (${error.message}) Save the edits from the page again.`);
  }
  if (!changes.length) return "The saved edit list is empty.";
  const page = checkPage(saved.page);
  const at = typeof saved.savedAt === "string" && !Number.isNaN(Date.parse(saved.savedAt)) ? saved.savedAt : "at an unknown time";
  return `Saved ${at}${page ? ` from ${page}` : ""}.\n\n${markdownFor(changes, page)}`;
}

/** Answer one JSON-RPC message; null for a notification, which gets no answer. */
export async function handle(message, root) {
  const { id, method, params } = message ?? {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, text) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message: text } });

  if (!message || message.jsonrpc !== "2.0" || typeof method !== "string") return fail(-32600, "Invalid request");
  if (id === undefined) return null; // notifications/initialized and friends

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "edityy", version: VERSION },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      try {
        if (params?.name === "get_visual_changes") {
          return reply({ content: [{ type: "text", text: await readChanges(root) }] });
        }
        if (params?.name === "clear_visual_changes") {
          await rm(join(root, CHANGES_FILE), { force: true });
          return reply({ content: [{ type: "text", text: "Cleared the saved edits." }] });
        }
        return fail(-32602, `Unknown tool: ${params?.name}`);
      } catch (error) {
        return reply({ content: [{ type: "text", text: error.message }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

/** Run the server on a pair of streams: stdin and stdout, unless told otherwise. */
export function serve({ root = process.cwd(), input = process.stdin, output = process.stdout } = {}) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  // One at a time, in order: a client may send the next request before the
  // last answer, and answers must not overtake each other.
  let queue = Promise.resolve();
  lines.on("line", (line) => {
    if (!line.trim()) return;
    // The catch keeps the chain alive: a rejected link would skip every
    // message after it, and the agent would wait for answers that never come.
    queue = queue
      .then(async () => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
          return;
        }
        let answer;
        try {
          answer = await handle(message, root);
        } catch (error) {
          answer = { jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32603, message: String(error?.message ?? error) } };
        }
        if (answer) output.write(JSON.stringify(answer) + "\n");
      })
      .catch(() => {
        // The output is gone: nothing to answer on, but keep reading.
      });
  });
  return lines;
}
