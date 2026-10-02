import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "product.spec.mjs",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: process.env.KRYX_TEST_CHROMIUM
      ? {
          executablePath: process.env.KRYX_TEST_CHROMIUM,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {},
  },
  webServer: {
    cwd: process.cwd(),
    command:
      "node --import ./tests/operator/register.mjs tests/operator/preview-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
