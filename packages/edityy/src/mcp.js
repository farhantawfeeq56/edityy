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
 * previews.js). This serves all of them through five tools: one read
 * (get_work) that returns every edit and every ask in one go, oldest first,
 * two placers (place_variants answers a variants ask, place_preview answers
 * a preview ask: the user picks one on the card, the kept pick arrives as
 * a saved edit, and the agent carries it into the source), mark_applied
 * once the code holds an edit, and clear_all to empty the canvas.
 *
 * MCP over stdio is newline-delimited JSON-RPC 2.0, and this server needs four
 * methods of it, so it is written out here rather than pulled in as an SDK: the
 * package keeps its zero dependencies.
 */
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { checkChanges, checkPage, markdownFor } from "./changes.js";
import { CHANGES_FILE, clearCanvas } from "./index.js";
import { clearSessionFor } from "./session.js";
import { lintPreviewHtml, placePreview, previewRequestText, previewText, readPendingPreviews, readPreviewRequests } from "./previews.js";
import { store, writeAppliedAt } from "./store.js";
import { DECLARATION_SCHEMA, placeVariations, readVariationRequests, requestText } from "./variations.js";

const VERSION = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
/**
 * The MCP versions this server speaks, newest first. A client that asks for one
 * of them gets it; any other gets the newest, as the spec says.
 */
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
// Every ask moves Sent to Select to Ready. A variants ask is answered with
// place_variants, a preview ask with place_preview: the user picks one on
// the card, the kept pick arrives as a saved edit, and the agent carries it
// into the source code.

const TOOLS = [
  {
    name: "get_work",
    description:
      "Read the saved visual edits plus every ask, oldest first. Call it once per turn, before any other " +
      "Edityy tool. Each edit has an id such as c-1: apply it to the source, then call mark_applied. " +
      "Answer a variants ask with place_variants and a preview ask with place_preview. " +
      "Pass {summary: true} for headers only, or {id} for one item.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "One edit id such as c-1, or one ask id. Answers that item only." },
        summary: { type: "boolean", description: "Headers only, no ask bodies." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "mark_applied",
    description:
      "Mark saved edits applied once the code holds them, so they are not applied twice. " +
      "Pass the edit ids get_work returned, such as [\"c-1\", \"c-2\"]. Pass {\"all\": true} to mark every saved edit. " +
      "That also clears the canvas session, and tells the open page to adopt the paint instead of reverting it, so the change shows with no refresh.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "The edit ids that are in the code now." },
        all: { type: "boolean", description: "Mark every saved edit. Ignores ids." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "clear_all",
    description:
      "Remove every Edityy edit, ask, paint and saved handoff from the project files. " +
      "The open page drops what it holds too, so a removed edit never comes back. " +
      "Use when the user asks to remove or clear all edits. Nothing is kept: apply first what must stay in the code.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "place_preview",
    description:
      "Paint a preview ask on the live page, not in the code. Quote the instruction get_work returned: " +
      "a waiting ask with those words is answered. One ask takes one call: all its options go in it. " +
      "styles restyles one element and takes a selector plus variations of declarations. " +
      "insert adds near an anchor (after, before, inside-start or inside-end): omit anchor to accept the ask's suggested spot, or to go at the end of main. " +
      "It takes html for one option, or 1 to 10 labeled variations of html for a pick. " +
      "update changes one element by selector, with styles, text, markup, or 1 to 10 labeled variations of markup. " +
      "remove takes away one element by selector. " +
      "The user picks one on the card: the kept paint arrives as a saved edit, and you carry it into the source code (read it back with get_work).",
    inputSchema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "The change the user asked for, quoted." },
        action: { type: "string", description: "One of styles, insert, update or remove." },
        selector: { type: "string", description: "The element to change, for styles, update and remove." },
        anchor: { type: "string", description: "The element the insert goes by; omit to accept the ask's suggested spot, or to go at the end of main." },
        position: { type: "string", description: "For insert: after, before, inside-start or inside-end; inside-end when untold." },
        html: { type: "string", description: "For insert and update: the markup." },
        text: { type: "string", description: "Optional: plain words for styles and update." },
        props: { type: "array", items: DECLARATION_SCHEMA },
        variations: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words the user will see." },
              html: { type: "string", description: "The markup for this option." },
              props: { type: "array", items: DECLARATION_SCHEMA },
              text: { type: "string", description: "Optional: plain words for this option." },
            },
            required: ["label"],
            additionalProperties: false,
          },
        },
        targets: { type: "array", minItems: 1, maxItems: 100, description: "Many elements in one preview, each with its own action, selector or anchor, and payload." },
      },
      required: ["instruction"],
      additionalProperties: false,
    },
  },
  {
    name: "place_variants",
    description:
      "Answer a pending variants ask. Takes exactly the asked number of variations, each a short label and " +
      "a list of declarations, plain words, or markup with inline elements, plus one name of one or two words " +
      "(such as Hero or Pricing cards) for the element: the popped card shows that name. The user picks one on the popped card, and each pick paints live on the element: the kept pick " +
      "arrives as a saved edit, and you carry it into the source code (read it back with get_work).",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "The requestId get_work returned." },
        name: { type: "string", description: "One or two words naming the element, such as Hero. Shows on the popped card." },
        variations: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Two or three words the user will see." },
              props: { type: "array", items: DECLARATION_SCHEMA },
              text: { type: "string", description: "Optional: plain words that replace the element's own words." },
              html: { type: "string", description: "Optional: markup that replaces the element's inner content, with inline elements." },
            },
            required: ["label"],
            additionalProperties: false,
          },
        },
      },
      required: ["requestId", "variations"],
      additionalProperties: false,
    },
  },
];

/** A full read that no longer fits one message: ask again for one item. */
const MAX_WORK_CHARS = 20000;

/**
 * Every saved edit and every ask as text for the agent, plus the same list
 * as data for the client.
 *
 * Edits carry ids of the form `c-1`: the agent applies them to the code and
 * marks them with mark_applied. Asks carry their kind, id and status: the
 * agent answers a pending variants ask with place_variants, and writes every
 * preview ask directly into the source. The Markdown is made here from
 * the checked changes. A `markdown` field in the file is never passed on: the
 * agent applies what it reads to the code.
 *
 * Pass {summary: true} for headers only, or {id} for one edit or ask. Past
 * MAX_WORK_CHARS the full read stops at the headers and says so, instead of
 * flooding the turn: the agent then reads one item at a time.
 */
async function buildWork(root, opts = {}) {
  const { id, summary } = opts;
  if (id !== undefined && typeof id !== "string") throw new Error("id must be an edit id such as \"c-1\" or an ask id.");
  if (summary !== undefined && typeof summary !== "boolean") throw new Error("summary must be true for headers only.");
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
  const [variationRequests, previewRequests, pendingPreviews] = await Promise.all([
    readVariationRequests(root),
    readPreviewRequests(root),
    readPendingPreviews(root),
  ]);
  const pendingVariations = variationRequests.filter((entry) => entry.status === "pending");
  const pendingPreviewRequests = previewRequests.filter((entry) => entry.status === "pending");
  const pending = [
    ...pendingVariations.map((entry) => ({ kind: "variants", entry, body: requestText(entry) })),
    ...pendingPreviewRequests.map((entry) => ({ kind: "preview-request", entry, body: previewRequestText(entry) })),
    ...[...pendingPreviews].reverse().map((entry) => ({ kind: "preview", entry, body: previewText(entry) })),
  ];
  const structured = {
    edits: changes.map((change, at) => ({ id: `c-${at + 1}`, selector: change.selector || change.label || "" })),
    asks: pending.map(({ kind, entry }) => ({ kind, id: entry.id, status: entry.status || (kind === "preview" ? "active" : "pending") })),
    summary: summary === true,
    truncated: false,
  };
  // One edit only.
  if (id && /^c-\d+$/.test(id)) {
    const at = Number(id.slice(2)) - 1;
    if (at < 0 || at >= changes.length) throw new Error(`Unknown edit id ${JSON.stringify(id)}. get_work lists the ids still waiting.`);
    const text = `# Work from Edityy (one item)\n\n${markdownFor([changes[at]], page).replace(/^## 1\./m, `## ${id}.`)}`;
    return { text, structured: { ...structured, edits: [{ id, selector: changes[at].selector || changes[at].label || "" }], asks: [] } };
  }
  // One ask only.
  if (id) {
    const found = pending.find(({ entry }) => entry.id === id);
    if (!found) {
      const known = variationRequests.concat(previewRequests).find((entry) => entry.id === id);
      if (known?.status === "cancelled") throw new Error("The user withdrew the last ask. Do not answer it.");
      const valid = [...structured.edits.map((edit) => edit.id), ...structured.asks.map((ask) => ask.id)];
      throw new Error(`Unknown id ${JSON.stringify(id)}.${valid.length ? ` Waiting: ${valid.join(", ")}.` : " get_work lists nothing."}`);
    }
    const text = `# Work from Edityy (one item)\n\n- [${found.kind}] ${found.entry.id}\n\n---\n\n${found.body}`;
    return { text, structured: { ...structured, edits: [], asks: [{ kind: found.kind, id: found.entry.id, status: found.entry.status || "pending" }] } };
  }
  const out = ["# Work from Edityy", "", "Call get_work once per turn. It holds every saved edit and every ask, oldest first.", "", "Answer a variants ask with place_variants and a preview ask with place_preview: the user picks one on the card. The kept pick arrives as a saved edit to carry into the source code."];
  out.push("", `## Edits (${changes.length})`);
  if (!changes.length) {
    out.push("No saved edits. In the browser, open Edityy's edits list and approve an edit with the tick.");
  } else {
    out.push("Apply each edit to the source code, then call mark_applied with its id.", "");
    // The headers and the ids number from 1, like the canvas marks.
    let next = 0;
    const at = saved.savedAt && !Number.isNaN(Date.parse(saved.savedAt)) ? `Saved at ${saved.savedAt}` : null;
    const from = page ? ` from ${page}` : "";
    out.push(`${at ? at + from + ".\n\n" : ""}${markdownFor(changes, page).replace(/^## \d+\./gm, () => `## c-${++next}.`)}`);
  }
  const count = pending.length;
  const askLine = ({ kind, entry }) =>
    kind === "variants"
      ? `- [variants] ${entry.id} (pending): ${entry.count} variations of \`${entry.element.selector}\``
      : kind === "preview-request"
        ? `- [preview-request] ${entry.id} (pending): ${JSON.stringify(entry.instruction)}`
        : `- [preview] ${entry.id} (active): ${JSON.stringify(entry.instruction)}`;
  // Past the limit the full read stops at an index: one line per edit and
  // ask, so the agent can read one item at a time with {"id"}.
  const compact = (size) => {
    const note = `Too much to list in one read (${size} chars). Call get_work with {"id"} for one edit or ask, or {"summary": true} for headers only.`;
    return {
      text: [
        "# Work from Edityy",
        "",
        `## Edits (${changes.length})`,
        ...structured.edits.map((edit) => `- ${edit.id}: \`${edit.selector}\``),
        "",
        `## Asks (${count}), oldest first`,
        ...pending.map(askLine),
        "",
        note,
      ].join("\n"),
      structured: { ...structured, truncated: true },
    };
  };
  out.push("", `## Asks (${count}), oldest first`);
  if (!count) {
    const lastVariation = variationRequests[variationRequests.length - 1];
    const lastPreview = previewRequests[previewRequests.length - 1];
    if (lastVariation?.status === "cancelled" || lastPreview?.status === "cancelled") {
      out.push("The user withdrew the last ask. Do not answer it. If they ask again, a new ask will appear.");
    } else if (lastVariation?.status === "answered" || lastPreview?.status === "answered") {
      out.push("The last ask is already answered. If the user asks again, a new ask will appear.");
    } else {
      out.push("No pending asks. In the browser, set more than one variation in the comment box and press an element, or write a comment with \"Ask the agent to preview\" ticked.");
    }
    const text = out.join("\n");
    if (text.length > MAX_WORK_CHARS) return compact(text.length);
    return { text, structured };
  }
  for (const item of pending) out.push(askLine(item));
  const head = out.join("\n");
  if (summary === true) return { text: `${head}\n\nPass an ask id to get_work for its body: {\"id\": \"${pending[0].entry.id}\"}.`, structured };
  const full = `${head}\n\n---\n\n${pending.map(({ body }) => body).join("\n\n---\n\n")}`;
  if (full.length > MAX_WORK_CHARS) return compact(full.length);
  return { text: full, structured };
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
          const args = params?.arguments ?? {};
          const { text, structured } = await buildWork(root, args);
          return reply({ content: [{ type: "text", text }], structuredContent: structured });
        }
        if (params?.name === "mark_applied") {
          const args = params?.arguments ?? {};
          const ids = args.ids;
          const all = args.all;
          if (all !== undefined && typeof all !== "boolean") throw new Error("all must be true to mark every saved edit.");
          if (ids !== undefined && !Array.isArray(ids)) throw new Error("ids must be a list of edit ids such as [\"c-1\"].");
          let saved;
          try {
            saved = JSON.parse(await readFile(join(root, CHANGES_FILE), "utf8"));
          } catch (error) {
            if (error.code === "ENOENT") return reply({ content: [{ type: "text", text: "No saved edits to mark." }] });
            throw new Error(`Could not read ${CHANGES_FILE}: ${error.message}`);
          }
          const changes = checkChanges(saved?.changes);
          // The session belongs to one page path: only drop it when the
          // applied edits came from that page. A null page clears, as before.
          const sessionPath = (page) => {
            if (!page) return null;
            try {
              return new URL(page).pathname || "/";
            } catch {
              return null;
            }
          };
          if (all === true) {
            await rm(join(root, CHANGES_FILE), { force: true });
            await clearSessionFor(sessionPath(saved.page), root);
            await writeAppliedAt(root);
            return reply({ content: [{ type: "text", text: `Marked ${changes.length} edit${changes.length === 1 ? "" : "s"} applied. Cleared the saved edits and the canvas session. The page keeps the paint, so no refresh is needed.` }] });
          }
          if (!ids || !ids.length) throw new Error("Pass the edit ids get_work returned, or {\"all\": true} to mark every saved edit.");
          for (const one of ids) {
            const at = typeof one === "string" && /^c-\d+$/.test(one) ? Number(one.slice(2)) - 1 : -1;
            if (at < 0 || at >= changes.length) throw new Error(`Unknown edit id ${JSON.stringify(one)}. get_work lists the ids still waiting.`);
          }
          const marked = new Set(ids);
          const left = changes.filter((_, at) => !marked.has(`c-${at + 1}`));
          const page = checkPage(saved.page);
          if (!left.length) {
            await rm(join(root, CHANGES_FILE), { force: true });
            await clearSessionFor(sessionPath(saved.page), root);
            await writeAppliedAt(root);
            return reply({ content: [{ type: "text", text: `Marked ${changes.length} edits applied. Cleared the saved edits and the canvas session. The page keeps the paint, so no refresh is needed.` }] });
          }
          await store(root, CHANGES_FILE, { ...saved, changes: left, markdown: markdownFor(left, page) });
          const rest = left.map((_, at) => `c-${at + 1}`).join(", ");
          return reply({ content: [{ type: "text", text: `Marked ${ids.length} applied. Still waiting: ${rest}.` }] });
        }
        if (params?.name === "place_preview") {
          const args = params?.arguments ?? {};
          const placed = await placePreview(args, root);
          const options = (placed.targets ?? [placed]).reduce((n, target) => n + (Array.isArray(target.variations) && target.variations.length ? target.variations.length : 1), 0);
          const raws = Array.isArray(args.targets) ? args.targets : [args];
          const warnings = [...new Set(raws.flatMap((target) => lintPreviewHtml(typeof target?.html === "string" ? target.html : "")))];
          const lines = [
            `Placed preview ${placed.id}${placed.requestId ? ` for ask ${placed.requestId}` : ""} (${placed.linked} of ${placed.needed} options linked).`,
            "The user picks one on the card with the number keys: each pick paints live on the page. The kept paint arrives as a saved edit: read it back with get_work and carry it into the source code.",
          ];
          if (options > 1) lines.push(`Options: ${options}.`);
          if (warnings.length) lines.push("", "Design warnings (fix what applies before the user decides):", ...warnings.map((warning) => `- ${warning}`));
          return reply({ content: [{ type: "text", text: lines.join("\n") }] });
        }
        if (params?.name === "clear_all") {
          const cleared = await clearCanvas(root);
          const n = Object.values(cleared.removed).reduce((a, b) => a + b, 0);
          const parts = Object.entries(cleared.removed).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
          return reply({
            content: [{ type: "text", text: n ? `Cleared ${n} row${n === 1 ? "" : "s"} (${parts.join(", ")}). The canvas is empty; get_work lists nothing.` : "Nothing to clear: the canvas is already empty." }],
          });
        }
        if (params?.name === "place_variants") {
          const placed = await placeVariations(params?.arguments, root);
          const labels = placed.variations.map((variation, i) => `${i + 1}. ${variation.label}`).join("\n");
          return reply({
            content: [{ type: "text", text: `Placed ${placed.variations.length} variations${placed.name ? ` as "${placed.name}"` : ""}. The user picks one on the popped card with keys 1 to ${placed.variations.length}: each pick paints live on the element. The kept pick arrives as a saved edit: read it back with get_work and carry it into the source code.\n\n${labels}` }],
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
