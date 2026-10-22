import { describe, expect, it } from "vitest"
import {
  completePrecisionOrigins,
  precisionOriginLabel,
  restoredPrecisionOrigins,
} from "./precision-plan-intake"

describe("precision intake origins", () => {
  it("marks pre-existing intake values as unknown instead of guessing their source", () => {
    expect(restoredPrecisionOrigins({ eventDistanceM: 5000, trainingFocus: "MIXED_INTENT" })).toEqual({
      eventDistanceM: "RESTORED_ORIGIN_UNKNOWN",
      trainingFocus: "RESTORED_ORIGIN_UNKNOWN",
    })
  })

  it("keeps an explicit choice of the default separate from a default supplied later", () => {
    const completed = { eventDistanceM: 5000, trainingFocus: "MIXED_INTENT" } as const
    expect(completePrecisionOrigins({}, completed, { trainingFocus: "USER" })).toMatchObject({
      eventDistanceM: "SUGGESTED",
      trainingFocus: "USER",
    })
    expect(completePrecisionOrigins({}, completed, {})).toMatchObject({
      eventDistanceM: "SUGGESTED",
      trainingFocus: "DEFAULT",
    })
  })

  it("uses plain labels for each source state", () => {
    expect(precisionOriginLabel("USER")).toBe("직접 선택")
    expect(precisionOriginLabel("DEFAULT")).toBe("기본 설정")
    expect(precisionOriginLabel("SUGGESTED")).toBe("자동 제안")
    expect(precisionOriginLabel("RESTORED_ORIGIN_UNKNOWN")).toBe("이전 설정")
  })
})
