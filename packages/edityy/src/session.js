/*
 * The canvas session: the edits that are on the page right now, the comments,
 * the numbered marks and the regions the user drew.
 *
 * The page posts this after every change, so a reload, a closed tab or a
 * restarted dev server finds the same canvas. The agent clears it with
 * clear_visual_changes once the changes are in the code. The file is
 * `.edityy/session.json`, beside the saved edit list.
 *
 * Nothing here is trusted: every field is checked and cut down, because the
 * file is read back into a page and written by a browser.
 */
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { SaveError } from "./changes.js";
import { readClearedAt, store } from "./store.js";

export const SESSION_PATH = "/__edityy/session";
export const SESSION_FILE = ".edityy/session.json";

/** Limits. A canvas holds far fewer entries than a whole site. */
const MAX_EDITS = 500;
const MAX_REGIONS = 100;
const MAX_SHORT = 4000;
const MAX_VALUE = 2000;
/** A property name, custom properties included. */
const PROPERTY = /^(?:--[\w-]+|-?[a-z][a-z0-9-]*)$/;
/** A page the session belongs to: a pathname, no origin and no query. */
const PATH = /^\/[\w\-./~%!$&'()*+,;=:@]*$/;

const invalid = (why) => new SaveError(400, `Invalid session: ${why}.`);

function str(value, name, max = MAX_SHORT) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw invalid(`${name} must be a string`);
  if (value.length > max) throw invalid(`${name} is too long`);
  return value;
}

function count(value, name, max) {
  if (!Number.isFinite(value)) throw invalid(`${name} must be a number`);
  if (value < 0 || value > max) throw invalid(`${name} is out of range`);
  return Math.round(value);
}

/** The pathname the session belongs to, or "/" when it has none. */
export function checkSessionPath(path) {
  if (path === undefined || path === null || path === "") return "/";
  if (typeof path !== "string" || path.length > 2000) throw invalid("path must be a page path");
  const cut = path.split(/[?#]/)[0];
  if (!PATH.test(cut)) throw invalid("path must be a page path");
  return cut;
}

/** One inline value: what it was, whether it was set, and what it is now. */
function checkProp(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${name} must be an object`);
  return {
    before: str(value.before, `${name}.before`, MAX_VALUE),
    set: value.set === true,
    was: str(value.was, `${name}.was`, MAX_VALUE),
    now: str(value.now, `${name}.now`, MAX_VALUE),
  };
}

function checkEdit(edit, i) {
  if (!edit || typeof edit !== "object" || Array.isArray(edit)) throw invalid(`edits[${i}] must be an object`);
  const props = edit.props ?? {};
  if (typeof props !== "object" || Array.isArray(props)) throw invalid(`edits[${i}].props must be an object`);
  const kept = {};
  Object.keys(props).forEach((prop) => {
    if (!PROPERTY.test(prop)) throw invalid(`edits[${i}].props has a property name that is not one`);
    kept[prop] = checkProp(props[prop], `edits[${i}].props.${prop}`);
  });
  const text = edit.text && typeof edit.text === "object" && !Array.isArray(edit.text)
    ? { before: str(edit.text.before, `edits[${i}].text.before`), after: str(edit.text.after, `edits[${i}].text.after`) }
    : null;
  return {
    selector: str(edit.selector, `edits[${i}].selector`),
    props: kept,
    text,
    comment: str(edit.comment, `edits[${i}].comment`, MAX_VALUE) || null,
    added: Array.isArray(edit.added) ? edit.added.slice(0, 100).map((key) => str(key, `edits[${i}].added`, 200)) : [],
    googleFont: str(edit.googleFont, `edits[${i}].googleFont`, 200) || null,
    moved: edit.moved === true,
    origin: ["Comment", "Agent", "Canvas session"].includes(edit.origin) ? edit.origin : null,
    mark: Math.max(0, count(edit.mark ?? 0, `edits[${i}].mark`, 100000)),
  };
}

function checkRegion(region, i) {
  if (!region || typeof region !== "object" || Array.isArray(region)) throw invalid(`regions[${i}] must be an object`);
  return {
    left: count(region.left, `regions[${i}].left`, 1000000),
    top: count(region.top, `regions[${i}].top`, 1000000),
    width: count(region.width, `regions[${i}].width`, 1000000),
    height: count(region.height, `regions[${i}].height`, 1000000),
    comment: str(region.comment, `regions[${i}].comment`, MAX_VALUE) || null,
    mark: Math.max(0, count(region.mark ?? 0, `regions[${i}].mark`, 100000)),
    addN: region.addN == null ? null : count(region.addN, `regions[${i}].addN`, 100000),
    confirmed: region.confirmed === true,
  };
}

/** The session as it is kept, or a 400 SaveError. */
export function checkSession(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalid("expected a JSON object with a path, edits and regions");
  }
  const edits = payload.edits ?? [];
  const regions = payload.regions ?? [];
  if (!Array.isArray(edits)) throw invalid("edits must be an array");
  if (!Array.isArray(regions)) throw invalid("regions must be an array");
  if (edits.length > MAX_EDITS) throw invalid(`more than ${MAX_EDITS} edits`);
  if (regions.length > MAX_REGIONS) throw invalid(`more than ${MAX_REGIONS} regions`);
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    // The clear marker the keeping page had honored, or "" from an older page.
    honored: typeof payload.honored === "string" ? payload.honored.slice(0, 200) : "",
    path: checkSessionPath(payload.path),
    edits: edits.map(checkEdit),
    regions: regions.map(checkRegion),
    markTop: Math.max(0, count(payload.markTop ?? 0, "markTop", 100000)),
  };
}

async function write(record, root) {
  await store(root, SESSION_FILE, record);
  return SESSION_FILE;
}

/** Keep the canvas the page just sent. */
export async function writeSession(payload, root = process.cwd()) {
  const record = checkSession(payload);
  // A keep that left before the agent cleared must not recreate the canvas
  // after the delete: it carries the marker it had honored, or none at all.
  const clearedAt = await readClearedAt(root);
  if (clearedAt && (record.honored || "") < clearedAt) {
    throw new SaveError(409, "The canvas was cleared after this state was kept. Read the asks queue and honor the clear, then keep again.");
  }
  return write(record, root);
}

/**
 * The canvas for one page, or null.
 *
 * A session is for the path it was made on: another page must not wear the
 * edits of the one before it.
 */
export async function readSession(path, root = process.cwd()) {
  let saved;
  try {
    saved = JSON.parse(await readFile(join(root, SESSION_FILE), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const record = checkSession(saved);
  return record.path === checkSessionPath(path) ? record : null;
}

/** Forget the canvas: the edits are in the code, or the user left the mode. */
export async function clearSession(root = process.cwd()) {
  await rm(join(root, SESSION_FILE), { force: true });
}
