import { describe, expect, it } from "vitest"
import { evaluateD9ColloquialLayer } from "../src/d9/evaluator"
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
      source: "PLAN_GENERATOR_STUB",
    })
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
