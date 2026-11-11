import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SaveError, checkChanges, checkPage, markdownFor } from "./changes.js";
import { PREVIEWS_FILE, PREVIEWS_PATH, PREVIEW_REQUEST_FILE, PREVIEW_REQUEST_PATH, clearPreviews, clearPreviewRequest, decidePreview, decidePreviews, readPendingPreviews, readPreviewRequests, writePreviewRequest } from "./previews.js";
import { SESSION_FILE, SESSION_PATH, clearSession, readSession, writeSession } from "./session.js";
import { readClearedAt, readJson, runNode, runRoute, sameSite, store, writeClearedAt } from "./store.js";
import { VARIATION_REQUEST_FILE, VARIATION_RESPONSE_FILE, VARIATIONS_PATH, clearVariations, readVariationRequests, readVariationResponse, readVariationResponses, writeVariationRequest } from "./variations.js";

/** The previews endpoint path, answered by previewsFromNode and previewsRoute. */
export { PREVIEWS_PATH };
/** The comment-box preview request endpoint path. */
export { PREVIEW_REQUEST_PATH };
/** The session endpoint path, answered by sessionFromNode and sessionRoute. */
export { SESSION_PATH };
/** The file the canvas session is kept in, beside the saved edit list. */
export { SESSION_FILE } from "./session.js";

/** Where the page polls every ask at once, and what the MCP getter reads. */
export const ASKS_PATH = "/__edityy/asks";

/**
 * The launcher payload, read once at import.
 *
 * Read by its path on disk. Do not resolve it with `new URL` against
 * `import.meta.url`: a bundler reads that form as an asset. In a Next.js route,
 * webpack makes it a public `/_next/…` URL, and the read throws when the route
 * loads.
 */
export const launcher = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "edityy.js"), "utf8");

/**
 * The brand mark, read once at import. It rides beside the launcher, so the
 * payload shows it from a URL and keeps one format instead of a blob.
 */
export const logo = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "logo.png"));

/** Where the middleware serves the launcher, and what it injects. */
export const ASSET_PATH = "/__edityy/edityy.js";

/** Where the middleware serves the brand mark, and what the payload shows. */
export const LOGO_PATH = "/__edityy/logo.png";
export const TAG = `<script src="${ASSET_PATH}" defer></script>`;

/** Where the page sends its edits, and the file they are written to. */
export const CHANGES_PATH = "/__edityy/changes";
export const CHANGES_FILE = ".edityy/changes.json";
/** The largest edit set the endpoint takes. Edits are text; this is plenty. */
const SAVE_LIMIT = 1024 * 1024;

/** Headers this middleware sets. */
const JS = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" };

/** Headers the middleware sets on the brand mark: it never changes. */
const PNG = { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" };

// Two regexes, not a real HTML parser. They miss `src` in an HTML
// comment and in quoted attribute values; re-parse with a DOM when that matters.
const HAS_SCRIPT = new RegExp(`<script[^>]*src=["']${ASSET_PATH}["']`, "i");
const HEAD_CLOSE = /<\/head(\s*)>/i;
const HAS_HTML_OPEN = /<html[\s>]/i;

/**
 * Put the launcher tag in the HTML this dev server is about to return.
 *
 * Returns the body untouched — same reference, so the caller can tell nothing
 * changed — when it is not HTML or already has the tag.
 */
export function inject(body, tag = TAG) {
  const html = body.toString("utf8");
  if (HAS_SCRIPT.test(html)) return body;
  if (!HAS_HTML_OPEN.test(html)) return body;

  // Inside head, right before it closes, so `defer` means what it says and the
  // tag lands after whatever the framework already put there.
  if (HEAD_CLOSE.test(html)) return html.replace(HEAD_CLOSE, tag + "</head$1>");

  // No head to close: a fragment. Prepend, so the tag is still parsed.
  return tag + html;
}

/**
 * Dev-server middleware. One `connect`-style function, so it drops into Vite,
 * `connect`, Express or anything else that takes `(req, res, next)`.
 *
 * It fails open. Every path defers to next(): a throw here surfaces as a
 * 500 on the user's page, which is worse than a missing launcher.
 */
export function edityy(options = {}) {
  const base = options.tag ?? TAG;
  const nonce = options.nonce;
  const root = options.root ?? process.cwd();
  const hosts = options.allowedHosts;

  return function edityyMiddleware(req, res, next) {
    const done = typeof next === "function" ? next : () => {};

    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

      if (pathname === ASSET_PATH) {
        res.writeHead?.(200, JS);
        res.end?.(launcher);
        return;
      }

      if (pathname === LOGO_PATH) {
        res.writeHead?.(200, PNG);
        res.end?.(logo);
        return;
      }

      if (pathname === CHANGES_PATH && options.save !== false) {
        saveFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      if (pathname === VARIATIONS_PATH && options.save !== false) {
        variationsFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      if (pathname === PREVIEWS_PATH && options.save !== false) {
        previewsFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      if (pathname === PREVIEW_REQUEST_PATH && options.save !== false) {
        previewRequestFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      if (pathname === SESSION_PATH && options.save !== false) {
        sessionFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      if (pathname === ASKS_PATH && options.save !== false) {
        asksFromNode(req, res, root, hosts).catch(() => {
          // Already answered, or the socket is gone: nothing left to tell anyone.
        });
        return;
      }

      // Per request, because an app that makes a nonce per response hands one
      // to each request; a fixed string is the same answer every time.
      const tag = withNonce(base, typeof nonce === "function" ? nonce(req, res) : nonce);
      patch(res, tag, done);
    } catch {
      done();
    }
  };
}

/**
 * The tag with a CSP nonce on it, or the tag as it was when there is none.
 *
 * Escaped, because the value lands inside an attribute: a nonce is base64 and
 * needs nothing, but a caller's mistake must not be able to break out of it.
 */
function withNonce(tag, nonce) {
  if (nonce === undefined || nonce === null || nonce === "") return tag;
  const value = String(nonce).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);
  return tag.replace(/^<script\b/i, `<script nonce="${value}"`);
}

/**
 * Wrap the response so an HTML body gets the tag on its way out.
 *
 * A buffered HTML body has its headers held back until end(). That is the whole
 * trick: injecting a tag changes the body's length, and once writeHead() has run
 * the length is already on the wire, so a corrected content-length would arrive
 * too late and the client would stop reading mid-tag. The held writeHead() is
 * sent at end() with every header and the status message it was given, and the
 * new length.
 *
 * A streamed HTML body has no length to correct, so its headers go straight
 * out. Only the bytes up to `</head>` are held — the tag goes in there and
 * everything after it streams through as it is written. A body is a stream when
 * the handler says `transfer-encoding: chunked`, or when it calls write() before
 * end() without a content-length: Node chunks that body without the header.
 *
 * Non-HTML responses are never held: they go straight through.
 */
function patch(res, tag, next) {
  const parts = [];
  const originalWrite = res.write;
  const originalEnd = res.end;
  const originalWriteHead = res.writeHead;

  // What this response is: "pass" (not HTML), "html" (HTML, not yet known how
  // it is sent), "buffer" (HTML, held to end()) or "stream" (HTML, held to
  // </head>). Decided from what the handler sends, because getHeader() is empty
  // once headers are on the wire.
  let mode = null;
  // The held writeHead(): its status, its message and its headers.
  let status;
  let message;
  let held;
  let headHeld = false;
  // Stream mode only: whether the held head has gone out yet.
  let flushed = false;

  const header = (name) => headerOf(held, name) ?? res.getHeader?.(name);
  const decide = () => {
    if (mode) return mode;
    const type = String(header("content-type") ?? "");
    const chunked = String(header("transfer-encoding") ?? "").toLowerCase() === "chunked";
    mode = !type.includes("text/html") ? "pass" : chunked ? "stream" : "html";
    return mode;
  };

  /** Send the held writeHead(), with `extra` headers over the top of its own. */
  const sendHead = (self, extra) => {
    if (!headHeld && !extra) return;
    const headers = { ...headerObject(held) };
    for (const name of Object.keys(extra ?? {})) {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === name) delete headers[key];
      headers[name] = extra[name];
    }
    const code = status ?? res.statusCode ?? 200;
    headHeld = false;
    if (message === undefined) originalWriteHead.call(self, code, headers);
    else originalWriteHead.call(self, code, message, headers);
  };

  /** Stream mode: send what is held, with the tag in it if its </head> is there. */
  const flush = (force) => {
    const out = parts.length === 1 ? parts[0] : Buffer.concat(parts);
    let spliced = out;
    try {
      spliced = spliceHead(out, tag, force);
      if (spliced === null) return null; // no </head> yet: keep holding
    } catch {
      spliced = out; // send exactly what the server produced
    }
    flushed = true;
    parts.length = 0;
    return spliced;
  };

  res.writeHead = function (code, ...rest) {
    status = code;
    message = typeof rest[0] === "string" ? rest[0] : undefined;
    held = rest.find((value) => value && typeof value === "object");
    if (decide() !== "html") return originalWriteHead.call(this, code, ...rest);
    headHeld = true; // sent for real once it is known how the body goes out
    return this;
  };

  res.write = function (chunk, encoding, callback) {
    // A write with no writeHead before it: the headers set so far are the
    // headers, because Node sends them with this first chunk.
    decide();
    if (mode === "html") {
      // A write before end() with no length is a body Node chunks: stream it.
      mode = header("content-length") === undefined ? "stream" : "buffer";
      if (mode === "stream") sendHead(this);
    }
    // Hold only while this is HTML; anything else streams through.
    if (mode === "pass" || flushed) return originalWrite.call(this, chunk, encoding, callback);
    const buffer = toBuffer(chunk, encoding);
    if (buffer) parts.push(buffer);
    const done = typeof encoding === "function" ? encoding : callback;
    if (mode === "stream") {
      const out = flush(false);
      if (out) return originalWrite.call(this, out, done);
    }
    done?.();
    return true;
  };

  res.end = function (chunk, encoding, callback) {
    // Restore first: one patch per response, and a later end() is untouched.
    res.end = originalEnd;
    res.write = originalWrite;
    res.writeHead = originalWriteHead;

    if (decide() === "html") mode = "buffer";
    if (mode === "pass") return originalEnd.call(this, chunk, encoding, callback);
    const done = typeof encoding === "function" ? encoding : callback;

    if (mode === "stream") {
      if (flushed) return originalEnd.call(this, chunk, encoding, callback);
      const last = toBuffer(chunk, encoding);
      if (last) parts.push(last);
      if (!parts.length) return originalEnd.call(this, done);
      return originalEnd.call(this, flush(true), done);
    }

    // No body at all (204, 304, HEAD): the held head as it was, then end().
    if ((chunk === undefined || chunk === null) && parts.length === 0) {
      try {
        sendHead(this);
      } catch {
        // Fall through to end() with whatever headers exist.
      }
      return originalEnd.call(this, chunk, encoding, callback);
    }

    const last = toBuffer(chunk, encoding);
    if (last) parts.push(last);

    let body = parts.length === 1 ? parts[0] : Buffer.concat(parts);
    try {
      body = inject(body, tag);
    } catch {
      // Fall through: send exactly what the server produced.
    }

    // Now the length is known, so the headers can go out correct. If that
    // throws, still send the body: a wrong length beats no page at all.
    try {
      sendHead(this, { "content-length": Buffer.byteLength(body) });
    } catch {
      // Fall through to end() below with whatever headers exist.
    }
    return originalEnd.call(this, body, done);
  };

  next();
}

/** A header's value from writeHead()'s headers, by any case of its name. */
function headerOf(headers, name) {
  const all = headerObject(headers);
  for (const key of Object.keys(all)) if (key.toLowerCase() === name) return all[key];
  return undefined;
}

/**
 * writeHead()'s headers as an object. Node also takes them as a flat array
 * (`[name, value, ...]`) or as pairs; a name given twice keeps both values.
 */
function headerObject(headers) {
  if (!headers) return {};
  if (!Array.isArray(headers)) return headers;
  const pairs = Array.isArray(headers[0]) ? headers : [];
  if (!pairs.length) for (let i = 0; i + 1 < headers.length; i += 2) pairs.push([headers[i], headers[i + 1]]);
  const out = {};
  for (const [name, value] of pairs) {
    if (name in out) out[name] = [].concat(out[name], value);
    else out[name] = value;
  }
  return out;
}

/** How much of a streamed page is held while looking for </head>. */
const HOLD_LIMIT = 256 * 1024;

/**
 * The held start of a streamed page, with the tag put in before </head>.
 *
 * Works on bytes, not a decoded string: a chunk can end in the middle of a
 * multi-byte character, and decoding that would corrupt it. latin1 maps one byte
 * to one character, so a match index is a byte index and the bytes either side
 * are passed on untouched.
 *
 * Returns null while there is no </head> yet and more may come. With `force`
 * (the response is ending) or past HOLD_LIMIT, it answers either way: the tag
 * where it can go, or the bytes unchanged.
 */
function spliceHead(held, tag, force) {
  const text = held.toString("latin1");
  if (HAS_SCRIPT.test(text)) return held;
  const close = HEAD_CLOSE.exec(text);
  if (!close) {
    if (!force && held.length < HOLD_LIMIT) return null;
    // A whole page with no head: the same rule inject() uses.
    return force ? Buffer.from(inject(held, tag)) : held;
  }
  if (!HAS_HTML_OPEN.test(text)) return held;
  return Buffer.concat([held.subarray(0, close.index), Buffer.from(tag), held.subarray(close.index)]);
}

/**
 * Write a page's edits to `.edityy/changes.json` under `root`, for a coding agent
 * (or a person) to read. The folder gets a `.gitignore` of its own, so pending
 * edits never end up in a commit by accident.
 *
 * Takes the body the launcher sends — `{ page, changes: [...] }` — and returns
 * the path it wrote, relative to `root`. Each change is checked and cut down to
 * the fields an agent needs, and the Markdown is made from them: a `markdown`
 * field in the payload is ignored, because an agent acts on what it reads.
 */
export async function writeChanges(payload, root = process.cwd()) {
  if (!payload || typeof payload !== "object") {
    throw new SaveError(400, "Expected a JSON object with a changes array.");
  }
  const changes = checkChanges(payload.changes);
  const page = checkPage(payload.page);
  const record = {
    version: 1,
    savedAt: new Date().toISOString(),
    page,
    markdown: markdownFor(changes, page),
    changes,
  };
  await store(root, CHANGES_FILE, record);
  return CHANGES_FILE;
}

/**
 * Is this request the page itself, rather than another site in the same browser?
 *
 * The endpoint writes a file, so a page on another origin must not be able to
 * reach it. A browser sends `Origin` on every POST and `Sec-Fetch-Site` on
 * modern ones; either one naming another site is a refusal. JSON is required
 * as well, which a cross-site form cannot send without a preflight this server
 * never answers.
 *
 * The host is checked too. A site can point its own name at 127.0.0.1 (DNS
 * rebinding); its requests then have that name as both Host and Origin, so the
 * two agree. Only a local name, an IP address or a host the app names passes.
 */
function allowed(method, type, origin, fetchSite, host, allowedHosts) {
  if (method !== "POST") throw new SaveError(405, "POST the edits as JSON.");
  if (!String(type ?? "").includes("application/json")) throw new SaveError(415, "Send the edits as application/json.");
  sameSite(origin, fetchSite, host, allowedHosts, "save edits");
}

/** The save endpoint on a Node dev server: read, check, write, answer. */
async function saveFromNode(req, res, root, allowedHosts) {
  const headers = req.headers ?? {};
  await runNode(req, res, root, allowedHosts, "save edits", async () => {
    allowed(req.method, headers["content-type"], headers.origin, headers["sec-fetch-site"], headers.host, allowedHosts);
    return { ok: true, path: await writeChanges(jsonBody(await readBody(req)), root) };
  });
}

/** A variation request is a number and an optional comment: 16 KB is plenty. */
const VARIATION_LIMIT = 16 * 1024;
/** The canvas session: every edit, comment and region on one page. */
const SESSION_LIMIT = 512 * 1024;

/**
 * The variation endpoint on a Node dev server.
 *
 * POST writes what the page asked for, GET answers with the agent's variations
 * once they are there (202 while they are not), and DELETE forgets the request.
 */
async function variationsFromNode(req, res, root, allowedHosts) {
  await runNode(req, res, root, allowedHosts, "request variations", async () => {
    if (req.method === "POST") {
      const request = await writeVariationRequest(jsonBody(await readBody(req, VARIATION_LIMIT)), root);
      return { ok: true, requestId: request.id };
    }
    if (req.method === "GET") {
      const id = new URL(req.url ?? "/", "http://localhost").searchParams.get("id") ?? "";
      // No id asks for the queue itself: the Edits panel reads what is
      // waiting, or which responses are ready, before anyone polls for one.
      if (!id) {
        const requests = await readVariationRequests(root);
        const responses = await readVariationResponses(root);
        return {
          ok: true,
          requests: requests.map((entry) => ({ id: entry.id, selector: entry.element.selector, prompt: entry.prompt, count: entry.count, status: entry.status })),
          responses: responses.map((entry) => ({ requestId: entry.requestId, variations: entry.variations })),
        };
      }
      const response = await readVariationResponse(id, root);
      return response ? { ok: true, requestId: response.requestId, variations: response.variations } : { ok: true, pending: true };
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url ?? "/", "http://localhost").searchParams.get("id") ?? null;
      await clearVariations(root, id);
      return { ok: true };
    }
    throw new SaveError(405, "GET, POST or DELETE the variation request.");
  });
}

/**
 * The previews endpoint on a Node dev server.
 *
 * GET answers with the agent-placed preview once it is there (pending while it
 * is not), DELETE drops it, and POST with `{ id, keep }` records the user's
 * decision from the page.
 */
async function previewsFromNode(req, res, root, allowedHosts) {
  await runNode(req, res, root, allowedHosts, "show previews", async () => {
    if (req.method === "GET") {
      return { ok: true, previews: await readPendingPreviews(root) };
    }
    if (req.method === "POST") {
      const body = jsonBody(await readBody(req, VARIATION_LIMIT));
      if (Array.isArray(body?.decisions)) {
        return { ok: true, decisions: await decidePreviews(body.decisions, root) };
      }
      const decided = await decidePreview(body.id, body.keep ? "keep" : "discard", root);
      return { ok: true, id: decided.id };
    }
    if (req.method === "DELETE") {
      await clearPreviews(root);
      return { ok: true };
    }
    throw new SaveError(405, "GET, POST or DELETE the preview.");
  });
}

/**
 * The comment-box preview request on a Node dev server.
 *
 * POST writes what the page asked for, GET answers with the request as it
 * stands, and DELETE withdraws it when the user takes the waiting strip back.
 */
async function previewRequestFromNode(req, res, root, allowedHosts) {
  await runNode(req, res, root, allowedHosts, "request a preview", async () => {
    if (req.method === "POST") {
      const written = await writePreviewRequest(jsonBody(await readBody(req, VARIATION_LIMIT)), root);
      return { ok: true, requestId: written.id };
    }
    if (req.method === "GET") {
      return { ok: true, requests: await readPreviewRequests(root) };
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url ?? "/", "http://localhost").searchParams.get("id") ?? null;
      await clearPreviewRequest(root, id);
      return { ok: true };
    }
    throw new SaveError(405, "GET, POST or DELETE the preview request.");
  });
}

/**
 * The canvas session on a Node dev server.
 *
 * GET answers with the canvas kept for one page path, POST keeps the canvas the
 * page sends, and DELETE forgets it once the edits are in the code.
 */
async function sessionFromNode(req, res, root, allowedHosts) {
  await runNode(req, res, root, allowedHosts, "keep the canvas session", async () => {
    if (req.method === "GET") {
      const path = new URL(req.url ?? "/", "http://localhost").searchParams.get("path") ?? "/";
      const session = await readSession(path, root);
      // Temporary clear_all diagnostic (remove after the stale-state hunt).
      console.log(`[edityy-diag] session GET path=${path} ${session ? `hit edits=${session.edits.length} savedAt=${session.savedAt}` : "miss"}`);
      return { ok: true, session };
    }
    if (req.method === "POST") {
      const written = await writeSession(jsonBody(await readBody(req, SESSION_LIMIT)), root);
      return { ok: true, path: written };
    }
    if (req.method === "DELETE") {
      await clearSession(root);
      return { ok: true };
    }
    throw new SaveError(405, "GET, POST or DELETE the canvas session.");
  });
}

/**
 * Every ask in one place: the variation queue with its answers, the
 * comment-box preview requests, and the previews still up for a decision.
 * The page polls this once, and the MCP getter reads the same files.
 */
export async function readAsks(root = process.cwd()) {
  const [variationRequests, variationResponses, previewRequests, previews, clearedAt] = await Promise.all([
    readVariationRequests(root),
    readVariationResponses(root),
    readPreviewRequests(root),
    readPendingPreviews(root),
    readClearedAt(root),
  ]);
  return {
    ok: true,
    clearedAt,
    variations: {
      requests: variationRequests.map((entry) => ({ id: entry.id, selector: entry.element.selector, prompt: entry.prompt, count: entry.count, status: entry.status })),
      responses: variationResponses.map((entry) => ({ requestId: entry.requestId, variations: entry.variations })),
    },
    previewRequests,
    previews,
  };
}

/**
 * Remove every canvas edit, ask, paint and saved handoff, and mark the clear.
 *
 * Deleting the files is not enough: an open page keeps its canvas in memory
 * and would re-post it. The cleared mark tells the page to drop what it holds.
 */
export async function clearCanvas(root = process.cwd()) {
  const removed = { previews: 0, previewRequests: 0, variationRequests: 0, variationResponses: 0, sessionEdits: 0, savedEdits: 0 };
  const take = async (file, key) => {
    try {
      const saved = await readJson(join(root, file), null);
      const rows = Array.isArray(saved) ? saved : Array.isArray(saved?.items) ? saved.items : Array.isArray(saved?.changes) ? saved.changes : Array.isArray(saved?.edits) ? [...saved.edits, ...(Array.isArray(saved?.regions) ? saved.regions : [])] : [];
      removed[key] = rows.length;
    } catch {
      // an unreadable file still goes, counted as nothing
    }
    try {
      await rm(join(root, file), { force: true });
    } catch {
      // already gone
    }
  };
  await take(PREVIEWS_FILE, "previews");
  await take(PREVIEW_REQUEST_FILE, "previewRequests");
  await take(VARIATION_REQUEST_FILE, "variationRequests");
  await take(VARIATION_RESPONSE_FILE, "variationResponses");
  await take(SESSION_FILE, "sessionEdits");
  await take(CHANGES_FILE, "savedEdits");
  const clearedAt = await writeClearedAt(root);
  // Temporary clear_all diagnostic (remove after the stale-state hunt).
  console.log(`[edityy-diag] clearCanvas removed=${JSON.stringify(removed)} clearedAt=${clearedAt}`);
  return { removed, clearedAt };
}

/** The asks queue on a Node dev server: one GET the page polls. */
async function asksFromNode(req, res, root, allowedHosts) {  await runNode(req, res, root, allowedHosts, "read the asks", async () => {
    if (req.method !== "GET") throw new SaveError(405, "GET the asks.");
    const asks = await readAsks(root);
    // Temporary clear_all diagnostic (remove after the stale-state hunt).
    console.log(`[edityy-diag] asks GET clearedAt=${asks.clearedAt}`);
    return asks;
  });
}

/** A body as JSON, or a 400 that says the body is not JSON. */
function jsonBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    throw new SaveError(400, "The body is not JSON.");
  }
}

/** A request body as a string, refused past `limit`.
 *
 * Past the limit the rest of the body is drained, not the request destroyed:
 * destroying it closes the socket, and the 413 never reaches the page.
 */
function readBody(req, limit = SAVE_LIMIT) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.off?.("data", onData);
        req.resume?.();
        reject(new SaveError(413, "Too many edits to save at once."));
        return;
      }
      parts.push(chunk);
    };
    req.on("data", onData);
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * The save endpoint as a fetch-style route handler, for frameworks whose pages
 * the middleware never sees — Next.js above all:
 *
 *   // app/edityy/changes/route.ts  (the app rewrites /__edityy/changes onto it)
 *   import { changesRoute } from "edityy";
 *   export const POST = changesRoute();
 *
 * It answers 404 unless NODE_ENV is "development": `next build` puts the route
 * in the production server, and a production server must not write files for
 * whoever asks.
 */
export function changesRoute(options = {}) {
  const root = options.root ?? process.cwd();
  return async function POST(request) {
    const body = await request.text();
    return runRoute(request, options, "save edits", async () => {
      const h = request.headers;
      const host = h.get("host") ?? new URL(request.url).host;
      allowed(request.method, h.get("content-type"), h.get("origin"), h.get("sec-fetch-site"), host, options.allowedHosts);
      if (Buffer.byteLength(body) > SAVE_LIMIT) throw new SaveError(413, "Too many edits to save at once.");
      return { ok: true, path: await writeChanges(jsonBody(body), root) };
    });
  };
}

/**
 * The brand mark as a fetch-style route handler, for Next.js:
 *
 *   // app/edityy/logo/route.ts  (the app rewrites /__edityy/logo.png onto it)
 *   import { logoRoute } from "edityy";
 *   export const GET = logoRoute();
 *
 * A picture, not a write: it answers on every host, in any environment.
 */
export function logoRoute() {
  return function GET() {
    return new Response(logo, { status: 200, headers: PNG });
  };
}

/**
 * The variation endpoint as fetch-style route handlers, for Next.js:
 *
 *   // app/edityy/variations/route.ts  (the app rewrites /__edityy/variations onto it)
 *   import { variationsRoute } from "edityy";
 *   export const { GET, POST, DELETE } = variationsRoute();
 *
 * Like changesRoute(), it answers 404 unless NODE_ENV is "development".
 */
export function variationsRoute(options = {}) {
  const root = options.root ?? process.cwd();
  const run = (request, act) => runRoute(request, options, "request variations", act);
  return {
    GET: (request) =>
      run(request, async () => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!id) {
          const requests = await readVariationRequests(root);
          const responses = await readVariationResponses(root);
          return {
            ok: true,
            requests: requests.map((entry) => ({ id: entry.id, selector: entry.element.selector, prompt: entry.prompt, count: entry.count, status: entry.status })),
            responses: responses.map((entry) => ({ requestId: entry.requestId, variations: entry.variations })),
          };
        }
        const response = await readVariationResponse(id, root);
        return response
          ? { ok: true, requestId: response.requestId, variations: response.variations }
          : { ok: true, pending: true };
      }),
    POST: (request) =>
      run(request, async () => {
        const body = await request.text();
        if (Buffer.byteLength(body) > VARIATION_LIMIT) throw new SaveError(413, "Too much to request variations with.");
        const written = await writeVariationRequest(jsonBody(body), root);
        return { ok: true, requestId: written.id };
      }),
    DELETE: (request) =>
      run(request, async () => {
        await clearVariations(root);
        return { ok: true };
      }),
  };
}

/**
 * The previews endpoint as fetch-style route handlers, for Next.js:
 *
 *   // app/edityy/previews/route.ts  (the app rewrites /__edityy/previews onto it)
 *   import { previewsRoute } from "edityy";
 *   export const { GET, POST, DELETE } = previewsRoute();
 *
 * Like changesRoute(), it answers 404 unless NODE_ENV is "development".
 */
export function previewsRoute(options = {}) {
  const root = options.root ?? process.cwd();
  const run = (request, act) => runRoute(request, options, "show previews", act);
  return {
    GET: (request) =>
      run(request, async () => ({ ok: true, previews: await readPendingPreviews(root) })),
    POST: (request) =>
      run(request, async () => {
        const body = await request.text();
        if (Buffer.byteLength(body) > VARIATION_LIMIT) throw new SaveError(413, "Too much to decide a preview with.");
        const decided = jsonBody(body);
        if (Array.isArray(decided?.decisions)) {
          return { ok: true, decisions: await decidePreviews(decided.decisions, root) };
        }
        const done = await decidePreview(decided.id, decided.keep ? "keep" : "discard", root);
        return { ok: true, id: done.id };
      }),
    DELETE: (request) =>
      run(request, async () => {
        await clearPreviews(root);
        return { ok: true };
      }),
  };
}

/**
 * The comment-box preview request as fetch-style route handlers, for Next.js:
 *
 *   // app/edityy/preview-request/route.ts  (the app rewrites /__edityy/preview-request onto it)
 *   import { previewRequestRoute } from "edityy";
 *   export const { GET, POST, DELETE } = previewRequestRoute();
 *
 * Like changesRoute(), it answers 404 unless NODE_ENV is "development".
 */
export function previewRequestRoute(options = {}) {
  const root = options.root ?? process.cwd();
  const run = (request, act) => runRoute(request, options, "request a preview", act);
  return {
    GET: (request) => run(request, async () => ({ ok: true, requests: await readPreviewRequests(root) })),
    POST: (request) =>
      run(request, async () => {
        const body = await request.text();
        if (Buffer.byteLength(body) > VARIATION_LIMIT) throw new SaveError(413, "Too much to request a preview with.");
        const written = await writePreviewRequest(jsonBody(body), root);
        return { ok: true, requestId: written.id };
      }),
    DELETE: (request) =>
      run(request, async () => {
        const id = new URL(request.url).searchParams.get("id") ?? null;
        await clearPreviewRequest(root, id);
        return { ok: true };
      }),
  };
}

/**
 * The canvas session as fetch-style route handlers, for Next.js:
 *
 *   // app/edityy/session/route.ts  (the app rewrites /__edityy/session onto it)
 *   import { sessionRoute } from "edityy";
 *   export const { GET, POST, DELETE } = sessionRoute();
 *
 * Like changesRoute(), it answers 404 unless NODE_ENV is "development".
 */
export function sessionRoute(options = {}) {
  const root = options.root ?? process.cwd();
  const run = (request, act) => runRoute(request, options, "keep the canvas session", act);
  return {
    GET: (request) =>
      run(request, async () => {
        const path = new URL(request.url).searchParams.get("path") ?? "/";
        return { ok: true, session: await readSession(path, root) };
      }),
    POST: (request) =>
      run(request, async () => {
        const body = await request.text();
        if (Buffer.byteLength(body) > SESSION_LIMIT) throw new SaveError(413, "Too much to keep the canvas with.");
        return { ok: true, path: await writeSession(jsonBody(body), root) };
      }),
    DELETE: (request) =>
      run(request, async () => {
        await clearSession(root);
        return { ok: true };
      }),
  };
}

/**
 * The asks queue as a fetch-style route handler, for Next.js:
 *
 *   // app/edityy/asks/route.ts  (the app rewrites /__edityy/asks onto it)
 *   import { asksRoute } from "edityy";
 *   export const GET = asksRoute();
 *
 * Like changesRoute(), it answers 404 unless NODE_ENV is "development".
 */
export function asksRoute(options = {}) {
  const root = options.root ?? process.cwd();
  return async function GET(request) {
    return runRoute(request, options, "read the asks", async () => readAsks(root));
  };
}

/** A body chunk as a Buffer, or nothing when there is no chunk. */
function toBuffer(chunk, encoding) {
  if (chunk === undefined || chunk === null) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8");
}

export default edityy;