import { defineConfig } from "@playwright/test"
import generic, { browserFixtureTests } from "./playwright.config"

// The full-suite runner owns an isolated loopback Vite server and its teardown.
// Keep every generic project, timeout, retry and assertion setting unchanged.
export default defineConfig({
  ...generic,
  testIgnore: [],
  testMatch: browserFixtureTests,
  outputDir: "./test-results/browser-fixtures",
  webServer: {
    command: "node e2e/browser-fixtures.setup.mjs",
    url: generic.use?.baseURL,
    reuseExistingServer: false,
  },
  ...(process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? { webServer: undefined } : {}),
})
