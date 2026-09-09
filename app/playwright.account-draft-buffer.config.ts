import { defineConfig } from "@playwright/test"

// Dedicated native-IDB module tests. Never reuse a parent's server or load app UI.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "account-journal-draft-buffer.spec.ts",
  outputDir: "./test-results/account-draft-buffer",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  forbidOnly: true,
  reporter: "list",
  globalSetup: "./e2e/account-journal-draft-buffer.setup.ts",
  use: {
    baseURL: "http://127.0.0.1:4381",
    browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    serviceWorkers: "block",
    trace: "off",
  },
})
