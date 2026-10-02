import { createServer } from "node:http";
import {
  mkdir,
  writeFile,
  readdir,
  realpath,
  readFile,
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { authenticated, validateUrl, body, response } from "./security.mjs";
const token = process.env.KRYX_RUNTIME_TOKEN;
if (!token || token.length < 32)
  throw new Error("Strong runtime token required");
const root = process.env.KRYX_WORKSPACE || "/workspace";
const allowed = new Set(JSON.parse(process.env.KRYX_ALLOWED_DOMAINS || "[]"));
if (!allowed.size) throw new Error("Workspace domain allowlist required");
await mkdir(root + "/downloads", { recursive: true });
await mkdir(root + "/screenshots", { recursive: true });
await mkdir(root + "/files", { recursive: true });
const browser = await chromium.launchPersistentContext(
  root + "/browser-profile",
  {
    headless: true,
    chromiumSandbox: process.env.KRYX_RUNTIME_TEST !== "1",
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    acceptDownloads:
      process.env.KRYX_DOWNLOADS_ENABLED === "1" &&
      !!process.env.KRYX_DOWNLOAD_SCAN_BINARY,
    downloadsPath: root + "/downloads",
    proxy: { server: process.env.KRYX_EGRESS_PROXY || "http://egress:8080" },
    args: ["--disable-quic", "--disable-dev-shm-usage"],
  },
);
await browser.route("**/*", async (route) => {
  try {
    await validateUrl(route.request().url(), allowed);
    await route.continue();
  } catch {
    await route.abort("blockedbyclient");
  }
});
let busy = false;
createServer(async (req, res) => {
  if (!authenticated(req, token))
    return response(res, 401, { error: "Unauthorized" });
  if (req.url === "/health") return response(res, 200, { ready: true });
  if (busy) return response(res, 409, { error: "Workspace computer is busy" });
  busy = true;
  try {
    const input = await body(req);
    if (req.method === "POST" && req.url === "/capture") {
      const url = await validateUrl(input.url, allowed),
        page = await browser.newPage();
      try {
        await page.setViewportSize(
          input.mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
        );
        const nav = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        if (nav && !nav.ok()) throw new Error("Page returned " + nav.status());
        await page.waitForTimeout(500);
        const png = await page.screenshot({ fullPage: true, timeout: 15000 }),
          text = await page.locator("body").innerText({ timeout: 15000 });
        const name =
          Date.now() + "-" + (input.mobile ? "mobile" : "desktop") + ".png";
        await writeFile(root + "/screenshots/" + name, png);
        return response(res, 200, {
          url: page.url(),
          text: text.slice(0, 32000),
          png: png.toString("base64"),
          file: "screenshots/" + name,
        });
      } finally {
        await page.close();
      }
    }
    if (req.url === "/files" && req.method === "POST") {
      const path = resolve(root + "/files", input.path || "");
      if (relative(root + "/files", path).startsWith(".."))
        throw new Error("Path escapes workspace");
      const rp = await realpath(path);
      if (relative(root + "/files", rp).startsWith(".."))
        throw new Error("Symlink escapes workspace");
      const content = await readFile(rp);
      if (content.length > 10 * 1024 * 1024)
        throw new Error("File is too large");
      return response(res, 200, { content: content.toString("base64") });
    }
    if (req.url === "/list" && req.method === "POST")
      return response(res, 200, {
        files: await readdir(root + "/files"),
        downloads: await readdir(root + "/downloads"),
      });
    // Infrastructure endpoint only. Must be called by the governed gateway after an exact command approval.
    if (req.url === "/terminal" && req.method === "POST") {
      if (process.env.KRYX_TERMINAL_ENABLED !== "1")
        throw new Error("Terminal is disabled on this runtime host");
      if (
        input.approved !== true ||
        typeof input.command !== "string" ||
        input.command.length > 8000
      )
        throw new Error("Approved bounded command required");
      const { stdout, stderr } = await promisify(execFile)(
        "/bin/sh",
        ["-c", input.command],
        {
          cwd: root + "/files",
          timeout: 30000,
          maxBuffer: 1000000,
          env: {
            PATH: "/usr/local/bin:/usr/bin:/bin",
            HOME: root + "/files",
            LANG: "C.UTF-8",
          },
        },
      );
      return response(res, 200, {
        stdout: stdout.split(token).join("[REDACTED]"),
        stderr: stderr.split(token).join("[REDACTED]"),
      });
    }
    return response(res, 404, { error: "Unknown runtime action" });
  } catch (e) {
    return response(res, 400, {
      error: e instanceof Error ? e.message : "Computer failed",
    });
  } finally {
    busy = false;
  }
}).listen(Number(process.env.PORT || 8081), "0.0.0.0");
process.on("SIGTERM", () => {
  void browser.close().finally(() => process.exit(0));
});
