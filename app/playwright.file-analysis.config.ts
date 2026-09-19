import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "file-analysis-flow.spec.ts",
  outputDir: "./test-results/file-analysis",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  forbidOnly: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4497",
    browserName: "chromium",
    ...(process.env.CI ? {} : { channel: "chrome" }),
    viewport: { width: 375, height: 812 },
    timezoneId: "Asia/Seoul",
    headless: true,
    actionTimeout: 10_000,
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
})
