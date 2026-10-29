/*
 * A variation request: one element, a number of variations, an optional comment
 * from the user, and the declarations that come back from the coding agent.
 *
 * The page writes the request, the agent reads it over MCP and answers with
 * declarations, and the page reads the answer back. Everything the two sides
 * exchange is checked here, because neither the page nor the agent is trusted:
 * only plain standard properties with plain values pass, so nothing that comes
 * back can carry a rule, a selector or a script.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MEDIA, STATE, SaveError } from "./changes.js";

export const VARIATIONS_PATH = "/__edityy/variations";
export const VARIATION_REQUEST_FILE = ".edityy/variation-request.json";
const VARIATION_RESPONSE_FILE = ".edityy/variation-response.json";
const ID = /^[\w-]{1,80}$/;
/** A request is waiting for an answer, or the user took it back. */
const STATUS = ["pending", "cancelled"];
/** A standard property: no custom property, no vendor-free-anything, no selector. */
const PROPERTY = /^-?[a-z][a-z0-9-]{0,99}$/;
/** A value with no rule, no block, no function that reaches the network, no bang. */
const VALUE = /[;{}\u0000-\u001f]|url\s*\(|expression\s*\(|@import|!important|\/\*/i;
const MIN_VARIATIONS = 2;
const MAX_VARIATIONS = 10;
const MAX_PROPERTIES = 12;
/** The comment is optional, so an empty one is a request too. */
const MAX_COMMENT = 240;
/** The element context the page sends: its own short list of current values. */
const MAX_VALUES = 16;
/** The limit of the element context, in characters. The page sends under 3k. */
const MAX_CONTEXT = 4000;

function invalid(message) {
  throw new SaveError(400, `Invalid variation data: ${message}.`);
}

/** Plain words for an element, or nothing when the answer leaves the text alone. */
const MAX_TEXT = 2000;
export function checkPreviewText(text) {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT) invalid("text must be 1 to 2000 characters");
  return text;
}

/** Plain CSS declarations, with no rule, no selector and no script in them. */
export function checkDeclarations(declarations) {
  if (declarations === undefined) return [];
  if (!Array.isArray(declarations) || declarations.length > MAX_PROPERTIES) invalid(`props must contain at most ${MAX_PROPERTIES} entries`);
  const seen = new Set();
  return declarations.map((declaration) => {
    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) invalid("each declaration must be an object");
    const property = declaration.property;
    const value = declaration.value;
    if (typeof property !== "string" || !PROPERTY.test(property) || property.startsWith("--")) invalid("property must be a standard CSS property name");
    // A state, a pseudo-element or a breakpoint lives in a rule of its own, so
    // each one is checked here before the page draws it.
    const on = declaration.on;
    if (on !== undefined && (typeof on !== "string" || !STATE.test(on))) {
      invalid("on must be a state or pseudo-element, such as :hover or ::before");
    }
    const when = declaration.when;
    if (when !== undefined && (typeof when !== "string" || !MEDIA.test(when))) {
      invalid("when must be a media condition, such as (max-width: 640px)");
    }
    // The same property can appear twice: on the element, and on its hover.
    const key = `${on || ""}|${when || ""}|${property}`;
    if (seen.has(key)) invalid("a declaration cannot repeat a property");
    seen.add(key);
    if (typeof value !== "string" || !value.trim() || value.length > 160 || VALUE.test(value)) invalid("property value is invalid");
    const out = { property, value: value.trim() };
    if (on) out.on = on;
    if (when) out.when = when;
    return out;
  });
}

export function checkVariationRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) invalid("expected an object");
  if (typeof request.id !== "string" || !ID.test(request.id)) invalid("id is invalid");
  const count = request.count;
  if (!Number.isInteger(count) || count < MIN_VARIATIONS || count > MAX_VARIATIONS) {
    invalid(`count must be a whole number from ${MIN_VARIATIONS} to ${MAX_VARIATIONS}`);
  }
  if (request.prompt !== undefined && typeof request.prompt !== "string") invalid("prompt must be a string");
  const prompt = (request.prompt || "").trim();
  if (prompt.length > MAX_COMMENT) invalid(`prompt must be at most ${MAX_COMMENT} characters`);
  const element = request.element;
  if (!element || typeof element !== "object" || Array.isArray(element)) invalid("element is missing");
  if (typeof element.tag !== "string" || !/^[a-z][a-z0-9-]{0,49}$/.test(element.tag)) invalid("element tag is invalid");
  if (typeof element.selector !== "string" || !element.selector.trim() || element.selector.length > 200) invalid("selector must be 1 to 200 characters");
  if (!Array.isArray(element.values) || element.values.length > MAX_VALUES) invalid(`element values must contain at most ${MAX_VALUES} entries`);
  let contextSize = element.tag.length + element.selector.length + prompt.length;
  const values = element.values.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid("each current value must be an object");
    if (typeof entry.property !== "string" || !PROPERTY.test(entry.property)) invalid("current property is invalid");
    if (typeof entry.value !== "string" || entry.value.length > 120 || VALUE.test(entry.value)) invalid("current value is invalid");
    contextSize += entry.property.length + entry.value.length;
    return { property: entry.property, value: entry.value };
  });
  if (contextSize > MAX_CONTEXT) invalid("element context is too large");
  const status = request.status === undefined ? "pending" : request.status;
  if (!STATUS.includes(status)) invalid("status is invalid");
  return { id: request.id, count: count, prompt: prompt, element: { tag: element.tag, selector: element.selector, values }, status };
}

export function checkVariations(response, expectedId, count) {
  if (!response || typeof response !== "object" || Array.isArray(response)) invalid("expected an object");
  if (response.requestId !== expectedId) {
    // The user asked again while the agent was working. The new number and the
    // new id are in the message, so the agent can answer it in one step.
    invalid(
      `the request changed: the user now asks for ${count || MIN_VARIATIONS} variations, requestId ${expectedId}. Read the request again and answer with that id`
    );
  }
  // The user chose the number before asking, so an answer of another size is
  // not the answer they asked for. More is not a failure: the first ones are
  // the ones they see. Fewer is a failure, and the message says so.
  const asked = count || MIN_VARIATIONS;
  const most = count || MAX_VARIATIONS;
  if (!Array.isArray(response.variations)) invalid(`variations must be a list of ${asked} entries`);
  if (count) {
    if (response.variations.length < asked) invalid(`the user asked for ${asked} variations; you sent ${response.variations.length}`);
  } else if (response.variations.length < MIN_VARIATIONS || response.variations.length > MAX_VARIATIONS) {
    invalid(`variations must contain ${MIN_VARIATIONS} to ${MAX_VARIATIONS} entries`);
  }
  const variations = (count ? response.variations.slice(0, most) : response.variations).map((variation) => {
    if (!variation || typeof variation !== "object" || Array.isArray(variation)) invalid("each variation must be an object");
    if (typeof variation.label !== "string" || !variation.label.trim() || variation.label.length > 50) invalid("each label must be 1 to 50 characters");
    const props = checkDeclarations(variation.props);
    const text = variation.text === undefined ? undefined : checkPreviewText(variation.text);
    if (!props.length && text === undefined) invalid("each variation must set a style or the text");
    const out = { label: variation.label.trim(), props };
    if (text !== undefined) out.text = text;
    return out;
  });
  return { requestId: expectedId, variations };
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

export async function writeVariationRequest(request, root = process.cwd()) {
  const checked = checkVariationRequest(request);
  // The page can only make a request that waits for an answer.
  checked.status = "pending";
  await store(root, VARIATION_REQUEST_FILE, checked);
  await rm(join(root, VARIATION_RESPONSE_FILE), { force: true });
  return checked;
}

export async function readVariationRequest(root = process.cwd()) {
  const request = await readJson(join(root, VARIATION_REQUEST_FILE), null);
  return request ? checkVariationRequest(request) : null;
}

export async function placeVariations(response, root = process.cwd()) {
  const request = await readVariationRequest(root);
  if (!request) throw new Error("There is no pending variation request.");
  if (request.status === "cancelled") throw new Error("The user withdrew the request. Do not answer it.");
  const checked = checkVariations(response, request.id, request.count);
  await store(root, VARIATION_RESPONSE_FILE, checked);
  return checked;
}

export async function readVariationResponse(id, root = process.cwd()) {
  const response = await readJson(join(root, VARIATION_RESPONSE_FILE), null);
  if (!response || response.requestId !== id) return null;
  return checkVariations(response, id);
}

/**
 * The user took the request back, so no agent answers it late.
 *
 * The request is kept, marked as cancelled, and the answer to it is dropped.
 * The agent can then tell a withdrawal from a request that was never made.
 */
export async function clearVariations(root = process.cwd()) {
  const path = join(root, VARIATION_REQUEST_FILE);
  let request = null;
  try {
    request = checkVariationRequest(JSON.parse(await readFile(path, "utf8")));
  } catch {
    request = null; // a file that is not a request is not worth keeping
  }
  if (request) await store(root, VARIATION_REQUEST_FILE, { ...request, status: "cancelled" });
  else await rm(path, { force: true });
  await rm(join(root, VARIATION_RESPONSE_FILE), { force: true });
}



/** The pending request as text for the agent: about 800 characters. */
export function requestText(request) {
  const values = request.element.values.map((v) => `${v.property}: ${v.value}`).join("; ");
  const asked = request.prompt
    ? `The user selected one element and wrote: ${JSON.stringify(request.prompt)}`
    : "The user selected one element and wrote no comment: they gave no direction, so cover styles that differ from each other.";
  return [
    "# Variation request from Edityy",
    "",
    `The user typed \`vartest\` in their agent. ${asked}`,
    "",
    `- Element: \`${request.element.selector}\` (a \`${request.element.tag}\`)`,
    `- Current values: ${values ? "`" + values + "`" : "none read"}`,
    `- Variations the user asked for: ${request.count}`,
    "",
    "Answer with the declarations only, then call place_variations:",
    "",
    `1. Make exactly ${request.count} variations, each with a short label of two or three words. If you send more, the first ones are the ones the user sees.`,
    "2. The user may have told you in their own message what they want. Follow",
    "   that when they did: the comment above is only part of what they asked for.",
    "3. Use plain standard CSS properties and plain values, or set the words with `text`.",
    "4. A state, a pseudo-element or a breakpoint is a rule: set `on` to `:hover` or",
    "   `::before`, or set `when` to a media condition such as `(max-width: 640px)`.",
    "   Leave both out for the element's own style.",
    "5. `::before` and `::after` need a `content` value to show at all.",
    "6. No custom properties, at-rules other than a media condition in `when`,",
    "   `!important`, or `url()`.",
    "7. Call place_variations with the requestId below and the variations.",
    "",
    `requestId: \`${request.id}\``,
    "",
    "The user sees each variation on the live element, keys 1 to 9 pick one and 0",
    "picks the tenth, and the one they keep becomes a normal edit for this project.",
    "A state or a breakpoint shows only when the user hovers it or narrows the window.",
  ].join("\n");
}
