import { defineConfig } from "../../app/node_modules/@playwright/test/index.mjs"
import { fileURLToPath } from "node:url"
export default defineConfig({ testDir: fileURLToPath(new URL("../../app/e2e/", import.meta.url)),
  testMatch: "catalog-schedule-review.audit.ts", workers: 1, retries: 0, timeout: 90000,
  outputDir: fileURLToPath(new URL("./reviewed/browser-results/", import.meta.url)),
  reporter: [["list"], ["json", { outputFile: fileURLToPath(new URL("./reviewed/browser-report.json", import.meta.url)) }]],
  use: { baseURL: "http://127.0.0.1:4428", browserName: "chromium", channel: "chrome", headless: true,
    serviceWorkers: "block", locale: "ko-KR", timezoneId: "Asia/Seoul", screenshot: "only-on-failure" } })
