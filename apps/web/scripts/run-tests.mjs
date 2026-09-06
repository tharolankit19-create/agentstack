/**
 * Compile the tests and run them, with no test framework.
 *
 * `src/lib/providers.ts` imports `server-only`, whose entire job is to throw
 * outside a Next request — so it is stripped from a scratch copy rather than
 * stubbed, which keeps the source honest and the test runnable.
 */
import { mkdtempSync, copyFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");
const work = mkdtempSync(join(tmpdir(), "agentstack-tests-"));

mkdirSync(join(work, "src", "lib"), { recursive: true });
mkdirSync(join(work, "tests"), { recursive: true });

const source = readFileSync(join(web, "src/lib/providers.ts"), "utf8");
writeFileSync(
  join(work, "src/lib/providers.ts"),
  source.replace(/^import "server-only";\s*$/m, ""),
);

const tests = readdirSync(join(web, "tests")).filter((f) => f.endsWith(".test.ts"));
for (const file of tests) copyFileSync(join(web, "tests", file), join(work, "tests", file));

// Plain-JS tests need no compiler; they exercise logic copied out of a client
// component, where there is no server-only import to strip.
const jsTests = readdirSync(join(web, "tests")).filter((f) => f.endsWith(".test.mjs"));

// Run from the workspace, not the scratch dir: tsc resolves @types/node
// through node_modules, and the scratch dir has none.
execFileSync(
  "npx",
  [
    "tsc",
    ...tests.map((f) => join(work, "tests", f)),
    join(work, "src/lib/providers.ts"),
    "--module", "nodenext",
    "--moduleResolution", "nodenext",
    "--target", "es2022",
    "--skipLibCheck",
    "--rootDir", work,
    "--outDir", join(work, "out"),
  ],
  { cwd: web, stdio: "inherit" },
);

let failed = 0;
for (const file of tests) {
  const name = file.replace(/\.ts$/, ".js");
  console.log(`\n── ${file}`);
  try {
    execFileSync("node", [join(work, "out", "tests", name)], { stdio: "inherit" });
  } catch {
    failed += 1;
  }
}

for (const file of jsTests) {
  console.log(`\n── ${file}`);
  try {
    execFileSync("node", [join(web, "tests", file)], { stdio: "inherit" });
  } catch {
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}
console.log("\nAll test files passed.");
