/*
 * A stdio MCP server that hands a coding agent what the page asked for.
 *
 *   npx edityy mcp
 *
 * The page writes three things: the edits saved to the project
 * (`.edityy/changes.json`, from index.js), variation asks — one element, a
 * number of variations and an optional comment (`.edityy/variation-request.json`,
 * from variations.js), and comment-box preview asks plus the placed paints
 * (`.edityy/preview-request.json` and `.edityy/previews.json`, from
 * previews.js). This serves all of them through four tools: one read
 * (get_work) that returns every edit and every ask in one go, oldest first,
 * two placers (place_variants for CSS-only answers, place_preview for canvas
 * paints), and mark_applied once the code holds an edit.
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
import { SESSION_FILE } from "./session.js";
import { placePreview, previewRequestText, previewText, readPendingPreviews, readPreviewRequests } from "./previews.js";
import { store } from "./store.js";
import { placeVariations, readVariationRequests, requestText } from "./variations.js";

const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
/**
 * The MCP versions this server speaks, newest first. A client that asks for one
 * of them gets it; any other gets the newest, as the spec says.
 */
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const DECLARATIONS = {
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
};
const PREVIEW_VARIATIONS = {
  type: "array",
  minItems: 1,
  maxItems: 100,
  items: {
    type: "object",
    properties: {
      label: { type: "string", description: "Two or three words the user will see." },
      props: DECLARATIONS,
      text: { type: "string", description: "Optional: plain words that replace the element's own words." },
    },
    required: ["label", "props"],
    additionalProperties: false,
  },
};
const PREVIEW_TARGET = {
  type: "object",
  properties: {
    action: { type: "string", description: "One of styles, insert, update or remove." },
    selector: { type: "string", description: "The element to change, for styles, update and remove." },
    variations: PREVIEW_VARIATIONS,
    anchor: { type: "string", description: "Optional: the element the insert goes by; without one it goes at the end of main." },
    position: { type: "string", description: "For insert: after, before, inside-start or inside-end." },
    html: { type: "string", description: "For insert and update: the markup. Strict-inline JS only: inline script + on* for local UI; no script src, no network in script." },
    props: DECLARATIONS,
    text: { type: "string", description: "Optional: plain words for update." },
  },
  required: ["action"],
  additionalProperties: false,
};

const TOOLS = [
  {
    name: "get_work",
    description:
      "Read everything Edityy holds in one call: the saved visual edits plus every ask, oldest first. " +
      "Call it once per turn, before any other Edityy tool. Each edit has an id such as c-0: apply it to the " +
      "source code, then call mark_applied with the ids that are in the code. Each ask has a kind, an id and a " +
      "status: answer a variants ask with place_variants and a preview-request ask with place_preview. " +
      "A preview ask paints on the live canvas only with Keep and Discard; keeping makes it a normal edit that " +
      "arrives here as an edit of its own. Never re-read for the same turn: this call already lists it all.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "mark_applied",
    description:
      "Mark saved edits applied once the code holds them, so they are not applied twice. " +
      "Pass the edit ids get_work returned, such as [\"c-0\", \"c-1\"]. With no ids, every saved edit is marked. " +
      "That also clears the canvas session.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "The edit ids that are in the code now. Empty marks every saved edit." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "place_preview",
    description:
      "Paint a change on the live Edityy canvas only, not in the code, for a comment-box preview ask. " +
      "The instruction alone names the ask: quote the instruction get_work returned, and a waiting ask with " +
      "those words is answered. No ask file is needed for a chat idea: an instruction with an action and its " +
      "payload still paints. Place one preview with an action and its payload, or many at once with targets: each target keeps its own action, selector or anchor, and payload. " +
      "styles restyles one element and takes a selector plus 1 to 100 labeled variations of plain CSS declarations, each with an optional text. " +
      "insert adds one element near an anchor, or at the end of main without one, with after, before, inside-start or inside-end. " +
      "update changes one element named by a selector, with styles, text or markup. " +
      "remove takes away one element named by a selector. " +
      "Inline script + event handlers paint for local UI; network calls and external script src are refused. " +
      "The preview shows on the page with Keep and Discard; keeping makes an edit of it (the agent reads it with get_work). " +
      "If the place is unclear and the user named none, ask first.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "The change the user asked for, quoted." },
        action: { type: "string", description: "One of styles, insert, update or remove." },
        selector: { type: "string", description: "The element to change, for styles, update and remove." },
        variations: PREVIEW_VARIATIONS,
        targets: { type: "array", minItems: 1, maxItems: 100, items: PREVIEW_TARGET, description: "Many elements in one preview, each with its own action, selector or anchor, and payload. Old single-action calls keep working without it." },
        anchor: { type: "string", description: "Optional: the element the insert goes by; without one it goes at the end of main." },
        position: { type: "string", description: "For insert: after, before, inside-start or inside-end." },
        html: { type: "string", description: "For insert and update: the markup. Strict-inline JS only: inline script + on* for local UI; no script src, no network in script." },
        props: DECLARATIONS,
        text: { type: "string", description: "Optional: plain words for update." },
      },
      required: ["instruction"],
      additionalProperties: false,
    },
  },
  {
    name: "place_variants",
    description:
      "Place the style variations for a pending variants ask, for the user to try on the live element. " +
      "Use the requestId get_work returned, and place exactly the number of variations the ask holds: fewer " +
      "leaves a slot empty and more has nowhere to go, so any other count is refused. " +
      "Each variation is a label and plain standard CSS declarations, with `on` for a state or " +
      "pseudo-element and `when` for a media condition, and it may also set the element's words with `text`. " +
      "Any CSS, incl. custom properties, !important and url(), paints on the canvas.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "The requestId get_work returned." },
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
 * Every saved edit and every ask as text for the agent, in one read.
 *
 * Edits carry ids of the form `c-0`: the agent applies them to the code and
 * marks them with mark_applied. Asks carry their kind, id and status: the
 * agent answers a pending one with a placer. The Markdown is made here from
 * the checked changes. A `markdown` field in the file is never passed on: the
 * agent applies what it reads to the code.
 */
async function workText(root) {
  const out = ["# Work from Edityy", "", "Call get_work once per turn. It holds every saved edit and every ask, oldest first."];
  let saved = null;
  try {
    saved = JSON.parse(await readFile(join(root, CHANGES_FILE), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`Could not read ${CHANGES_FILE}: ${error.message}`);
  }
  let changes = [];
  let page = null;
  if (saved) {
    try {
      changes = checkChanges(saved?.changes);
    } catch (error) {
      throw new Error(`${CHANGES_FILE} does not hold an edit list Edityy wrote (${error.message}) Save the edits from the page again.`);
    }
    page = checkPage(saved.page);
  }
  out.push("", `## Edits (${changes.length})`);
  if (!changes.length) {
    out.push("No saved edits. In the browser, open Edityy's edits list and approve an edit with the tick.");
  } else {
    out.push("Apply each edit to the source code, then call mark_applied with its id.", "");
    // The headers number from 1; the ids the agent marks number from 0.
    let next = -1;
    const at = saved.savedAt && !Number.isNaN(Date.parse(saved.savedAt)) ? `Saved at ${saved.savedAt}` : null;
    const from = page ? ` from ${page}` : "";
    out.push(`${at ? at + from + ".\n\n" : ""}${markdownFor(changes, page).replace(/^## \d+\./gm, () => `## c-${++next}.`)}`);
  }
  const variationRequests = await readVariationRequests(root);
  const previewRequests = await readPreviewRequests(root);
  const pendingPreviews = await readPendingPreviews(root);
  const pendingVariations = variationRequests.filter((entry) => entry.status === "pending");
  const pendingPreviewRequests = previewRequests.filter((entry) => entry.status === "pending");
  const count = pendingVariations.length + pendingPreviewRequests.length + pendingPreviews.length;
  out.push("", `## Asks (${count}), oldest first`);
  if (!count) {
    const lastVariation = variationRequests[variationRequests.length - 1];
    const lastPreview = previewRequests[previewRequests.length - 1];
    if (lastVariation?.status === "cancelled" || lastPreview?.status === "cancelled") {
      out.push("The user withdrew the last ask. Do not answer it. If they ask again, a new ask will appear.");
    } else if (lastVariation?.status === "answered" || lastPreview?.status === "answered") {
      out.push("The last ask is already answered. If the user asks again, a new ask will appear.");
    } else {
      out.push("No pending asks. In the browser, set more than one variation in the comment box and press an element, or write a comment with \"Apply on temporary canvas\" ticked.");
    }
    return out.join("\n");
  }
  for (const entry of pendingVariations) out.push(`- [variants] ${entry.id} (pending): ${entry.count} variations of \`${entry.element.selector}\``);
  for (const entry of pendingPreviewRequests) out.push(`- [preview-request] ${entry.id} (pending): ${JSON.stringify(entry.instruction)}`);
  for (const entry of [...pendingPreviews].reverse()) out.push(`- [preview] ${entry.id} (active): ${JSON.stringify(entry.instruction)}`);
  const head = out.join("\n");
  const bodies = [
    ...pendingVariations.map((entry) => requestText(entry)),
    ...pendingPreviewRequests.map((entry) => previewRequestText(entry)),
    ...[...pendingPreviews].reverse().map((entry) => previewText(entry)),
  ];
  return bodies.length ? `${head}\n\n---\n\n${bodies.join("\n\n---\n\n")}` : head;
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
        if (params?.name === "get_work") {
          return reply({ content: [{ type: "text", text: await workText(root) }] });
        }
        if (params?.name === "mark_applied") {
          const ids = params?.arguments?.ids;
          if (ids !== undefined && !Array.isArray(ids)) throw new Error("ids must be a list of edit ids such as [\"c-0\"].");
          let saved;
          try {
            saved = JSON.parse(await readFile(join(root, CHANGES_FILE), "utf8"));
          } catch (error) {
            if (error.code === "ENOENT") return reply({ content: [{ type: "text", text: "No saved edits to mark." }] });
            throw new Error(`Could not read ${CHANGES_FILE}: ${error.message}`);
          }
          const changes = checkChanges(saved?.changes);
          if (!ids || !ids.length) {
            await rm(join(root, CHANGES_FILE), { force: true });
            await rm(join(root, SESSION_FILE), { force: true });
            return reply({ content: [{ type: "text", text: `Marked ${changes.length} edit${changes.length === 1 ? "" : "s"} applied. Cleared the saved edits and the canvas session.` }] });
          }
          for (const one of ids) {
            const at = typeof one === "string" && /^c-\d+$/.test(one) ? Number(one.slice(2)) : -1;
            if (at < 0 || at >= changes.length) throw new Error(`Unknown edit id ${JSON.stringify(one)}. get_work lists the ids still waiting.`);
          }
          const marked = new Set(ids);
          const left = changes.filter((_, at) => !marked.has(`c-${at}`));
          const page = checkPage(saved.page);
          if (!left.length) {
            await rm(join(root, CHANGES_FILE), { force: true });
            await rm(join(root, SESSION_FILE), { force: true });
            return reply({ content: [{ type: "text", text: `Marked ${changes.length} edits applied. Cleared the saved edits and the canvas session.` }] });
          }
          await store(root, CHANGES_FILE, { ...saved, changes: left, markdown: markdownFor(left, page) });
          const rest = left.map((_, at) => `c-${at}`).join(", ");
          return reply({ content: [{ type: "text", text: `Marked ${ids.length} applied. Still waiting: ${rest}.` }] });
        }
        if (params?.name === "place_preview") {
          const preview = await placePreview(params?.arguments, root);
          const queue = await readPreviewRequests(root);
          const left = queue.filter((entry) => entry.status === "pending");
          const more = left.length ? ` Still waiting: ${left.map((entry) => entry.instruction).join(" | ")}.` : "";
          const link = preview.requestId ? ` (paint ${preview.linked} of ${preview.needed} for "${preview.instruction}"${preview.reused ? ", reused without a duplicate" : ""})` : "";
          return reply({
            content: [{ type: "text", text: `Placed preview ${preview.id}${link}. It shows on the page: one preview keeps or discards on its own, and several waiting at once show a checkbox list with a Keep all button. Keep makes an edit of it (the agent reads it with get_work). The user decides on the page.${more}` }],
          });
        }
        if (params?.name === "place_variants") {
          const placed = await placeVariations(params?.arguments, root);
          const labels = placed.variations.map((variation, i) => `${i + 1}. ${variation.label}`).join("\n");
          return reply({
            content: [{ type: "text", text: `Placed ${placed.variations.length} variations. The user picks one with keys 1 to ${placed.variations.length}:\n\n${labels}` }],
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
