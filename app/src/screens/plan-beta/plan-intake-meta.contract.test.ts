import { describe, expect, it } from "vitest"
import { STEP_META } from "./plan-intake-meta"

describe("plan intake wording", () => {
  it("uses short Korean labels for every question step", () => {
    expect(Object.values(STEP_META).map((step) => step.eyebrow)).toEqual([
      "목표 종목",
      "현재 참가 부문",
      "훈련 경험",
      "이번 목표",
      "가능한 날",
      "주로 하는 시간",
      "하루 두 번 훈련",
      "지금 몸 상태",
    ])
  })
})
