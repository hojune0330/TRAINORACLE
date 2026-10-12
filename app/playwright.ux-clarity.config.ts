import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

export default defineConfig({
  ...base,
  testMatch: "**/ux-clarity.spec.ts",
  timeout: 120_000,
  workers: 2,
  projects: [
    { name: "phone-320", use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
    { name: "phone-375", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "reduced-motion", use: { viewport: { width: 375, height: 812 }, reducedMotion: "reduce" } },
  ],
})
