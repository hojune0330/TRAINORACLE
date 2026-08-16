import { describe, expect, it, vi } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"

vi.mock("./detailed-prescription-approvals", () => ({
  DETAILED_PRESCRIPTION_APPROVALS: Object.freeze([Object.freeze({
    templateId: "V2-SEED-05",
    notation: "5×1000m @5000m RP · r150″",
    lifecycleStatus: "ACTIVE",
    eligibilityStatus: "ELIGIBLE",
    eligibleEventGroups: Object.freeze(["FIVE_K"]),
    eligibleExperienceBands: Object.freeze(["EXPERIENCED"]),
    ownerReview: Object.freeze({ reviewerName: "owner", evidenceRef: "owner:1", decision: "APPROVED" }),
    coachReview: Object.freeze({ reviewerName: "coach", evidenceRef: "coach:1", decision: "APPROVED" }),
    sportsScienceReview: Object.freeze({ reviewerName: "scientist", evidenceRef: "science:1", decision: "APPROVED" }),
    youthReview: Object.freeze({ reviewerName: "youth-reviewer", evidenceRef: "youth:1", decision: "APPROVED" }),
    minorAllowed: true,
    warmupComponentRef: "WU-QUALITY-001",
    cooldownComponentRef: "CD-QUALITY-001",
    downshiftOptionRefs: Object.freeze(["REDUCE_REPETITIONS"]),
    stopConditionCodes: Object.freeze(["STOP_IF_D9_BLOCKED_OR_UNKNOWN"]),
  })]),
}))

import { prepareDetailedPrescription } from "./detailed-prescription"

function clearedGate() {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    evidence: [],
  }))
}

describe("approved detailed prescription path", () => {
  it("preserves required execution references after every approval gate passes", () => {
    // Given: the canonical manifest contains one fully reviewed, scope-matched template.
    const input = {
      detailedPrescriptionEnabled: true,
      templateId: "V2-SEED-05",
      athleteEventGroup: "FIVE_K" as const,
      athleteExperienceBand: "EXPERIENCED" as const,
      athleteIsMinor: true,
      guardianConsentConfirmed: true,
      designatedHumanReviewConfirmed: true,
      anchor: {
        anchorId: "race:5000:current",
        kind: "RECENT_RESULT" as const,
        eventDistanceM: 5000,
        performanceSeconds: 1000,
        achievedAt: "2026-07-20",
        seasonId: null,
        enteredBy: "ATHLETE" as const,
        sourceRef: "athlete-record:race:5000:current",
        verificationState: "SELF_REPORTED" as const,
        freshnessState: "CURRENT" as const,
        purpose: "CURRENT_CAPABILITY" as const,
      },
      displayRoundingPolicyVersion: "seconds-v1",
      safetyGate: clearedGate(),
    }

    // When: the app prepares the reviewed template for this exact athlete scope.
    const result = prepareDetailedPrescription(input)

    // Then: the dose and every execution guard travel together.
    expect(result?.pace.targetRepSeconds).toBe(200)
    expect(result?.prescription).toMatchObject({
      warmupComponentRef: "WU-QUALITY-001",
      cooldownComponentRef: "CD-QUALITY-001",
      downshiftOptionRefs: ["REDUCE_REPETITIONS"],
      stopConditionCodes: ["STOP_IF_D9_BLOCKED_OR_UNKNOWN"],
    })
  })
})
