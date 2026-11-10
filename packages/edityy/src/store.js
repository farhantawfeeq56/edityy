/*
 * One backing store behind every Edityy file and endpoint.
 *
 * variations.js, previews.js, session.js and index.js all kept their own
 * readJson/store pair and their own id maker, and each route factory in
 * index.js kept its own json/run pair. The copies drifted apart, so they live
 * here now: one atomic write, one JSON read, one id maker and one wrapper for
 * both endpoint styles (fetch routes and Node middleware).
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
export async function store(root, file, value) {
  const dir = join(root, ".edityy");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".gitignore"), "*\n");
  const path = join(root, file);
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, path);
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
