import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "multi-event-pace-lifecycle.spec.ts",
  outputDir: "./test-results/multi-event-pace-lifecycle",
  globalSetup: "./e2e/multi-event-pace.setup.ts",
  workers: 2,
  fullyParallel: true,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 8_000 },
  forbidOnly: true,
  reporter: [["list"], ["json", { outputFile: "./test-results/multi-event-pace-lifecycle.json" }]],
  use: {
    actionTimeout: 12_000,
    baseURL: "http://127.0.0.1:4597",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    timezoneId: "Asia/Seoul",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
})
