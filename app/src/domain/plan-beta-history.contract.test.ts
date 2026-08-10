import { beforeEach, describe, expect, it } from "vitest"
import {
  archiveAndClearActivePlan,
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
    expect(readStoredHistory()).toHaveLength(2)
  })
})
