import { describe, expect, it } from "vitest"
import type { PaceAnchorRecord } from "@impl/prescription/types"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { prepareDetailedPrescription } from "./detailed-prescription"

const anchor: PaceAnchorRecord = {
  anchorId: "race:5000:current", kind: "RECENT_RESULT", eventDistanceM: 5000,
  performanceSeconds: 1000, achievedAt: "2026-07-20", seasonId: null,
  enteredBy: "ATHLETE", sourceRef: "athlete-record:race:5000:current",
  verificationState: "SELF_REPORTED", freshnessState: "CURRENT", purpose: "CURRENT_CAPABILITY",
}

const approval = (() => {
  const value = DETAILED_PRESCRIPTION_APPROVALS[0]
  if (value === undefined) throw new TypeError("V2-SEED-05 approval is missing")
  return value
})()

function input(detailedPrescriptionEnabled = true) {
  return {
    detailedPrescriptionEnabled,
    selectedEnergyIntent: "VO2_INTENT" as const,
    templateId: approval.templateId,
    templateVersion: approval.templateVersion,
    templateContentFingerprint: approval.templateContentFingerprint,
    athleteEventGroup: "FIVE_K" as const,
    targetEventDistanceM: approval.targetEventDistanceM,
    athleteExperienceBand: "EXPERIENCED" as const,
    eventScopeEvidenceFingerprint: approval.eventScopeEvidence.evidenceFingerprint,
    experienceScopeEvidenceFingerprint: approval.experienceScopeEvidence.evidenceFingerprint,
    sportsScienceEvidenceFingerprint: approval.sportsScienceEvidence.canonicalEvidenceFingerprint,
    populationApplicability: "YOUTH_AND_ADULT" as const,
    populationEvidenceFingerprint: approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
    componentRefs: approval.componentRefs,
    evaluatedAt: "2026-08-17T03:00:00.000Z",
    anchor,
    displayRoundingPolicyVersion: "seconds-v1",
    safetyGate: decideSafetyGate(mapD9ResultToRveSignal({
      disposition: "D9_CLEARED", blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"], evidence: [],
    })),
  }
}

describe("detailed prescription application boundary", () => {
  it("returns no prescription while the explicit product flag is off", () => {
    expect(prepareDetailedPrescription(input(false))).toBeNull()
  })

  it("prepares the exact active V2-SEED-05 prescription from compiled authority", () => {
    const result = prepareDetailedPrescription(input())

    expect(result).not.toBeNull()
    expect(result?.prescription.repetitionRecoveryMode).toBe("JOG")
    expect(result?.prescription.warmupComponent.componentRef).toBe("WU-V2-5K-01")
    expect(result?.prescription.cooldownComponent.componentRef).toBe("CD-V2-5K-01")
    expect(result?.prescription.fallbackComponent.numericRepetitionVariant).toBeNull()
    expect(result?.totals).toMatchObject({ totalRepetitions: 5, qualityDistanceM: 5000, repetitionRecoveryTotalSeconds: 600 })
  })

  it("rejects changed evidence and caller-forged lifecycle flags", () => {
    const changedEvidence = {
      ...input(),
      sportsScienceEvidenceFingerprint: `sha256:${"a".repeat(64)}`,
      lifecycleStatus: "ACTIVE",
      eligibilityStatus: "ELIGIBLE",
    }

    expect(prepareDetailedPrescription(changedEvidence)).toBeNull()
  })

  it("rejects D9 ACTIVE without exposing a partial prescription", () => {
    const blocked = {
      ...input(),
      safetyGate: decideSafetyGate(mapD9ResultToRveSignal({
        disposition: "D9_ACTIVE", blocksPlanGeneration: true,
        reasonCodes: ["D9_ACTIVE_COLLOQUIAL_RISK_SIGNAL"], evidence: [],
      })),
    }

    expect(prepareDetailedPrescription(blocked)).toBeNull()
  })
})
