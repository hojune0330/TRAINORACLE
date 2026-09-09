import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e", testMatch: "account-plan-collection-preparation.spec.ts",
  outputDir: "./test-results/account-plan-preparation", workers: 1, retries: 0,
  timeout: 30_000, forbidOnly: true, reporter: "list",
  globalSetup: "./e2e/account-plan-collection-preparation.setup.ts",
  use: { baseURL: "http://127.0.0.1:4393", browserName: "chromium", ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true, serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
})
