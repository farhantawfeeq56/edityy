import { readFileSync } from "node:fs";

/** The launcher payload, read once at import. */
export const launcher = readFileSync(new URL("./edityy.js", import.meta.url), "utf8");

/** Where the middleware serves the launcher and what it injects. */
export const ASSET_PATH = "/__edityy/edityy.js";
export const TAG = `<script src="${ASSET_PATH}" defer></script>`;

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

  return function edityyMiddleware(req, res, next) {
    const done = typeof next === "function" ? next : () => {};

    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

      if (pathname === ASSET_PATH) {
        res.writeHead?.(200, JS);
        res.end?.(launcher);
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
 * too late and the client would stop reading mid-tag. Dev servers send one
 * buffered HTML body, so holding it costs nothing.
 *
 * A streamed (chunked) HTML body has no length to correct, so its headers go
 * straight out. Only the bytes up to `</head>` are held — the tag goes in there
 * and everything after it streams through as it is written.
 *
 * Non-HTML responses are never held: they go straight through.
 */
function patch(res, tag, next) {
  const parts = [];
  const originalWrite = res.write;
  const originalEnd = res.end;
  const originalWriteHead = res.writeHead;

  // What this response is: "pass" (not HTML), "buffer" (HTML, held to end()) or
  // "stream" (chunked HTML, held to </head>). Decided from what the handler
  // sends, because getHeader() is empty once headers are on the wire.
  let mode = null;
  let status = 200;
  // Stream mode only: whether the held head has gone out yet.
  let flushed = false;
  const decide = (headers) => {
    if (mode) return mode;
    const type = String(headers["content-type"] ?? res.getHeader?.("content-type") ?? "");
    const chunked = String(headers["transfer-encoding"] ?? res.getHeader?.("transfer-encoding") ?? "") === "chunked";
    mode = !type.includes("text/html") ? "pass" : chunked ? "stream" : "buffer";
    return mode;
  };

  /** Stream mode: send what is held, with the tag in it if its </head> is there. */
  const flush = (force) => {
    const held = parts.length === 1 ? parts[0] : Buffer.concat(parts);
    let out = held;
    try {
      const spliced = spliceHead(held, tag, force);
      if (spliced === null) return null; // no </head> yet: keep holding
      out = spliced;
    } catch {
      // Fall through: send exactly what the server produced.
    }
    flushed = true;
    parts.length = 0;
    return out;
  };

  res.writeHead = function (code, ...rest) {
    const headers = rest.find((value) => value && typeof value === "object") ?? {};
    status = code;
    if (decide(headers) === "buffer") return this; // held: sent for real at end()
    return originalWriteHead.call(this, code, ...rest);
  };

  res.write = function (chunk, encoding, callback) {
    // A write with no writeHead before it: the headers set so far are the
    // headers, because Node sends them with this first chunk.
    decide({});
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

    const kind = decide({});
    if (kind === "pass") return originalEnd.call(this, chunk, encoding, callback);
    const done = typeof encoding === "function" ? encoding : callback;

    if (kind === "stream") {
      if (flushed) return originalEnd.call(this, chunk, encoding, callback);
      const last = toBuffer(chunk, encoding);
      if (last) parts.push(last);
      if (!parts.length) return originalEnd.call(this, done);
      return originalEnd.call(this, flush(true), done);
    }

    // No body at all (204, 304, HEAD): pass the arguments straight through.
    if ((chunk === undefined || chunk === null) && parts.length === 0) {
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

    // Now the length is known, so the headers can go out correct. If setHeader
    // throws, still send the body: a wrong length beats no page at all.
    try {
      res.setHeader?.("content-length", Buffer.byteLength(body));
      originalWriteHead.call(this, status);
    } catch {
      // Fall through to end() below with whatever headers exist.
    }
    return originalEnd.call(this, body, done);
  };

  next();
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

/** A body chunk as a Buffer, or nothing when there is no chunk. */
function toBuffer(chunk, encoding) {
  if (chunk === undefined || chunk === null) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8");
}

export default edityy;