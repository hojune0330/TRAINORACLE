import { describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { PaceAnchorRecord } from "@impl/prescription/types"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { prepareDetailedPrescription } from "./detailed-prescription"

const ANCHOR: PaceAnchorRecord = {
  anchorId: "race:5000:current",
  kind: "RECENT_RESULT",
  eventDistanceM: 5000,
  performanceSeconds: 1000,
  achievedAt: "2026-07-20",
  seasonId: null,
  enteredBy: "ATHLETE",
  sourceRef: "athlete-record:race:5000:current",
  verificationState: "SELF_REPORTED",
  freshnessState: "CURRENT",
  purpose: "CURRENT_CAPABILITY",
}

const REVIEW = {
  reviewerName: "synthetic-test-reviewer",
  evidenceRef: "test-only:evidence",
  decision: "APPROVED" as const,
}

const FORGED_APPROVAL = {
  templateId: "FORGED-UNLISTED-TEMPLATE",
  notation: "5×1000m @5000m RP · r150″",
  lifecycleStatus: "ACTIVE",
  eligibilityStatus: "ELIGIBLE",
  eligibleEventGroups: ["FIVE_K"],
  eligibleExperienceBands: ["EXPERIENCED"],
  ownerReview: REVIEW,
  coachReview: REVIEW,
  sportsScienceReview: REVIEW,
  youthReview: REVIEW,
}

function clearedGate() {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    evidence: [],
  }))
}

function input(templateId: string, detailedPrescriptionEnabled: boolean) {
  return {
    detailedPrescriptionEnabled,
    templateId,
    athleteEventGroup: "FIVE_K" as const,
    athleteExperienceBand: "EXPERIENCED" as const,
    anchor: ANCHOR,
    displayRoundingPolicyVersion: "seconds-v1",
    safetyGate: clearedGate(),
  }
}

describe("detailed prescription application boundary", () => {
  it("returns no prescription while the explicit product flag is off", () => {
    const result = prepareDetailedPrescription(input("FORGED-UNLISTED-TEMPLATE", false))

    expect(result).toBeNull()
  })

  it("keeps an unlisted template unavailable through the canonical manifest", () => {
    const result = prepareDetailedPrescription(input("UNLISTED-TEMPLATE", true))

    expect(DETAILED_PRESCRIPTION_APPROVALS).toHaveLength(0)
    expect(result).toBeNull()
  })

  it("ignores a forged caller-supplied approval record", () => {
    const result = Reflect.apply(prepareDetailedPrescription, undefined, [
      input(FORGED_APPROVAL.templateId, true),
      [FORGED_APPROVAL],
    ])

    expect(result).toBeNull()
  })
})
