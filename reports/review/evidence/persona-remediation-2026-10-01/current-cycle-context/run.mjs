import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { mkdirSync } from "node:fs"
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, "../../app")
const { startVitest } = await import("../../app/node_modules/vitest/dist/node.js")
mkdirSync(resolve(here, "no-env"), { recursive: true })
const tests = process.argv.slice(2)
const mutation = process.env.B06_MUTATION
const targets = {
  coachEntry: ["/plan-beta/PlanAdaptationFlow.tsx", "&& currentContext.current.activePlan.selectionActor === \"SELF\"", ""],
  currentChain: ["/domain/plan-current-cycle-context.ts", "!isVerifiedSameCycleChange(previous, original)", "false"],
  pendingScope: ["/plan-beta/PlanAdaptationFlow.tsx", "state, pendingRevision, history.scope, history.revision", "state, pendingRevision"],
  pendingCommit: ["/plan-beta/plan-selection.ts", "readMatchingPendingSuccessor(predecessor) !== null", "false"],
  pendingEntry: ["/plan-beta/PlanAdaptationFlow.tsx", "const loaded = await onLoadPending(state)\n      if (epoch", "const loaded = null\n      if (epoch"],
  historyLoad: ["/hooks/usePlanEvidenceHistory.ts", "void ensureAccountPlanHistory()", "void Promise.resolve(false)"],
  historyRetry: ["/plan-beta/SessionExplanation.tsx", "context?.generatedAt, history.history, history.revision", "context?.generatedAt, history.revision"],
  journalArrival: ["/hooks/usePlanEvidenceHistory.ts", "window.addEventListener(\"trainoracle:account-journals-changed\", refresh)", "void refresh"],
  stablePlan: ["/screens/PlanBeta.tsx", "setStored(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)", "setStored(next)"],
  unreadBookmark: ["/screens/OracleExplore.tsx", "fingerprint={mode === \"personal\" && !personalResultUnavailable ? personalResult.fingerprint : undefined}", "fingerprint={mode === \"personal\" ? personalResult.fingerprint : undefined}"],
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
    ...(process.env.B06_TEST_NAME ? { testNamePattern: process.env.B06_TEST_NAME } : {}),
    reporters: ["default", "json"], outputFile: resolve(here, `${process.env.B06_RUN ?? "before"}.json`),
  }, { plugins, envDir: resolve(here, "no-env"), cacheDir: resolve(here, "cache") })
  if (mutation && !applied) throw Error(`Mutation was not applied: ${mutation}`)
  process.exitCode ||= ctx.state.getUnhandledErrors().length ? 1 : 0
} finally { await ctx?.close() }
