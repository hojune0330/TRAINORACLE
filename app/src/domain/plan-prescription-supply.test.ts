import { beforeEach, describe, expect, it } from "vitest"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { planPrescriptionSupply } from "./plan-prescription-supply"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import type { PlanSession } from "@impl/plan-generator/types"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })

function generatedSessions() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "LT_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(`Expected generated plan, got ${result.kind}`)
  return result.generated.candidates[0].sessions
}

describe("generated MAIN prescription supply", () => {
  it("reports each actual generated QUALITY slot and exposes only resolved catalog steps", () => {
    const sessions = generatedSessions()
    const mains = sessions.filter(s => s.role === "QUALITY")
    const supply = planPrescriptionSupply(sessions)
    expect(supply.map(({ day, slot }) => [day, slot])).toEqual(mains.map(({ day, slot }) => [day, slot]))
    expect(supply.every(slot => slot.flags.includes("detailed_applied") ? slot.calculation !== undefined : true)).toBe(true)
    expect(supply.some(slot => slot.catalogId && slot.calculation?.steps.length)).toBe(true)
  })

  it("keeps an unbound MAIN as time/RPE guidance without claiming catalog absence", () => {
    const sessions = generatedSessions().map(session => session.role === "QUALITY"
      ? { ...session, prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 40 } } }
      : session)
    const slot = planPrescriptionSupply(sessions)[0]!
    expect(slot.flags).toEqual(["time_rpe_guidance"])
    expect(slot.detail).toContain("상세 훈련 구성은 연결되어 있지 않아요")
    expect(slot.detail).not.toContain("공급 없음")
  })

  it("does not call a pending detailed preview applied", () => {
    const slot = planPrescriptionSupply(generatedSessions(), { confirmationPending: true })[0]!
    expect(slot.flags).toContain("confirmation_pending")
    expect(slot.flags).not.toContain("detailed_applied")
  })

  it("surfaces missing venue conditions and missing inputs from the bound calculation", () => {
    const sessions = generatedSessions()
    const target = sessions.find(s => s.role === "QUALITY")!
    if (target.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected a time/RPE MAIN")
    const entry = ALL_WORKOUT_CATALOG.find(row => row.family === "LT" && row.requirements.length > 0
      && row.eventDistances.includes(5000) && row.experience.includes("EXPERIENCED"))!
    const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    const calc = calculateCatalogWorkout(entry.id, inputs)!
    const bound = { ...target, prescription: { kind: "RPE_TIME_RANGE" as const, rpe: { minimum: 6, maximum: 7 },
      durationMinutes: { minimum: 30, maximum: 40 }, catalogWorkout: { version: 1 as const, catalogId: entry.id,
        catalogFingerprint: calc.catalogFingerprint, calculationFingerprint: calc.fingerprint, inputs,
        originalEnvelope: { rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 40 } } } } } as PlanSession
    const condition = planPrescriptionSupply([bound])[0]!
    expect(condition.flags).toContain("condition_needed")
    expect(condition.detail).not.toContain("상세 연결됨")

    const rp = ALL_WORKOUT_CATALOG.find(row => row.id === "RP-10000-INTRO")!
    const rpInputs = { ...inputs, eventDistanceM: 10000 }
    const rpCalc = calculateCatalogWorkout(rp.id, rpInputs)!
    const targetBinding = bound.prescription.kind === "RPE_TIME_RANGE" ? bound.prescription.catalogWorkout : undefined
    if (!targetBinding) throw Error("Expected a catalog binding")
    const rpBound = { ...bound, prescription: { ...bound.prescription, catalogWorkout: { ...targetBinding,
      catalogId: rp.id, catalogFingerprint: rpCalc.catalogFingerprint, calculationFingerprint: rpCalc.fingerprint, inputs: rpInputs } } } as PlanSession
    const needsInput = planPrescriptionSupply([rpBound])[0]!
    expect(needsInput.flags).toContain("input_needed")
    expect(needsInput.detail).toContain("실제 목표 페이스 입력 필요")
  })

  it("marks a stale calculation fingerprint as check failed and does not reveal its numbers", () => {
    const sessions = generatedSessions().map(session => session.role === "QUALITY" && session.prescription.kind === "RPE_TIME_RANGE"
      ? { ...session, prescription: { ...session.prescription, catalogWorkout: session.prescription.catalogWorkout
        ? { ...session.prescription.catalogWorkout, calculationFingerprint: "sha256:stale" } : undefined } }
      : session)
    const slot = planPrescriptionSupply(sessions)[0]!
    expect(slot.flags).toEqual(["check_failed"])
    expect(slot.calculation).toBeUndefined()
  })
})
