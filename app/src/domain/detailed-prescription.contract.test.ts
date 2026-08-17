import { describe, expect, it } from "vitest"
import type { PaceAnchorRecord } from "@impl/prescription/types"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { prepareDetailedPrescription } from "./detailed-prescription"

const SHA_A = `sha256:${"a".repeat(64)}`
const SHA_B = `sha256:${"b".repeat(64)}`
const SHA_C = `sha256:${"c".repeat(64)}`

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

function input(templateId: string, detailedPrescriptionEnabled: boolean) {
  return {
    detailedPrescriptionEnabled,
    templateId,
    templateVersion: "2.0.0",
    templateContentFingerprint: SHA_A,
    athleteEventGroup: "FIVE_K" as const,
    athleteExperienceBand: "EXPERIENCED" as const,
    eventScopeEvidenceFingerprint: SHA_B,
    experienceScopeEvidenceFingerprint: SHA_C,
    populationApplicability: "YOUTH_AND_ADULT" as const,
    populationEvidenceFingerprint: SHA_B,
    componentRefs: [{
      componentType: "WARMUP" as const,
      componentRef: "component:warmup:test",
      componentVersion: "1.0.0",
      componentFingerprint: SHA_C,
    }],
    evaluatedAt: "2026-08-17T00:00:00.000Z",
    anchor: ANCHOR,
    displayRoundingPolicyVersion: "seconds-v1",
    safetyGate: decideSafetyGate(mapD9ResultToRveSignal({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
      evidence: [],
    })),
  }
}

describe("detailed prescription application boundary", () => {
  it("returns no prescription while the explicit product flag is off", () => {
    expect(prepareDetailedPrescription(input("FORGED-UNLISTED-TEMPLATE", false))).toBeNull()
  })

  it("keeps the empty compiled manifest closed when caller inputs look eligible", () => {
    const forgedInput = {
      ...input("UNLISTED-TEMPLATE", true),
      lifecycleStatus: "ACTIVE",
      eligibilityStatus: "ELIGIBLE",
    }

    expect(DETAILED_PRESCRIPTION_APPROVALS).toHaveLength(0)
    expect(prepareDetailedPrescription(forgedInput)).toBeNull()
  })

  it("ignores a forged caller-supplied approval record", () => {
    const result = Reflect.apply(prepareDetailedPrescription, undefined, [
      input("FORGED-UNLISTED-TEMPLATE", true),
      [{ templateId: "FORGED-UNLISTED-TEMPLATE", lifecycleStatus: "ACTIVE", eligibilityStatus: "ELIGIBLE" }],
    ])

    expect(result).toBeNull()
  })
})
