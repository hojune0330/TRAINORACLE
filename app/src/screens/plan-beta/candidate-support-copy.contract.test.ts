import { describe, expect, it } from "vitest"
import { candidatePurposeStatus } from "./candidate-purpose-status"
import { candidateLabel } from "./labels"

describe("easy-session-duration-only candidate copy", () => {
  it("uses plain athlete-facing labels without unsupported benefit claims or internal jargon", () => {
    const balanced = {
      ...candidateLabel("BALANCED", "VO2_INTENT"),
      ...candidatePurposeStatus("BALANCED"),
    }
    const conservative = {
      ...candidateLabel("CONSERVATIVE", "VO2_INTENT"),
      ...candidatePurposeStatus("CONSERVATIVE"),
    }
    const copy = JSON.stringify([balanced, conservative])

    expect(balanced.title).toBe("시간 조절 계획")
    expect(conservative.title).toBe("최소 시간 계획")
    expect(balanced.label).toBe("쉬운 날은 시간 범위로")
    expect(conservative.label).toBe("쉬운 날은 가장 짧게")
    expect(copy).not.toMatch(/보조훈련|보조 훈련|부담|더 안전|회복 여유|회복 최적화|쉬는 날을 늘/u)
  })
})
