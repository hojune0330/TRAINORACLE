import { beforeEach, describe, expect, it, vi } from "vitest"
import { evaluateD9ColloquialLayer } from "@impl/d9/evaluator"
import { assessPurposeScopedMemo } from "./memo-safety"

vi.mock("@impl/d9/evaluator", () => ({
  evaluateD9ColloquialLayer: vi.fn(() => ({
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_ACTIVE_SIGNAL"],
    evidence: [{ clause: "raw evaluator evidence must not escape" }],
  })),
}))

describe("assessPurposeScopedMemo", () => {
  beforeEach(() => {
    vi.mocked(evaluateD9ColloquialLayer).mockClear()
  })

  it.each([
    ["explicit private", "PRIVATE_SELF_ONLY"],
    ["legacy unlabeled", undefined],
  ])("does not evaluate %s text", (_label, purpose) => {
    // Given
    const privateText = "나만 보는 부상과 일기"

    // When
    const assessment = assessPurposeScopedMemo(privateText, purpose)

    // Then
    expect(assessment).toBeNull()
    expect(evaluateD9ColloquialLayer).not.toHaveBeenCalled()
  })

  it("does not evaluate an empty analyzable training note", () => {
    // Given / When
    const assessment = assessPurposeScopedMemo("   ", "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(assessment).toBeNull()
    expect(evaluateD9ColloquialLayer).not.toHaveBeenCalled()
  })

  it("returns only a sanitized assessment for a nonempty training note", () => {
    // Given
    const trainingNote = "첫 바퀴는 침착하게"

    // When
    const assessment = assessPurposeScopedMemo(trainingNote, "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(evaluateD9ColloquialLayer).toHaveBeenCalledOnce()
    expect(evaluateD9ColloquialLayer).toHaveBeenCalledWith(trainingNote)
    expect(assessment).toEqual({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_NO_ACTIVE_SIGNAL"],
    })
    expect(JSON.stringify(assessment)).not.toContain(trainingNote)
    expect(JSON.stringify(assessment)).not.toContain("raw evaluator evidence")
  })
})
