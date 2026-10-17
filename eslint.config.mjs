import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    "next-env.d.ts",
    // Built from packages/edityy/sweep by `npm run build:sweep`. Minified React,
    // so there is nothing here for a linter to read.
    "packages/edityy/src/ascii-sweep.js",
  ]),
]);

export default eslintConfig;
