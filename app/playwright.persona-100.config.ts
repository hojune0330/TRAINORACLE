import { defineConfig } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"

const runId = process.env.TRAINORACLE_PERSONA_BROWSER_RUN ?? new Date().toISOString().replaceAll(/[:.]/gu, "-")
if (!/^[a-zA-Z0-9_-]{1,80}$/u.test(runId)) throw new Error("Invalid browser audit run identifier")
const origin = process.env.TRAINORACLE_PERSONA_BROWSER_ORIGIN ?? "http://127.0.0.1:4419"
const parsedOrigin = new URL(origin)
if (parsedOrigin.protocol !== "http:" || parsedOrigin.hostname !== "127.0.0.1"
  || parsedOrigin.origin !== origin) throw new Error("Browser audit requires an exact loopback origin")
process.env.TRAINORACLE_PERSONA_BROWSER_RUN = runId
process.env.TRAINORACLE_PERSONA_BROWSER_ORIGIN = origin
const output = fileURLToPath(new URL(`../.scratch/persona-100-browser-${runId}/`, import.meta.url))
if (existsSync(`${output}/playwright-report.json`)) throw new Error("Use a new audit run identifier; preserve previous evidence")

export default defineConfig({
  testDir: "./e2e",
  testMatch: "persona-100-adversarial.audit.ts",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 6_000 },
  forbidOnly: true,
  outputDir: `${output}/playwright-results`,
  reporter: [["list"], ["json", { outputFile: `${output}/playwright-report.json` }]],
  use: {
    baseURL: origin,
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
    { name: "current" },
  ],
})
