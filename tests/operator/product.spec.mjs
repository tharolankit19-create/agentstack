import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("goal -> plan -> durable work -> evidence -> exact approval; survives closing tab", async ({
  page,
  context,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "What should Kryx get done?" }),
  ).toBeVisible();
  await page
    .getByLabel("Marketing goal")
    .fill(
      "Find 20 recently launched SaaS founders and prepare personalized outreach.",
    );
  await page.getByText("Business context & maximum spend").click();
  await page.getByLabel("Verified email sender").fill("owner@company.example");
  await page.getByRole("button", { name: "Start work →" }).click();
  await expect(page.getByRole("button", { name: "Start plan" })).toBeVisible();
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Plan title" })
    .fill("Qualified founders for launch");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Qualified founders for launch" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Research recent launches" }),
  ).toBeVisible();
  mkdirSync("docs/operator/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/operator/screenshots/plan.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start plan" }).click();
  const url = page.url();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(url);
  await expect(
    reopened.getByText(
      "Waiting for you: Send email to founder0@product0.example",
    ),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    reopened.getByText("11 drafts ready; 11 messages awaiting approval"),
  ).toBeVisible();
  await reopened
    .getByRole("button", { name: "Approve this exact email" })
    .first()
    .click();
  await expect(
    reopened.getByText("APPROVED: Send email to founder0@product0.example"),
  ).toBeVisible();
  await reopened
    .getByRole("button", { name: "Artifacts", exact: true })
    .click();
  await expect(reopened.getByText("qualified-leads.csv")).toBeVisible();
  await reopened.getByText("qualified-leads.csv").click();
  const download = reopened.waitForEvent("download");
  await reopened.getByRole("link", { name: "Download ↗" }).first().click();
  expect((await download).suggestedFilename()).toBe("qualified-leads.csv");
  await reopened.screenshot({
    path: "docs/operator/screenshots/artifacts-and-approvals.png",
    fullPage: true,
  });
});
test("mobile goal composer stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByLabel("Marketing goal")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "docs/operator/screenshots/mobile-home.png",
    fullPage: true,
  });
});
