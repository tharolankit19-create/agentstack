// Screenshots of the built Next.js product. No seeded metrics or provider fixtures.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const origin = "http://127.0.0.1:3002";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "apps/web", "-H", "127.0.0.1", "-p", "3002"], { stdio: ["ignore", "pipe", "pipe"] });
let browser;
try {
  let ready = false;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Next.js exited before becoming ready");
    try { if ((await fetch(origin, {signal: AbortSignal.timeout(1000)})).ok) {ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  assert(ready, "Built Next.js server must respond");
  browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(origin);
  await page.getByRole("heading", {name:/Your always-on\s*AI marketing operator\./}).waitFor();
  await mkdir("docs/operator/screenshots", {recursive:true});
  await page.screenshot({path:"docs/operator/screenshots/landing-desktop.png",fullPage:true});
  await page.screenshot({path:"docs/operator/screenshots/landing-hero.png"});
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin);
  assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=390,"Landing page must fit mobile viewport");
  await page.screenshot({path:"docs/operator/screenshots/landing-mobile.png",fullPage:true});
  console.log("Built Next.js landing: desktop, mobile and screenshot checks passed");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
