import { injectLauncher, normalizeTarget } from "../connect";

// V1 is a local prototype: a fetch can take a moment, and the target is a
// developer's own dev server. This only matters on hosts that enforce it.
export const maxDuration = 60;

// ponytail: no opt-in, no cache. Hitting reload should show the current site.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("Missing ?url=", { status: 400, headers: { "content-type": "text/plain" } });

  let target: URL;
  try {
    target = normalizeTarget(raw);
  } catch (error) {
    return new Response((error as Error).message, { status: 400, headers: { "content-type": "text/plain" } });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { headers: { accept: "text/html" } });
  } catch {
    return new Response(`Could not reach ${target.origin}. Is that server running?`, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
  if (!upstream.ok) {
    return new Response(`${target.origin} responded ${upstream.status}.`, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }

  // ponytail: trusts the target's own content type. A V1 frame that shows a
  // JSON/text response is a worse experience than a wrong content-type header.
  return new Response(injectLauncher(await upstream.text()), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
