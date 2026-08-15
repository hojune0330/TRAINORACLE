import { beforeEach, describe, expect, it, vi } from "vitest"
import type { D9Disposition } from "@impl/d9/evaluator"
import { assessPurposeScopedMemo } from "./memo-safety"

const evaluatorMock = vi.hoisted(() => vi.fn<(rawText?: string) => unknown>())

vi.mock("@impl/d9/evaluator", () => ({
  evaluateD9ColloquialLayer: evaluatorMock,
}))

function d9Result(
  disposition: D9Disposition,
  blocksPlanGeneration: boolean,
  reasonCodes: readonly string[] = [disposition],
) {
  return {
    disposition,
    blocksPlanGeneration,
    reasonCodes: [...reasonCodes],
    evidence: [],
  }
}

const MALFORMED_RESULTS: readonly [string, unknown][] = [
  ["empty object", {}],
  ["null", null],
  ["non-object", "D9_CLEARED"],
  ["missing disposition", { blocksPlanGeneration: false, reasonCodes: [], evidence: [] }],
  ["invalid disposition", {
    disposition: "D9_BROKEN",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_BROKEN"],
    evidence: [],
  }],
  ["missing block flag", { disposition: "D9_UNKNOWN", reasonCodes: [], evidence: [] }],
  ["invalid block flag", {
    disposition: "D9_UNKNOWN",
    blocksPlanGeneration: "true",
    reasonCodes: [],
    evidence: [],
  }],
  ["ACTIVE with nonblocking flag", d9Result("D9_ACTIVE", false)],
  ["UNKNOWN with nonblocking flag", d9Result("D9_UNKNOWN", false)],
  ["CLEARED with blocking flag", d9Result("D9_CLEARED", true)],
  ["missing reason codes", { disposition: "D9_CLEARED", blocksPlanGeneration: false, evidence: [] }],
  ["invalid reason codes", {
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: [7],
    evidence: [],
  }],
  ["missing evidence", {
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED"],
  }],
  ["invalid evidence", {
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED"],
    evidence: [{}],
  }],
  ["invalid RVE status field", { ...d9Result("D9_CLEARED", false), storedStatus: "UNKNOWN" }],
]

describe("assessPurposeScopedMemo", () => {
  beforeEach(() => {
    evaluatorMock.mockReset()
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
    expect(evaluatorMock).not.toHaveBeenCalled()
  })

  it("does not evaluate an empty analyzable training note", () => {
    const assessment = assessPurposeScopedMemo("   ", "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(assessment).toBeNull()
    expect(evaluatorMock).not.toHaveBeenCalled()
  })

  it.each([
    ["D9_ACTIVE", d9Result("D9_ACTIVE", true)],
    ["D9_UNKNOWN", d9Result("D9_UNKNOWN", true)],
    ["D9_CLEARED", d9Result("D9_CLEARED", false)],
  ] as const)("preserves valid %s disposition semantics", (disposition, result) => {
    // Given
    evaluatorMock.mockReturnValueOnce(result)

    // When
    const assessment = assessPurposeScopedMemo("첫 바퀴는 침착하게", "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(assessment).toMatchObject({
      disposition,
      blocksPlanGeneration: disposition !== "D9_CLEARED",
      reasonCodes: result.reasonCodes,
    })
  })

  it("preserves a non-blocking advisory under D9_CLEARED", () => {
    // Given
    const trainingNote = "가볍게 뻐근하지만 괜찮아요"
    evaluatorMock.mockReturnValueOnce({
      ...d9Result("D9_CLEARED", false, ["D9_CLEARED_WITH_NON_BLOCKING_ADVISORY", "D9_ADVISORY"]),
      evidence: [{
        ruleId: "BODY_WITH_WEAK_PAIN_ADVISORY",
        family: "mild_training_response",
        route: "ADVISORY",
        reasonCode: "D9_ADVISORY",
        clauseIndex: 0,
        clause: "raw evaluator evidence must not escape",
        matchedBy: ["painWeak"],
      }],
    })

    // When
    const assessment = assessPurposeScopedMemo(trainingNote, "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(evaluatorMock).toHaveBeenCalledOnce()
    expect(evaluatorMock).toHaveBeenCalledWith(trainingNote)
    expect(assessment).toEqual({
      disposition: "D9_CLEARED",
      blocksPlanGeneration: false,
      reasonCodes: ["D9_CLEARED_WITH_NON_BLOCKING_ADVISORY", "D9_ADVISORY"],
    })
    expect(JSON.stringify(assessment)).not.toContain(trainingNote)
    expect(JSON.stringify(assessment)).not.toContain("raw evaluator evidence")
  })

  it.each(MALFORMED_RESULTS)("fails closed for %s evaluator response", (_label, malformedResult) => {
    // Given
    evaluatorMock.mockReturnValueOnce(malformedResult)

    // When
    const assessment = assessPurposeScopedMemo("검토가 필요한 메모", "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(assessment).toEqual({
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: ["RVE_D9_INVALID_INPUT_SHAPE"],
    })
  })

  it("fails closed when the evaluator throws", () => {
    // Given
    evaluatorMock.mockImplementationOnce(() => {
      throw new Error("evaluator unavailable")
    })

    // When
    const assessment = assessPurposeScopedMemo("검토가 필요한 메모", "ANALYZABLE_TRAINING_NOTE")

    // Then
    expect(assessment).toEqual({
      disposition: "D9_UNKNOWN",
      blocksPlanGeneration: true,
      reasonCodes: ["EVALUATOR_FAILURE_FAILSAFE"],
    })
  })
})
