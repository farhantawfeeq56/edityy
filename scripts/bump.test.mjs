import assert from "node:assert/strict";
import { test } from "node:test";
import { caretCovers, nextVersion, releaseChangelog } from "./bump.mjs";

test("nextVersion bumps each part and accepts an exact version", () => {
  assert.equal(nextVersion("0.1.2", "patch"), "0.1.3");
  assert.equal(nextVersion("0.1.2", "minor"), "0.2.0");
  assert.equal(nextVersion("0.1.2", "major"), "1.0.0");
  assert.equal(nextVersion("1.0.0-beta.1", "patch"), "1.0.0");
  assert.equal(nextVersion("0.1.2", "1.0.0-beta.1"), "1.0.0-beta.1");
  assert.throws(() => nextVersion("0.1.2", "huge"), /not patch, minor, major/);
});

test("caretCovers follows npm's caret rules for 0.x", () => {
  assert.equal(caretCovers("^0.1.1", "0.1.2"), true);
  assert.equal(caretCovers("^0.1.1", "0.2.0"), false);
  assert.equal(caretCovers("^0.1.1", "0.1.0"), false);
  assert.equal(caretCovers("^1.2.0", "1.9.0"), true);
  assert.equal(caretCovers("^1.2.0", "2.0.0"), false);
  assert.equal(caretCovers("^0.0.3", "0.0.4"), false);
  assert.equal(caretCovers("^1.0.0", "1.1.0-beta.1"), false);
  assert.equal(caretCovers("*", "3.0.0"), true);
});

const changelog = `# Changelog

## Unreleased

### Fixed

- A thing.

## 0.1.2 — 2026-10-04

- Older.
`;

test("releaseChangelog dates the Unreleased section", () => {
  const out = releaseChangelog(changelog, "0.1.3", "2026-10-05");
  assert.match(out, /^## 0\.1\.3 — 2026-10-05$/m);
  assert.doesNotMatch(out, /Unreleased/);
  assert.match(out, /^## 0\.1\.2 — 2026-10-04$/m);
});

test("releaseChangelog refuses a missing or empty Unreleased section", () => {
  assert.throws(() => releaseChangelog("# Changelog\n\n## 0.1.2\n", "0.1.3", "d"), /no "## Unreleased"/);
  assert.throws(
    () => releaseChangelog("# Changelog\n\n## Unreleased\n\n## 0.1.2\n\n- x\n", "0.1.3", "d"),
    /is empty/,
  );
});
