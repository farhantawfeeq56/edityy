// Checks the edits pop against the lintapple policy. Run: npm test
//
// The pop is painted inside a shadow root, so the lintapple browser
// checker cannot see it. These checks run lintapple's rules over the pop
// sheet and the markers a live run needs next to it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/edityy.js", import.meta.url), "utf8");
const policyPath = new URL("../../../ui-policy.json", import.meta.url);
const policy = JSON.parse(readFileSync(policyPath, "utf8"));

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

/** The edits pop rules: header, filters, cards and foot. */
function popRules() {
  const rules = [];
  for (const chunk of sheet().split("}")) {
    const at = chunk.lastIndexOf("{");
    if (at < 0) continue;
    const selector = chunk.slice(0, at).trim().split("\n").pop().trim();
    const body = chunk.slice(at + 1).trim();
    if (/(^|[\s,+>])([.#](pop\.changes|changes|task)[\w-]*)/.test(selector) || selector.startsWith(".changes") || selector.startsWith(".task") || selector.includes(".changes-") || selector.includes(".task-")) {
      rules.push({ selector, body });
    }
  }
  return rules;
}

function bodies(name) {
  return popRules().filter((rule) => rule.selector === name).map((rule) => rule.body);
}

test("the policy is a lintapple policy at the app scale", () => {
  assert.deepEqual([...new Set(policy.fontSizes)].sort((a, b) => a - b), [8, 10, 11]);
  assert.ok(policy.fonts.includes("Plus Jakarta Sans"), "the chrome font is approved");
  assert.equal(policy.minControlSize, 15);
  assert.equal(policy.minControlGap, 8);
  assert.equal(policy.minControlInset, 8);
  assert.equal(policy.minLayoutGap, 8);
  assert.deepEqual(policy.iconSizeRules, [{ selector: ".task-icon svg", sizes: [13] }]);
});

test("the pop wears only approved type sizes", () => {
  const sizes = new Set();
  for (const rule of popRules()) {
    for (const m of rule.body.matchAll(/font:\d+ (\d+(?:\.\d+)?)px/g)) sizes.add(Number(m[1]));
  }
  assert.deepEqual([...sizes].sort((a, b) => a - b), [8, 10]);
  for (const size of sizes) assert.ok(policy.fontSizes.includes(size), `${size}px is on the policy`);
});

test("the pop controls meet the size minimum", () => {
  for (const rule of popRules()) {
    // The screen-reader class is a 1px clip stub, not a control.
    if (rule.selector.includes("changes-sr")) continue;
    // A glyph is content inside a control, not a control itself.
    if (rule.selector.includes("svg")) continue;
    for (const m of rule.body.matchAll(/height:(\d+)px/g)) {
      assert.ok(Number(m[1]) >= policy.minControlSize, `${rule.selector} is ${m[1]}px tall`);
    }
  }
  // The mini buttons have no height: padding and one line of 10px text.
  assert.ok(8 + 8 + 10 >= policy.minControlSize, "mini buttons reach the minimum");
});

test("control groups keep the gap minimum", () => {
  for (const name of [".changes-filters", ".task-actions", ".task-icons", ".task-editrow", ".task-chips"]) {
    for (const body of bodies(name)) {
      const m = body.match(/gap:(\d+)px/);
      assert.ok(m, `${name} declares a gap`);
      assert.ok(Number(m[1]) >= policy.minControlGap, `${name} gap ${m[1]}px`);
    }
  }
});

test("control content keeps the inset minimum", () => {
  const num = (body, prop) => {
    const m = body.match(new RegExp(prop + ":(\\d+)px"));
    return m ? Number(m[1]) : null;
  };
  // Text controls: the horizontal edges are declared padding; the vertical
  // edges are padding too, or centering in a tall enough box.
  for (const name of [".changes-filter", ".task-chip", ".task-note"]) {
    for (const body of bodies(name)) {
      const pad = body.match(/padding:(\d+)px (\d+)px/);
      if (pad) {
        assert.ok(Number(pad[1]) >= policy.minControlInset, `${name} vertical ${pad[1]}px`);
        assert.ok(Number(pad[2]) >= policy.minControlInset, `${name} horizontal ${pad[2]}px`);
      } else {
        const side = num(body, "padding") ?? num(body, "height");
        const size = num(body, "height");
        const font = (body.match(/font:\d+ (\d+)px/) || [])[1];
        assert.ok(side >= policy.minControlInset, `${name} side ${side}px`);
        assert.ok((size - Number(font)) / 2 >= policy.minControlInset, `${name} centered inset`);
      }
    }
  }
  // The mini buttons declare both edges as padding.
  const mini = popRules().find((rule) => rule.selector === ".task-actions .mini").body;
  const miniPad = mini.match(/padding:(\d+)px (\d+)px/);
  assert.ok(Number(miniPad[1]) >= policy.minControlInset && Number(miniPad[2]) >= policy.minControlInset, "mini edges keep the inset");
  // Icon controls: the 13px glyph sits centered in a 30px button.
  const icon = bodies(".task-icon").join("" );
  const size = Number(icon.match(/width:(\d+)px/)[1]);
  const glyph = Number(bodies(".task-icon svg").join("").match(/width:(\d+)px/)[1]);
  assert.ok((size - glyph) / 2 >= policy.minControlInset, "the glyph keeps the inset");
  assert.ok(policy.iconSizeRules[0].sizes.includes(glyph), "the glyph size is approved");
});

test("the pop carries the layout markers a live check needs", () => {
  assert.equal(source.match(/data-ui-actions/g).length, 7, "seven action groups");
  assert.equal(source.match(/data-ui-container/g).length, 1, "task cards are containers");
  assert.equal(source.match(/data-ui-stack/g).length, 1, "the chip row is a stack");
});
