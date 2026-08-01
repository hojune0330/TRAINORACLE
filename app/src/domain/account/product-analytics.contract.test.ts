import { describe, expect, it } from "vitest"
import { createProductAnalyticsEvent } from "./product-analytics"

describe("optional product analytics", () => {
  it("creates no event when the user did not opt in", () => {
    expect(createProductAnalyticsEvent("JOURNAL_SAVED", false, "2026-08-01T00:00:00.000Z")).toBeNull()
  })

  it("stores only an allowlisted event and a 30-day expiry", () => {
    expect(createProductAnalyticsEvent("JOURNAL_SAVED", true, "2026-08-01T00:00:00.000Z")).toEqual({
      name: "JOURNAL_SAVED",
      occurredAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-31T00:00:00.000Z",
    })
  })

  it("rejects arbitrary event names that could smuggle journal content", () => {
    expect(() => createProductAnalyticsEvent(
      "memo:오늘 통증 5",
      true,
      "2026-08-01T00:00:00.000Z",
    )).toThrow()
  })
})
