import { describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { PaceAnchorRecord } from "@impl/prescription/types"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  type DetailedPrescriptionApprovalRecord,
} from "./detailed-prescription-approvals"
import { prepareDetailedPrescription } from "./detailed-prescription"

const CATALOG_TEMPLATE_IDS = [
  "BA-SEED-01", "BA-SEED-02", "BA-SEED-03", "BA-SEED-04", "BA-SEED-05",
  "LT-SEED-01", "LT-SEED-02", "LT-SEED-03", "LT-SEED-04", "LT-SEED-05",
  "V2-SEED-01", "V2-SEED-02", "V2-SEED-03", "V2-SEED-04", "V2-SEED-05",
  "GL-SEED-01", "GL-SEED-02", "GL-SEED-03", "GL-SEED-04", "GL-SEED-05",
  "AP-SEED-01", "AP-SEED-02", "AP-SEED-03", "AP-SEED-04", "AP-SEED-05",
  "RE-SUPPORT-01", "RE-SUPPORT-02", "RE-SUPPORT-03", "RE-SUPPORT-04", "RE-SUPPORT-05",
] as const

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

const COMPLETE_APPROVAL: DetailedPrescriptionApprovalRecord = {
  templateId: "TEST-ONLY-APPROVED",
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
    const result = prepareDetailedPrescription(
      input(COMPLETE_APPROVAL.templateId, false),
      [COMPLETE_APPROVAL],
    )

    expect(result).toBeNull()
  })

  it("returns no prescription for an incomplete approval record", () => {
    const result = prepareDetailedPrescription(
      input(COMPLETE_APPROVAL.templateId, true),
      [{ ...COMPLETE_APPROVAL, youthReview: null }],
    )

    expect(result).toBeNull()
  })

  it.each(CATALOG_TEMPLATE_IDS)("keeps unapproved catalog template %s unavailable", (templateId) => {
    const result = prepareDetailedPrescription(
      input(templateId, true),
      DETAILED_PRESCRIPTION_APPROVALS,
    )

    expect(result).toBeNull()
  })

  it("delegates a fully gated synthetic fixture to the prescription runtime", () => {
    const result = prepareDetailedPrescription(
      input(COMPLETE_APPROVAL.templateId, true),
      [COMPLETE_APPROVAL],
    )

    expect(result).toMatchObject({
      notation: COMPLETE_APPROVAL.notation,
      prescription: {
        kind: "STRUCTURED_PRESCRIPTION",
        paceAnchorRef: ANCHOR.anchorId,
      },
      pace: { targetRepSeconds: 200 },
    })
  })
})
