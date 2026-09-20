import { describe, expect, it } from "vitest"
import { analysisNavigationForReceipt } from "./analysis-navigation"

describe("analysis receipt navigation", () => {
  it.each([
    [{ kind: "distance", savedDate: "2026-09-21", distanceKm: 8 }, "DISTANCE_KM"],
    [{ kind: "mood", savedDate: "2026-09-21" }, "MOOD"],
    [{ kind: "pain", savedDate: "2026-09-21", moodAlsoSaved: true }, "PAIN_MAX"],
  ] as const)("maps %s to monthly %s", (receipt, metric) => {
    expect(analysisNavigationForReceipt(receipt)).toEqual({
      section: "monthly",
      metric,
      savedDate: "2026-09-21",
    })
  })

  it("does not pretend a generic receipt has an analysis destination", () => {
    expect(analysisNavigationForReceipt({ kind: "generic", savedDate: "2026-09-21" })).toBeNull()
  })
})
