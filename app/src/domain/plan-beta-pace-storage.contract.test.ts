import { beforeEach, describe, expect, it } from "vitest"
import { parsePlanBetaState } from "./plan-beta-schema"
import { loadPlanBetaState } from "./plan-beta-store"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { paceTargetPlanItemSchema } from "./plan-session-schema"

function paceTargetPrescriptionFixture() {
  return {
    kind: "PACE_TARGET" as const,
    setCount: 1,
    repetitionsPerSet: 5,
    repetitionDistanceM: 1000,
    targetRepSeconds: 222,
    selectedAnchor: {
      anchorId: "race:5000:current",
      kind: "RECENT_RESULT" as const,
      purpose: "CURRENT_CAPABILITY" as const,
      eventDistanceM: 5000,
      performanceSeconds: 1110,
      achievedAt: "2026-07-20",
      seasonId: null,
      enteredBy: "ATHLETE" as const,
      verificationState: "SELF_REPORTED" as const,
      freshnessState: "CURRENT" as const,
      sourceRef: "journal:race:5000:2026-07-20",
      elapsedLabel: "2개월 전",
    },
    comparisonAnchor: null,
    goalReference: null,
    displayRoundingPolicyVersion: "seconds-v1",
    repetitionRecoverySeconds: 150,
    setRecoverySeconds: null,
  }
}

function paceTargetStateFixture() {
  const state = stateFixture()
  return {
    ...state,
    activePlan: {
      ...state.activePlan,
      sessions: [
        {
          ...state.activePlan.sessions[0],
          role: "QUALITY",
          plannedEnergyIntent: "VO2_INTENT",
          prescription: paceTargetPrescriptionFixture(),
        },
      ],
    },
  }
}

describe("P3 pace evidence storage boundary", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("keeps a persisted pace-target session inert in the production store", () => {
    window.localStorage.setItem(
      "trainoracle.plan-beta.v1",
      JSON.stringify(paceTargetStateFixture()),
    )

    expect(loadPlanBetaState()).toBeNull()
  })

  it("keeps PACE_TARGET outside stored plan state even under fixture authority", () => {
    expect(parsePlanBetaState(paceTargetStateFixture())).toBeNull()
  })

  it("parses the detached PACE_TARGET evidence variant with full provenance", () => {
    const parsed = paceTargetPlanItemSchema.safeParse(
      paceTargetPrescriptionFixture(),
    )

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).toMatchObject({
      kind: "PACE_TARGET",
      targetRepSeconds: 222,
      selectedAnchor: {
        anchorId: "race:5000:current",
        enteredBy: "ATHLETE",
        verificationState: "SELF_REPORTED",
        freshnessState: "CURRENT",
        sourceRef: "journal:race:5000:2026-07-20",
      },
    })
  })

  it("rejects detached pace evidence when selected provenance is incomplete", () => {
    const prescription = paceTargetPrescriptionFixture()
    const malformed = {
      ...prescription,
      selectedAnchor: {
        ...prescription.selectedAnchor,
        sourceRef: "",
      },
    }

    expect(paceTargetPlanItemSchema.safeParse(malformed).success).toBe(false)
  })
})
