import { describe, expect, it } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { planHistoryListSchema } from "./plan-beta-schema"
import {
  advancePeriodizationContext,
  createInitialPeriodizationContext,
} from "./periodization-lineage"

describe("periodization history retention", () => {
  it("accepts one 18-frame macrocycle and rejects an unbounded nineteenth summary", () => {
    const state = stateFixture()
    if (state.version !== 3) throw new Error("V3 fixture required")
    let context = createInitialPeriodizationContext(
      state.activePlan.candidateId,
      state.generatedAt,
    )!
    const history = Array.from({ length: 18 }, (_, index) => {
      if (index > 0) {
        context = advancePeriodizationContext(
          context,
          new Date(Date.parse(context.frameStartedAt) + 9.5 * 24 * 60 * 60 * 1_000).toISOString(),
        )!
      }
      return {
        version: 3 as const,
        candidateId: state.activePlan.candidateId,
        pairId: state.activePlan.pairId,
        candidateKind: state.activePlan.candidateKind,
        eventDistanceM: state.activePlan.eventDistanceM,
        selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
        frameLengthDays: state.activePlan.frame.lengthDays,
        progress: [],
        archivedAt: context.frameStartedAt,
        periodization: context,
      }
    })

    expect(planHistoryListSchema.safeParse(history).success).toBe(true)
    expect(planHistoryListSchema.safeParse([...history, history[0]]).success).toBe(false)
  })
})
