import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e", testMatch: "account-plan-service-mobile.spec.ts",
  outputDir: "./test-results/account-plan-service-mobile",
  workers: 1, retries: 0, timeout: 60_000, forbidOnly: true, reporter: "list",
  globalSetup: "./e2e/account-plan-service-mobile.setup.ts",
  use: { baseURL: "http://127.0.0.1:4383", browserName: "chromium", ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true, serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
})
