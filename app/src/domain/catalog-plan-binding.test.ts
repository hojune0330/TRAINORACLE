import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { parsePlanBetaState } from "./plan-beta-schema"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
const base = { eventGroup: "FIVE_K" as const, eventDistanceM: 5000 as const, competitionDivision: "OPEN" as const,
  experienceBand: "EXPERIENCED" as const, availableDayCount: 5 as const, requestedFrameLength: 9 as const, trainingFocus: "LT_INTENT" as const,
  secondSessionMode: "SINGLE_SESSION_ONLY" as const, trainingTimePreference: "VARIES" as const, selectedDetailedTemplateRef: null }
describe("catalog -> plan -> selection -> saved structure", () => {
  it.each([800, 1500, 3000, 5000, 10000, 21097, 42195] as const)("keeps %sm, experience, AM/PM and all purpose choices compatible", eventDistanceM => {
    const eventGroup = eventDistanceM <= 3000 ? "MIDDLE_DISTANCE" : eventDistanceM === 5000 ? "FIVE_K" : eventDistanceM === 10000 ? "TEN_K" : "GENERAL_ENDURANCE"
    for (const experienceBand of ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const) {
      for (const trainingFocus of ["BASE_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT", "RECOVERY_INTENT"] as const) {
        const result = generatePlanFromDraft({ ...base, eventGroup, eventDistanceM, experienceBand, trainingFocus,
          secondSessionMode: "RECOVERY_PM_ALLOWED" }, "NO_KNOWN_RISK")
        expect(result.kind, `${eventDistanceM}/${experienceBand}/${trainingFocus}`).toBe("generated")
        if (result.kind !== "generated") continue
        expect(result.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
        expect(isInitialCandidatePair(...result.generated.candidates)).toBe(true)
        const selected = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake, result.athleteEvidence)
        expect(selected.kind).toBe("selected")
        if (selected.kind === "selected") expect(parsePlanBetaState(selected.state)).not.toBeNull()
        for (const s of result.generated.candidates[0].sessions) if (s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout) {
          expect(s.prescription.catalogWorkout.inputs).toMatchObject({ eventDistanceM, experience: experienceBand })
          expect(s.prescription.catalogWorkout.acceptedDurationSeconds).toBeUndefined()
          expect(s.prescription.rpe.maximum).toBeLessThanOrEqual(s.prescription.catalogWorkout.originalEnvelope.rpe.maximum)
          expect(s.prescription.durationMinutes.maximum).toBeLessThanOrEqual(s.prescription.catalogWorkout.originalEnvelope.durationMinutes.maximum)
        }
      }
    }
  }, 30000)
  it.each(["BASE_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT", "RECOVERY_INTENT"] as const)("%s preserves identity and storage", trainingFocus => {
    const result = generatePlanFromDraft({ ...base, trainingFocus }, "NO_KNOWN_RISK")
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
    expect(isInitialCandidatePair(...result.generated.candidates)).toBe(true)
    const selected = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake, result.athleteEvidence)
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") return
    expect(parsePlanBetaState(selected.state)).not.toBeNull()
    const connected = selected.state.activePlan.sessions.filter(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout)
    expect(connected.length).toBeGreaterThan(0)
    for (const s of connected) if (s.prescription.kind === "RPE_TIME_RANGE") expect(resolveCatalogBinding(s.prescription.catalogWorkout!)).not.toBeNull()
  })
  it("explicit same-purpose replacement keeps day, slot and exposure ledger", () => {
    const result = generatePlanFromDraft(base, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw Error(result.kind)
    const selected = result.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    const changed = replaceCandidateCatalogWorkout(result.generated, selected, "P-LT-B-480", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [],
    })
    expect(changed).not.toBeNull()
    expect(changed!.candidates[0].mainExposureLedger).toEqual(result.generated.candidates[0].mainExposureLedger)
    expect(changed!.candidates[0].sessions.map(s => [s.day, s.slot, s.role])).toEqual(result.generated.candidates[0].sessions.map(s => [s.day, s.slot, s.role]))
    expect(replaceCandidateCatalogWorkout(result.generated, selected, "P-REC-W", { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] })).toBeNull()
  })
  it("a longer exact workout needs its own duration acceptance, never silently expands the plan", () => {
    const result = generatePlanFromDraft(base, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw Error(result.kind)
    const selected = result.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const, availableSeconds: null, confirmedRequirements: [],
      fiveK: { recordId: "current-5k", seconds: 1111.7, achievedAt: "2026-09-01", evaluatedAt: "2026-09-30" }, segmentPaces: [] }
    expect(replaceCandidateCatalogWorkout(result.generated, selected, "X-LT-01", inputs)).toBeNull()
    const changed = replaceCandidateCatalogWorkout(result.generated, selected, "X-LT-01", inputs, true)
    expect(changed).not.toBeNull()
    const session = changed!.candidates[0].sessions.find(s => s.day === selected.day && s.slot === selected.slot)!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong kind")
    const binding = session.prescription.catalogWorkout!
    expect(binding.acceptedDurationSeconds).toBeGreaterThan(3000)
    expect(resolveCatalogBinding({ ...binding, acceptedDurationSeconds: binding.acceptedDurationSeconds! + 1 })).toBeNull()
    expect(changed!.candidates[0].mainExposureLedger).toEqual(result.generated.candidates[0].mainExposureLedger)
  })
})
