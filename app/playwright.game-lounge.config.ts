import { defineConfig } from '@playwright/test'
import base from './playwright.treadmill.config'
export default defineConfig({ ...base, testMatch: 'game-lounge.spec.ts', timeout: 90_000, outputDir: './test-results/game-lounge',
  use: { ...base.use, baseURL: process.env.GAME_LOUNGE_URL ?? 'http://127.0.0.1:4257' }, webServer: undefined })
