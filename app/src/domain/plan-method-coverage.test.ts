import { beforeEach, expect, it } from "vitest"
import { planHistorySchema } from "./plan-beta-schema"
import { PLAN_METHOD_REGISTRY } from "./plan-method-registry"
import { summarizePlanMethodCoverage } from "./plan-method-coverage"
import { loadPlanMethodHistorySnapshot } from "./plan-beta-store"
import { resolveDetailedPlanTemplateOptions } from "../screens/plan-beta/plan-template-options"

const base = { candidateId: "history", candidateKind: "BALANCED", frameLengthDays: 10,
  progress: [], archivedAt: "2026-09-05T00:00:00.000Z" }
const reference = PLAN_METHOD_REGISTRY[0]!.templateRef
const legacy = planHistorySchema.parse(base)
const v3 = planHistorySchema.parse({ ...base, version: 3, pairId: "plan-pair:v3:old",
  eventDistanceM: 5000, selectedDetailedTemplateRef: reference })
const v4 = planHistorySchema.parse({ ...base, version: 4, pairId: "plan-pair:v3:new",
  eventDistanceM: 5000, selectedDetailedTemplateRef: reference,
  archivedAt: "2026-09-01T00:00:00.000Z",
  methodHistory: [
    { sessionDay: 2, sessionSlot: "AM", selectedDetailedTemplateRef: reference, outcome: "PERFORMED" },
    { sessionDay: 5, sessionSlot: "PM", selectedDetailedTemplateRef: reference, outcome: "MISSING" },
    { sessionDay: 6, sessionSlot: "PM", selectedDetailedTemplateRef: reference, outcome: "MISSING" },
    { sessionDay: 8, sessionSlot: "AM", selectedDetailedTemplateRef: { ...reference, fingerprint: `sha256:${"a".repeat(64)}` }, outcome: "NOT_PERFORMED" },
  ],
})
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

it("separates missing outcomes, unknown references and event coverage without mutating history", () => {
  const otherEvent = planHistorySchema.parse({ ...v3, eventDistanceM: 800, archivedAt: "2025-01-01T00:00:00.000Z" })
  const rows = [v3, otherEvent, legacy, v4]
  const before = JSON.stringify(rows)
  expect(summarizePlanMethodCoverage(rows, 5000)).toEqual({
    retainedPlans: 4, matchingPlans: 2, unknownEventPlans: 1, missingOutcomes: 3,
    unmappedReferences: 1, earliestArchive: "2026-09-01T00:00:00.000Z", latestArchive: "2026-09-05T00:00:00.000Z",
  })
  expect(JSON.stringify(rows)).toBe(before)
})

it("does not invent dates or completion from an empty archive", () => {
  expect(summarizePlanMethodCoverage([], 5000)).toEqual({ retainedPlans: 0, matchingPlans: 0,
    unknownEventPlans: 0, missingOutcomes: 0, unmappedReferences: 0, earliestArchive: null, latestArchive: null })
})

it("does not report unreadable history as a verified empty archive", () => {
  localStorage.setItem("trainoracle.plan-beta.history.v1", "{broken")
  expect(loadPlanMethodHistorySnapshot(5000)).toEqual({ history: [], coverage: null })
  expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBe("{broken")
})

it("uses the same stored snapshot for recommendation counts and coverage", () => {
  const raw = JSON.stringify([v3, v4, legacy])
  localStorage.setItem("trainoracle.plan-beta.history.v1", raw)
  const snapshot = loadPlanMethodHistorySnapshot(5000)
  expect(snapshot.history).toHaveLength(4)
  expect(snapshot.coverage).toMatchObject({ matchingPlans: 2, missingOutcomes: 3, unmappedReferences: 1 })
  const draft = { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" } as const
  const options = resolveDetailedPlanTemplateOptions(draft, "2026-09-02T03:00:00.000Z")
  expect(options[0]?.historyCoverage).toEqual(snapshot.coverage)
  expect(options[0]?.observedPerformedCount).toBe(1)
  expect(resolveDetailedPlanTemplateOptions(draft, "2026-09-02T03:00:00.000Z", [])[0]?.historyCoverage).toBeUndefined()
  expect(localStorage.getItem("trainoracle.plan-beta.history.v1")).toBe(raw)
})
