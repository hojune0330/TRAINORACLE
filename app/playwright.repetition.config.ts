import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./e2e", testMatch: "planned-repetition.spec.ts", workers: 1, retries: 0,
  outputDir: "./test-results/repetition", timeout: 60000, forbidOnly: true, reporter: "list",
  globalSetup: "./e2e/planned-repetition.setup.ts",
  use: { baseURL: "http://127.0.0.1:4397", browserName: "chromium", channel: "chrome",
    headless: true, serviceWorkers: "block", trace: "retain-on-failure" },
})
