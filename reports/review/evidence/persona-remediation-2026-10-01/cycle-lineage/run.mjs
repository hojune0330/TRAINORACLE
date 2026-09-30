import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { mkdirSync } from "node:fs"
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, "../../app")
const { startVitest } = await import("../../app/node_modules/vitest/dist/node.js")
mkdirSync(resolve(here, "no-env"), { recursive: true })
const tests = process.argv.slice(2)
const mutation = process.env.B06_MUTATION
const targets = {
  source: ["/domain/plan-journal-evidence.ts", "resolveExecutionReplanSource(state, entry.plannedSessionLink, originals)", "null"],
  occurrence: ["/domain/plan-journal-evidence.ts", "`${entry.plannedSessionLink.plannedDate}:${session.day}:${session.slot}`", "entry.plannedSessionLink.plannedSessionId"],
  reader: ["/plan-beta/SessionExplanation.tsx", "row.currentPlannedSessionId === evidence.sessionId", "row.plannedSessionId === evidence.sessionId"],
  method: ["/domain/session-explanation-evidence.ts", "collectPlanMethodObservations(entries, originals, state)", "collectPlanMethodObservations(entries, [state])"],
}
let applied = false
const plugins = mutation ? [{ name: "b06-lineage-mutation", enforce: "pre", transform(source, id) {
  const target = targets[mutation]
  if (!target) throw Error(`Unknown mutation: ${mutation}`)
  if (!id.replaceAll("\\", "/").endsWith(target[0])) return
  const normalized = source.replaceAll("\r\n", "\n")
  if (normalized.split(target[1]).length !== 2) throw Error(`Missing mutation target ${mutation}`)
  applied = true
  return normalized.replace(target[1], target[2])
} }] : []
let ctx
try {
  ctx = await startVitest("test", tests.length ? tests : ["src/domain/plan-cycle-lineage.contract.test.ts"], {
    config: resolve(app, "vitest.config.ts"), root: app, run: true, watch: false,
    fileParallelism: false, maxWorkers: 1, testTimeout: 15000,
    reporters: ["default", "json"], outputFile: resolve(here, `${process.env.B06_RUN ?? "before"}.json`),
  }, { plugins, envDir: resolve(here, "no-env"), cacheDir: resolve(here, "cache") })
  if (mutation && !applied) throw Error(`Mutation was not applied: ${mutation}`)
  process.exitCode ||= ctx.state.getUnhandledErrors().length ? 1 : 0
} finally { await ctx?.close() }
