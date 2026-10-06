// Checks that the hand-written declarations cover every runtime export, so a new
// export cannot ship untyped. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** The names a .d.ts declares as values: consts, functions and the default. */
const declared = (file) => {
  const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const names = [...text.matchAll(/export declare (?:const|function) (\w+)/g)].map((m) => m[1]);
  if (/export default \w+;/.test(text)) names.push("default");
  return names.sort();
};

test("every entry point has a types condition that exists", () => {
  for (const [entry, target] of Object.entries(pkg.exports)) {
    assert.equal(typeof target, "object", `${entry} has conditions`);
    assert.ok(target.types, `${entry} has types`);
    assert.doesNotThrow(() => readFileSync(new URL("../" + target.types, import.meta.url)), `${entry}: ${target.types}`);
  }
  assert.equal(pkg.types, pkg.exports["."].types);
});

test("the declarations name every runtime export", async () => {
  for (const entry of [".", "./vite"]) {
    const { types, default: js } = pkg.exports[entry];
    // client.js is imported for its side effect and is not loaded here: it
    // mounts the launcher into whatever document exists.
    const runtime = Object.keys(await import(new URL("../" + js, import.meta.url))).sort();
    assert.deepEqual(declared(types), runtime, entry);
  }
});
