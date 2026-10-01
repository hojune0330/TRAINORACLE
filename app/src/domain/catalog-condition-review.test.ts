import { beforeEach, describe, expect, it } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { findCatalogConditionReview } from "./catalog-condition-review"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
function conditionFixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "ATP_PC_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result
}
describe("first-plan condition discovery", () => {
  it("finds a real eligible MAIN but never manufactures confirmation or modifies the source", () => {
    const source = conditionFixture(), snapshot = JSON.stringify(source.generated)
    const offer = findCatalogConditionReview(source.generated, source.intake)
    expect(offer).not.toBeNull()
    expect(Object.keys(offer!).sort()).toEqual(["catalogFingerprint", "catalogId", "day", "pairId", "slot"])
    const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const, availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    expect(replaceCandidateCatalogWorkout(source.generated, offer!, offer!.catalogId, inputs)).toBeNull()
    const applied = replaceCandidateCatalogWorkout(source.generated, offer!, offer!.catalogId,
      { ...inputs, confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"] })
    expect(applied).not.toBeNull()
    applied!.candidates.forEach((candidate, index) => {
      expect(candidate.mainExposureLedger).toEqual(source.generated.candidates[index]!.mainExposureLedger)
      candidate.sessions.forEach((session, position) => {
        const original = source.generated.candidates[index]!.sessions[position]!
        if (session.day !== offer!.day || session.slot !== offer!.slot) { expect(session).toEqual(original); return }
        if (session.prescription.kind !== "RPE_TIME_RANGE" || original.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
        expect(session.prescription.rpe.maximum).toBeLessThanOrEqual(original.prescription.rpe.maximum)
        expect(session.prescription.durationMinutes.maximum).toBeLessThanOrEqual(original.prescription.durationMinutes.maximum)
        expect(session.prescription.catalogWorkout?.acceptedDurationSeconds).toBeUndefined()
      })
    })
    expect(JSON.stringify(source.generated)).toBe(snapshot)
  })

  it.each(["rpe", "duration"] as const)("rejects inconsistent A/B QUALITY %s envelopes", field => {
    const source = conditionFixture()
    const candidates = rebindCandidatePairIdentity(source.generated.candidates.map((candidate, i) => i === 0 ? candidate : {
      ...candidate, sessions: candidate.sessions.map(session => session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE"
        ? session : { ...session, prescription: { ...session.prescription,
          ...(field === "rpe" ? { rpe: { minimum: 1, maximum: 2 } } : { durationMinutes: { minimum: 1, maximum: 1 } }) } }),
    }) as unknown as PlanGenerationSuccess["candidates"])
    const changed = { ...source.generated, candidates, pairId: candidates[0].pairId }
    expect(findCatalogConditionReview(changed, source.intake)).toBeNull()
  })

  it.each(["rpe", "duration"] as const)("rejects matching valid pairs whose %s ceiling cannot fit any offered workout", field => {
    const source = conditionFixture()
    const candidates = rebindCandidatePairIdentity(source.generated.candidates.map(candidate => ({
      ...candidate, sessions: candidate.sessions.map(session => session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE"
        ? session : { ...session, prescription: { ...session.prescription,
          ...(field === "rpe" ? { rpe: { minimum: 1, maximum: 2 } } : { durationMinutes: { minimum: 1, maximum: 1 } }) } }),
    })) as unknown as PlanGenerationSuccess["candidates"])
    expect(candidates.every(isVerifiedPlanCandidate)).toBe(true)
    expect(isInitialCandidatePair(...candidates)).toBe(true)
    const changed = { ...source.generated, candidates, pairId: candidates[0].pairId }
    expect(findCatalogConditionReview(changed, source.intake)).toBeNull()
  })

  it("does not present LT cap conflicts as an environment-only question", () => {
    const source = conditionFixture()
    const result = generatePlanFromDraft({ ...source.intake, trainingFocus: "LT_INTENT" }, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw Error(result.kind)
    expect(findCatalogConditionReview(result.generated, result.intake)).toBeNull()
  })
})
