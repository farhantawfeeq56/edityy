import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SaveError, checkChanges, checkPage, markdownFor } from "./changes.js";

/** The launcher payload, read once at import. */
export const launcher = readFileSync(new URL("./edityy.js", import.meta.url), "utf8");

/** Where the middleware serves the launcher and what it injects. */
export const ASSET_PATH = "/__edityy/edityy.js";
export const TAG = `<script src="${ASSET_PATH}" defer></script>`;

/** Where the page sends its edits, and the file they are written to. */
export const CHANGES_PATH = "/__edityy/changes";
export const CHANGES_FILE = ".edityy/changes.json";
/** The largest edit set the endpoint takes. Edits are text; this is plenty. */
const SAVE_LIMIT = 1024 * 1024;

/** Headers this middleware sets. */
const JS = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" };

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

      if (pathname === CHANGES_PATH && options.save !== false) {
        saveFromNode(req, res, root, hosts).catch(() => {
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
  const dir = join(root, ".edityy");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".gitignore"), "*\n");
  await writeFile(join(root, CHANGES_FILE), JSON.stringify(record, null, 2) + "\n");
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
  if (!hostAllowed(host, allowedHosts)) throw new SaveError(403, "Only a local host can save edits. Add this one to allowedHosts.");
  if (fetchSite && fetchSite !== "same-origin") throw new SaveError(403, "Only the page itself can save edits.");
  if (origin) {
    let from = null;
    try {
      from = new URL(origin).host;
    } catch {
      // An origin that is not a URL ("null", for one) is not this page.
    }
    if (from !== host) throw new SaveError(403, "Only the page itself can save edits.");
  }
}

/**
 * Is `host` (a Host header, port and all) one this endpoint answers?
 *
 * `localhost` and its subdomains, and any IP address, always: an address is not
 * a name, so no other site can point it here. Then each name in `allowedHosts`,
 * where a leading dot also takes its subdomains (as Vite's `allowedHosts`
 * does), or every host for `true`.
 */
function hostAllowed(host, allowedHosts) {
  if (allowedHosts === true) return true;
  if (typeof host !== "string" || !host || /[@/\\\s]/.test(host)) return false;
  let name;
  try {
    name = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (name.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(name)) return true;
  return (Array.isArray(allowedHosts) ? allowedHosts : []).some((allow) => {
    const want = String(allow).toLowerCase();
    return want.startsWith(".") ? name === want.slice(1) || name.endsWith(want) : name === want;
  });
}

/** The save endpoint on a Node dev server: read, check, write, answer. */
async function saveFromNode(req, res, root, allowedHosts) {
  const answer = (status, body) => {
    res.writeHead?.(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end?.(JSON.stringify(body));
  };
  try {
    const h = req.headers ?? {};
    allowed(req.method, h["content-type"], h.origin, h["sec-fetch-site"], h.host, allowedHosts);
    const body = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new SaveError(400, "The body is not JSON.");
    }
    answer(200, { ok: true, path: await writeChanges(payload, root) });
  } catch (error) {
    answer(error instanceof SaveError ? error.status : 500, { ok: false, error: error.message });
  }
}

/** A request body as a string, refused past SAVE_LIMIT. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > SAVE_LIMIT) {
        reject(new SaveError(413, "Too many edits to save at once."));
        req.destroy?.();
        return;
      }
      parts.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * The save endpoint as a fetch-style route handler, for frameworks whose pages
 * the middleware never sees — Next.js above all:
 *
 *   // app/%5F%5Fedityy/changes/route.ts  (Next serves %5F as "_")
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
    const json = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    if (process.env.NODE_ENV !== "development") return json(404, { ok: false, error: "Not found." });
    try {
      const h = request.headers;
      const host = h.get("host") ?? new URL(request.url).host;
      allowed(request.method, h.get("content-type"), h.get("origin"), h.get("sec-fetch-site"), host, options.allowedHosts);
      const body = await request.text();
      if (Buffer.byteLength(body) > SAVE_LIMIT) throw new SaveError(413, "Too many edits to save at once.");
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new SaveError(400, "The body is not JSON.");
      }
      return json(200, { ok: true, path: await writeChanges(payload, root) });
    } catch (error) {
      return json(error instanceof SaveError ? error.status : 500, { ok: false, error: error.message });
    }
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