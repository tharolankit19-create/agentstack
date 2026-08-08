#!/usr/bin/env node
/**
 * Freezes a tool-name → domain map for the agent catalog.
 *
 * Logos need a domain, and the directory has one for nearly every tool — but
 * the directory is 860 entries and roughly a megabyte, and the places that
 * most need a logo (the dashboard's agent library, the agent cards) are client
 * components. Shipping the whole reference to a browser so it can look up
 * fifteen icons is not a trade worth making.
 *
 * So this extracts only the tools the catalog actually names, which is about a
 * hundred and fifty, and writes them out as a flat map small enough to import
 * anywhere. Server components keep using the directory directly.
 *
 * Runs as part of `npm run bundle`, after the runtime bundle has written
 * templates.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DIRECTORY = path.join(ROOT, "src/data/directory.json");
const TEMPLATES = path.join(ROOT, "src/generated/templates.json");
const OUT = path.join(ROOT, "src/generated/tool-domains.json");

/**
 * Tools our own agent configs name that the directory does not carry.
 *
 * This is the single source of truth for them — replaceability.ts reads the
 * generated file rather than keeping a second copy that can drift.
 */
const CURATED = {
  "AdCreative.ai": "adcreative.ai",
  Appcues: "appcues.com",
  Beamer: "getbeamer.com",
  Birdeye: "birdeye.com",
  "Copy.ai": "copy.ai",
  Crayon: "crayon.co",
  Databox: "databox.com",
  "F5Bot Pro": "f5bot.com",
  Fireflies: "fireflies.ai",
  Geckoboard: "geckoboard.com",
  "HelpScout Docs": "helpscout.com",
  "HubSpot Sales": "hubspot.com",
  "Intercom Articles": "intercom.com",
  Klue: "klue.com",
  LaunchNotes: "launchnotes.com",
  Lever: "lever.co",
  Madgicx: "madgicx.com",
  Munch: "getmunch.com",
  "Otter.ai": "otter.ai",
  "Perplexity Pro": "perplexity.ai",
  Qwilr: "qwilr.com",
  "Repurpose.io": "repurpose.io",
  "Reputation.com": "reputation.com",
  Syften: "syften.com",
  Userflow: "userflow.com",
  VidIQ: "vidiq.com",
  Workable: "workable.com",
};

/** Same rule as toSlug() in src/lib/replaceability.ts. Keep them in step. */
function toSlug(tool) {
  return tool
    .toLowerCase()
    .replace(/\.[a-z]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main() {
  const directory = JSON.parse(readFileSync(DIRECTORY, "utf8"));
  const templates = JSON.parse(readFileSync(TEMPLATES, "utf8"));

  const fromDirectory = new Map(
    directory.filter((entry) => entry.domain).map((entry) => [entry.slug, entry.domain]),
  );

  const out = {};
  let missing = 0;

  for (const template of templates) {
    for (const tool of template.replaces?.tools ?? []) {
      const slug = toSlug(tool);
      const domain = CURATED[tool] ?? fromDirectory.get(slug);
      if (!domain) {
        missing += 1;
        console.warn(`[domains] no domain for "${tool}" — it will render as a letter tile`);
        continue;
      }
      out[slug] = domain;
    }
  }

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(
    `[domains] ${Object.keys(sorted).length} tools → src/generated/tool-domains.json` +
      (missing > 0 ? ` (${missing} without one)` : ""),
  );
}

main();
