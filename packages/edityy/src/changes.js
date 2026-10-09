/*
 * The saved edit list: what the save endpoint accepts, and the Markdown a coding
 * agent reads. Internal — index.js and mcp.js share it, and it is not exported.
 *
 * The browser sends the edits, and an agent is told to apply them to the code.
 * So nothing the browser sends reaches the agent unchecked: each change is cut
 * down to the fields below, with their types and lengths checked, and the
 * Markdown is made here from those fields — never taken from the request.
 */

/** Limits on one saved edit list. Edits are short text; these are generous. */
const MAX_CHANGES = 500;
const MAX_PROPS = 100;
const MAX_SHORT = 2000;
const MAX_TEXT = 20000;
/** A font family name as Google Fonts writes it: "Lora", "M PLUS 1p", "Noto Sans JP". */
const FAMILY = /^[\p{L}\p{N}][\p{L}\p{N} .'&-]*$/u;
/** A CSS property name, custom properties included. */
const PROPERTY = /^(?:--[\w-]+|-?[a-z][a-z0-9-]*)$/;
/** An HTML tag name: what an added element is. */
const TAG = /^[a-z][a-z0-9-]*$/;

/** An error that knows the status it should answer with. */
export class SaveError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const invalid = (why) => new SaveError(400, `Invalid edit: ${why}.`);

/** A string field: missing is `fallback`, anything else must be a short enough string. */
function str(value, name, max, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw invalid(`${name} must be a string`);
  if (value.length > max) throw invalid(`${name} is too long`);
  return value;
}

/**
 * The changes, cut down to the fields an agent needs, or a 400 SaveError.
 *
 * Each change is `{ label, selector, source, props, text, added, removed, moved }`,
 * the shape the launcher sends. A prop is `{ prop, before, after }`, and a
 * `font-family` prop has `googleFont` when the user picked a Google font.
 * `added` is `{ tag, style, wraps }` for an element the user added: its tag,
 * the inline style it was made with, and the selectors of the elements it was
 * put around.
 */
export function checkChanges(changes) {
  if (!Array.isArray(changes)) throw new SaveError(400, "Expected a JSON object with a changes array.");
  if (changes.length > MAX_CHANGES) throw invalid(`more than ${MAX_CHANGES} changes`);
  return changes.map((change) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) throw invalid("each change must be an object");
    const props = change.props ?? [];
    if (!Array.isArray(props)) throw invalid("props must be an array");
    if (props.length > MAX_PROPS) throw invalid(`more than ${MAX_PROPS} props`);
    let text = null;
    if (change.text !== undefined && change.text !== null) {
      if (typeof change.text !== "object") throw invalid("text must be an object");
      text = { before: str(change.text.before, "text.before", MAX_TEXT), after: str(change.text.after, "text.after", MAX_TEXT) };
    }
    return {
      label: str(change.label, "label", MAX_SHORT),
      selector: str(change.selector, "selector", MAX_SHORT),
      source: str(change.source, "source", MAX_SHORT, null),
      props: props.map((p) => {
        if (!p || typeof p !== "object") throw invalid("each prop must be an object");
        const prop = str(p.prop, "prop", 200);
        if (!PROPERTY.test(prop)) throw invalid("prop must be a CSS property name");
        const out = { prop, before: str(p.before, "before", MAX_SHORT), after: str(p.after, "after", MAX_SHORT) };
        const googleFont = str(p.googleFont, "googleFont", 200, null);
        if (googleFont !== null) {
          if (prop !== "font-family" || !FAMILY.test(googleFont)) throw invalid("googleFont must be a font family on font-family");
          out.googleFont = googleFont;
        }
        return out;
      }),
      text,
      added: checkAdded(change.added),
      removed: change.removed === true,
      moved: change.moved === true,
      movedTo: str(change.movedTo, "movedTo", MAX_SHORT, null),
    };
  });
}

/** An added element, or null when the change did not add one. */
function checkAdded(added) {
  if (added === undefined || added === null) return null;
  if (typeof added !== "object" || Array.isArray(added)) throw invalid("added must be an object");
  const tag = str(added.tag, "added.tag", 100);
  if (!TAG.test(tag)) throw invalid("added.tag must be a tag name");
  const wraps = added.wraps ?? [];
  if (!Array.isArray(wraps)) throw invalid("added.wraps must be an array");
  if (wraps.length > MAX_PROPS) throw invalid(`more than ${MAX_PROPS} wrapped elements`);
  return {
    tag,
    style: str(added.style, "added.style", MAX_SHORT),
    wraps: wraps.map((selector) => str(selector, "added.wraps", MAX_SHORT)),
  };
}

/** The page the edits were made on, when it is an http(s) URL; null otherwise. */
export function checkPage(page) {
  if (typeof page !== "string" || page.length > MAX_SHORT) return null;
  try {
    const url = new URL(page);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** One line: a value can never start a new Markdown line, heading or list. */
const line = (value) => String(value).replace(/[\r\n\u2028\u2029]+/g, " ");

/** A Markdown code span that a backtick inside the value cannot close. */
function code(value) {
  const text = line(value);
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return fence + pad + text + pad + fence;
}

/**
 * The checked changes as Markdown for a coding agent: the same layout the
 * launcher copies, with every value from the page in a code span or quoted.
 */
export function markdownFor(changes, page) {
  if (!changes.length) return "";
  const out = [
    "# Visual edits from Edityy",
    "",
    "Apply these edits to the source code" + (page ? " of " + code(page) : "") + ". " +
      "Change the code that renders each element, in the styling approach the project already uses " +
      "(CSS, CSS modules, Tailwind classes, styled components), not with inline styles.",
    "",
  ];
  changes.forEach((change, i) => {
    out.push(`## ${i + 1}. ${code(change.label || change.selector || "element")}`, "");
    if (change.selector) out.push(`- Selector: ${code(change.selector)}`);
    if (change.source) out.push(`- Source: ${code(change.source)}`);
    for (const p of change.props) {
      out.push(`- ${code(p.prop)}: ${code(p.before || "unset")} → ${code(p.after || "unset")}`);
      if (p.googleFont) {
        out.push(`- Font: ${code(p.googleFont)} is a Google font that the project does not load. ` +
          "Add it to the project the way the project loads its fonts, then use it in `font-family`.");
      }
    }
    if (change.added) {
      out.push(`- Added: a new ${code(change.added.tag)}` + (change.added.style ? ` with ${code(change.added.style)}` : ""));
      if (change.added.wraps.length) out.push(`- Wraps: ${change.added.wraps.map(code).join(", ")}`);
    }
    if (change.text) out.push(`- Text: ${line(JSON.stringify(change.text.before))} → ${line(JSON.stringify(change.text.after))}`);
    if (change.removed) out.push("- Removed: this element");
    if (change.moved) out.push(`- Moved to: ${code(change.movedTo || "a new position")}`);
    out.push("");
  });
  return out.join("\n");
}
