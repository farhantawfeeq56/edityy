/*
 * A stdio MCP server that hands a coding agent what the page asked for.
 *
 *   npx edityy mcp
 *
 * The page writes two things: the edits saved with "Save to project"
 * (`.edityy/changes.json`, from index.js), and a variation request — one
 * element, a number of variations and an optional comment
 * (`.edityy/variation-request.json`, from variations.js).
 * This serves both to an agent through seven tools: read the edits, clear them
 * once they are in the code, read the variation request, place the
 * variations the agent answers with, place a chat-initiated canvas preview,
 * read a preview to apply it, and decide a preview once it is handled.
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
import { decidePreview, placePreview, previewText, readActivePreview, readPreview, readPreviews } from "./previews.js";
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
      "The user typed vartest: read the style variations they asked for on one element of their running site. " +
      "Read it at the start of every vartest: the user may have asked again since the last one, and an answer " +
      "for an old request is refused. " +
      "Returns the number of variations, their optional comment, the element's selector and tag, and its current values. " +
      "Answer with that many variations of plain CSS declarations, then call place_variations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "place_preview",
    description:
      "The user typed edityy:: followed by an instruction in their agent chat: paint that change on the live Edityy canvas only, not in the code. " +
      "Place one preview with an action and its payload. " +
      "styles restyles one element and takes a selector plus 1 to 10 labeled variations of plain CSS declarations, each with an optional text. " +
      "insert adds one allowlisted element near an anchor, or at the end of main without one, with after, before, inside-start or inside-end. " +
      "update changes one element named by a selector, with styles, text or markup. " +
      "remove takes away one element named by a selector. " +
      "No custom properties, at-rules in place of when, !important, url(), script tags, event attributes or iframes. " +
      "The preview shows on the page with Keep and Discard; keeping it makes it a normal Edityy edit. " +
      "If the place is unclear and the user named none, ask first.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "The change the user asked for, quoted." },
        action: { type: "string", description: "One of styles, insert, update or remove." },
        selector: { type: "string", description: "The element to change, for styles, update and remove." },
        variations: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words the user will see." },
              props: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    property: { type: "string", description: "A standard CSS property name, such as scrollbar-color." },
                    value: { type: "string", description: "The value, such as #8a8a8a transparent." },
                    on: { type: "string", description: "Optional: a state or pseudo-element on the element, such as :hover or ::before." },
                    when: { type: "string", description: "Optional: a media condition, such as (max-width: 640px), for a breakpoint." },
                  },
                  required: ["property", "value"],
                  additionalProperties: false,
                },
              },
              text: { type: "string", description: "Optional: plain words that replace the element's own words." },
            },
            required: ["label", "props"],
            additionalProperties: false,
          },
        },
        anchor: { type: "string", description: "Optional: the element the insert goes by; without one it goes at the end of main." },
        position: { type: "string", description: "For insert: after, before, inside-start or inside-end." },
        html: { type: "string", description: "For insert and update: the markup. Structure, headings, words and pictures only; no forms, scripts or event attributes." },
        props: {
          type: "array",
          items: {
            type: "object",
            properties: {
              property: { type: "string", description: "A standard CSS property name." },
              value: { type: "string", description: "The value." },
              on: { type: "string", description: "Optional: a state or pseudo-element, such as :hover." },
              when: { type: "string", description: "Optional: a media condition, such as (max-width: 640px)." },
            },
            required: ["property", "value"],
            additionalProperties: false,
          },
        },
        text: { type: "string", description: "Optional: plain words for update." },
      },
      required: ["instruction", "action"],
      additionalProperties: false,
    },
  },
  {
    name: "get_preview",
    description:
      "Read one placed Edityy canvas preview, with its instruction, action and payload. " +
      "Apply kept previews to the source code: the page saved them with Save to project, so read them with get_visual_changes. " +
      "Each preview has an id such as e-123: the user types implement <id> to apply it or discard <id> to drop it.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The preview id, such as e-123. Without one, the active preview is read." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "decide_preview",
    description:
      "Mark one Edityy canvas preview kept or discarded, once the user said implement or discard with its id. " +
      "Kept previews are already Edityy edits on the page: read them with get_visual_changes and apply them to the code.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The preview id, such as e-123." },
        decision: { type: "string", description: "keep or discard." },
      },
      required: ["id", "decision"],
      additionalProperties: false,
    },
  },
  {
    name: "place_variations",
    description:
      "Place the style variations for a pending variation request, for the user to try on the live element. " +
      "Place exactly the number get_variation_request returned; if you place more, the first ones are the ones the user sees. " +
      "Use the requestId that get_variation_request returned, and read the request again if the user changed it. " +
      "Each variation is a label and plain standard CSS declarations, with `on` for a state or " +
      "pseudo-element and `when` for a media condition, and it may also set the element's words with `text`. " +
      "No custom properties, at-rules in place of `when`, `!important` or url().",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "The requestId that get_variation_request returned." },
        variations: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words the user will see." },
              props: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    property: { type: "string", description: "A standard CSS property name, such as scrollbar-color." },
                    value: { type: "string", description: "The value, such as #8a8a8a transparent." },
                    on: {
                      type: "string",
                      description: "Optional: a state or pseudo-element on the element, such as :hover, :focus-visible or ::before.",
                    },
                    when: {
                      type: "string",
                      description: "Optional: a media condition, such as (max-width: 640px), for a breakpoint variation.",
                    },
                  },
                  required: ["property", "value"],
                  additionalProperties: false,
                },
              },
              text: { type: "string", description: "Optional: plain words that replace the element's own words." },
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
          if (!request) {
            return reply({
              content: [{ type: "text", text: "No pending variation request. In the browser, select an element, choose Variations, then Send to agent." }],
            });
          }
          if (request.status === "cancelled") {
            return reply({
              content: [
                {
                  type: "text",
                  text:
                    `The user withdrew the last variation request (${request.count} variations of a ${request.element.tag}). ` +
                    "Do not answer it. If they ask again, a new request will appear.",
                },
              ],
            });
          }
          return reply({ content: [{ type: "text", text: requestText(request) }] });
        }
        if (params?.name === "place_preview") {
          const preview = await placePreview(params?.arguments, root);
          return reply({
            content: [{ type: "text", text: `Placed preview ${preview.id}. It shows on the canvas with Keep and Discard. Keep makes it a normal Edityy edit. The user decides with implement ${preview.id} or discard ${preview.id}.` }],
          });
        }
        if (params?.name === "get_preview") {
          const id = params?.arguments?.id;
          const shown = typeof id === "string" && id ? await readPreview(id, root) : await readActivePreview(root);
          if (!shown) {
            if (typeof id === "string" && id) return reply({ content: [{ type: "text", text: `No preview ${id}.` }] });
            const list = await readPreviews(root);
            if (!list.history.length) {
              return reply({ content: [{ type: "text", text: "No preview. The user types edityy:: followed by an instruction, and you place it with place_preview." }] });
            }
            const rows = list.history.map((item) => `- ${item.id} (${item.status}): ${item.instruction}`).join("\n");
            return reply({ content: [{ type: "text", text: `Previews, newest first:\n\n${rows}` }] });
          }
          return reply({ content: [{ type: "text", text: previewText(shown) }] });
        }
        if (params?.name === "decide_preview") {
          const decided = await decidePreview(params?.arguments?.id, params?.arguments?.decision, root);
          return reply({
            content: [{
              type: "text",
              text:
                decided.status === "kept"
                  ? `Preview ${decided.id} is kept. Read it with get_visual_changes and apply it to the code.`
                  : `Preview ${decided.id} is discarded. The page drops it.`
            }],
          });
        }
        if (params?.name === "place_variations") {
          const placed = await placeVariations(params?.arguments, root);
          const labels = placed.variations.map((variation, i) => `${i + 1}. ${variation.label}`).join("\n");
          const sent = Array.isArray(params?.arguments?.variations) ? params.arguments.variations.length : 0;
          const note =
            sent > placed.variations.length
              ? `\n\nThe user asked for ${placed.variations.length}, so the first ${placed.variations.length} of your ${sent} are used.`
              : "";
          return reply({
            content: [{ type: "text", text: `Placed ${placed.variations.length} variations. The user picks one with keys 1 to ${placed.variations.length}:\n\n${labels}${note}` }],
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
