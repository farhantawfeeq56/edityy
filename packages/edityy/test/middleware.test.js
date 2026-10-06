// Checks for the dev-server middleware and the HTML injection it does.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSET_PATH, TAG, edityy, inject, launcher } from "../src/index.js";

/** A node response with just the bits the middleware touches. */
function fakeRes({ headers = {} } = {}) {
  const map = new Map(Object.entries(headers));
  const res = {
    body: undefined,
    status: undefined,
    getHeader: (name) => map.get(String(name).toLowerCase()),
    setHeader: (name, value) => map.set(String(name).toLowerCase(), value),
    writeHead(status, head) {
      res.status = status;
      for (const [k, v] of Object.entries(head ?? {})) map.set(k.toLowerCase(), v);
    },
    end(chunk) {
      res.body = chunk;
    },
  };
  return res;
}

/** Runs one request through the middleware; `passed` is whether next() ran. */
function handle(url, res, options) {
  const out = { res, passed: false };
  edityy(options)({ url }, res, () => (out.passed = true));
  return out;
}

test("serves the launcher on the asset path", () => {
  const { res } = handle(ASSET_PATH, fakeRes());
  assert.equal(res.status, 200);
  assert.equal(res.body, launcher);
  assert.match(String(res.getHeader("content-type")), /javascript/);
  assert.equal(res.getHeader("cache-control"), "no-store");
});

test("injects the tag before </head> and fixes content-length", () => {
  const html = "<!doctype html><html><head><title>x</title></head><body>hi</body></html>";
  const { res, passed } = handle(
    "/some/page",
    fakeRes({ headers: { "content-type": "text/html; charset=utf-8", "content-length": 500 } })
  );

  assert.equal(passed, true);
  res.end(html);
  const out = res.body.toString();
  assert.match(out, /<script src="\/__edityy\/edityy\.js" defer><\/script><\/head>/);
  // The real length, not the placeholder the server sent.
  assert.equal(res.getHeader("content-length"), Buffer.byteLength(out));
  assert.match(out, /<body>hi<\/body>/);
});

test("injects a custom tag when one is given", () => {
  const { res } = handle("/", fakeRes({ headers: { "content-type": "text/html" } }), {
    tag: '<script src="/x.js"></script>',
  });
  res.end("<html><head></head><body></body></html>");
  assert.match(res.body.toString(), /<script src="\/x\.js"><\/script>/);
});

test("leaves a page that already has the tag alone", () => {
  const html = `<!doctype html><html><head>${TAG}</head><body></body></html>`;
  const { res } = handle(
    "/",
    fakeRes({ headers: { "content-type": "text/html", "content-length": html.length } })
  );
  res.end(html);
  assert.equal(res.body.toString(), html);
  assert.equal(res.getHeader("content-length"), html.length);
});

test("never touches non-HTML responses", () => {
  for (const contentType of ["application/json", "text/javascript", "image/svg+xml"]) {
    const payload = '{"a":1}';
    const { res } = handle(
      "/api/thing",
      fakeRes({ headers: { "content-type": contentType, "content-length": payload.length } })
    );
    res.end(payload);
    assert.equal(res.body, payload, contentType);
    assert.equal(res.getHeader("content-length"), payload.length, contentType);
  }
});

test("survives a body-less response", () => {
  const res = fakeRes({ headers: { "content-type": "text/html" } });
  handle("/", res);
  // 204/304 have no body: res.end() must still be called, with the original
  // arguments passed straight through.
  assert.doesNotThrow(() => res.end());
  assert.equal(res.body, undefined);
});

test("skips a chunked HTML response instead of hijacking the stream", () => {
  const res = fakeRes({
    headers: { "content-type": "text/html", "transfer-encoding": "chunked" },
  });
  const { passed } = handle("/", res);
  assert.equal(passed, true);
  // res.end was left alone, so a streamed body still reaches the client intact.
  res.end("<html><head></head><body>streamed</body></html>");
  assert.equal(res.body.toString(), "<html><head></head><body>streamed</body></html>");
});

test("a throwing setHeader still delivers the page, tag and all", () => {
  const { res } = handle("/", fakeRes({ headers: { "content-type": "text/html", "content-length": 10 } }));
  // A response whose header store explodes must not take the page down with it.
  res.setHeader = () => {
    throw new Error("boom");
  };
  assert.doesNotThrow(() => res.end("<html><head></head><body>hi</body></html>"));
  assert.match(res.body.toString(), /defer><\/script>/);
  assert.match(res.body.toString(), /<body>hi<\/body>/);
});

test("a response whose getHeader throws still defers to next()", () => {
  const res = fakeRes();
  res.getHeader = () => {
    throw new Error("boom");
  };
  // Must not escape: an exception here would 500 the user's page.
  const out = handle("/", res);
  assert.equal(out.passed, true);
  // Nothing was written; the user's handler owns the response.
  assert.equal(res.body, undefined);
});

test("injects a body split across write() and end()", () => {
  const res = fakeRes({ headers: { "content-type": "text/html", "content-length": 20 } });
  const written = [];
  res.write = (chunk) => written.push(String(chunk));
  handle("/", res);

  res.write("<!doctype html><html><head><title>t</title>");
  res.end("</head><body>hi</body></html>");

  const out = res.body.toString();
  assert.match(out, /<script src="\/__edityy\/edityy\.js" defer><\/script><\/head>/);
  assert.match(out, /<body>hi<\/body>/);
  assert.equal(res.getHeader("content-length"), Buffer.byteLength(out));
  // The head was held back rather than written straight to the wire.
  assert.deepEqual(written, []);
});

test("a write() with no end() body still flushes on end()", () => {
  const res = fakeRes({ headers: { "content-type": "text/html" } });
  res.write = () => {};
  handle("/", res);
  res.write("<html><head></head><body>x</body></html>");
  res.end();
  assert.match(res.body.toString(), /defer><\/script>/);
});

test("encodes correctly for a multi-byte body", () => {
  const res = fakeRes({ headers: { "content-type": "text/html; charset=utf-8", "content-length": 1 } });
  handle("/", res);
  res.end("<html><head></head><body>café ✓</body></html>");
  const out = res.body.toString();
  assert.match(out, /café ✓/);
  assert.equal(res.getHeader("content-length"), Buffer.byteLength(out));
});

test("inject() covers the shapes dev servers actually return", () => {
  assert.match(inject("<html><HEAD></HEAD><body></body></html>").toString(), /defer><\/script>/, "uppercase head");
  assert.match(inject("<html><body>no head</body></html>").toString(), /^<script/, "body fragment prepends");

  const full = inject("<html><head><title>t</title></head><body>b</body></html>").toString();
  assert.ok(full.indexOf("defer") < full.indexOf("</head>"), "tag stays in head, so defer is meaningful");
  assert.ok(full.indexOf("defer") > full.indexOf("<title>"), "after existing head content, not before it");

  assert.equal(inject("{\"json\":true}").toString(), "{\"json\":true}", "not html");
  assert.equal(
    inject("<!doctype html><html><head></head><body></body></html>")
      .toString()
      .match(/<script src="\/__edityy\/edityy\.js" defer><\/script>/g).length,
    1
  );
});

test("inject() accepts a Buffer", () => {
  const out = inject(Buffer.from("<html><head></head></html>"));
  assert.equal(typeof out, "string");
  assert.match(out, /defer><\/script>/);
  // Unchanged input comes back as the same Buffer, so callers can skip a rewrite.
  const json = Buffer.from('{"a":1}');
  assert.equal(inject(json), json);
});
test("a nonce goes on the injected tag, so a strict CSP lets it run", () => {
  const { res } = handle("/", fakeRes({ headers: { "content-type": "text/html" } }), { nonce: "abc123" });
  res.end("<html><head></head><body></body></html>");
  assert.match(res.body.toString(), /<script nonce="abc123" src="\/__edityy\/edityy\.js" defer><\/script>/);
});

test("a nonce can come from the request, for apps that make one per response", () => {
  const seen = [];
  const res = fakeRes({ headers: { "content-type": "text/html" } });
  edityy({ nonce: (req) => (seen.push(req.url), "n-" + req.url.length) })({ url: "/page" }, res, () => {});
  res.end("<html><head></head></html>");
  assert.match(res.body.toString(), /nonce="n-5"/);
  assert.deepEqual(seen, ["/page"]);
});

test("a nonce cannot break out of its attribute", () => {
  const { res } = handle("/", fakeRes({ headers: { "content-type": "text/html" } }), { nonce: '"><img onerror=x>' });
  res.end("<html><head></head></html>");
  const out = res.body.toString();
  assert.match(out, /nonce="&quot;&gt;&lt;img onerror=x&gt;"/);
  assert.doesNotMatch(out, /<img/);
});

test("no nonce, no attribute", () => {
  const { res } = handle("/", fakeRes({ headers: { "content-type": "text/html" } }), { nonce: "" });
  res.end("<html><head></head></html>");
  assert.match(res.body.toString(), new RegExp(TAG.replace(/[/.]/g, "\\$&")));
});

test("a nonce function that throws leaves the page alone", () => {
  const res = fakeRes({ headers: { "content-type": "text/html" } });
  const out = { passed: false };
  edityy({ nonce: () => { throw new Error("boom"); } })({ url: "/" }, res, () => (out.passed = true));
  assert.equal(out.passed, true);
  res.end("<html><head></head></html>");
  assert.equal(res.body, "<html><head></head></html>");
});
