/**
 * Edityy V1 — local connection.
 *
 * The connection is a server-side reverse proxy: Edityy fetches the target
 * origin itself and rewrites the HTML on the way through, so the launcher
 * lands on the real page. The developer's project installs nothing — no
 * package, no script tag, no build step.
 *
 * ponytail: origin-level proxy (no per-URL path rewrite). Good enough for a
 * root URL; add path mapping + absolute-origin rewriting when a real SDK
 * needs deep links into a running app.
 */

/** Loopback and private ranges only — this must not be an open proxy. */
const ALLOWED_HOST = /^(localhost|127(\.\d+){3}|\[?::1\]?|0\.0\.0\.0|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2})$/i;

/** Resolve relative to the origin root — keeping only "/" keeps the rewrite trivial. */
export function normalizeTarget(raw: string): URL {
  const trimmed = raw.trim();
  const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http:// and https:// URLs are supported.");
  if (!ALLOWED_HOST.test(url.hostname))
    throw new Error("Edityy V1 only connects to localhost and private network addresses.");
  return new URL("/", url);
}

const MARKER = "data-edityy-launcher";

/** Inline so nothing extra has to be served for, and CSP-blocked. */
const LAUNCHER = `<style ${MARKER}>#edityy-launcher{position:fixed;right:24px;bottom:24px;z-index:2147483647;width:56px;height:56px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;font:600 15px/1 system-ui,sans-serif;color:#111;background:#b7efb2;box-shadow:0 6px 24px #1113}#edityy-launcher:hover{opacity:.9}#edityy-launcher:focus-visible{outline:2px solid #111;outline-offset:3px}</style>`;

const SCRIPT = `<script ${MARKER}>(function(){var b=document.createElement("button");b.id="edityy-launcher";b.type="button";b.textContent="Edityy";b.title="Edityy launcher (V1)";b.setAttribute("aria-label","Open Edityy");b.addEventListener("click",function(){console.log("[edityy] launcher clicked — editor not built in V1")});document.documentElement.appendChild(b)})();</script>`;

/** A meta CSP with frame-ancestors would block Edityy from framing the site at all. */
const CSP_META = /<meta[^>]+content-security-policy[^>]*>/gi;

/** ponytail: one regex, one pass. Fine for a single top-level document. */
export function injectLauncher(html: string): string {
  if (html.includes(MARKER)) return html;
  return html
    .replace(CSP_META, (tag) => tag.replace(/frame-ancestors[^;"'>]*;?/gi, ""))
    .replace(/<\/head\s*>/i, `${LAUNCHER}</head>`)
    .replace(/<\/body\s*>/i, `${SCRIPT}</body>`);
}
