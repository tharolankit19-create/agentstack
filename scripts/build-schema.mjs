#!/usr/bin/env node
/**
 * Regenerates supabase/schema.sql from the migrations.
 *
 * The migrations are the source of truth; schema.sql exists so that setting up
 * a fresh project is one paste instead of several, which is the difference
 * between a setup step people do and one they postpone.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");

const header = `-- AgentStack — the complete schema, in one file.
--
-- Paste this whole file into your Supabase project's SQL Editor and hit Run.
-- It is the concatenation of everything in supabase/migrations/, in order, so
-- a fresh project needs exactly one action instead of several.
--
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Already ran some migrations individually? Run only the ones you have not,
-- and skip this file — it assumes a clean project and will error on objects
-- that already exist.
--
-- Verify afterwards with:
--   curl -s https://your-app.vercel.app/api/health | jq .database
--
-- Generated from the migrations. Do not edit by hand; edit a migration and
-- regenerate with: node scripts/build-schema.mjs

`;

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
const parts = [header];

for (const file of files) {
  const rule = "=".repeat(72);
  parts.push(`\n-- ${rule}\n-- ${file}\n-- ${rule}\n\n`);
  parts.push(await readFile(path.join(migrationsDir, file), "utf8"));
}

await writeFile(path.join(root, "supabase/schema.sql"), parts.join(""));
console.log(`[schema] combined ${files.length} migrations: ${files.join(", ")}`);
