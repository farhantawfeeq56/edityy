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
import { CHANGES_FILE } from "./index.js";

const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
/** What this server speaks when a client asks for something it does not know. */
const PROTOCOL = "2025-06-18";

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

/** The saved edits as text for the agent, or why there are none. */
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
  if (!Array.isArray(saved.changes) || !saved.changes.length) return "The saved edit list is empty.";
  const head = `Saved ${saved.savedAt ?? "at an unknown time"}${saved.page ? ` from ${saved.page}` : ""}.`;
  return `${head}\n\n${saved.markdown || JSON.stringify(saved.changes, null, 2)}`;
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
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : PROTOCOL,
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
    queue = queue.then(async () => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
        return;
      }
      const answer = await handle(message, root);
      if (answer) output.write(JSON.stringify(answer) + "\n");
    });
  });
  return lines;
}
