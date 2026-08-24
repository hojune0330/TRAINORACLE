import { describe, expect, it } from "vitest"
import { candidatePurposeStatus } from "./candidate-purpose-status"
import { candidateLabel } from "./labels"

describe("support-only candidate copy", () => {
  it("uses the approved labels without global burden, safety, or recovery claims", () => {
    const balanced = {
      ...candidateLabel("BALANCED", "VO2_INTENT"),
      ...candidatePurposeStatus("BALANCED"),
    }
    const conservative = {
      ...candidateLabel("CONSERVATIVE", "VO2_INTENT"),
      ...candidatePurposeStatus("CONSERVATIVE"),
    }
    const copy = JSON.stringify([balanced, conservative])

    expect(balanced.title).toBe("기본 보조훈련")
    expect(conservative.title).toBe("보조훈련 짧게")
    expect(copy).not.toMatch(/부담|더 안전|회복 여유|회복 최적화|쉬는 날을 늘/u)
  })
})
