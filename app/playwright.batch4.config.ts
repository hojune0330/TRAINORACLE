import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
  ...base,
  testMatch: "**/batch4-ancillary.browser.ts",
  workers: 1,
  timeout: 90_000,
  use: { ...base.use, baseURL: "http://127.0.0.1:4493" },
  outputDir: "../reports/review/evidence/batch4-ancillary-20261007/browser",
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4493 --strictPort",
    url: "http://127.0.0.1:4493/e2e/fixtures/batch4-ancillary.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "phone-320", use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: "phone-375", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "reduced-motion", use: { viewport: { width: 375, height: 812 }, reducedMotion: "reduce" } },
  ],
})
