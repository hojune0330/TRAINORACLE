import { describe, expect, it } from "vitest"
import { STEP_META } from "./plan-intake-meta"
import {
  divisionForGoal,
  visibleIntakeSteps,
} from "./plan-intake-navigation"

describe("plan intake wording", () => {
  it("uses short Korean labels for every question step", () => {
    expect(Object.values(STEP_META).map((step) => step.eyebrow)).toEqual([
      "목표",
      "참가 부문",
      "경험",
      "훈련 종류",
      "안내 방식",
      "운동할 날",
      "시간대",
      "하루 두 번",
      "몸 상태",
    ])
    // 글자 피로를 줄이기 위해 각 질문의 보조 문구는 한두 문장, 60자 이내로 유지한다.
    for (const step of Object.values(STEP_META)) expect(step.copy.length).toBeLessThanOrEqual(60)
  })
})

describe("conditional competition division", () => {
  it("skips division for general endurance and stores the valid omitted value", () => {
    expect(divisionForGoal("GENERAL_ENDURANCE")).toBe("NOT_PROVIDED")
    expect(visibleIntakeSteps("GENERAL_ENDURANCE")).not.toContain("division")
  })

  it("never asks division up front for any event; it is a refine item", () => {
    expect(divisionForGoal("MIDDLE_DISTANCE")).toBe("NOT_PROVIDED")
    expect(visibleIntakeSteps("MIDDLE_DISTANCE")).not.toContain("division")
    expect(visibleIntakeSteps("MIDDLE_DISTANCE")).toEqual(["goal", "experience", "days", "safety"])
  })
})
