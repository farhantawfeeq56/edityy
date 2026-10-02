// Applies db/schema.sql to DATABASE_URL, one statement at a time (the HTTP driver
// rejects multi-statement queries). Idempotent.
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const file = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = file
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

const sql = neon(url);
for (const statement of statements) await sql.query(statement);
console.log(`applied ${statements.length} statements`);