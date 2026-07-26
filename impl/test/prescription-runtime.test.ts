import { describe, expect, it } from "vitest"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { preparePrescriptionRuntime } from "../src/prescription/runtime"

function gateFor(disposition: "D9_CLEARED" | "D9_ACTIVE" | "D9_UNKNOWN") {
  return decideSafetyGate(
    mapD9ResultToRveSignal({
      disposition,
      blocksPlanGeneration: disposition !== "D9_CLEARED",
      reasonCodes: [disposition],
      evidence: [],
    }),
  )
}

const runtimeInput = {
  notation: "2×(10×400m) @5000m RP · r60″ · R3′",
  anchor: {
    anchorId: "race:5000:current",
    kind: "RECENT_RESULT",
    eventDistanceM: 5000,
    performanceSeconds: 1000,
    achievedAt: "2026-07-20",
    seasonId: null,
    enteredBy: "ATHLETE",
    sourceRef: "journal:race:5000:2026-07-20",
    verificationState: "SELF_REPORTED",
    freshnessState: "CURRENT",
    purpose: "CURRENT_CAPABILITY",
  },
  displayRoundingPolicyVersion: "seconds-v1",
  template: {
    lifecycleStatus: "DRAFT",
    eligibilityStatus: "REVIEW_REQUIRED",
  },
}

const draftTemplateIds = [
  "BA-SEED-01", "BA-SEED-02", "BA-SEED-03", "BA-SEED-04", "BA-SEED-05",
  "LT-SEED-01", "LT-SEED-02", "LT-SEED-03", "LT-SEED-04", "LT-SEED-05",
  "V2-SEED-01", "V2-SEED-02", "V2-SEED-03", "V2-SEED-04", "V2-SEED-05",
  "GL-SEED-01", "GL-SEED-02", "GL-SEED-03", "GL-SEED-04", "GL-SEED-05",
  "AP-SEED-01", "AP-SEED-02", "AP-SEED-03", "AP-SEED-04", "AP-SEED-05",
  "RE-SUPPORT-01", "RE-SUPPORT-02", "RE-SUPPORT-03", "RE-SUPPORT-04", "RE-SUPPORT-05",
] as const

describe("prescription runtime safety boundary", () => {
  it.each(draftTemplateIds)("rejects draft template %s before it can become a plan prescription", (templateId) => {
    // Given
    const input = {
      ...runtimeInput,
      template: {
        ...runtimeInput.template,
        templateId,
      },
      safetyGate: gateFor("D9_CLEARED"),
    }

    // When
    const result = preparePrescriptionRuntime(input)

    // Then
    expect(result).toEqual({ kind: "rejected", code: "TEMPLATE_NOT_ACTIVE" })
  })

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)(
    "rejects %s before notation or anchor values can produce a prescription",
    (disposition) => {
      // Given
      const input = {
        ...runtimeInput,
        template: {
          lifecycleStatus: "ACTIVE" as const,
          eligibilityStatus: "ELIGIBLE" as const,
        },
        safetyGate: gateFor(disposition),
      }

      // When
      const result = preparePrescriptionRuntime(input)

      // Then
      expect(result).toEqual({ kind: "rejected", code: "SAFETY_GATE_BLOCKED" })
    },
  )

  it("does not retain raw memo or private signal fields in its structured result", () => {
    // Given
    const rawMemo = "do not retain this"
    const input = {
      ...runtimeInput,
      template: {
        lifecycleStatus: "ACTIVE" as const,
        eligibilityStatus: "ELIGIBLE" as const,
      },
      safetyGate: gateFor("D9_CLEARED"),
      rawMemo,
      privateSelfOnlySignal: "private",
    }

    // When
    const result = preparePrescriptionRuntime(input)

    // Then
    expect(result.kind).toBe("prepared")
    expect(JSON.stringify(result)).not.toContain(rawMemo)
    expect(JSON.stringify(result)).not.toContain("private")
  })
})
