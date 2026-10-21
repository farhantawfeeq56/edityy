// Checks the chrome's stylesheet for a rule that is not closed. Run: npm test
//
// The sheet is written as an array of strings, one per rule. A rule whose
// closing brace is missing does not break the page loudly: the parser reads
// the next rule as part of it, and every rule after that is dropped. The
// chrome then wears half a sheet and nobody can say why.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");

/** The sheet the chrome paints itself with, as one string. */
function sheet() {
  const start = source.indexOf("root.innerHTML = [");
  const end = source.indexOf('].join("");');
  assert.ok(start !== -1 && end !== -1, "the sheet is where it was expected");
  const body = source.slice(start + "root.innerHTML = [".length, end);
  const strings = [];
  const pattern = /"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = pattern.exec(body))) {
    strings.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return strings.join("");
}

// The blocks that may hold other blocks: a keyframe list and a media query.
const nested = /^@(keyframes|media|supports|layer|container|scope|document)\b/;

test("every rule in the sheet is closed", () => {
  const css = sheet();
  const problems = [];
  const open = [];
  let topEnd = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      const parent = open[open.length - 1];
      if (parent && !nested.test(parent.selector)) {
        problems.push(parent.selector.slice(-80));
      }
      const from = parent ? parent.bodyStart : topEnd;
      const selector = css.slice(from, i).trim().split("}").pop().trim().split("\n").pop().trim();
      open.push({ selector: selector, bodyStart: i + 1 });
    } else if (c === "}") {
      assert.ok(open.length, "a rule is closed twice");
      open.pop();
      if (!open.length) topEnd = i + 1;
    }
  }
  assert.deepEqual([...new Set(problems)], [], "a rule is not closed");
  assert.equal(open.length, 0, "the sheet is closed at the end");
});
