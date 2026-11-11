/*
 * One backing store behind every Edityy file and endpoint.
 *
 * variations.js, previews.js, session.js and index.js all kept their own
 * readJson/store pair and their own id maker, and each route factory in
 * index.js kept its own json/run pair. The copies drifted apart, so they live
 * here now: one atomic write, one JSON read, one id maker and one wrapper for
 * both endpoint styles (fetch routes and Node middleware).
 */
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** A JSON file, or `missing` when it was never written. A broken file throws. */
export async function readJson(path, missing) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return missing;
    throw error;
  }
}

/**
 * Write a value beside the file, then rename it over: a reader (the MCP
 * server) sees the old file or the new one, never half of a file. The folder
 * gets a `.gitignore` of its own, so pending data never lands in a commit.
 */
const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"]);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export const CLEARED_FILE = ".edityy/cleared.json";

/** When the canvas was last cleared by the agent, or null when never. */
export async function readClearedAt(root = process.cwd()) {
  const saved = await readJson(join(root, CLEARED_FILE), null);
  const at = saved && typeof saved.clearedAt === "string" ? saved.clearedAt : null;
  return at && !Number.isNaN(Date.parse(at)) ? at : null;
}

/** Mark the canvas cleared, so an open page drops what it holds too. */
export async function writeClearedAt(root = process.cwd()) {
  const clearedAt = new Date().toISOString();
  await store(root, CLEARED_FILE, { clearedAt });
  return clearedAt;
}

async function sweepTemps(dir) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const now = Date.now();
  await Promise.all(
    names
      .filter((name) => name.endsWith(".tmp"))
      .map(async (name) => {
        try {
          const found = await stat(join(dir, name));
          if (now - found.mtimeMs > 120000) await unlink(join(dir, name));
        } catch {
          // best effort: a stale temp file never blocks a save
        }
      })
  );
}

export async function store(root, file, value) {
  const dir = join(root, ".edityy");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".gitignore"), "*\n");
  await sweepTemps(dir);
  const path = join(root, file);
  const temp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  let last = null;
  for (let at = 0; at < 6; at++) {
    try {
      await rename(temp, path);
      return;
    } catch (error) {
      last = error;
      if (!RETRYABLE.has(error?.code) || at === 5) break;
      await wait(25 * 2 ** at);
    }
  }
  try {
    await unlink(temp);
  } catch {
    // the temp file is already gone or still locked; the sweep takes it later
  }
  const hint = last?.code ? ` (${last.code}; the file is locked, usually by the dev server watcher)` : "";
  const retry = new Error(`Could not save ${file}${hint}. Nothing was half-written: retry the same call, it is safe to retry.`);
  retry.code = last?.code;
  throw retry;
}

/** A random id with a prefix, so two agents never share one. */
export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** A JSON answer with no caching, for fetch-style route handlers. */
export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Is `host` (a Host header, port and all) one this endpoint answers?
 *
 * `localhost` and its subdomains, and any IP address, always pass: an address
 * is not a name, so no other site can point it here. Then each name in
 * `allowedHosts`, where a leading dot also takes its subdomains (as Vite's
 * `allowedHosts` does), or every host for `true`.
 */
export function hostAllowed(host, allowedHosts) {
  if (allowedHosts === true) return true;
  if (typeof host !== "string" || !host || /[@/\\\s]/.test(host)) return false;
  let name;
  try {
    name = new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
  if (!name) return false;
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (name.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(name)) return true;
  return (Array.isArray(allowedHosts) ? allowedHosts : []).some((allow) => {
    const want = String(allow).toLowerCase();
    return want.startsWith(".") ? name === want.slice(1) || name.endsWith(want) : name === want;
  });
}

/**
 * The page itself, on a host this dev server names. Every endpoint asks this:
 * the request's own site, by `Sec-Fetch-Site` and `Origin`, and a host that is
 * local, an address, or named by the app.
 */
export function sameSite(origin, fetchSite, host, allowedHosts, what) {
  if (!hostAllowed(host, allowedHosts)) {
    const error = new Error(`Only a local host can ${what}. Add this one to allowedHosts.`);
    error.status = 403;
    throw error;
  }
  if (fetchSite && fetchSite !== "same-origin") {
    const error = new Error(`Only the page itself can ${what}.`);
    error.status = 403;
    throw error;
  }
  if (origin) {
    let from = null;
    try {
      from = new URL(origin).host;
    } catch {
      // An origin that is not a URL ("null", for one) is not this page.
    }
    if (from !== host) {
      const error = new Error(`Only the page itself can ${what}.`);
      error.status = 403;
      throw error;
    }
  }
}

/**
 * One fetch-style endpoint: 404 outside `next dev`, one origin check, one
 * error shape. `act` answers the request.
 */
export async function runRoute(request, options, what, act) {
  if (process.env.NODE_ENV !== "development") return json(404, { ok: false, error: "Not found." });
  try {
    const headers = request.headers;
    const host = headers.get("host") ?? new URL(request.url).host;
    sameSite(headers.get("origin"), headers.get("sec-fetch-site"), host, options.allowedHosts, what);
    return json(200, await act());
  } catch (error) {
    return json(error?.status ?? 500, { ok: false, error: error.message });
  }
}

/** One Node-middleware endpoint: the same check and error shape as runRoute. */
export async function runNode(req, res, root, allowedHosts, what, act) {
  const answer = (status, body) => {
    res.writeHead?.(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end?.(JSON.stringify(body));
  };
  try {
    const headers = req.headers ?? {};
    sameSite(headers.origin, headers["sec-fetch-site"], headers.host, allowedHosts, what);
    answer(200, await act());
  } catch (error) {
    answer(error?.status ?? 500, { ok: false, error: error.message });
  }
}
