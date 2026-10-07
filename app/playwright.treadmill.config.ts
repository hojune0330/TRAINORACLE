import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e", testMatch: "treadmill-game.spec.ts", workers: 1, retries: 0, timeout: 60_000,
  outputDir: "./test-results/treadmill", reporter: "list", forbidOnly: true,
  use: { baseURL: "http://127.0.0.1:4219", browserName: "chromium", timezoneId: "Asia/Seoul", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 900, height: 900 } } },
    { name: "phone", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? undefined : {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4219 --strictPort",
    url: "http://127.0.0.1:4219", reuseExistingServer: false,
  },
})
