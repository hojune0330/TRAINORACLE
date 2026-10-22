import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Deliberately separate from app/vitest.config.ts so this coverage audit is
// opt-in and never joins the regular unit-test discovery pattern.
export default defineConfig({
  plugins: [react()],
  cacheDir: ".vite/precision-plan-supply-audit-cache",
  resolve: {
    alias: { "@impl": fileURLToPath(new URL("../../impl/src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["scripts/precision-plan-supply.audit.test.ts"],
    // A deliberately opt-in 147-scenario report, not an interactive latency check.
    testTimeout: 60000,
    clearMocks: true,
    restoreMocks: true,
  },
})
