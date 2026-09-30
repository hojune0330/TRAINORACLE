import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { mkdirSync } from "node:fs"
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, "../../app")
const { startVitest } = await import("../../app/node_modules/vitest/dist/node.js")
mkdirSync(resolve(here, "no-env"), { recursive: true })
const tests = process.argv.slice(2)
const mutation = process.env.B07_MUTATION
const targets = {
  lineage: ["/screens/plan-beta/plan-selection.ts", "advancePeriodizationContext(predecessor.periodization, state.generatedAt)", "state.periodization"],
  rollback: ["/domain/plan-beta-store.ts", "snapshots.map(snapshot =>\n      restoreStorageValue(snapshot.storage, snapshot.key, snapshot.value)).every(Boolean)", "true"],
}
let applied = false
const plugins = mutation ? [{ name: "b07-memory-only-mutation", enforce: "pre", transform(source, id) {
  const target = targets[mutation]
  if (!target) throw Error(`Unknown mutation: ${mutation}`)
  if (!id.replaceAll("\\", "/").endsWith(target[0])) return
  const normalized = source.replaceAll("\r\n", "\n")
  if (normalized.split(target[1]).length !== 2) throw Error(`Mutation target missing or ambiguous: ${mutation}`)
  applied = true
  return normalized.replace(target[1], target[2])
} }] : []
let ctx
try {
  ctx = await startVitest("test", tests.length ? tests : ["src/screens/plan-beta/plan-next-draft.contract.test.tsx"], {
    config: resolve(app, "vitest.config.ts"), root: app, run: true, watch: false,
    fileParallelism: false, maxWorkers: 1, testTimeout: 15000,
    reporters: ["default", "json"], outputFile: resolve(here, `${process.env.B07_RUN ?? "before"}.json`),
  }, { plugins, envDir: resolve(here, "no-env"), cacheDir: resolve(here, "cache") })
  if (mutation && !applied) throw Error(`Mutation was not applied: ${mutation}`)
  process.exitCode ||= ctx.state.getUnhandledErrors().length ? 1 : 0
} finally { await ctx?.close() }
