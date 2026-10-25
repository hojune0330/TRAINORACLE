import { beforeEach, describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { catalogDeliveryProfile, preferredCatalogEntries } from "@impl/prescription/catalog-delivery"
import { bindDefaultCatalogSessions, initialCatalogMainOptions, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { PlanSession } from "@impl/plan-generator/types"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { parsePlanBetaState } from "./plan-beta-schema"
import { buildWorkoutMemo } from "./workout-memo"
import { sessionPrescriptionBasis } from "./prescription-basis"
import { sessionExecutionSteps, sessionLabel } from "../screens/plan-beta/labels"

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear()
  await initializeCanonicalJournalFixture()
})
const events = [800, 1500, 3000, 5000, 10000, 21097, 42195] as const
const conditions = [
  { name: "first-plan", experienceBand: "NEW_TO_RUNNING", trainingFocus: "LT_INTENT", availableDayCount: "EVERY_DAY", secondSessionMode: "SINGLE_SESSION_ONLY" },
  { name: "developing", experienceBand: "DEVELOPING", trainingFocus: "VO2_INTENT", availableDayCount: 5, secondSessionMode: "SINGLE_SESSION_ONLY" },
  { name: "two-sessions", experienceBand: "EXPERIENCED", trainingFocus: "MIXED_INTENT", availableDayCount: "EVERY_DAY", secondSessionMode: "RECOVERY_PM_ALLOWED" },
  { name: "three-days", experienceBand: "EXPERIENCED", trainingFocus: "LT_INTENT", availableDayCount: 3, secondSessionMode: "SINGLE_SESSION_ONLY" },
] as const

describe("familiar prescription delivery, 28 synthetic journeys", () => {
  it.each(events.flatMap(event => conditions.map(condition => [event, condition] as const)))("%sm / %j", (eventDistanceM, condition) => {
    const eventGroup = eventDistanceM <= 3000 ? "MIDDLE_DISTANCE" : eventDistanceM === 5000 ? "FIVE_K" : eventDistanceM === 10000 ? "TEN_K" : "GENERAL_ENDURANCE"
    const { name: _name, ...intake } = condition
    const result = generatePlanFromDraft({ ...intake, eventGroup, eventDistanceM, competitionDivision: "OPEN",
      requestedFrameLength: 9, trainingTimePreference: "VARIES", selectedDetailedTemplateRef: null, startDate: "2026-10-25" }, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw Error(result.kind)
    const plan = result.generated.candidates[0]
    const before = JSON.stringify(plan)
    const main = plan.sessions.filter(s => s.role === "QUALITY")
    expect(main.length).toBeGreaterThan(0)
    for (const session of main) {
      if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("MISSING_DETAILED_MAIN")
      const binding = session.prescription.catalogWorkout
      const calculation = resolveCatalogBinding(binding)!
      expect(calculation).not.toBeNull()
      expect(calculation.unavailable).toEqual([])
      const raw: PlanSession = { ...session, prescription: { kind: "RPE_TIME_RANGE", ...binding.originalEnvelope } }
      const options = initialCatalogMainOptions(raw, eventDistanceM, condition.experienceBand)
      const ids = options.flatMap(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout ? [s.prescription.catalogWorkout.catalogId] : [])
      const preferred = preferredCatalogEntries(ALL_WORKOUT_CATALOG.filter(e => ids.includes(e.id)))
      expect(preferred.map(e => e.id)).toContain(binding.catalogId)
      const memo = buildWorkoutMemo(session, { state: "PREVIEW" })!
      expect(memo).not.toBeNull()
      expect(memo.basis).toBe(sessionPrescriptionBasis(session))
      expect(sessionExecutionSteps(session, true).find(s => s.role === "MAIN")?.detail).toContain(memo.lines.find(l => l.label === "본운동")!.text)
      expect(sessionLabel(session)).not.toMatch(/NaN|undefined/)
    }
    expect(result.generated.candidates[1].sessions.filter(s => s.role === "QUALITY")).toEqual(main)
    expect(bindDefaultCatalogSessions(plan.sessions, eventDistanceM, condition.experienceBand, 999)).toEqual(plan.sessions)
    const selected = selectPlanForActivation(plan.candidateId, result.generated, result.gate, result.intake, result.athleteEvidence)
    if (selected.kind !== "selected") throw Error(selected.kind)
    expect(parsePlanBetaState(JSON.parse(JSON.stringify(selected.state)))).not.toBeNull()
    expect(JSON.stringify(plan)).toBe(before)
  }, 15000)

  it("prefers simple structures only within the supplied eligible pool and keeps all alternatives", () => {
    const simple = ALL_WORKOUT_CATALOG.find(e => e.id === "P-LT-C")!
    const complex = ALL_WORKOUT_CATALOG.find(e => e.id === "X-LT-07")!
    const before = JSON.stringify(ALL_WORKOUT_CATALOG)
    expect(catalogDeliveryProfile(simple).name).toBe("템포런")
    expect(catalogDeliveryProfile(complex).complexity).toBeGreaterThan(catalogDeliveryProfile(simple).complexity)
    expect(preferredCatalogEntries([complex, simple])).toEqual([simple])
    expect(preferredCatalogEntries([complex])).toEqual([complex])
    expect(preferredCatalogEntries([])).toEqual([])
    expect(JSON.stringify(ALL_WORKOUT_CATALOG)).toBe(before)
  })

  it("marks a legacy unspecified MAIN and never invents reps or a record pace", () => {
    const session: PlanSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "VO2_INTENT",
      prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 30, maximum: 50 }, rpe: { minimum: 7, maximum: 8 } } }
    const memo = buildWorkoutMemo(session)!
    expect(memo.warnings).toContain("상세 구성 미정 · 전체 시간을 본운동 시간으로 사용하지 마세요.")
    expect(memo.lines.some(l => l.label === "목표")).toBe(false)
  })
})
