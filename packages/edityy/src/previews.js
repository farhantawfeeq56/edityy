/*
 * A chat-initiated preview: the agent paints a change on the live canvas only.
 *
 * The user types `edityy:: <instruction>` in the agent chat. The agent answers
 * by calling place_preview over MCP, and the page polls the previews endpoint
 * and paints it. Nothing here touches source files: a kept preview becomes an
 * ordinary Edityy edit, and the agent applies that edit to the code later.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { SaveError } from "./changes.js";
import { newId, readJson, store } from "./store.js";
import { checkDeclarations, checkPreviewText } from "./variations.js";

export const PREVIEWS_PATH = "/__edityy/previews";
export const PREVIEWS_FILE = ".edityy/previews.json";
export const PREVIEW_REQUEST_PATH = "/__edityy/preview-request";
export const PREVIEW_REQUEST_FILE = ".edityy/preview-request.json";
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
/** One paint can offer a pick: 1 to 10 labeled html options, one edit. */
const MIN_HTML_VARIATIONS = 1;
const MAX_HTML_VARIATIONS = 10;
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

/** A random preview id, so two agents never share one. */
export function newPreviewId() {
  return newId("e");
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
function checkHtmlVariations(variations) {
  if (!Array.isArray(variations) || variations.length < MIN_HTML_VARIATIONS || variations.length > MAX_HTML_VARIATIONS) {
    invalid(`variations must be a list of ${MIN_HTML_VARIATIONS} to ${MAX_HTML_VARIATIONS} html options`);
  }
  return variations.map((variation) => {
    if (!variation || typeof variation !== "object" || Array.isArray(variation)) invalid("each variation must be an object");
    if (typeof variation.label !== "string" || !variation.label.trim() || variation.label.length > 50) invalid("each variation label must be 1 to 50 characters");
    return { label: variation.label.trim(), html: checkPreviewHtml(variation.html) };
  });
}
  if (action === "insert") {
    out.anchor = placed.anchor === undefined || placed.anchor === null ? null : selector(placed.anchor, "anchor");
    // No position means the end of the anchor: the request's insert
    // parent fills the anchor in when the agent omits it.
    out.position = placed.position === undefined || placed.position === null ? "inside-end" : placed.position;
    if (!POSITIONS.includes(out.position)) invalid("position must be after, before, inside-start or inside-end");
    if (placed.variations !== undefined) {
      if (placed.html !== undefined) invalid("insert takes html or variations, not both");
      out.variations = checkHtmlVariations(placed.variations);
    } else {
      out.html = checkPreviewHtml(placed.html);
    }
  }
  if (action === "update") {
    out.selector = selector(placed.selector, "selector");
    const props = checkDeclarations(placed.props);
    const text = placed.text === undefined ? undefined : checkPreviewText(placed.text);
    const html = placed.html === undefined ? undefined : checkPreviewHtml(placed.html);
    const variations = placed.variations === undefined ? undefined : checkHtmlVariations(placed.variations);
    if (variations !== undefined && html !== undefined) invalid("update takes html or variations, not both");
    if (!props.length && text === undefined && html === undefined && variations === undefined) invalid("update must set a style, the text or the markup");
    out.props = props;
    if (text !== undefined) out.text = text;
    if (html !== undefined) out.html = html;
    if (variations !== undefined) out.variations = variations;
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

function fingerprint(checked) {
  const props = (list) =>
    [...(list ?? [])]
      .map((prop) => `${prop.on ?? ""}|${prop.when ?? ""}|${prop.property}=${prop.value}`)
      .sort()
      .join(";");
  const variations = (checked.variations ?? [])
    .map((variation) => `${variation.label}:${props(variation.props)}:${variation.text ?? ""}`)
    .join("|");
  const htmlVariations = (checked.variations ?? [])
    .map((variation) => `${variation.label}:${variation.html}`)
    .join("|");
  return JSON.stringify({
    instruction: checked.instruction,
    action: checked.action,
    anchor: checked.anchor ?? null,
    position: checked.position ?? null,
    selector: checked.selector ?? null,
    html: checked.html ?? null,
    props: props(checked.props),
    text: checked.text ?? null,
    variations,
    htmlVariations,
  });
}

/** How many options one paint offers: bundled variants count, a single paint counts one. */
function paintOptions(preview) {
  const targets = Array.isArray(preview.targets) ? preview.targets : [preview];
  return targets.reduce((n, target) => n + (Array.isArray(target.variations) && target.variations.length ? target.variations.length : 1), 0);
}

function linkedOptions(ids, items) {
  const byId = new Map((items ?? []).map((entry) => [entry?.id, entry]));
  return ids.reduce((n, id) => n + paintOptions(byId.get(id) ?? {}), 0);
}

/** Place a preview from the agent chat. It becomes the active one. Older ones stay in history. It also answers the pending comment-box request with the same words, when there is one. */
export async function placePreview(placed, root = process.cwd()) {
  const checked = checkPreview(placed);
  // A request the user withdrew is not answered: the page already took the
  // waiting strip away, and a late paint would fight the next request.
  // Only the ask with the same words is answered: a paint with other words
  // answers nothing, so it never clears the wrong card.
  const queue = await readPreviewRequests(root);
  const waiting = queue.find((entry) => entry.status === "pending" && entry.instruction === checked.instruction) || null;
  // A dragged Add-box names its spot: an insert with no anchor takes the
  // request's insert parent, so the paint lands where the user drew.
  // An anchor the agent sets wins: it overrides the drawn spot.
  const drawn = (waiting && waiting.region && typeof waiting.region.parent === "string" && waiting.region.parent) || null;
  if (drawn) {
    let moved = false;
    for (const target of checked.targets) {
      if (target.action === "insert" && !target.anchor) {
        target.anchor = drawn;
        if (!target.position) target.position = "inside-end";
        moved = true;
      }
    }
    if (moved && checked.targets[0]) Object.assign(checked, checked.targets[0]);
  }
  if (!waiting && queue.some((entry) => entry.status === "cancelled" && entry.instruction === checked.instruction)) {
    throw new Error("The user withdrew the preview request. Do not place it.");
  }
  const saved = (await readJson(join(root, PREVIEWS_FILE), null)) ?? { items: [] };
  const savedItems = Array.isArray(saved.items) ? saved.items : [];
  const actives = savedItems.filter((entry) => entry?.status === "active");
  const linkedEverywhere = new Set(queue.flatMap((entry) => entry.previewIds ?? []));
  const print = fingerprint(checked);
  // Retry safety: a paint whose link never landed stays active but unlinked.
  // The same call retries the same html, so reuse that orphan instead of a duplicate row.
  if (waiting) {
    const orphan = actives.find((entry) => entry.instruction === checked.instruction && !linkedEverywhere.has(entry.id) && fingerprint(entry) === print);
    if (orphan) {
      const fresh = await readPreviewRequests(root);
      const own = fresh.find((entry) => entry.id === waiting.id) ?? waiting;
      const ids = own.previewIds?.includes(orphan.id) ? [...own.previewIds] : [...(own.previewIds ?? []), orphan.id];
      own.previewIds = ids;
      own.previewId = ids[0];
      own.status = "answered";
      const at = fresh.findIndex((entry) => entry.id === own.id);
      if (at >= 0) fresh[at] = own;
      try {
        await store(root, PREVIEW_REQUEST_FILE, fresh);
      } catch (error) {
        throw new Error(`Paint ${orphan.id} is on the canvas but the link to request ${own.id} did not land (${error.code ?? "write failed"}). Retry the same place_preview call: it reuses ${orphan.id} without a duplicate.`);
      }
      return { ...orphan, requestId: own.id, linked: linkedOptions(ids, savedItems), needed: own.count || 1, reused: true };
    }
  }
  const id = newPreviewId();
  const preview = { ...checked, id, status: "active", createdAt: new Date().toISOString() };
  const items = [preview, ...(Array.isArray(saved.items) ? saved.items : []).filter((entry) => entry?.id !== id)];
  // Past previews stay listed, newest first, within the cap. An older one waits
  // with its own status, so more than one can be up for a decision at once.
  try {
    await store(root, PREVIEWS_FILE, { version: 1, active: latestNonDiscarded(items), items: items.slice(0, MAX_HISTORY + 1) });
  } catch (error) {
    throw new Error(`Paint ${id} did not land (${error.code ?? "write failed"}). Nothing is half-written: retry the same place_preview call.`);
  }
  // The comment-box request it answered waits no more: it stays on file as
  // answered, so the agent never paints the same ask twice. The first paint
  // whose words match a waiting ask answers that ask, so no other waiting
  // ask is consumed. A chat-initiated preview with no request file simply
  // has nothing to answer.
  if (waiting) {
    const fresh = await readPreviewRequests(root);
    const own = fresh.find((entry) => entry.id === waiting.id);
    if (!own) return { ...preview, requestId: null, linked: 0, needed: 0, reused: false };
    const ids = own.previewIds?.includes(id) ? [...own.previewIds] : [...(own.previewIds ?? []), id];
    // Adopt same-instruction orphans whose link never landed, oldest first,
    // so a partial write never leaves the count short forever.
    const live = [preview, ...actives].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
    const need = own.count || 1;
    for (const entry of live) {
      if (linkedOptions(ids, items) >= need) break;
      if (entry.instruction === checked.instruction && !ids.includes(entry.id) && entry.status === "active") ids.push(entry.id);
    }
    own.previewIds = ids;
    own.previewId = ids[0];
    own.status = "answered";
    const at = fresh.findIndex((entry) => entry.id === own.id);
    if (at >= 0) fresh[at] = own;
    try {
      await store(root, PREVIEW_REQUEST_FILE, fresh);
    } catch (error) {
      throw new Error(`Placed preview ${id} but the link to request ${own.id} did not land (${error.code ?? "write failed"}). The paint is on the canvas. Retry the same place_preview call: it reuses ${id} without a duplicate.`);
    }
    return { ...preview, requestId: own.id, linked: linkedOptions(ids, items), needed: own.count || 1, reused: false };
  }
  return { ...preview, requestId: null, linked: 0, needed: 0, reused: false };
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
      lines.push(`Anchor: ${target.anchor ? `\`${target.anchor}\`` : "end of main"}`, `Position: ${target.position}`);
      if (Array.isArray(target.variations) && target.variations.length) {
        target.variations.forEach((variation, i) => lines.push("", `## Option ${i + 1}: ${variation.label}`, "", variation.html));
      } else {
        lines.push("", target.html);
      }
    }
    if (target.action === "update") {
      for (const prop of target.props) lines.push(`- \`${prop.property}\`: \`${prop.value}\``);
      if (target.text !== undefined) lines.push(`- Text: ${JSON.stringify(target.text)}`);
      if (target.html !== undefined) lines.push("", target.html);
      if (Array.isArray(target.variations) && target.variations.length) {
        target.variations.forEach((variation, i) => lines.push("", `## Option ${i + 1}: ${variation.label}`, "", variation.html));
      }
    }
  }
  lines.push("", "Apply this to the source in the way the project already styles things, then tell the user it is in.");
  return lines.join("\n");
}

/* ---------------------------------------------------------- preview request */

// One comment-box ask: a request is pending, withdrawn or answered.
const REQUEST_STATUS = ["pending", "cancelled", "answered"];
/** A dragged box lives in document pixels, at most a long page. */
const MAX_COORD = 100000;
function coord(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_COORD) invalid(`${name} must be a whole number from 0 to ${MAX_COORD}`);
  return value;
}
/** A drawn Add-box: where it is, and what sits under it, so the agent can place there. */
function checkRegion(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) invalid("region must be an object");
  const out = {
    left: coord(source.left, "region left"),
    top: coord(source.top, "region top"),
    width: coord(source.width, "region width"),
    height: coord(source.height, "region height"),
  };
  if (source.mark !== undefined && source.mark !== null) out.mark = coord(source.mark, "region mark");
  for (const key of ["viewportW", "viewportH", "viewTop"]) {
    if (source[key] !== undefined && source[key] !== null) out[key] = coord(source[key], `region ${key}`);
  }
  if (source.pctLeft !== undefined && source.pctLeft !== null) {
    if (typeof source.pctLeft !== "number" || !(source.pctLeft >= 0) || source.pctLeft > 100) invalid("region pctLeft must be 0 to 100");
    out.pctLeft = Math.round(source.pctLeft * 10) / 10;
  }
  for (const key of ["center", "parent"]) {
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] !== "string" || !source[key].trim() || source[key].length > MAX_SELECTOR) {
        invalid(`region ${key} must be 1 to ${MAX_SELECTOR} characters`);
      }
      out[key] = source[key].trim();
    }
  }
  return out;
}
const STRICT_PROPERTY = /^-?[a-z][a-z0-9-]{0,99}$/;
const VALUE = /[;{}\u0000-\u001f]|url\s*\(|expression\s*\(|@import|!important|\/\*/i;
const MAX_VALUES = 16;
const MAX_CONTEXT = 4000;

/** A comment-box preview request: an instruction and an optional element. */
export function checkPreviewRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) invalid("expected an object");
  if (typeof request.id !== "string" || !ID.test(request.id)) invalid("id is invalid");
  if (typeof request.instruction !== "string" || !request.instruction.trim() || request.instruction.length > MAX_INSTRUCTION) {
    invalid(`instruction must be 1 to ${MAX_INSTRUCTION} characters`);
  }
  const instruction = request.instruction.trim();
  let element = null;
  if (request.element) {
    const source = request.element;
    if (typeof source !== "object" || Array.isArray(source)) invalid("element must be an object");
    if (typeof source.tag !== "string" || !/^[a-z][a-z0-9-]{0,49}$/.test(source.tag)) invalid("element tag is invalid");
    if (typeof source.selector !== "string" || !source.selector.trim() || source.selector.length > MAX_SELECTOR) {
      invalid(`selector must be 1 to ${MAX_SELECTOR} characters`);
    }
    if (!Array.isArray(source.values) || source.values.length > MAX_VALUES) invalid(`element values must contain at most ${MAX_VALUES} entries`);
    let size = source.tag.length + source.selector.length + instruction.length;
    const values = source.values.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid("each current value must be an object");
      if (typeof entry.property !== "string" || !STRICT_PROPERTY.test(entry.property)) invalid("current property is invalid");
      if (typeof entry.value !== "string" || entry.value.length > 120 || VALUE.test(entry.value)) invalid("current value is invalid");
      size += entry.property.length + entry.value.length;
      return { property: entry.property, value: entry.value };
    });
    if (size > MAX_CONTEXT) invalid("element context is too large");
    element = { tag: source.tag, selector: source.selector, values };
  }
  const count = request.count === undefined ? 1 : request.count;
  if (!Number.isInteger(count) || count < 1 || count > 10) invalid("count must be a whole number from 1 to 10");
  const status = request.status === undefined ? "pending" : request.status;
  if (!REQUEST_STATUS.includes(status)) invalid("status is invalid");
  const out = { id: request.id, instruction, element, count, status };
  if (request.region !== undefined && request.region !== null) out.region = checkRegion(request.region);
  else out.region = null;
  if (request.previewId !== undefined) {
    if (typeof request.previewId !== "string" || !ID.test(request.previewId)) invalid("previewId is invalid");
    out.previewId = request.previewId;
  }
  if (request.previewIds !== undefined) {
    if (!Array.isArray(request.previewIds)) invalid("previewIds is invalid");
    out.previewIds = [];
    for (const pid of request.previewIds) {
      if (typeof pid !== "string" || !ID.test(pid)) invalid("previewId is invalid");
      if (!out.previewIds.includes(pid)) out.previewIds.push(pid);
    }
  }
  return out;
}

/** The page writes a preview request; it waits for place_preview. Several can wait at once. */
export async function writePreviewRequest(request, root = process.cwd()) {
  const checked = checkPreviewRequest(request);
  checked.status = "pending";
  const items = await readPreviewRequests(root);
  const at = items.findIndex((entry) => entry.id === checked.id);
  if (at >= 0) items[at] = checked;
  else items.push(checked);
  await store(root, PREVIEW_REQUEST_FILE, items);
  return checked;
}

/** Every preview request on file, oldest first. A legacy single object reads as one. */
export async function readPreviewRequests(root = process.cwd()) {
  const saved = await readJson(join(root, PREVIEW_REQUEST_FILE), null);
  if (!saved) return [];
  const rows = Array.isArray(saved) ? saved : [saved];
  const out = [];
  for (const row of rows) {
    try {
      out.push(checkPreviewRequest(row));
    } catch {
      // a row that is not a request is not worth keeping
    }
  }
  return out;
}

/** The request as the agent reads it, or null when there is none. */
export async function readPreviewRequest(root = process.cwd()) {
  const items = await readPreviewRequests(root);
  if (!items.length) return null;
  // The agent reads the oldest one still waiting. When none waits, the
  // newest one on file says whether the last ask was withdrawn or answered.
  return items.find((entry) => entry.status === "pending") || items[items.length - 1];
}

/** Every preview request still waiting, oldest first. */
export async function readPendingPreviewRequests(root = process.cwd()) {
  return (await readPreviewRequests(root)).filter((entry) => entry?.status === "pending");
}

/** The user withdrew a pending request, with one id or all of them, so no agent answers it late. */
export async function clearPreviewRequest(root = process.cwd(), id = null) {
  const items = await readPreviewRequests(root);
  if (!items.length) return;
  let touched = false;
  items.forEach((entry) => {
    if ((id === null && entry.status === "pending") || (id !== null && entry.id === id && entry.status !== "cancelled")) {
      entry.status = "cancelled";
      touched = true;
    }
  });
  // With no id and nothing still waiting, the last ask on file is the one
  // withdrawn: the agent can then tell a withdrawal from a request that
  // was never made or was answered. Without that, a queue that only holds
  // answered requests would look like no request at all.
  if (id === null && !items.some((entry) => entry.status === "pending")) {
    const last = items[items.length - 1];
    if (last && last.status !== "cancelled") {
      last.status = "cancelled";
      touched = true;
    }
  }
  if (touched) await store(root, PREVIEW_REQUEST_FILE, items);
}

/** One preview request as text for the agent: what to paint on the canvas. */
export function previewRequestText(request) {
  const lines = [`# Preview request from Edityy`, "", `Request: ${request.id}`, `Instruction: ${JSON.stringify(request.instruction)}`];
  const count = request.count > 1 ? request.count : 1;
  if (count > 1) lines.push(`Variants the user asked for: ${count}`);
  if (request.element) {
    lines.push("", `Element: <${request.element.tag}> at ${request.element.selector}`, "", "Current values:");
    for (const entry of request.element.values) lines.push(`- ${entry.property}: ${entry.value}`);
  }
  if (request.region) {
    const box = request.region;
    lines.push("", `Location: region${box.mark ? ` mark ${box.mark}` : ""} at (${box.left}, ${box.top}), ${box.width}x${box.height}px.`);
    if (box.pctLeft !== undefined || box.viewTop !== undefined) {
      const view = box.viewportW ? ` (viewport ${box.viewportW}x${box.viewportH ?? "?"})` : "";
      lines.push(`Annotation at: ${box.pctLeft !== undefined ? `${box.pctLeft}% from left` : "unknown from left"}, ${box.viewTop !== undefined ? `${box.viewTop}px from top` : "unknown from top"}${view}.`);
    }
    if (box.center) lines.push(`Center: \`${box.center}\`.${box.parent ? ` Insert parent: \`${box.parent}\`.` : ""}`);
    else if (box.parent) lines.push(`Insert parent: \`${box.parent}\`.`);
    if (box.parent) {
      lines.push(`Suggested anchor: \`${box.parent}\`, suggested position: \`inside-end\`.`);
      lines.push("Omit anchor to paint at the drawn spot. Set another anchor only when the words name a different place.");
    } else {
      lines.push("Insert the new markup at the end of main, or ask where when the words name no place.");
    }
  }
  lines.push(
    "",
    "Paint this on the live canvas only with place_preview, or many at once with targets. Do not edit files.",
    "The canvas is temporary: experiment freely within these constraints. Nothing here touches source files, and a wrong paint costs one Discard. Paint boldly instead of asking the user to choose: infer anchors and links from the page's own ids and routes, paint, and name your assumption.",
    "The preview shows on the page with Keep and Discard; Keep saves it as a normal Edityy edit for the agent to write into the source. Edityy itself changes only the live page. If no anchor exists at all, say so instead of guessing."
  );
  if (count > 1) {
    lines.push("", `Place all ${count} variants in ONE place_preview call: one ask is one edit with ${count} options to pick from.`);
    lines.push(`A styles target takes \`variations\` of CSS; an insert or update target takes \`variations\` of html, each with a short label. The first paint answers the ask, even with fewer options: waiting, then options ready, then kept or discarded.`);
    lines.push(`Retrying the same call reuses the existing paint instead of a duplicate row.`);
  }
  return lines.join("\n");
}
