import { beforeEach, describe, expect, it } from "vitest"
import {
  archiveAndClearActivePlan,
  loadPlanMethodHistory,
  savePlanBetaState,
} from "./plan-beta-store"
import { planHistoryListSchema } from "./plan-beta-schema"
import { stateFixture } from "./plan-beta-store.test-fixture"

const HISTORY_KEY = "trainoracle.plan-beta.history.v1"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

function readStoredHistory() {
  const raw = window.localStorage.getItem(HISTORY_KEY)
  if (raw === null) throw new Error("Expected archived plan history")
  const parsed = planHistoryListSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) throw new Error("Expected valid archived plan history")
  return parsed.data
}

describe("plan history retention", () => {
  it("keeps two completed frames when the same candidate is selected again", () => {
    // Given: the athlete has completed and archived a plan candidate.
    const firstFrame = stateFixture()
    expect(savePlanBetaState(firstFrame)).toEqual({ ok: true })
    expect(archiveAndClearActivePlan(firstFrame)).toMatchObject({ ok: true })

    // When: the same candidate is selected and archived for a later frame.
    const secondFrame = stateFixture()
    expect(savePlanBetaState(secondFrame)).toEqual({ ok: true })
    expect(archiveAndClearActivePlan(secondFrame)).toMatchObject({ ok: true })

    // Then: each completed frame remains in the local history.
    const history = readStoredHistory()
    expect(history).toHaveLength(2)
    expect(history.every(row => "version" in row && row.version === 4)).toBe(true)
    expect(history.every(row => (
      "version" in row && row.version === 4 && row.methodHistory.length === 0
    ))).toBe(true)
  })

  it("keeps legacy method selection without pretending it was performed", () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([{
      version: 3,
      candidateId: "legacy-candidate",
      pairId: "plan-pair:v3:legacy",
      candidateKind: "BALANCED",
      eventDistanceM: 5000,
      selectedDetailedTemplateRef: {
        templateId: "V2-SEED-05",
        version: "1.0.0",
        fingerprint: `sha256:${"a".repeat(64)}`,
      },
      frameLengthDays: 9.5,
      progress: [{ sessionDay: 2, sessionSlot: "AM", state: "COMPLETED" }],
      archivedAt: "2026-09-05T00:00:00.000Z",
    }]))
    expect(loadPlanMethodHistory(5000)).toMatchObject([{
      selected: { familyId: "V2-SEED-05" },
      performed: { status: "MISSING" },
    }])
  })
})
