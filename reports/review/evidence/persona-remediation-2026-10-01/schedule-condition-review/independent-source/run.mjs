import { fileURLToPath } from "node:url"
import config from "./vitest.review.config.mjs"
import { startVitest } from "../../app/node_modules/vitest/dist/node.js"
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"

const zone = process.argv[2] === "KST" ? "KST" : "UTC"
const mode = process.argv[3] ?? null
const contractOnly = mode === "contract"
const mutation = contractOnly ? null : mode
const suffix = mode ? `${zone}-${mode}` : zone
process.env.TZ = zone === "KST" ? "Asia/Seoul" : "UTC"
process.env.DEBUG_PRINT_LIMIT = "300"
const mutations = {
  date: { target: "/domain/catalog-schedule-conditions.ts", name: "C01",
    from: "accountScope, date, day: session.day", to: 'accountScope, date: "DATE_REMOVED", day: session.day' },
  gate: { target: "/screens/plan-beta/PlanCandidates.tsx", name: "C02",
    from: "&& !selectionUnavailable && unreviewedConditions.length === 0", to: "&& !selectionUnavailable" },
  crossslot: { target: "/screens/plan-beta/PlanCandidates.tsx", name: "C05",
    from: ".filter(condition => condition.day === reviewedAddress.day && condition.slot === reviewedAddress.slot)",
    to: ".filter(() => true)" },
}
const defect = mutation ? mutations[mutation] : null
if (mutation && !defect) throw Error("Unknown scratch-only mutation")
let mutationApplied = false
if (defect) config.plugins = [{
  name: "independent-scratch-only-mutation",
  enforce: "pre",
  transform(code, id) {
    if (!id.replaceAll("\\", "/").endsWith(defect.target)) return
    if (code.split(defect.from).length !== 2) throw Error("Mutation requires exactly one matching source location")
    mutationApplied = true
    return code.replace(defect.from, defect.to)
  },
}]
const files = [
  "app/src/domain/catalog-schedule-conditions.ts",
  "app/src/screens/plan-beta/CatalogScheduleReview.tsx",
  "app/src/screens/plan-beta/CatalogWorkoutPicker.tsx",
  "app/src/screens/plan-beta/PlanCandidates.tsx",
  "app/src/components/instant-plan/InstantPlanRecommendationView.tsx",
  "app/src/screens/plan-beta/catalog-workout.css",
  "specs/reconstruct/ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md",
]
const snapshot = () => Object.fromEntries(files.map(file => [file,
  createHash("sha256").update(readFileSync(new URL(`../../${file}`, import.meta.url))).digest("hex")]))
const before = snapshot()
const ctx = await startVitest("test", [], {
  ...config.test,
  root: config.root,
  config: false,
  run: true,
  watch: false,
  ...(defect ? { testNamePattern: defect.name } : contractOnly ? { testNamePattern: "C0|R0" } : {}),
  reporters: ["verbose", "json"],
  outputFile: fileURLToPath(new URL(`./results-${suffix}.json`, import.meta.url)),
}, config)
await ctx?.close()
const after = snapshot()
writeFileSync(new URL(`./snapshot-${suffix}.json`, import.meta.url), JSON.stringify({
  zone, mutation, mutationApplied, capturedAt: new Date().toISOString(), before, after,
  unchangedDuringRun: JSON.stringify(before) === JSON.stringify(after),
}, null, 2))
