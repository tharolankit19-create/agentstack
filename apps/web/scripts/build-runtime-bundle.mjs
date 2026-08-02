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

/**
 * Every tool a template names must exist in the shared registry, and every
 * prompt it names must exist on disk.
 *
 * This runs on every build of the SaaS, so a typo in a config fails here — not
 * at 9am on a customer's deployed agent, where the only symptom is an agent
 * that silently stops doing its job.
 */
function validate(templates, files) {
  const registry = files.find((f) => f.path === "src/tools/index.ts");
  if (!registry) throw new Error("src/tools/index.ts is missing from the bundle.");

  const registered = new Set(
    [...registry.content.matchAll(/^\s{2}([a-z_]+):\s/gm)].map((m) => m[1]),
  );
  const paths = new Set(files.map((f) => f.path));
  const problems = [];

  for (const template of templates) {
    for (const tool of template.tools ?? []) {
      if (!registered.has(tool)) {
        problems.push(`${template.id}: tool "${tool}" is not in the tool registry`);
      }
    }
    for (const prompt of template.prompts ?? []) {
      const file = `templates/${template.id}/prompts/${prompt}.txt`;
      if (!paths.has(file)) problems.push(`${template.id}: missing ${file}`);
    }
    if (!template.prompts?.includes("system")) {
      problems.push(`${template.id}: every template needs a system prompt`);
    }
    if (!template.replaces?.tools?.length || !template.replaces?.monthlyUsd) {
      problems.push(`${template.id}: needs replaces.tools and replaces.monthlyUsd`);
    }
    // Required settings the agent's own prompts reference but nobody collects
    // would surface as literal {{placeholders}} in a customer's output.
    const declared = new Set((template.settings ?? []).map((s) => s.key));
    for (const prompt of template.prompts ?? []) {
      const body =
        files.find((f) => f.path === `templates/${template.id}/prompts/${prompt}.txt`)
          ?.content ?? "";
      for (const [, key] of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        if (key === "source" || key === "brief") continue;
        if (!declared.has(key)) {
          problems.push(
            `${template.id}/${prompt}.txt uses {{${key}}}, which is not a setting`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Template catalog is invalid:\n  - ${problems.join("\n  - ")}`);
  }
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

  validate(templates, files);

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
