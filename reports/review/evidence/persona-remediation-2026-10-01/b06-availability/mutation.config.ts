import { defineConfig } from "../../app/node_modules/vitest/dist/config.js"
import react from "../../app/node_modules/@vitejs/plugin-react/dist/index.js"
import { fileURLToPath } from "node:url"

const mutation = process.env.B06_MUTATION
let applied = false
export default defineConfig({
  plugins: [{
    name: "b06-memory-only-mutation", enforce: "pre",
    transform(source, id) {
      if (mutation === "late-response" && id.replaceAll("\\", "/").endsWith("/PlanAdaptationFlow.tsx")) {
        const target = "epoch === requestEpoch.current && currentState.current === state"
        if (!source.includes(target)) throw Error("Mutation target not found")
        applied = true
        return source.replaceAll(target, "true")
      }
      if (mutation === "content-match" && id.replaceAll("\\", "/").endsWith("/plan-adaptation-availability.ts")) {
        const start = source.indexOf("  if (baseCandidate.kind !== plan.candidateKind")
        const end = source.indexOf("  const explicitRequest =", start)
        if (start < 0 || end <= start) throw Error("Mutation target not found")
        applied = true
        return source.slice(0, start) + source.slice(end)
      }
    },
    closeBundle() { if (!applied) throw Error("Mutation was not applied") },
  }, react()],
  resolve: { alias: { "@impl": fileURLToPath(new URL("../../impl/src", import.meta.url)) } },
  test: { environment: "jsdom", clearMocks: true, restoreMocks: true,
    include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["./src/test/setup.ts"] },
})
