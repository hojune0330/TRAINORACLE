import { describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { AthleteRecord } from "./athlete-records"
import { buildPaceTargetPlanItem } from "./pace-target-plan"

type AchievedRecord = Exclude<AthleteRecord, { readonly purpose: "RACE_GOAL" }>

const TODAY = new Date("2026-07-30T12:00:00.000Z")

function clearedGate() {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition: "D9_CLEARED",
    blocksPlanGeneration: false,
    reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
    evidence: [],
  }))
}

function blockedGate(disposition: "D9_ACTIVE" | "D9_UNKNOWN") {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition,
    blocksPlanGeneration: true,
    reasonCodes: [disposition],
    evidence: [],
  }))
}

function achievedRecord(
  purpose: "PERSONAL_BEST" | "SEASON_BEST" | "RECENT_RESULT",
  performanceSeconds: number,
): AchievedRecord {
  const common = {
    schemaVersion: 1 as const,
    id: `${purpose.toLowerCase()}-${performanceSeconds}`,
    eventDistanceM: 5000,
    performanceSeconds,
    achievedOn: "2026-05-10",
    enteredBy: "ATHLETE" as const,
    verificationState: "SELF_REPORTED" as const,
    sourceRef: `athlete-record:${purpose.toLowerCase()}-${performanceSeconds}`,
    savedAt: "2026-07-30T00:00:00.000Z",
  }
  return purpose === "SEASON_BEST"
    ? { ...common, purpose, seasonId: "2026-outdoor" }
    : { ...common, purpose, seasonId: null }
}

function goalRecord(): AthleteRecord {
  return {
    schemaVersion: 1,
    id: "goal-5000-1050",
    purpose: "RACE_GOAL",
    eventDistanceM: 5000,
    performanceSeconds: 1050,
    achievedOn: null,
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:goal-5000-1050",
    savedAt: "2026-07-30T00:00:00.000Z",
  }
}

const ACTIVE_FIXTURE = {
  lifecycleStatus: "ACTIVE" as const,
  eligibilityStatus: "ELIGIBLE" as const,
}

const DRAFT_TEMPLATE = {
  lifecycleStatus: "DRAFT" as const,
  eligibilityStatus: "REVIEW_REQUIRED" as const,
}

function baseInput() {
  return {
    selectedRecord: achievedRecord("PERSONAL_BEST", 1110),
    selectedFreshness: "CURRENT" as const,
    comparison: null,
    goalRecord: goalRecord(),
    notation: "5×1000m @5000m RP · r150″",
    displayRoundingPolicyVersion: "seconds-v1",
    template: ACTIVE_FIXTURE,
    safetyGate: clearedGate(),
    today: TODAY,
  }
}

describe("P3 pace-target plan builder", () => {
  it("creates 222-second repetitions and preserves the selected record provenance", () => {
    const result = buildPaceTargetPlanItem(baseInput())

    expect(result).toEqual({
      kind: "created",
      item: expect.objectContaining({
        kind: "PACE_TARGET",
        setCount: 1,
        repetitionsPerSet: 5,
        repetitionDistanceM: 1000,
        targetRepSeconds: 222,
        repetitionRecoverySeconds: 150,
        displayRoundingPolicyVersion: "seconds-v1",
        selectedAnchor: expect.objectContaining({
          anchorId: "personal_best-1110",
          kind: "PB",
          purpose: "CURRENT_CAPABILITY",
          enteredBy: "ATHLETE",
          verificationState: "SELF_REPORTED",
          freshnessState: "CURRENT",
          sourceRef: "athlete-record:personal_best-1110",
        }),
      }),
    })
  })

  it("keeps the 210-second goal reference display-only and outside the current anchor", () => {
    const result = buildPaceTargetPlanItem(baseInput())

    expect(result).toMatchObject({
      kind: "created",
      item: {
        targetRepSeconds: 222,
        goalReference: {
          repSeconds: 210,
          displayOnly: true,
          anchor: {
            anchorId: "goal-5000-1050",
            kind: "GOAL",
            purpose: "ASPIRATIONAL_TARGET",
            sourceRef: "athlete-record:goal-5000-1050",
          },
        },
      },
    })
  })

  it.each(["STALE", "UNKNOWN"] as const)(
    "returns RPE guidance without a number for a %s selected record",
    (selectedFreshness) => {
      const result = buildPaceTargetPlanItem({
        ...baseInput(),
        selectedFreshness,
      })

      expect(result).toEqual({
        kind: "fallback",
        code: "ANCHOR_NOT_CURRENT",
        guidance: "RPE",
      })
      expect(JSON.stringify(result)).not.toMatch(/222|210/u)
    },
  )

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)(
    "blocks %s without weakening the safety gate",
    (disposition) => {
      const result = buildPaceTargetPlanItem({
        ...baseInput(),
        safetyGate: blockedGate(disposition),
      })

      expect(result).toEqual({ kind: "blocked", code: "SAFETY_GATE_BLOCKED" })
    },
  )

  it("keeps a draft and review-required template numeric-inert", () => {
    const result = buildPaceTargetPlanItem({
      ...baseInput(),
      template: DRAFT_TEMPLATE,
    })

    expect(result).toEqual({
      kind: "fallback",
      code: "TEMPLATE_NOT_ACTIVE",
      guidance: "RPE",
    })
  })

  it("requires the selected record to match the notation event", () => {
    const result = buildPaceTargetPlanItem({
      ...baseInput(),
      notation: "5×1000m @1500m RP · r150″",
    })

    expect(result).toEqual({
      kind: "fallback",
      code: "CROSS_EVENT_MODEL_REQUIRED",
      guidance: "RPE",
    })
  })

  it("rejects an incomplete selected source instead of inventing provenance", () => {
    const selectedRecord = {
      ...baseInput().selectedRecord,
      sourceRef: "",
    }
    const result = buildPaceTargetPlanItem({
      ...baseInput(),
      selectedRecord,
    })

    expect(result).toEqual({
      kind: "fallback",
      code: "MALFORMED_RUNTIME_INPUT",
      guidance: "RPE",
    })
  })

  it("allows an old PB only after explicit CURRENT confirmation", () => {
    const selectedRecord = {
      ...baseInput().selectedRecord,
      achievedOn: "2016-05-10",
    }
    const result = buildPaceTargetPlanItem({
      ...baseInput(),
      selectedRecord,
      selectedFreshness: "CURRENT",
    })

    expect(result).toMatchObject({
      kind: "created",
      item: {
        targetRepSeconds: 222,
        selectedAnchor: { freshnessState: "CURRENT" },
      },
    })
  })

  it("drops a cross-event goal reference while preserving today's target", () => {
    const goal = goalRecord()
    const result = buildPaceTargetPlanItem({
      ...baseInput(),
      goalRecord: { ...goal, eventDistanceM: 1500 },
    })

    expect(result).toMatchObject({
      kind: "created",
      item: {
        targetRepSeconds: 222,
        goalReference: null,
      },
    })
  })

})
