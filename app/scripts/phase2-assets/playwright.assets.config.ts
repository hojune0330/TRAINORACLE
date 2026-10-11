import { defineConfig } from "@playwright/test"

/** Renders phase-2 design assets (not a test suite). See docs/phase2/ASSETS.md. Run from app/. */
export default defineConfig({
  testDir: ".", testMatch: "render-assets.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  outputDir: "../../test-results/phase2-assets", reporter: "list",
  use: { baseURL: "http://127.0.0.1:4233", browserName: "chromium", deviceScaleFactor: 1 },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4233 --strictPort",
    url: "http://127.0.0.1:4233", reuseExistingServer: false, cwd: "../..",
  },
})
