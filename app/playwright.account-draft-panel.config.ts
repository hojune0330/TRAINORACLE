import { defineConfig } from "@playwright/test"
import base from "./playwright.account-draft-buffer.config"

export default defineConfig({ ...base, testMatch: "account-journal-draft-panel.spec.ts", outputDir: "./test-results/account-draft-panel" })
