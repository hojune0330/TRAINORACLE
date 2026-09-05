import { describe, expect, it } from "vitest"
import {
  deriveStoredPlanMethodHistory,
  recommendationHistoryFromStored,
  methodReferenceFromTemplate,
} from "./plan-method-history"
import { PLAN_METHOD_REGISTRY } from "./plan-method-registry"

const detailed = {
  day: 3,
  slot: "PM" as const,
  prescription: {
    kind: "PACE_TARGET" as const,
    templateId: "V2-SEED-05",
    templateVersion: "1.0.0",
    templateContentFingerprint: "sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a",
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
      selected: { familyId: "race-pace-distance-repetitions", configurationId: "V2-SEED-05", version: "1.0.0" },
      performed: { status: "MISSING" },
    }])
  })

  it("ignores RPE-only sessions instead of inventing a method", () => {
    expect(deriveStoredPlanMethodHistory({
      sessions: [{ day: 1, slot: "AM", prescription: { kind: "RPE_TIME_RANGE" } }],
      progress: [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }],
    })).toEqual([])
  })

  it.each(PLAN_METHOD_REGISTRY)("maps legacy exact ref $templateRef.templateId without changing stored content", ({ templateRef, method }) => {
    const rows = [{ sessionDay: 3, sessionSlot: "PM" as const, selectedDetailedTemplateRef: { ...templateRef }, outcome: "PERFORMED" as const }]
    const before = JSON.stringify(rows)
    expect(methodReferenceFromTemplate(templateRef)).toEqual(method)
    expect(recommendationHistoryFromStored(rows)).toEqual([{ selected: method, performed: { status: "PERFORMED", method } }])
    expect(JSON.stringify(rows)).toBe(before)
  })

  it.each([
    { templateId: "UNKNOWN" }, { version: "2.0.0" }, { fingerprint: `sha256:${"0".repeat(64)}` },
  ])("preserves an unknown stored ref without fabricating family exposure %j", (change) => {
    const ref = { ...PLAN_METHOD_REGISTRY[0]!.templateRef, ...change }
    const rows = deriveStoredPlanMethodHistory({
      sessions: [{ ...detailed, prescription: { kind: "PACE_TARGET", templateId: ref.templateId, templateVersion: ref.version, templateContentFingerprint: ref.fingerprint } }],
      progress: [{ sessionDay: 3, sessionSlot: "PM", state: "COMPLETED" }],
    })
    expect(rows[0]?.selectedDetailedTemplateRef).toEqual(ref)
    expect(rows[0]?.outcome).toBe("PERFORMED")
    expect(methodReferenceFromTemplate(ref)).toBeNull()
    expect(recommendationHistoryFromStored(rows)).toEqual([])
  })
})
