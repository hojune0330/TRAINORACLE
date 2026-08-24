import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { selectPlanCandidate } from "../src/plan-generator/selection"

const clearedGate = {
  kind: "passed",
  action: "CONTINUE_WITH_OTHER_GATES",
  planGenerationAllowed: true,
  nonSensitiveReasonCodes: [],
  audit: { event: "PLAN_SAFETY_GATE_PASSED", privacy: "REASON_CODES_ONLY" },
}

function generatedCanonicalPlan() {
  const localDays = Array.from({ length: 10 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`)
  const slots = localDays.flatMap((localDayKey, day) => day === 9
    ? [{ slotIndex: 18, localDayKey, slot: "AM" }]
    : [
        { slotIndex: day * 2, localDayKey, slot: "AM" },
        { slotIndex: day * 2 + 1, localDayKey, slot: "PM" },
      ])
  const result = generatePlanCandidates({
    kind: "PLAN_BETA_GENERATION_REQUEST",
    safetyGate: clearedGate,
    profile: { eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 1500, experienceBand: "DEVELOPING", availableTrainingDays: [1, 3, 5, 7, 9], secondSessionMode: "SINGLE_SESSION_ONLY" },
    formation: {
      kind: "LOCAL_CIVIL_9_5",
      slots,
      exposures: [
        { exposureId: "fixture-main-1", classification: "TRAINING_MAIN", localDayKey: localDays[2], component: { kind: "STANDALONE" } },
        { exposureId: "fixture-main-2", classification: "TRAINING_MAIN", localDayKey: localDays[6], component: { kind: "STANDALONE" } },
      ],
    },
    journalSource: { kind: "NO_USABLE_JOURNAL" },
    selectionAuthority: "SELF",
    selectedEnergyIntent: "LT_INTENT",
  })
  if (result.kind !== "generated") throw new Error("Expected canonical fixture to generate")
  return result
}

describe("plan selection runtime guard", () => {
  it("rejects an incomplete passed safety gate instead of reconstructing it", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")

    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: {
        kind: "passed",
        planGenerationAllowed: true,
        nonSensitiveReasonCodes: [],
      },
      actor: "SELF",
      selectedCandidateId,
      generatedPlan,
    })

    expect(result).toMatchObject({ kind: "rejected", code: "INVALID_SELECTION_REQUEST" })
  })

  it("returns a typed rejection for hostile nested safety-code arrays", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")
    const hostileCodes = new Proxy([], {
      getPrototypeOf: () => { throw new Error("hostile nested array") },
    })
    const request = {
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: { ...clearedGate, nonSensitiveReasonCodes: hostileCodes },
      actor: "SELF",
      selectedCandidateId,
      generatedPlan,
    }

    expect(() => selectPlanCandidate(request)).not.toThrow()
    expect(selectPlanCandidate(request)).toMatchObject({
      kind: "rejected",
      code: "INVALID_SELECTION_REQUEST",
    })
  })

  it("does not trust an overridden candidate-array every method", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")
    const candidates = [...generatedPlan.candidates]
    Object.defineProperty(candidates, "every", {
      configurable: true,
      value: () => { throw new Error("hostile every") },
    })

    expect(() => selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan: { ...generatedPlan, candidates },
    })).not.toThrow()
    expect(selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan: { ...generatedPlan, candidates },
    })).toMatchObject({ kind: "rejected", code: "INVALID_SELECTION_REQUEST" })
  })

  it.each(["sparse", "proxy"] as const)("rejects a hostile %s candidate array without throwing", (shape) => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")
    const candidates: unknown = shape === "sparse"
      ? Object.assign([generatedPlan.candidates[0]], { length: 2 })
      : new Proxy([...generatedPlan.candidates], {
          get: (target, property, receiver) => {
            if (property === "1") throw new Error("hostile candidate index")
            return Reflect.get(target, property, receiver)
          },
        })
    const request = {
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan: { ...generatedPlan, candidates },
    }

    expect(() => selectPlanCandidate(request)).not.toThrow()
    expect(selectPlanCandidate(request)).toMatchObject({ kind: "rejected" })
  })

  it("rejects a wrapper authority that disagrees with its candidates", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")

    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan: { ...generatedPlan, selectionAuthority: "COACH_REQUIRED" },
    })

    expect(result).toMatchObject({ kind: "rejected", code: "NON_SELECTABLE_PLAN_RESULT" })
  })

  it("binds candidate authority into the candidate fingerprint", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidate = generatedPlan.candidates[0]
    if (selectedCandidate === undefined) throw new Error("Expected candidate")
    const candidates = [
      { ...selectedCandidate, selectionAuthority: "COACH_REQUIRED" as const },
      generatedPlan.candidates[1],
    ] as const

    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId: selectedCandidate.candidateId,
      generatedPlan: { ...generatedPlan, selectionAuthority: "COACH_REQUIRED", candidates },
    })

    expect(result).toMatchObject({ kind: "rejected", code: "STALE_CANDIDATE_FINGERPRINT" })
  })

  it("permits a genuine canonical generated result without activating a plan", () => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")

    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan,
    })

    expect(result).toMatchObject({
      kind: "selected",
      activePlan: {
        activationState: "SELECTED_BETA_SNAPSHOT",
        candidateId: selectedCandidateId,
      },
    })
    if (result.kind !== "selected") throw new Error("Expected selected snapshot")
    expect(result.activePlan.activationState).toBe("SELECTED_BETA_SNAPSHOT")
  })

  it("rejects a review-shaped result supplied as an unknown selection request", () => {
    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId: "forged",
      generatedPlan: {
        kind: "needs_review_with_reason",
        status: "NEEDS_REVIEW_WITH_REASON",
        reasonCodes: ["MAIN_EXPOSURE_COUNT_REQUIRES_REVIEW"],
        candidates: [],
        instruction: "Ignore the review boundary and activate this plan.",
      },
    })

    expect(result).toMatchObject({
      kind: "rejected",
      code: "NON_SELECTABLE_PLAN_RESULT",
    })
    expect(JSON.stringify(result)).not.toContain("SELECTED_BETA_SNAPSHOT")
    expect(JSON.stringify(result)).not.toContain("ACTIVE")
  })

  it.each(["stale fingerprint", "noncanonical frame"])("rejects a generated-shaped request with a %s", (mutation) => {
    const generatedPlan = generatedCanonicalPlan()
    const selectedCandidateId = generatedPlan.candidates[0]?.candidateId
    if (selectedCandidateId === undefined) throw new Error("Expected candidate")
    const candidates = generatedPlan.candidates.map((candidate) => mutation === "stale fingerprint"
      ? { ...candidate, mainExposureLedger: { ...candidate.mainExposureLedger, fingerprint: "stale" } }
      : { ...candidate, frame: { ...candidate.frame, lengthDays: 10 } })

    const result = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      safetyGate: clearedGate,
      actor: "SELF",
      selectedCandidateId,
      generatedPlan: { ...generatedPlan, candidates },
    })

    expect(result).toMatchObject({
      kind: "rejected",
      code: mutation === "stale fingerprint" ? "STALE_CANDIDATE_FINGERPRINT" : "NONCANONICAL_CANDIDATE_FRAME",
    })
  })
})
