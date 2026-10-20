/*
 * A variation request: one element, one sentence from the user, and the few
 * declarations that come back from the coding agent.
 *
 * The page writes the request, the agent reads it over MCP and answers with
 * declarations, and the page reads the answer back. Everything the two sides
 * exchange is checked here, because neither the page nor the agent is trusted:
 * only plain standard properties with plain values pass, so nothing that comes
 * back can carry a rule, a selector or a script.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SaveError } from "./changes.js";

export const VARIATIONS_PATH = "/__edityy/variations";
export const VARIATION_REQUEST_FILE = ".edityy/variation-request.json";
const VARIATION_RESPONSE_FILE = ".edityy/variation-response.json";
const ID = /^[\w-]{1,80}$/;
/** A standard property: no custom property, no vendor-free-anything, no selector. */
const PROPERTY = /^-?[a-z][a-z0-9-]{0,99}$/;
/** A value with no rule, no block, no function that reaches the network, no bang. */
const VALUE = /[;{}\u0000-\u001f]|url\s*\(|expression\s*\(|@import|!important|\/\*/i;
const MAX_VARIATIONS = 5;
const MAX_PROPERTIES = 12;
/** The limit of the element context, in characters. The page sends under 3k. */
const MAX_CONTEXT = 4000;

function invalid(message) {
  throw new SaveError(400, `Invalid variation data: ${message}.`);
}

export function checkVariationRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) invalid("expected an object");
  if (typeof request.id !== "string" || !ID.test(request.id)) invalid("id is invalid");
  if (typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > 240) invalid("prompt must be 1 to 240 characters");
  const element = request.element;
  if (!element || typeof element !== "object" || Array.isArray(element)) invalid("element is missing");
  if (typeof element.tag !== "string" || !/^[a-z][a-z0-9-]{0,49}$/.test(element.tag)) invalid("element tag is invalid");
  if (typeof element.selector !== "string" || !element.selector.trim() || element.selector.length > 200) invalid("selector must be 1 to 200 characters");
  if (!Array.isArray(element.values) || element.values.length > MAX_PROPERTIES) invalid(`element values must contain at most ${MAX_PROPERTIES} entries`);
  let contextSize = element.tag.length + element.selector.length + request.prompt.length;
  const values = element.values.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid("each current value must be an object");
    if (typeof entry.property !== "string" || !PROPERTY.test(entry.property)) invalid("current property is invalid");
    if (typeof entry.value !== "string" || entry.value.length > 120 || VALUE.test(entry.value)) invalid("current value is invalid");
    contextSize += entry.property.length + entry.value.length;
    return { property: entry.property, value: entry.value };
  });
  if (contextSize > MAX_CONTEXT) invalid("element context is too large");
  return { id: request.id, prompt: request.prompt.trim(), element: { tag: element.tag, selector: element.selector, values } };
}

export function checkVariations(response, expectedId) {
  if (!response || typeof response !== "object" || Array.isArray(response)) invalid("expected an object");
  if (response.requestId !== expectedId) invalid("request id does not match");
  if (!Array.isArray(response.variations) || response.variations.length < 2 || response.variations.length > MAX_VARIATIONS) {
    invalid(`variations must contain 2 to ${MAX_VARIATIONS} entries`);
  }
  const variations = response.variations.map((variation) => {
    if (!variation || typeof variation !== "object" || Array.isArray(variation)) invalid("each variation must be an object");
    if (typeof variation.label !== "string" || !variation.label.trim() || variation.label.length > 50) invalid("each label must be 1 to 50 characters");
    if (!Array.isArray(variation.props) || variation.props.length < 1 || variation.props.length > MAX_PROPERTIES) invalid(`each variation must have 1 to ${MAX_PROPERTIES} properties`);
    const seen = new Set();
    const props = variation.props.map((declaration) => {
      if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) invalid("each declaration must be an object");
      const property = declaration.property;
      const value = declaration.value;
      if (typeof property !== "string" || !PROPERTY.test(property) || property.startsWith("--")) invalid("property must be a standard CSS property name");
      if (seen.has(property)) invalid("a variation cannot repeat a property");
      seen.add(property);
      if (typeof value !== "string" || !value.trim() || value.length > 160 || VALUE.test(value)) invalid("property value is invalid");
      return { property, value: value.trim() };
    });
    return { label: variation.label.trim(), props };
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
  const checked = checkVariations(response, request.id);
  await store(root, VARIATION_RESPONSE_FILE, checked);
  return checked;
}

export async function readVariationResponse(id, root = process.cwd()) {
  const response = await readJson(join(root, VARIATION_RESPONSE_FILE), null);
  if (!response || response.requestId !== id) return null;
  return checkVariations(response, id);
}

/** Forget the request and any answer to it. */
export async function clearVariations(root = process.cwd()) {
  await rm(join(root, VARIATION_REQUEST_FILE), { force: true });
  await rm(join(root, VARIATION_RESPONSE_FILE), { force: true });
}

/** The pending request as text for the agent: about 800 characters. */
export function requestText(request) {
  const values = request.element.values.map((v) => `${v.property}: ${v.value}`).join("; ");
  return [
    "# Variation request from Edityy",
    "",
    `The user selected one element and asked for: ${JSON.stringify(request.prompt)}`,
    "",
    `- Element: \`${request.element.selector}\` (a \`${request.element.tag}\`)`,
    `- Current values: ${values ? "`" + values + "`" : "none read"}`,
    "",
    "Answer with the declarations only, then call place_variations:",
    "",
    "1. Make 2 to 5 variations. Give each one a short label of two or three words.",
    "2. In each variation, use plain standard CSS properties and plain values.",
    "3. Do not use custom properties, pseudo-elements, hover or other states,",
    "   at-rules, media queries, `!important`, or `url()`.",
    "4. Call place_variations with the requestId below and the variations.",
    "",
    `requestId: \`${request.id}\``,
    "",
    "The user sees each variation on the live element, keys 1 to 5 switch between",
    "them, and the one they keep becomes a normal edit for this project.",
  ].join("\n");
}
