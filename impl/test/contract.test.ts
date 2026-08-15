import { describe, expect, it } from "vitest"
import { evaluateD9ColloquialLayer } from "../src/d9/evaluator"
import type { D9Result } from "../src/d9/evaluator"
import {
  createEvaluatorFailureSignal,
  mapD9ResultToRveSignal,
} from "../src/rve/signal"
import { decideSafetyGate } from "../src/safety-gate/gate"
import { createPlanDraft } from "../src/plan-generator/generator"

describe("D9 -> RVE -> Safety Gate contract slice", () => {
  it("maps ACTIVE to RVE ACTIVE and blocks plan generation", () => {
    // Given
    const d9 = evaluateD9ColloquialLayer("종아리 뚝 했고 절뚝거려요")

    // When
    const rve = mapD9ResultToRveSignal(d9)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "ACTIVE",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
    })
    expect(gate).toMatchObject({
      kind: "blocked",
      action: "BLOCK",
      planGenerationAllowed: false,
    })
  })

  it("maps UNKNOWN to human review and prevents plan generation", () => {
    // Given
    const d9 = evaluateD9ColloquialLayer("뛸수록 정강이가 아파요")

    // When
    const rve = mapD9ResultToRveSignal(d9)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
    })
    expect(gate).toMatchObject({
      kind: "blocked",
      action: "BLOCK_OR_HUMAN_REVIEW",
      planGenerationAllowed: false,
    })
  })

  it("maps CLEARED advisory to non-blocking CLEARED with reason codes preserved", () => {
    // Given
    const d9 = evaluateD9ColloquialLayer("그냥 좀 뻐근해요")

    // When
    const rve = mapD9ResultToRveSignal(d9)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "CLEARED",
      blocksPlanGeneration: false,
      requiresHumanReview: false,
    })
    expect(rve.nonSensitiveReasonCodes.length).toBeGreaterThan(0)
    expect(gate.kind).toBe("passed")
    if (gate.kind !== "passed") {
      throw new Error("Expected Safety Gate to pass for non-blocking advisory")
    }
    expect(createPlanDraft(gate)).toEqual({
      kind: "plan_draft",
      source: "BETA_PLAN_ENGINE",
    })
  })

  it("captures a hostile changing reason-code getter once before mapping", () => {
    // Given
    const rawMemo = "PRIVATE_MEMO_TEXT_must_not_cross_the_boundary"
    let reasonCodeReads = 0
    const reasonCodes = [""]
    Object.defineProperty(reasonCodes, 0, {
      enumerable: true,
      get() {
        reasonCodeReads += 1
        return reasonCodeReads > 2
          ? rawMemo
          : "D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"
      },
    })

    // When
    const rve = mapD9ResultToRveSignal({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes,
      evidence: [],
    })

    // Then
    expect(rve).toMatchObject({
      storedStatus: "CLEARED",
      blocksPlanGeneration: false,
      requiresHumanReview: false,
      nonSensitiveReasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    })
    expect(JSON.stringify(rve)).not.toContain(rawMemo)
    expect(reasonCodeReads).toBe(1)
    expect(Object.isFrozen(rve.nonSensitiveReasonCodes)).toBe(true)
  })

  it.each([
    ["getter", Object.defineProperty({
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
      evidence: [],
    }, "disposition", {
      enumerable: true,
      get() {
        throw new Error("hostile getter")
      },
    })],
    ["proxy", new Proxy({}, {
      ownKeys() {
        throw new Error("hostile proxy")
      },
    })],
  ])("fails closed when an evaluator %s throws", (_label, hostileResult) => {
    expect(mapD9ResultToRveSignal(hostileResult)).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
      nonSensitiveReasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
    })
  })

  it.each([
    [
      "CLEARED with ACTIVE evidence",
      "D9_CLEARED",
      "D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL",
      "ACTIVE",
      "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM",
    ],
    [
      "CLEARED with UNKNOWN evidence",
      "D9_CLEARED",
      "D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL",
      "UNKNOWN",
      "D9_UNKNOWN_PAIN_WORSENING",
    ],
    [
      "UNKNOWN with ACTIVE evidence",
      "D9_UNKNOWN",
      "D9_UNKNOWN_PAIN_WORSENING",
      "ACTIVE",
      "D9_ACTIVE_MEDICAL_RED_FLAG_SYMPTOM",
    ],
  ] as const)("fails closed for %s", (
    _label,
    disposition,
    resultReasonCode,
    route,
    evidenceReasonCode,
  ) => {
    // Given
    const contradictory: D9Result = {
      disposition,
      blocksPlanGeneration: disposition !== "D9_CLEARED",
      reasonCodes: [resultReasonCode],
      evidence: [{
        ruleId: "CONTRADICTORY_EVIDENCE",
        family: "test",
        route,
        reasonCode: evidenceReasonCode,
        clauseIndex: 0,
        clause: "raw evidence must not escape",
        matchedBy: ["test"],
      }],
    }

    // When
    const rve = mapD9ResultToRveSignal(contradictory)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
      nonSensitiveReasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
    })
    expect(gate).toMatchObject({
      kind: "blocked",
      action: "BLOCK_OR_HUMAN_REVIEW",
      planGenerationAllowed: false,
    })
  })

  it.each([
    [
      "ordinary CLEARED carrying advisory evidence",
      {
        disposition: "D9_CLEARED",
        blocksPlanGeneration: false,
        reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
        evidence: [{
          ruleId: "WEAK_PAIN_NO_BODYPART_ADVISORY",
          family: "mild_training_response",
          route: "ADVISORY",
          reasonCode: "D9_ADVISORY_UNLOCALIZED_DISCOMFORT",
          clauseIndex: 0,
          clause: "raw evaluator evidence must not escape",
          matchedBy: ["painWeak"],
        }],
      },
    ],
    [
      "advisory CLEARED missing advisory evidence",
      {
        disposition: "D9_CLEARED",
        blocksPlanGeneration: false,
        reasonCodes: [
          "D9_CLEARED_WITH_NON_BLOCKING_ADVISORY",
          "D9_ADVISORY_UNLOCALIZED_DISCOMFORT",
        ],
        evidence: [],
      },
    ],
  ] as const)("fails closed for %s", (_label, malformed) => {
    // When
    const rve = mapD9ResultToRveSignal(malformed)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
      nonSensitiveReasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
    })
    expect(gate).toMatchObject({
      kind: "blocked",
      action: "BLOCK_OR_HUMAN_REVIEW",
      planGenerationAllowed: false,
    })
  })

  it("rejects an arbitrary evaluator reason code without returning memo text", () => {
    // Given
    const rawMemo = "PRIVATE_MEMO_TEXT_must_not_cross_the_boundary"
    const malformed: D9Result = {
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: [rawMemo],
      evidence: [],
    }

    // When
    const rve = mapD9ResultToRveSignal(malformed)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
      nonSensitiveReasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
    })
    expect(gate.planGenerationAllowed).toBe(false)
    expect(JSON.stringify({ rve, gate })).not.toContain(rawMemo)
  })

  it.each([
    ["timeout", "RVE_D9_EVALUATOR_TIMEOUT"],
    ["exception", "RVE_D9_EVALUATOR_EXCEPTION"],
    ["stale_version", "RVE_D9_EVALUATOR_VERSION_STALE"],
  ] as const)("fails safe to UNKNOWN when evaluator failure is %s", (failure, reasonCode) => {
    const rve = createEvaluatorFailureSignal(failure)
    const gate = decideSafetyGate(rve)

    // Then
    expect(rve).toMatchObject({
      storedStatus: "UNKNOWN",
      blocksPlanGeneration: true,
      requiresHumanReview: true,
      nonSensitiveReasonCodes: [reasonCode],
    })
    expect(gate.planGenerationAllowed).toBe(false)
  })

  it("does not include raw athlete text in RVE signal, Safety Gate output, or audit object", () => {
    // Given
    const rawText = "뛸수록 정강이가 아파요"

    // When
    const rve = mapD9ResultToRveSignal(evaluateD9ColloquialLayer(rawText))
    const gate = decideSafetyGate(rve)

    // Then
    expect(JSON.stringify(rve)).not.toContain(rawText)
    expect(JSON.stringify(gate)).not.toContain(rawText)
    expect(JSON.stringify(gate.audit)).not.toContain(rawText)
  })
})
