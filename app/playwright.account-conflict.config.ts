import { defineConfig } from "@playwright/test"
import base from "./playwright.account-record-service.config"

export default defineConfig({ ...base, testMatch: "account-journal-conflict.spec.ts",
  outputDir: "./test-results/account-conflict" })
