// Checks what the edityy tarball ships. Run from CI after `npm pack --dry-run --json`:
//   node scripts/check-pack.mjs <pack.json>
// Add a file here when the package starts to ship it. The list lives outside the
// workflow, so a PR that adds a package file does not change CI.
import { readFileSync } from "node:fs";

const want = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "package.json",
  "src/client.js",
  "src/edityy.js",
  "src/index.js",
  "src/vite.js",
];

const [pkg] = JSON.parse(readFileSync(process.argv[2], "utf8"));
const files = pkg.files.map((f) => f.path).sort();
console.log(files.join("\n"));
const missing = want.filter((f) => !files.includes(f));
const extra = files.filter((f) => !want.includes(f));
if (missing.length || extra.length) {
  console.error("missing:", missing, "unexpected:", extra);
  process.exit(1);
}
