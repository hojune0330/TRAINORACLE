import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "persona-100-adversarial.audit.ts",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 6_000 },
  forbidOnly: true,
  outputDir: "../.scratch/persona-100-browser/playwright-results",
  reporter: [["list"], ["json", { outputFile: "../.scratch/persona-100-browser/playwright-report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4419",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    serviceWorkers: "block",
    actionTimeout: 6_000,
    navigationTimeout: 30_000,
    timezoneId: "Asia/Seoul",
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    { name: "baseline", outputDir: "../.scratch/persona-100-browser/baseline-results-segment-2" },
    { name: "current", outputDir: "../.scratch/persona-100-browser/current-results" },
    { name: "baseline-repair", outputDir: "../.scratch/persona-100-browser/baseline-repair-results" },
  ],
})
