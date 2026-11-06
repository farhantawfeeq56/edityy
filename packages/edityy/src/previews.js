/*
 * A chat-initiated preview: the agent paints a change on the live canvas only.
 *
 * The user types `edityy:: <instruction>` in the agent chat. The agent answers
 * by calling place_preview over MCP, and the page polls the previews endpoint
 * and paints it. Nothing here touches source files: a kept preview becomes an
 * ordinary Edityy edit, and the agent applies that edit to the code later.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SaveError } from "./changes.js";
import { checkDeclarations, checkPreviewText } from "./variations.js";

export const PREVIEWS_PATH = "/__edityy/previews";
const PREVIEWS_FILE = ".edityy/previews.json";
const ID = /^[\w-]{1,80}$/;
/** What the preview does: restyle, add, change or take away. */
const ACTIONS = ["styles", "insert", "update", "remove"];
/** Where an insert lands by the anchor, or the end of main with no anchor. */
const POSITIONS = ["after", "before", "inside-start", "inside-end"];
/** A selector, an anchor or an id: short text that names an element. */
const MAX_SELECTOR = 200;
/** The instruction the user typed, as the agent quotes it. */
const MAX_INSTRUCTION = 500;
/** Inserted markup. */
const MAX_HTML = 50000;
/** How many past previews the file keeps. */
const MAX_HISTORY = 20;
/** How many elements one preview can paint, and how many looks one styles element can hold. */
const MAX_TARGETS = 100;
const MAX_STYLES_VARIATIONS = 100;
/** Strict-inline JS: inline script + on* allowed, network/storage blocked. */
const BANNED_JS = /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|document\.cookie|\beval\s*\(|new\s+Function|importScripts|document\.write\b|window\.location|document\.location|location\s*=(?!=)|location\.href/i;
/** A URL that runs code instead of showing content. */
const DANGEROUS_URL = /^\s*((javascript|vbscript)\s*:|data\s*:\s*(text\/html|application\/javascript|application\/xhtml\+xml))/i;
const EXTERNAL_URL = /^\s*(https?:\/\/|\/\/)/i;

function invalid(message) {
  throw new SaveError(400, `Invalid preview data: ${message}.`);
}

function selector(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_SELECTOR) invalid(`${name} must be 1 to ${MAX_SELECTOR} characters`);
  return value;
}

/** Inserted markup: strict-inline JS only, no network in script. */
export function checkPreviewHtml(html) {
  if (typeof html !== "string" || !html.trim() || html.length > MAX_HTML) invalid(`html must be 1 to ${MAX_HTML} characters`);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const body of scripts) {
    if (BANNED_JS.test(body)) invalid("html cannot use network or storage in script");
  }
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  for (const body of styles) {
    if (/@import/i.test(body)) invalid("html cannot use @import in style");
  }
  const tags = html.match(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g) || [];
  for (const tag of tags) {
    const name = tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/)[1].toLowerCase();
    if (/^<\//.test(tag)) continue;
    const inside = tag.replace(/^<[a-zA-Z][a-zA-Z0-9-]*/, "").replace(/\/?>$/, "");
    const attrs = inside.match(/[a-zA-Z:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g) || [];
    for (const attr of attrs) {
      const eq = attr.indexOf("=");
      const key = (eq === -1 ? attr : attr.slice(0, eq)).trim().toLowerCase();
      const raw = eq === -1 ? "" : attr.slice(eq + 1).trim();
      const value = raw.replace(/^("|')|("|')$/g, "");
      if (name === "script" && key === "src") invalid("html cannot use script src");
      if (key.startsWith("on") && BANNED_JS.test(value)) invalid("html cannot use network or storage in event handler");
      if (["href", "src", "action", "formaction", "xlink:href", "poster", "data"].includes(key) && DANGEROUS_URL.test(value)) invalid("html links cannot run code");
      if ((key === "action" || key === "formaction") && EXTERNAL_URL.test(value)) invalid("html forms cannot post to another site");
      if (name === "iframe" && key === "srcdoc" && /<script|javascript\s*:/i.test(value)) invalid("html cannot put script in iframe");
    }
  }
  return html;
}

/** A random preview id: `e-` plus time and chance, so two agents never share one. */
export function newPreviewId() {
  return `e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * What the agent places: an instruction, an action and its payload.
 *
 * The id is made here, not taken: an agent that names its own id could shadow
 * another preview. Status and time are made here too.
 */
/** One element of a preview: its action and its own payload. */
function checkTarget(placed) {
  if (!placed || typeof placed !== "object" || Array.isArray(placed)) invalid("each target must be an object");
  const action = placed.action;
  if (!ACTIONS.includes(action)) invalid("action must be styles, insert, update or remove");
  const out = { action };
  if (action === "styles") {
    out.selector = selector(placed.selector, "selector");
    if (!Array.isArray(placed.variations) || placed.variations.length < 1 || placed.variations.length > MAX_STYLES_VARIATIONS) {
      invalid(`styles needs 1 to ${MAX_STYLES_VARIATIONS} variations`);
    }
    out.variations = placed.variations.map((variation) => {
      if (!variation || typeof variation !== "object" || Array.isArray(variation)) invalid("each variation must be an object");
      if (typeof variation.label !== "string" || !variation.label.trim() || variation.label.length > 50) invalid("each label must be 1 to 50 characters");
      const props = checkDeclarations(variation.props);
      const text = variation.text === undefined ? undefined : checkPreviewText(variation.text);
      if (!props.length && text === undefined) invalid("each variation must set a style or the text");
      const checked = { label: variation.label.trim(), props };
      if (text !== undefined) checked.text = text;
      return checked;
    });
  }
  if (action === "insert") {
    out.anchor = placed.anchor === undefined || placed.anchor === null ? null : selector(placed.anchor, "anchor");
    if (!POSITIONS.includes(placed.position)) invalid("position must be after, before, inside-start or inside-end");
    out.position = placed.position;
    out.html = checkPreviewHtml(placed.html);
  }
  if (action === "update") {
    out.selector = selector(placed.selector, "selector");
    const props = checkDeclarations(placed.props);
    const text = placed.text === undefined ? undefined : checkPreviewText(placed.text);
    const html = placed.html === undefined ? undefined : checkPreviewHtml(placed.html);
    if (!props.length && text === undefined && html === undefined) invalid("update must set a style, the text or the markup");
    out.props = props;
    if (text !== undefined) out.text = text;
    if (html !== undefined) out.html = html;
  }
  if (action === "remove") {
    out.selector = selector(placed.selector, "selector");
  }
  return out;
}

export function checkPreview(placed) {
  if (!placed || typeof placed !== "object" || Array.isArray(placed)) invalid("expected an object");
  if (typeof placed.instruction !== "string" || !placed.instruction.trim() || placed.instruction.length > MAX_INSTRUCTION) {
    invalid(`instruction must be 1 to ${MAX_INSTRUCTION} characters`);
  }
  // Many elements at once, or the old single-action call: both land as
  // `targets`, and the top level keeps the first target for old readers.
  let targets;
  if (placed.targets !== undefined) {
    if (!Array.isArray(placed.targets) || !placed.targets.length || placed.targets.length > MAX_TARGETS) {
      invalid(`targets must be a list of 1 to ${MAX_TARGETS} elements`);
    }
    targets = placed.targets.map(checkTarget);
  } else {
    targets = [checkTarget(placed)];
  }
  return { instruction: placed.instruction.trim(), ...targets[0], targets };
}

/** The newest preview the page or the agent still reads: not discarded yet. */
function latestNonDiscarded(items) {
  for (const item of items) if (item && item.status !== "discarded") return item.id;
  return null;
}

async function readJson(path, missing) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return missing;
    throw error;
  }
}

async function store(root, file, value) {
  const dir = join(root, ".edityy");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".gitignore"), "*\n");
  const path = join(root, file);
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, path);
}

/** The file as the page reads it: the active preview and the past ones. */
export async function readPreviews(root = process.cwd()) {
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  if (!saved || typeof saved !== "object") return { active: null, history: [] };
  const items = Array.isArray(saved.items) ? saved.items : [];
  const history = [];
  for (const item of items) {
    try {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !ID.test(item.id)) continue;
      history.push({ id: item.id, instruction: String(item.instruction || ""), action: item.action, status: item.status, createdAt: item.createdAt });
    } catch {
      continue; // a row that is not a preview is not worth keeping
    }
  }
  const active = typeof saved.active === "string" && history.some((item) => item.id === saved.active) ? saved.active : null;
  return { active, history };
}

/** The active preview in full, or null when there is none. */
export async function readActivePreview(root = process.cwd()) {
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  if (!saved || typeof saved.active !== "string") return null;
  const item = (Array.isArray(saved.items) ? saved.items : []).find((entry) => entry?.id === saved.active);
  if (!item || item.status === "discarded") return null;
  return item;
}

/** Every preview still up for a decision, newest first, in full. */
export async function readPendingPreviews(root = process.cwd()) {
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  return (Array.isArray(saved?.items) ? saved.items : []).filter((item) => item?.status === "active");
}

/** One preview in full by its id, or null when there is none. */
export async function readPreview(id, root = process.cwd()) {
  if (typeof id !== "string" || !ID.test(id)) return null;
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  const item = (Array.isArray(saved?.items) ? saved.items : []).find((entry) => entry?.id === id);
  return item ?? null;
}

/** Place a preview from the agent chat. It becomes the active one. Older ones stay in history. */
export async function placePreview(placed, root = process.cwd()) {
  const checked = checkPreview(placed);
  const id = newPreviewId();
  const preview = { ...checked, id, status: "active", createdAt: new Date().toISOString() };
  const saved = (await readJson(join(root, PREVIEWS_FILE), null)) ?? { items: [] };
  const items = [preview, ...(Array.isArray(saved.items) ? saved.items : []).filter((entry) => entry?.id !== id)];
  // Past previews stay listed, newest first, within the cap. An older one waits
  // with its own status, so more than one can be up for a decision at once.
  await store(root, PREVIEWS_FILE, { version: 1, active: latestNonDiscarded(items), items: items.slice(0, MAX_HISTORY + 1) });
  return preview;
}

/** The user kept or dropped a preview, on the page or in the chat. */
export async function decidePreview(id, decision, root = process.cwd()) {
  if (typeof id !== "string" || !ID.test(id)) throw new Error("Unknown preview id.");
  if (decision !== "keep" && decision !== "discard") throw new Error("Decide keep or discard.");
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  const items = Array.isArray(saved?.items) ? saved.items : [];
  const item = items.find((entry) => entry?.id === id);
  if (!item) throw new Error("Unknown preview id.");
  item.status = decision === "keep" ? "kept" : "discarded";
  await store(root, PREVIEWS_FILE, { version: 1, active: latestNonDiscarded(items), items });
  return item;
}

/**
 * A batch of decisions at once, from the page's checkbox list: each kept one
 * stays readable for the agent, each other one leaves. Decided previews are
 * left as they are, so a race between two rounds is harmless.
 */
export async function decidePreviews(decisions, root = process.cwd()) {
  if (!Array.isArray(decisions)) throw new Error("Expected a list of decisions.");
  const saved = await readJson(join(root, PREVIEWS_FILE), null);
  const items = Array.isArray(saved?.items) ? saved.items : [];
  const decided = [];
  for (const one of decisions) {
    const id = one?.id;
    if (typeof id !== "string" || !ID.test(id) || (one.keep !== true && one.keep !== false)) continue;
    const item = items.find((entry) => entry?.id === id);
    if (!item || item.status !== "active") continue;
    item.status = one.keep ? "kept" : "discarded";
    decided.push({ id: item.id, status: item.status });
  }
  await store(root, PREVIEWS_FILE, { version: 1, active: latestNonDiscarded(items), items });
  return decided;
}

/** Forget every preview. The page drops what it was showing. */
export async function clearPreviews(root = process.cwd()) {
  await rm(join(root, PREVIEWS_FILE), { force: true });
}

/** One preview as text for the agent: what to change in the source. */
export function previewText(preview) {
  const targets = Array.isArray(preview.targets) ? preview.targets : [preview];
  const lines = [`# Preview ${preview.id} from Edityy`, "", `Instruction: ${JSON.stringify(preview.instruction)}`, `Action: ${preview.action}`, `Status: ${preview.status}`];
  for (const target of targets) {
    if (target.selector) lines.push(`Target: \`${target.selector}\``);
    if (target.action === "styles") {
      for (const variation of target.variations) {
        lines.push("", `## ${variation.label}`);
        for (const prop of variation.props) {
          lines.push(`- \`${prop.property}\`${prop.on ? ` on \`${prop.on}\`` : ""}${prop.when ? ` in \`@media ${prop.when}\`` : ""}: \`${prop.value}\``);
        }
        if (variation.text !== undefined) lines.push(`- Text: ${JSON.stringify(variation.text)}`);
      }
    }
    if (target.action === "insert") {
      lines.push(`Anchor: ${target.anchor ? `\`${target.anchor}\`` : "end of main"}`, `Position: ${target.position}`, "", target.html);
    }
    if (target.action === "update") {
      for (const prop of target.props) lines.push(`- \`${prop.property}\`: \`${prop.value}\``);
      if (target.text !== undefined) lines.push(`- Text: ${JSON.stringify(target.text)}`);
      if (target.html !== undefined) lines.push("", target.html);
    }
  }
  lines.push("", "Apply this to the source in the way the project already styles things, then tell the user it is in.");
  return lines.join("\n");
}
