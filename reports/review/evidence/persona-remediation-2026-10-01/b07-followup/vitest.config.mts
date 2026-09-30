import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "../../app/node_modules/vitest/dist/config.js"

const here = fileURLToPath(new URL(".", import.meta.url))
const app = fileURLToPath(new URL("../../app/", import.meta.url))
const pkg = (name: string) => `${app}node_modules/${name}`
export default defineConfig(({ mode }) => ({
  root: here, envDir: `${here}empty-env`, cacheDir: `${here}cache-${mode}`,
  resolve: { alias: {
    "@impl": fileURLToPath(new URL("../../impl/src", import.meta.url)),
    "@testing-library/react": pkg("@testing-library/react/dist/index.js"),
    "@testing-library/jest-dom/vitest": pkg("@testing-library/jest-dom/dist/vitest.mjs"),
    "react-dom/client": pkg("react-dom/client.js"),
    "react-dom/test-utils": pkg("react-dom/test-utils.js"),
    "react-dom": pkg("react-dom/index.js"),
    "react/jsx-dev-runtime": pkg("react/jsx-dev-runtime.js"),
    "react/jsx-runtime": pkg("react/jsx-runtime.js"),
    "react": pkg("react/index.js"), "vitest": pkg("vitest/dist/index.js"),
  } },
  plugins: [{ name: "b07-memory-only-lineage-mutation", enforce: "pre", load(id) {
    if (mode !== "m_no_advance" || !id.replaceAll("\\", "/").endsWith("/plan-beta/plan-selection.ts")) return null
    const source = readFileSync(id, "utf8")
    const anchor = "advancePeriodizationContext(predecessor.periodization, state.generatedAt)"
    if (source.split(anchor).length !== 2) throw Error("Non-unique B07 mutation anchor")
    return source.replace(anchor, "predecessor.periodization /* M_NO_ADVANCE */")
  } }],
  test: { environment: "jsdom", include: ["b07-boundaries.test.tsx"],
    setupFiles: ["setup.ts"], restoreMocks: true, fileParallelism: false, testTimeout: 12000 },
}))
