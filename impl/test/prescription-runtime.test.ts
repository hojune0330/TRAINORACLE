import { describe, expect, it } from "vitest"
import { evaluateD9ColloquialLayer } from "../src/d9/evaluator"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { mapD9ResultToRveSignal } from "../src/rve/signal"
import { preparePrescriptionRuntime } from "../src/prescription/runtime"

function gateFor(disposition: "D9_CLEARED" | "D9_ACTIVE" | "D9_UNKNOWN") {
  const evaluatorText = {
    D9_CLEARED: "첫 바퀴는 침착하게",
    D9_ACTIVE: "종아리 뚝 했고 절뚝거려요",
    D9_UNKNOWN: "뛸수록 정강이가 아파요",
  }[disposition]

  return decideSafetyGate(
    mapD9ResultToRveSignal(evaluateD9ColloquialLayer(evaluatorText)),
  )
}

const runtimeInput = {
  notation: "2×(10×400m) @5000m RP · r60″ STAND · R3′ STAND",
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
  operationalComponents: {
    warmup: {
      componentRef: "WU-V2-5K-01",
      componentVersion: "1.0.0",
      authority: "OWNER_OPERATIONAL_ADAPTATION",
      easyDurationMinutes: 15,
      rpeMin: 2,
      rpeMax: 3,
      strides: {
        repetitions: 4,
        durationSeconds: 20,
        recoverySeconds: 40,
        recoveryMode: "WALK_OR_JOG",
        progression: "PROGRESSIVE",
      },
    },
    cooldown: {
      componentRef: "CD-V2-5K-01",
      componentVersion: "1.0.0",
      authority: "OWNER_OPERATIONAL_ADAPTATION",
      easyDurationMinutes: 10,
      rpeMin: 1,
      rpeMax: 2,
    },
    fallback: {
      componentRef: "RPE-ONLY-CONTROLLED-01",
      componentVersion: "1.0.0",
      code: "RPE_ONLY_CONTROLLED",
      behavior: "DELEGATE_TO_EXISTING_RPE_CANDIDATE",
      numericRepetitionVariant: null,
    },
    stopConditions: {
      componentRef: "STOP-V2-5K-01",
      componentVersion: "1.0.0",
      authority: "OWNER_PRECAUTIONARY_OPERATIONAL_RULE",
      diagnosticClaim: false,
      codes: [
        "STOP_NEW_OR_WORSENING_PAIN",
        "STOP_DIZZINESS_OR_FAINTNESS",
        "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
        "STOP_LOSS_OF_CONTROLLED_FORM",
      ],
    },
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

  it("returns a typed rejection for hostile nested safety-code arrays", () => {
    const hostileCodes = new Proxy([], {
      getPrototypeOf: () => { throw new Error("hostile nested array") },
    })
    const input = {
      ...runtimeInput,
      template: { lifecycleStatus: "ACTIVE", eligibilityStatus: "ELIGIBLE" },
      safetyGate: {
        ...gateFor("D9_CLEARED"),
        nonSensitiveReasonCodes: hostileCodes,
      },
    }

    expect(() => preparePrescriptionRuntime(input)).not.toThrow()
    expect(preparePrescriptionRuntime(input)).toEqual({
      kind: "rejected",
      code: "MALFORMED_RUNTIME_INPUT",
    })
  })

  it("prepares the exact V2-SEED-05 JOG session with complete operational components", () => {
    const input = {
      ...runtimeInput,
      notation: "5×1000m @5000m RP · r150″ JOG",
      template: {
        lifecycleStatus: "ACTIVE" as const,
        eligibilityStatus: "ELIGIBLE" as const,
      },
      safetyGate: gateFor("D9_CLEARED"),
    }

    const result = preparePrescriptionRuntime(input)

    expect(result.kind).toBe("prepared")
    if (result.kind !== "prepared") throw new TypeError("Expected V2-SEED-05 to prepare")
    expect(result.prescription.repetitionRecoveryMode).toBe("JOG")
    expect(result.prescription.warmupComponent).toEqual(runtimeInput.operationalComponents.warmup)
    expect(result.prescription.cooldownComponent).toEqual(runtimeInput.operationalComponents.cooldown)
    expect(result.prescription.fallbackComponent).toEqual(runtimeInput.operationalComponents.fallback)
    expect(result.prescription.stopConditionComponent).toEqual(runtimeInput.operationalComponents.stopConditions)
    expect(result.totals.totalRepetitions).toBe(5)
    expect(result.totals.qualityDistanceM).toBe(5000)
    expect(result.totals.repetitionRecoveryOccurrences).toBe(4)
    expect(result.totals.repetitionRecoveryTotalSeconds).toBe(600)
  })

  it.each(["warmup", "cooldown", "fallback", "stopConditions"] as const)(
    "rejects atomically when the %s operational component is missing",
    (component) => {
      const operationalComponents = { ...runtimeInput.operationalComponents }
      expect(Reflect.deleteProperty(operationalComponents, component)).toBe(true)
      expect(operationalComponents).not.toHaveProperty(component)

      const result = preparePrescriptionRuntime({
        ...runtimeInput,
        notation: "5×1000m @5000m RP · r150″ JOG",
        template: { lifecycleStatus: "ACTIVE", eligibilityStatus: "ELIGIBLE" },
        operationalComponents,
        safetyGate: gateFor("D9_CLEARED"),
      })

      expect(result).toEqual({ kind: "rejected", code: "MALFORMED_RUNTIME_INPUT" })
    },
  )

  it("rejects a numeric repetition downshift instead of doing runtime dose arithmetic", () => {
    const numericFallback = {
      ...runtimeInput.operationalComponents.fallback,
      numericRepetitionVariant: 4,
    }
    expect(numericFallback.numericRepetitionVariant).not.toBeNull()

    const result = preparePrescriptionRuntime({
      ...runtimeInput,
      notation: "5×1000m @5000m RP · r150″ JOG",
      template: { lifecycleStatus: "ACTIVE", eligibilityStatus: "ELIGIBLE" },
      operationalComponents: {
        ...runtimeInput.operationalComponents,
        fallback: numericFallback,
      },
      safetyGate: gateFor("D9_CLEARED"),
    })

    expect(result).toEqual({ kind: "rejected", code: "MALFORMED_RUNTIME_INPUT" })
  })
})
