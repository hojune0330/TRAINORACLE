import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./e2e", testMatch: "calendar-card-ui.spec.ts", workers: 1, timeout: 60_000,
  outputDir: "../.scratch/calendar-ui/results", reporter: "line",
  use: { ...devices["Pixel 5"], channel: "chrome", baseURL: "http://127.0.0.1:51840", screenshot: "only-on-failure", serviceWorkers: "block" },
})
