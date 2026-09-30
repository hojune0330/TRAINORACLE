import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "../../app/node_modules/vitest/dist/config.js"

const here = fileURLToPath(new URL(".", import.meta.url))
const app = fileURLToPath(new URL("../../app/", import.meta.url))
const resolvePackage = (name: string) => `${app}node_modules/${name}`

export default defineConfig(({ mode }) => ({
  root: here,
  envDir: `${here}empty-env`,
  cacheDir: `${here}cache-${mode}`,
  resolve: { alias: {
    "@impl": fileURLToPath(new URL("../../impl/src", import.meta.url)),
    "@testing-library/react": resolvePackage("@testing-library/react/dist/index.js"),
    "@testing-library/user-event": resolvePackage("@testing-library/user-event/dist/esm/index.js"),
    "@testing-library/jest-dom/vitest": resolvePackage("@testing-library/jest-dom/dist/vitest.mjs"),
    "react-dom/client": resolvePackage("react-dom/client.js"),
    "react-dom/test-utils": resolvePackage("react-dom/test-utils.js"),
    "react-dom": resolvePackage("react-dom/index.js"),
    "react/jsx-dev-runtime": resolvePackage("react/jsx-dev-runtime.js"),
    "react/jsx-runtime": resolvePackage("react/jsx-runtime.js"),
    "react": resolvePackage("react/index.js"),
    "vitest": resolvePackage("vitest/dist/index.js"),
  } },
  plugins: [{
    name: "scratch-only-named-mutations",
    enforce: "pre",
    load(id) {
      let oldText: string | undefined
      let newText: string | undefined
      if (mode === "m_exact_content" && id.replaceAll("\\", "/").endsWith("/domain/plan-adaptation-availability.ts")) {
        oldText = "|| canonicalJson(baseCandidate.sessions) !== canonicalJson(plan.sessions)"
        newText = "|| false /* M_EXACT_CONTENT removed exact-session comparison */"
      }
      if (mode === "m_stale_prepare" && id.replaceAll("\\", "/").endsWith("/plan-beta/PlanAdaptationFlow.tsx")) {
        oldText = "if (epoch === requestEpoch.current && currentState.current === state) {\n        handlePrepared"
        newText = "if (true /* M_STALE_PREPARE removed response guard */) {\n        handlePrepared"
      }
      if (!oldText || !newText) return null
      const source = readFileSync(id, "utf8").replaceAll("\r\n", "\n")
      if (source.split(oldText).length !== 2) throw new Error(`Mutation anchor not unique: ${mode}`)
      return source.replace(oldText, newText)
    },
  }],
  test: {
    environment: "jsdom",
    include: ["b06-boundaries.test.tsx"],
    setupFiles: ["setup.ts"],
    restoreMocks: true,
    fileParallelism: false,
    testTimeout: 10000,
  },
}))
