import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./e2e", testMatch: "account-running-profile.browser.ts",
  outputDir: "./test-results/running-profile-storage", workers: 1, retries: 0, timeout: 45000,
  forbidOnly: true, reporter: "list", globalSetup: "./e2e/account-journal-draft-buffer.setup.ts",
  use: { baseURL: "http://127.0.0.1:4381", browserName: "chromium", ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true, serviceWorkers: "block", trace: "retain-on-failure" },
})
