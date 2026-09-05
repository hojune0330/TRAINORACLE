import { describe, expect, it } from "vitest"
import {
  deriveStoredPlanMethodHistory,
  recommendationHistoryFromStored,
} from "./plan-method-history"

const detailed = {
  day: 3,
  slot: "PM" as const,
  prescription: {
    kind: "PACE_TARGET" as const,
    templateId: "METHOD-A",
    templateVersion: "1.0.0",
    templateContentFingerprint: `sha256:${"a".repeat(64)}`,
  },
}

describe("plan method history", () => {
  it.each([
    ["COMPLETED", "PERFORMED"],
    ["RESTED", "NOT_PERFORMED"],
    ["SKIPPED", "NOT_PERFORMED"],
    ["PAIN_CHECKIN", "NOT_PERFORMED"],
  ] as const)("keeps %s distinct as %s", (state, expected) => {
    const rows = deriveStoredPlanMethodHistory({
      sessions: [detailed],
      progress: [{ sessionDay: 3, sessionSlot: "PM", state }],
    })
    expect(rows[0]?.outcome).toBe(expected)
    expect(recommendationHistoryFromStored(rows)[0]?.performed.status).toBe(expected)
  })

  it("does not turn an unanswered session into a failed or completed method", () => {
    const rows = deriveStoredPlanMethodHistory({ sessions: [detailed], progress: [] })
    expect(rows).toMatchObject([{ outcome: "MISSING" }])
    expect(recommendationHistoryFromStored(rows)).toMatchObject([{
      selected: { familyId: "METHOD-A", configurationId: "METHOD-A", version: "1.0.0" },
      performed: { status: "MISSING" },
    }])
  })

  it("ignores RPE-only sessions instead of inventing a method", () => {
    expect(deriveStoredPlanMethodHistory({
      sessions: [{ day: 1, slot: "AM", prescription: { kind: "RPE_TIME_RANGE" } }],
      progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }],
    })).toEqual([])
  })
})
