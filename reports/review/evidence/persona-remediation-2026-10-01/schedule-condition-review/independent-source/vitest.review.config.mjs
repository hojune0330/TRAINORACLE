import { fileURLToPath } from "node:url"
import { defineConfig } from "../../app/node_modules/vitest/dist/config.js"

const path = value => fileURLToPath(new URL(value, import.meta.url))

export default defineConfig({
  root: path("../../app/"),
  envDir: path("./no-env/"),
  cacheDir: path("./vite-cache/"),
  esbuild: { jsx: "automatic" },
  server: { fs: { allow: [path("../../")] } },
  resolve: {
    alias: {
      "@impl": path("../../impl/src/"),
      "react": path("../../app/node_modules/react"),
      "react-dom": path("../../app/node_modules/react-dom"),
      "vitest": path("../../app/node_modules/vitest"),
      "@testing-library/react": path("../../app/node_modules/@testing-library/react"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["../.scratch/schedule-condition-review-20261001/independent.test.tsx"],
    setupFiles: [path("../../app/src/test/setup.ts"), path("./offline.setup.ts")],
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 1,
    server: { deps: { inline: [/schedule-condition-review-20261001/] } },
  },
})
