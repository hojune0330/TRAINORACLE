import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./e2e", testMatch: "calendar-decoration-flow.spec.ts", workers: 1, retries: 0, timeout: 60_000,
  outputDir: "./test-results/calendar-decoration", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4197", channel: "chrome", timezoneId: "Asia/Seoul", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? undefined : { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4197 --strictPort", url: "http://127.0.0.1:4197", reuseExistingServer: true },
})
