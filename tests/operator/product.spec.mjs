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
test("tool docs -> durable proposal -> credential-free sandbox -> reviewed installation -> API artifact", async ({
  page,
  context,
}) => {
  await page.goto("/dashboard/connectors");
  await expect(
    page.getByRole("heading", { name: "Give Kryx access to your tools." }),
  ).toBeVisible();
  await page
    .getByLabel("Documentation or API URL")
    .fill("https://8.8.8.8/docs");
  await page
    .getByLabel("What should Kryx read?")
    .fill("Read repository details from the QA provider");
  await page
    .getByRole("button", { name: "Read docs and propose adapter" })
    .click();
  await expect(page.getByRole("button", { name: "Start plan" })).toBeVisible();
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(
    page.getByText(
      "Adapter proposal ready for endpoint review and sandbox testing",
    ),
  ).toBeVisible({ timeout: 30000 });
  await page.goto("/dashboard/connectors");
  await expect(
    page.getByRole("heading", { name: "QA repository API" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Approve installation of these endpoints",
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create API read plan" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Sandbox inputs for QA repository API")
    .fill('{"repository.read":{"page":1}}');
  await page.getByRole("button", { name: "Create sandbox test plan" }).click();
  await expect(page.getByRole("button", { name: "Start plan" })).toBeVisible();
  await page.getByRole("button", { name: "Start plan" }).click();
  const taskUrl = page.url();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(taskUrl);
  await expect(
    reopened.getByText(
      "Sandbox passed. Review and approve installation in Integrations.",
    ),
  ).toBeVisible({ timeout: 30000 });
  await reopened.goto("/dashboard/connectors");
  await expect(
    reopened.getByText("Sandbox passed", { exact: true }),
  ).toBeVisible();
  await reopened.screenshot({
    path: "docs/operator/screenshots/adapter-review.png",
    fullPage: true,
  });
  await reopened
    .getByRole("button", { name: "Approve installation of these endpoints" })
    .click();
  await expect(
    reopened.getByRole("button", { name: "Create API read plan" }),
  ).toBeVisible();
  await reopened
    .getByLabel("Read inputs for QA repository API")
    .fill('{"page":1}');
  await reopened.getByRole("button", { name: "Create API read plan" }).click();
  await expect(
    reopened.getByRole("button", { name: "Start plan" }),
  ).toBeVisible();
  await reopened.getByRole("button", { name: "Start plan" }).click();
  await expect(
    reopened.getByText("Connected API read completed with source evidence"),
  ).toBeVisible({ timeout: 30000 });
  await reopened
    .getByRole("button", { name: "Artifacts", exact: true })
    .click();
  await expect(reopened.getByText("connected-api.json")).toBeVisible();
  await reopened.getByText("connected-api.json").click();
  await expect(
    reopened.getByText("QA repository", { exact: false }).last(),
  ).toBeVisible();
  await reopened.screenshot({
    path: "docs/operator/screenshots/adapter-artifact.png",
    fullPage: true,
  });
  await reopened.setViewportSize({ width: 390, height: 844 });
  await reopened.goto("/dashboard/connectors");
  expect(
    await reopened.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await reopened.screenshot({
    path: "docs/operator/screenshots/integrations-mobile.png",
    fullPage: true,
  });
});
