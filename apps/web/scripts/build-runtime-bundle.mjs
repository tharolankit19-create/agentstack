#!/usr/bin/env node
/**
 * Freezes apps/hermes-core into two generated files:
 *
 *   src/generated/runtime-bundle.json — every source file of the agent engine,
 *     as {path, content}. The deploy route uploads exactly these files to
 *     Vercel, so a customer's agent is byte-for-byte the engine in this repo.
 *
 *   src/generated/templates.json — the parsed template configs, so the
 *     dashboard renders its config forms from the same config.json the agent
 *     reads at runtime. One source of truth, no drift.
 *
 * Reading the sibling workspace directly at request time would not survive
 * Next's file tracing on Vercel, which is why this runs at build.
 */

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const coreRoot = path.resolve(webRoot, "../hermes-core");
const outDir = path.join(webRoot, "src/generated");

/** Directories that must never reach a customer's deployment. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".turbo",
  "dist",
  "build",
]);

/** Files that must never reach a customer's deployment. */
const SKIP_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development.local",
  ".env.production.local",
  "next-env.d.ts",
  ".DS_Store",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".txt",
  ".md",
  ".css",
]);

const MAX_FILE_BYTES = 1_000_000;

async function collect(dir, base = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await collect(path.join(dir, entry.name), relative)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;

    // .env.example is documentation; every other .env* is a credential file.
    if (entry.name.startsWith(".env") && entry.name !== ".env.example") continue;

    const extension = path.extname(entry.name);
    if (!ALLOWED_EXTENSIONS.has(extension)) continue;

    const content = await readFile(path.join(dir, entry.name), "utf8");
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) {
      console.warn(`[bundle] skipping oversized file: ${relative}`);
      continue;
    }
    files.push({ path: relative, content });
  }

  return files;
}

async function main() {
  const files = await collect(coreRoot);

  if (!files.some((f) => f.path === "package.json")) {
    throw new Error(`No package.json found under ${coreRoot}. Is the path right?`);
  }

  // The bundle is a deployable app, not a workspace member: a Vercel build of
  // these files alone must not try to resolve a monorepo root that is not there.
  const packageIndex = files.findIndex((f) => f.path === "package.json");
  const pkg = JSON.parse(files[packageIndex].content);
  delete pkg.workspaces;
  pkg.name = "agentstack-agent";
  pkg.private = true;
  files[packageIndex] = {
    path: "package.json",
    content: `${JSON.stringify(pkg, null, 2)}\n`,
  };

  const templates = files
    .filter((f) => /^templates\/[^/]+\/config\.json$/.test(f.path))
    .map((f) => JSON.parse(f.content))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (templates.length === 0) {
    throw new Error("No template config.json files were found.");
  }

  // A leaked secret in the bundle would be copied into every customer's
  // deployment, so fail the build rather than ship one.
  for (const file of files) {
    if (file.path === ".env.example") continue;
    const suspicious = file.content.match(/\bsk-[A-Za-z0-9_-]{20,}/);
    if (suspicious) {
      throw new Error(
        `Refusing to bundle ${file.path}: it contains what looks like a live API key.`,
      );
    }
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "runtime-bundle.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        fileCount: files.length,
        files,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outDir, "templates.json"),
    `${JSON.stringify(templates, null, 2)}\n`,
  );

  const bytes = files.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
  console.log(
    `[bundle] ${files.length} files (${(bytes / 1024).toFixed(0)} KB), ` +
      `${templates.length} templates: ${templates.map((t) => t.id).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(`[bundle] failed: ${error.message}`);
  process.exit(1);
});
