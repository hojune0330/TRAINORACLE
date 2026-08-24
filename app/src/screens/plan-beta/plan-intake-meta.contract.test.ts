import { describe, expect, it } from "vitest"
import { STEP_META } from "./plan-intake-meta"
import {
  divisionForGoal,
  visibleIntakeSteps,
} from "./plan-intake-navigation"

describe("plan intake wording", () => {
  it("uses short Korean labels for every question step", () => {
    expect(Object.values(STEP_META).map((step) => step.eyebrow)).toEqual([
      "목표 종목",
      "현재 참가 부문",
      "훈련 경험",
      "이번 목표",
      "훈련 상세 방식",
      "가능한 날",
      "주로 하는 시간",
      "하루 두 번 훈련",
      "지금 몸 상태",
    ])
  })
})

describe("conditional competition division", () => {
  it("skips division for general endurance and stores the valid omitted value", () => {
    expect(divisionForGoal("GENERAL_ENDURANCE")).toBe("NOT_PROVIDED")
    expect(visibleIntakeSteps("GENERAL_ENDURANCE")).not.toContain("division")
  })

  it("keeps division for competition-oriented goals", () => {
    expect(divisionForGoal("MIDDLE_DISTANCE")).toBeUndefined()
    expect(visibleIntakeSteps("MIDDLE_DISTANCE")).toContain("division")
  })
})
