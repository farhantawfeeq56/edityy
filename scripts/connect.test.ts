// Regression check for the V1 connection: URL guard + launcher injection.
// Run: npm run test
import assert from "node:assert/strict";
import { test } from "node:test";
import { injectLauncher, normalizeTarget } from "../app/launcher/connect.ts";

test("only loopback and private hosts are accepted", () => {
  assert.equal(normalizeTarget("localhost:3000").href, "http://localhost:3000/");
  assert.equal(normalizeTarget("http://127.0.0.1:8080/foo").href, "http://127.0.0.1:8080/");
  assert.equal(normalizeTarget(" http://192.168.1.7:5173 ").href, "http://192.168.1.7:5173/");
  assert.throws(() => normalizeTarget("https://example.com"), /only connects/);
  assert.throws(() => normalizeTarget("file:///etc/passwd"), /only connects/);
  assert.throws(() => normalizeTarget("http://127.0.0.1.example.com"), /only connects/);
});

test("launcher style and script land in head and body", () => {
  const html = injectLauncher("<html><head><title>t</title></head><body><p>hi</p></body></html>");
  assert.match(html, /<head>[\s\S]*data-edityy-launcher[\s\S]*<\/head>/);
  assert.match(html, /<body>[\s\S]*<script data-edityy-launcher>[\s\S]*<\/body>/);
  assert.match(html, /position:fixed;right:24px;bottom:24px/);
  assert.match(html, /z-index:2147483647/);
  assert.match(html, /width:56px;height:56px;border-radius:50%/);
  assert.match(html, /aria-label/);
  assert.match(html, /<p>hi<\/p>/);
});

test("injection is idempotent and survives missing tags", () => {
  const once = injectLauncher("<html><head></head><body></body></html>");
  assert.equal(injectLauncher(once), once);
  const bare = injectLauncher("<p>fragment</p>");
  assert.equal(bare, "<p>fragment</p>"); // nothing to inject into, nothing breaks
});

test("a meta CSP cannot block the frame itself", () => {
  const out = injectLauncher(
    '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; frame-ancestors \'none\'"></head><body></body></html>',
  );
  assert.doesNotMatch(out, /frame-ancestors/);
  assert.match(out, /default-src 'self'/); // the rest of the policy survives
});
