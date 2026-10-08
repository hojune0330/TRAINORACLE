import { defineConfig } from "@playwright/test"

/** Optional: needs an installed Chrome with a GPU. The test skips itself when no adapter is granted. */
export default defineConfig({
  testDir: "./e2e", testMatch: "treadmill-shader-sky.spec.ts", workers: 1, retries: 0, timeout: 60_000,
  outputDir: "./test-results/treadmill-webgpu", reporter: "list", forbidOnly: true,
  use: {
    baseURL: "http://127.0.0.1:4220", browserName: "chromium", channel: "chrome",
    launchOptions: { args: ["--enable-unsafe-webgpu"] }, viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul",
  },
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1" ? undefined : {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4220 --strictPort",
    url: "http://127.0.0.1:4220", reuseExistingServer: false,
  },
})
