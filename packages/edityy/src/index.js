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

      // A streamed HTML response is never buffered here, so patching it would
      // mean hijacking the stream. Skip the injection.
      if (res.getHeader?.("transfer-encoding") === "chunked") return done();

      // Per request, because an app that makes a nonce per response hands one
      // to each request; a fixed string is the same answer every time.
      const tag = withNonce(base, typeof nonce === "function" ? nonce(req, res) : nonce);
      patch(res, tag, done);
    } catch {
      done();
    }
  };
}/**
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
 * Headers are held back until end(). That is the whole trick: injecting a tag
 * changes the body's length, and once writeHead() has run the length is already
 * on the wire, so a corrected content-length would arrive too late and the
 * client would stop reading mid-tag. Dev servers send one buffered HTML body,
 * so holding it costs nothing.
 *
 * Non-HTML responses are never buffered: they go straight through.
 *
 * writeHead is delayed for HTML only. A server that streams HTML
 * progressively (chunked) is skipped entirely rather than half-handled.
 */
function patch(res, tag, next) {
  const parts = [];
  const originalWrite = res.write;
  const originalEnd = res.end;
  const originalWriteHead = res.writeHead;

  // Does this response carry HTML we should patch? Decided from what the
  // handler sends, because getHeader() is empty once headers are on the wire.
  let html = false;
  let status = 200;
  let decided = false;
  const decide = (headers) => {
    if (decided) return html;
    decided = true;
    html =
      String(headers["content-type"] ?? res.getHeader?.("content-type") ?? "").includes("text/html") &&
      String(headers["transfer-encoding"] ?? res.getHeader?.("transfer-encoding") ?? "") !== "chunked";
    return html;
  };

  res.writeHead = function (code, ...rest) {
    const headers = rest.find((value) => value && typeof value === "object") ?? {};
    status = code;
    if (decide(headers)) return this; // held: sent for real at end()
    return originalWriteHead.call(this, code, ...rest);
  };

  res.write = function (chunk, encoding, callback) {
    // Buffer only while this might still be HTML; anything else streams through.
    if (decided && !html) return originalWrite.call(this, chunk, encoding, callback);
    const buffer = toBuffer(chunk, encoding);
    if (buffer) parts.push(buffer);
    const done = typeof encoding === "function" ? encoding : callback;
    done?.();
    return true;
  };

  res.end = function (chunk, encoding, callback) {
    // Restore first: one patch per response, and a later end() is untouched.
    res.end = originalEnd;
    res.write = originalWrite;
    res.writeHead = originalWriteHead;

    if (!decide({})) return originalEnd.call(this, chunk, encoding, callback);

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
    return originalEnd.call(this, body, callback);
  };

  next();
}

/** A body chunk as a Buffer, or nothing when there is no chunk. */
function toBuffer(chunk, encoding) {
  if (chunk === undefined || chunk === null) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk), typeof encoding === "string" ? encoding : "utf8");
}

export default edityy;