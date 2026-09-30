import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Explicit opt-in audit. Do not add this include to the default unit configuration.
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  envDir: false,
  cacheDir: fileURLToPath(new URL("../.scratch/persona-100-core/vite-cache", import.meta.url)),
  resolve: { alias: { "@impl": fileURLToPath(new URL("../impl/src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["src/domain/plan-persona-100.audit.ts"],
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    pool: "threads",
    maxWorkers: 1,
    testTimeout: 120000,
    hookTimeout: 120000,
    reporters: ["verbose", "json"],
    outputFile: fileURLToPath(new URL("../.scratch/persona-100-core/vitest-results.json", import.meta.url)),
  },
})
