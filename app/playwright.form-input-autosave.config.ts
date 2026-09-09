import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e", testMatch: "form-input-autosave.spec.ts",
  outputDir: "./test-results/form-input-autosave", workers: 1, retries: 0,
  timeout: 45_000, forbidOnly: true, reporter: "list",
  globalSetup: "./e2e/form-input-autosave.setup.ts",
  use: { baseURL: "http://127.0.0.1:4396", browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }), headless: true,
    serviceWorkers: "block", trace: "off" },
})
