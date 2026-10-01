import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { parsePlanBetaState } from "./plan-beta-schema"
import { applyInitialMainConditions, applyInitialMainManual, reviewInitialMainConditions } from "./initial-main-conditions"
import type { InitialMainInput } from "./initial-main-conditions"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { createEvaluatorFailureSignal } from "@impl/rve/signal"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
const space = "ACCELERATION_AND_DECELERATION_SPACE"
function fixture(experienceBand = "EXPERIENCED" as "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED",
  trainingFocus = "ATP_PC_INTENT" as "ATP_PC_INTENT" | "GLY_INTENT" | "VO2_INTENT" | "LT_INTENT",
  eventDistanceM = 5000 as 800 | 1500 | 3000 | 5000 | 10000 | 21097 | 42195) {
  const source = generatePlanFromDraft({ eventGroup: eventDistanceM <= 3000 ? "MIDDLE_DISTANCE" : eventDistanceM === 5000 ? "FIVE_K"
    : eventDistanceM === 10000 ? "TEN_K" : "GENERAL_ENDURANCE", eventDistanceM, competitionDivision: "OPEN", experienceBand,
    availableDayCount: "EVERY_DAY", requestedFrameLength: 9, trainingFocus,
    secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (source.kind !== "generated") throw Error(source.kind)
  const input: InitialMainInput = { generated: source.generated, intake: source.intake, gate: source.gate,
    context: { mode: "newplan", startDate: "2026-10-02", accountScope: null, revision: 1 } }
  return { source, input }
}

describe("newplan-only initial MAIN condition review", () => {
  it.each([800, 1500, 3000, 5000, 10000, 21097, 42195] as const)("%sm closes all eligible ATP-PC MAIN gaps only after explicit confirmation", event => {
    for (const experience of ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const) {
      const { input, source } = fixture(experience, "ATP_PC_INTENT", event), snapshot = JSON.stringify(input.generated)
      const review = reviewInitialMainConditions(input)!
      expect(review).not.toBeNull()
      expect(review.offers).toHaveLength(input.generated.candidates[0].sessions.filter(session => session.role === "QUALITY").length)
      expect(review.offers.length).toBeGreaterThan(0)
      expect(review.fallbacks).toEqual([])
      expect(review.offers.every(offer => offer.workout.inputs.confirmedRequirements.length === 0)).toBe(true)
      expect(applyInitialMainConditions(input, review.key, [])).toBeNull()
      expect(applyInitialMainConditions(input, review.key, [space, "HIGH_INTENSITY_REPETITION_EXPERIENCE"])).toBeNull()
      const applied = applyInitialMainConditions(input, review.key, [space])!
      expect(applied).not.toBeNull()
      expect(applied.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
      expect(isInitialCandidatePair(...applied.generated.candidates)).toBe(true)
      expect(applied.reviewedConditionKeys).toHaveLength(review.offers.length)
      applied.generated.candidates.forEach((candidate, candidateIndex) => {
        expect(candidate.mainExposureLedger).toEqual(input.generated.candidates[candidateIndex]!.mainExposureLedger)
        candidate.sessions.forEach((session, index) => {
          const original = input.generated.candidates[candidateIndex]!.sessions[index]!
          if (session.role !== "QUALITY") { expect(session).toEqual(original); return }
          expect([session.day, session.slot, session.plannedEnergyIntent]).toEqual([original.day, original.slot, original.plannedEnergyIntent])
          if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
          const workout = resolveCatalogBinding(session.prescription.catalogWorkout!)!
          expect(workout.inputs).toMatchObject({ experience, eventDistanceM: event, fiveK: null, segmentPaces: [] })
          expect(workout.unavailable).toEqual([])
          expect(session.prescription.durationMinutes.maximum * 60).toBe(workout.totals.seconds!.maximum)
        })
      })
      const selected = selectPlanForActivation(applied.generated.candidates[0].candidateId, applied.generated, source.gate, source.intake, source.athleteEvidence)
      expect(selected.kind).toBe("selected")
      if (selected.kind === "selected") expect(parsePlanBetaState(selected.state)).not.toBeNull()
      expect(JSON.stringify(input.generated)).toBe(snapshot)
      expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    }
  }, 30000)

  it("experienced GLY has no remaining confirmation gap", () => {
    const { input } = fixture("EXPERIENCED", "GLY_INTENT")
    expect(reviewInitialMainConditions(input)).toMatchObject({ offers: [], fallbacks: [] })
    expect(input.generated.candidates[0].sessions.filter(s => s.role === "QUALITY").every(s =>
      s.prescription.kind === "RPE_TIME_RANGE" && resolveCatalogBinding(s.prescription.catalogWorkout!) !== null)).toBe(true)
  })
  it("developing GLY links only after explicit segment targets and exact longer-time acceptance", () => {
    const { input } = fixture("DEVELOPING", "GLY_INTENT"), review = reviewInitialMainConditions(input)!
    expect(review.offers).toEqual([])
    expect(review.fallbacks.length).toBeGreaterThan(0)
    const fallback = review.fallbacks[0]!
    expect(fallback.reason).toBe("EXPLICIT_SEGMENT_TIME_REQUIRED")
    expect(fallback.manualCatalogIds).toEqual(["P-GLY-D", "P-GLY-S"])
    const inputs = { eventDistanceM: 5000, experience: "DEVELOPING" as const, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    expect(applyInitialMainManual(input, review.key, fallback, "P-GLY-D", inputs, true)).toBeNull()
    expect(applyInitialMainManual(input, review.key, fallback, "P-GLY-D", { ...inputs, confirmedRequirements: [space] }, true)).toBeNull()
    // Synthetic, explicitly entered fixture, not a recommended athlete target.
    const explicit = { ...inputs, segmentSeconds: [{ segmentId: "part-0", seconds: 45 }] }
    expect(applyInitialMainManual(input, review.key, fallback, "P-GLY-D", explicit)).toBeNull()
    const next = applyInitialMainManual(input, review.key, fallback, "P-GLY-D", explicit, true)!
    expect(next).not.toBeNull()
    expect(next.candidates.every(isVerifiedPlanCandidate)).toBe(true)
    const session = next.candidates[0].sessions.find(session => session.day === fallback.day && session.slot === fallback.slot)!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
    const workout = resolveCatalogBinding(session.prescription.catalogWorkout!)!
    expect(workout.steps.filter(step => step.phase === "main" && step.kind === "WORK").map(step => step.seconds!.maximum)).toEqual([45, 45, 45, 45, 45, 45])
    expect(workout.totals.seconds!.maximum).toBe(2630)
    expect(session.prescription.catalogWorkout!.acceptedDurationSeconds).toBe(2630)
    expect(workout.inputs.experience).toBe("DEVELOPING")
    expect(applyInitialMainManual({ ...input, context: { ...input.context, revision: 2 } }, review.key, fallback, "P-GLY-D", explicit, true)).toBeNull()
    expect(applyInitialMainManual(input, review.key, fallback, "X-GLY-07", explicit, true)).toBeNull()
  })
  it("beginner GLY remains honestly unbound; alternatives require a new explicit purpose, not a false experience", () => {
    const { input } = fixture("NEW_TO_RUNNING", "GLY_INTENT"), snapshot = JSON.stringify(input)
    const review = reviewInitialMainConditions(input)!
    expect(review.offers).toEqual([])
    expect(review.fallbacks.length).toBeGreaterThan(0)
    for (const fallback of review.fallbacks) {
      expect(fallback.reason).toBe("BEGINNER_GLY_NOT_ADOPTED")
      expect(fallback.alternatives.map(alternative => alternative.trainingFocus)).toEqual(["VO2_INTENT", "LT_INTENT"])
      for (const alternative of fallback.alternatives) {
        const { input: next } = fixture("NEW_TO_RUNNING", alternative.trainingFocus as "VO2_INTENT" | "LT_INTENT")
        expect(reviewInitialMainConditions(next)).toMatchObject({ offers: [], fallbacks: [] })
        expect(next.intake.experienceBand).toBe("NEW_TO_RUNNING")
      }
    }
    expect(applyInitialMainConditions(input, review.key, [space])).toBeNull()
    expect(JSON.stringify(input)).toBe(snapshot)
  })
  it.each(["date", "account", "revision", "mode", "experience", "event", "pair"] as const)("rejects stale %s review without touching the draft", field => {
    const { input } = fixture(), review = reviewInitialMainConditions(input)!
    const changed: InitialMainInput = { ...input, context: { ...input.context,
      ...field === "date" ? { startDate: "2026-11-02" } : field === "account" ? { accountScope: "another" }
        : field === "revision" ? { revision: 2 } : field === "mode" ? { mode: "saved-plan" as const } : {} },
      intake: { ...input.intake, ...field === "experience" ? { experienceBand: "NEW_TO_RUNNING" as const }
        : field === "event" ? { eventDistanceM: 800 as const } : {} },
      generated: { ...input.generated, ...field === "pair" ? { pairId: "stale" } : {} } }
    const snapshot = JSON.stringify(changed)
    expect(applyInitialMainConditions(changed, review.key, [space])).toBeNull()
    expect(JSON.stringify(changed)).toBe(snapshot)
  })
  it("preserves saved plans and rejects safety hard stops, unknown safety and invalid calendar dates", () => {
    const { input } = fixture(), review = reviewInitialMainConditions(input)!
    for (const storedStatus of ["ACTIVE", "UNKNOWN"] as const) {
      const gate = decideSafetyGate({ ...createEvaluatorFailureSignal("exception"), storedStatus })
      expect(reviewInitialMainConditions({ ...input, gate })).toBeNull()
      expect(applyInitialMainConditions({ ...input, gate }, review.key, [space])).toBeNull()
    }
    expect(reviewInitialMainConditions({ ...input, context: { ...input.context, startDate: "2026-02-30" } })).toBeNull()
    expect(reviewInitialMainConditions({ ...input, context: { ...input.context, mode: "saved-plan" } })).toBeNull()
    setActiveLocalAccount("another")
    expect(applyInitialMainConditions(input, review.key, [space])).toBeNull()
    setActiveLocalAccount(null)
  })
})
