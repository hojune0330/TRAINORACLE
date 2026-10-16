import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'friend-arena.spec.ts', workers: 1, retries: 0, timeout: 135_000,
  outputDir: './test-results/arena', reporter: 'list', forbidOnly: true,
  use: { baseURL: process.env.ARENA_TEST_BASE ?? 'http://127.0.0.1:4225', browserName: 'chromium', viewport: { width: 360, height: 800 }, trace: 'retain-on-failure' },
})
