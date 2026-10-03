import { readFileSync } from "node:fs";

/** The launcher payload, read once at import. */
export const launcher = readFileSync(new URL("./edityy.js", import.meta.url), "utf8");

/** Where the middleware serves the launcher and what it injects. */
export const ASSET_PATH = "/__edityy/edityy.js";
export const TAG = `<script src="${ASSET_PATH}" defer></script>`;

/** Content types for the responses this middleware writes. */
const JS = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" };

// ponytail: two regexes, not a real HTML parser. They miss `src` in an HTML
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
 * ponytail: fails open. A throw anywhere here surfaces as a 500 on the user's
 * page, so every path swallows and defers to `next()`.
 */
export function edityy(options = {}) {
  const tag = options.tag ?? TAG;

  return function edityyMiddleware(req, res, next) {
    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      return next();
    }

    const done = typeof next === "function" ? next : () => {};
    const chunked =
      String(res.getHeader?.("content-type") ?? "").includes("text/html") &&
      res.getHeader("transfer-encoding") === "chunked";

    if (pathname === ASSET_PATH) {
      res.writeHead?.(200, JS);
      res.end?.(launcher);
      return;
    }

    // A streamed HTML response: its body is not buffered here, so patching would
    // mean hijacking the stream. Serve the script and skip the injection.
    if (chunked) return done();

    let originalEnd = res.end;
    res.end = function (chunk, encoding, callback) {
      res.end = originalEnd;
      try {
        if (typeof chunk === "string" || chunk instanceof Uint8Array) {
          const encodingName =
            typeof encoding === "string" ? encoding : typeof encoding === "function" ? null : encoding;
          if (typeof encodingName === "string") chunk = Buffer.from(chunk, encodingName);

          const patched = inject(chunk, tag);
          const headers = res.getHeader?.("content-length");
          // Unchanged means the content-length still matches the real body.
          if (patched !== chunk && headers != null) res.setHeader?.("content-length", Buffer.byteLength(patched));

          originalEnd.call(this, patched, typeof encoding === "function" ? encoding : callback);
          return;
        }
      } catch {
        // Fall through: send what the server originally produced.
      }
      return originalEnd.call(this, chunk, encoding, callback);
    };

    return done();
  };
}

export default edityy;