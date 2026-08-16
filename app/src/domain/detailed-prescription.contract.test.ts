import { describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { PaceAnchorRecord } from "@impl/prescription/types"
import {
  DETAILED_PRESCRIPTION_APPROVALS,
  type DetailedPrescriptionApprovalRecord,
} from "./detailed-prescription-approvals"
import {
  isDetailedPrescriptionApprovalComplete,
  prepareDetailedPrescription,
} from "./detailed-prescription"

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
  minorAllowed: true,
  warmupComponentRef: "WU-QUALITY-001",
  cooldownComponentRef: "CD-QUALITY-001",
  downshiftOptionRefs: ["REDUCE_REPETITIONS"],
  stopConditionCodes: ["STOP_IF_D9_BLOCKED_OR_UNKNOWN"],
} satisfies DetailedPrescriptionApprovalRecord

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
    athleteIsMinor: false,
    guardianConsentConfirmed: false,
    designatedHumanReviewConfirmed: false,
  }
}

describe("detailed prescription application boundary", () => {
  it("rejects an approval that omits required execution and stop references", () => {
    // Given: every human review is present but the execution references are empty.
    const approval = {
      ...FORGED_APPROVAL,
      warmupComponentRef: "",
      cooldownComponentRef: "",
      downshiftOptionRefs: [],
      stopConditionCodes: [],
    }

    // When: the canonical approval gate evaluates it for an adult athlete.
    const complete = isDetailedPrescriptionApprovalComplete(approval, {
      athleteEventGroup: "FIVE_K",
      athleteExperienceBand: "EXPERIENCED",
      athleteIsMinor: false,
      guardianConsentConfirmed: false,
      designatedHumanReviewConfirmed: false,
    })

    // Then: status labels and signatures alone cannot activate the dose.
    expect(complete).toBe(false)
  })

  it("requires minor eligibility, guardian consent, and designated-human confirmation", () => {
    // Given: a fully reviewed template permits minors.
    const approval = FORGED_APPROVAL

    // When / Then: missing either athlete-specific confirmation remains ineligible.
    expect(isDetailedPrescriptionApprovalComplete(approval, {
      athleteEventGroup: "FIVE_K",
      athleteExperienceBand: "EXPERIENCED",
      athleteIsMinor: true,
      guardianConsentConfirmed: false,
      designatedHumanReviewConfirmed: true,
    })).toBe(false)
    expect(isDetailedPrescriptionApprovalComplete(approval, {
      athleteEventGroup: "FIVE_K",
      athleteExperienceBand: "EXPERIENCED",
      athleteIsMinor: true,
      guardianConsentConfirmed: true,
      designatedHumanReviewConfirmed: false,
    })).toBe(false)
  })

  it("accepts a complete reviewed approval only inside its athlete scope", () => {
    // Given: every approval field and athlete-specific minor confirmation is present.
    const eligibility = {
      athleteEventGroup: "FIVE_K" as const,
      athleteExperienceBand: "EXPERIENCED" as const,
      athleteIsMinor: true,
      guardianConsentConfirmed: true,
      designatedHumanReviewConfirmed: true,
    }

    // When / Then: the exact reviewed scope passes, while another event does not.
    expect(isDetailedPrescriptionApprovalComplete(FORGED_APPROVAL, eligibility)).toBe(true)
    expect(isDetailedPrescriptionApprovalComplete(FORGED_APPROVAL, {
      ...eligibility,
      athleteEventGroup: "TEN_K",
    })).toBe(false)
  })

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
