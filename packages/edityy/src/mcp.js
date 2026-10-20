/*
 * A stdio MCP server that hands a coding agent what the page asked for.
 *
 *   npx edityy mcp
 *
 * The page writes two things: the edits saved with "Save to project"
 * (`.edityy/changes.json`, from index.js), and a variation request — one
 * element, one sentence (`.edityy/variation-request.json`, from variations.js).
 * This serves both to an agent through four tools: read the edits, clear them
 * once they are in the code, read the variation request, and place the
 * variations the agent answers with.
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
import { placeVariations, readVariationRequest, requestText } from "./variations.js";

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
      "Returns each edited element with a CSS selector, its source location when known, every " +
      "property and text change as before → after, and any comment the user wrote about it. " +
      "Apply them to the source code, then call clear_visual_changes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "clear_visual_changes",
    description:
      "Delete the saved visual edits once they have been applied to the source code, so they are not applied twice.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_variation_request",
    description:
      "Read the style variations the user asked for on one element of their running site. " +
      "Returns the one-sentence request, the element's selector and tag, and its current values. " +
      "Answer with 2 to 5 variations of plain CSS declarations, then call place_variations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "place_variations",
    description:
      "Place the style variations for a pending variation request, for the user to try on the live element. " +
      "Each variation is a label and plain standard CSS declarations. No custom properties, " +
      "pseudo-elements, states, at-rules or !important.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "The requestId that get_variation_request returned." },
        variations: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words the user will see." },
              props: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: {
                  type: "object",
                  properties: {
                    property: { type: "string", description: "A standard CSS property name, such as scrollbar-color." },
                    value: { type: "string", description: "The value, such as #8a8a8a transparent." },
                  },
                  required: ["property", "value"],
                  additionalProperties: false,
                },
              },
            },
            required: ["label", "props"],
            additionalProperties: false,
          },
        },
      },
      required: ["requestId", "variations"],
      additionalProperties: false,
    },
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
        if (params?.name === "get_variation_request") {
          const request = await readVariationRequest(root);
          return reply({
            content: [{ type: "text", text: request ? requestText(request) : "No pending variation request. The user has not asked for variations yet." }],
          });
        }
        if (params?.name === "place_variations") {
          const placed = await placeVariations(params?.arguments, root);
          const labels = placed.variations.map((variation, i) => `${i + 1}. ${variation.label}`).join("\n");
          return reply({
            content: [{ type: "text", text: `Placed ${placed.variations.length} variations. The user picks one:\n\n${labels}` }],
          });
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
