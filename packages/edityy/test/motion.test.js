// Checks that the package and the site run on one set of motion tokens. Run: npm test
//
// The tokens live in src/motion.css, which the site imports. The chrome runs
// inside a shadow root on somebody else's page, so it cannot read that file:
// it carries the same values as a fallback. This test is what holds the two
// copies together, and what keeps a third copy from appearing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../src/motion.css", import.meta.url), "utf8");
const payload = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");

/** The `--edityy-*` declarations in the stylesheet's :root block. */
const declared = () => {
  const out = {};
  for (const match of css.matchAll(/--edityy-([a-z-]+):\s*([^;]+);/g)) out[match[1]] = match[2].trim();
  return out;
};

/** The values the payload carries, read out of the two objects it declares. */
const carried = (name) => {
  const block = payload.match(new RegExp("var " + name + " = \\{([\\s\\S]*?)\\n  \\};"));
  assert.ok(block, name + " is declared in the payload");
  const out = {};
  for (const match of block[1].matchAll(/(\w+):\s*(?:"([^"]+)"|(\d+))/g)) {
    out[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return out;
};

test("the chrome carries the same curves as the stylesheet", () => {
  const want = declared();
  const ease = carried("EASE");
  for (const [name, value] of Object.entries(ease)) {
    assert.equal(want["ease-" + name], value, "the curve " + name);
  }
  assert.equal(Object.keys(ease).length, 5, "five curves, and no more");
});

test("the chrome carries the same durations as the stylesheet", () => {
  const want = declared();
  const time = carried("TIME");
  for (const [name, value] of Object.entries(time)) {
    assert.equal(want[name], value + "ms", "the duration " + name);
  }
  assert.equal(Object.keys(time).length, 9, "nine durations, and no more");
});

test("the stylesheet names every token the chrome wears", () => {
  const want = declared();
  const ease = carried("EASE");
  const time = carried("TIME");
  for (const name of Object.keys(ease)) assert.ok(want["ease-" + name], "the curve " + name);
  for (const name of Object.keys(time)) assert.ok(want[name], "the duration " + name);
});

/** The payload without the reduced-motion rule: it is the one place a
    duration is written out, because it says "no duration at all". */
const withoutPolicy = (text) => text.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\{[^}]*\}[^}]*\}/g, "");

test("the sheet invents no timing of its own", () => {
  // The sheet is the CSS the chrome paints itself with. Every duration and
  // every curve in it is a token, so a page that sets its own timing gets it
  // everywhere and not in half the places.
  const sheet = payload.slice(payload.indexOf("root.innerHTML = ["), payload.indexOf("].join(\"\");"));
  const timings = [...withoutPolicy(sheet).matchAll(/cubic-bezier\([^)]*\)|[0-9]*\.?[0-9]+m?s\b/g)].map((m) => m[0]);
  assert.deepEqual(timings, [], "the sheet names a timing of its own");
});

test("no animation is given a duration of its own", () => {
  // The animations the payload starts read the same tokens the sheet does.
  const timings = [...withoutPolicy(payload).matchAll(/duration:\s*(\d+)/g)].map((m) => m[1]);
  assert.deepEqual(timings, [], "an animation is given a literal duration");
});

test("the reduced-motion policy is one rule in both places", () => {
  // The site and the chrome are two scopes, so the rule is written twice, but
  // it says the same thing: every duration collapses and every animation runs
  // once and stops.
  const rule = /animation-duration:\s*1ms\s*!important;\s*animation-iteration-count:\s*1\s*!important;\s*transition-duration:\s*1ms\s*!important;\s*transition-delay:\s*0ms\s*!important/;
  assert.match(css, rule, "the site's rule");
  assert.match(payload, rule, "the chrome's rule");
});
