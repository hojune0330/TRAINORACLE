import { defineConfig } from '@playwright/test'
import treadmill from './playwright.treadmill.config'
export default defineConfig({ ...treadmill, testMatch: 'solo-party.spec.ts', timeout: 180_000, outputDir: './test-results/solo-party' })
