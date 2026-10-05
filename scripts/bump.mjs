// Bumps packages/edityy for a release: the version in package.json and
// package-lock.json, the CHANGELOG's Unreleased heading, and the root range when
// it would no longer cover the new version. Merging the result to main publishes
// it (.github/workflows/release.yml).
//
//   npm run bump -- patch | minor | major | <x.y.z[-pre]>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function nextVersion(current, bump) {
  const m = SEMVER.exec(current);
  if (!m) throw new Error(`Current version "${current}" is not semver.`);
  const [major, minor, patch] = m.slice(1, 4).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  // A prerelease of x.y.z bumps to x.y.z itself, as `npm version patch` does.
  if (bump === "patch") return m[4] ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
  if (SEMVER.test(bump)) return bump;
  throw new Error(`"${bump}" is not patch, minor, major or a semver version.`);
}

// Whether a caret range like ^0.1.1 covers version. Only the forms this repo
// uses: ^x.y.z, or * which covers everything.
export function caretCovers(range, version) {
  if (range === "*") return true;
  const r = SEMVER.exec(range.replace(/^\^/, ""));
  const v = SEMVER.exec(version);
  if (!range.startsWith("^") || !r || !v) return false;
  const [ra, rb, rc] = r.slice(1, 4).map(Number);
  const [va, vb, vc] = v.slice(1, 4).map(Number);
  const atLeast = va !== ra ? va > ra : vb !== rb ? vb > rb : vc >= rc;
  if (!atLeast || v[4]) return false;
  if (ra > 0) return va === ra;
  if (rb > 0) return va === 0 && vb === rb;
  return va === 0 && vb === 0 && vc === rc;
}

export function releaseChangelog(text, version, date) {
  const heading = /^## Unreleased[ \t]*$/m;
  const match = heading.exec(text);
  if (!match) throw new Error('CHANGELOG.md has no "## Unreleased" section to release.');
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  if (!(next === -1 ? rest : rest.slice(0, next)).trim()) {
    throw new Error('The "## Unreleased" section of CHANGELOG.md is empty. Add the notes first.');
  }
  return text.replace(heading, `## ${version} — ${date}`);
}

function setVersionField(text, from, to) {
  const field = `"version": "${from}"`;
  if (!text.includes(field)) throw new Error(`Could not find ${field}.`);
  return text.replace(field, `"version": "${to}"`);
}

function main(bump) {
  const root = new URL("../", import.meta.url);
  const file = (path) => new URL(path, root);
  const read = (path) => readFileSync(file(path), "utf8");

  const pkgPath = "packages/edityy/package.json";
  const current = JSON.parse(read(pkgPath)).version;
  const version = nextVersion(current, bump);
  const date = new Date().toLocaleDateString("en-CA");

  // Compute every change before writing any, so a failure leaves no half bump.
  const writes = {
    [pkgPath]: setVersionField(read(pkgPath), current, version),
    "packages/edityy/CHANGELOG.md": releaseChangelog(read("packages/edityy/CHANGELOG.md"), version, date),
  };

  let lock = read("package-lock.json");
  const entry = `"packages/edityy": {\n      "version": "${current}"`;
  if (!lock.includes(entry)) throw new Error("package-lock.json has no packages/edityy entry at the current version.");
  lock = lock.replace(entry, `"packages/edityy": {\n      "version": "${version}"`);

  // The site uses the workspace copy only while the root range covers it (#45).
  const rootPkg = JSON.parse(read("package.json"));
  const range = rootPkg.dependencies?.edityy ?? rootPkg.devDependencies?.edityy;
  if (range && !caretCovers(range, version)) {
    const from = `"edityy": "${range}"`;
    writes["package.json"] = read("package.json").replace(from, `"edityy": "^${version}"`);
    lock = lock.replace(from, `"edityy": "^${version}"`);
  }
  writes["package-lock.json"] = lock;

  for (const [path, text] of Object.entries(writes)) writeFileSync(file(path), text);
  console.log(`edityy ${current} -> ${version}\n${Object.keys(writes).join("\n")}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bump = process.argv[2];
  if (!bump) {
    console.error("Usage: npm run bump -- patch | minor | major | <x.y.z[-pre]>");
    process.exit(2);
  }
  try {
    main(bump);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
