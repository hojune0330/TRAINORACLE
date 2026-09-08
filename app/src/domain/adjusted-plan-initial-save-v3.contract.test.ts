import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { saveSelectedAdjustedPlanV3 } from "./adjusted-plan-storage-v5"
import { adjustedPlanSelectionV3Fixture } from "./adjusted-plan-selection-v3.test-fixtures"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { activeAthleteRecordsStorageKey } from "./athlete-records"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it.each(["record", "expiry", "review"])("rejects %s change during initial active-plan writing", async change => {
  const { request, policy, retained } = adjustedPlanSelectionV3Fixture()
  const key = activePlanBetaStorageKey(), original = Storage.prototype.setItem
  let injected = false
  const review = { source: request.preparation.source, explanation: request.preparation.explanation, policies: [policy], retained: [retained] }
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, name, value) {
    original.call(this, name, value)
    if (name === key && !injected) {
      injected = true
      if (change === "record") localStorage.removeItem(activeAthleteRecordsStorageKey())
      if (change === "expiry") vi.setSystemTime(new Date(TODAY.getTime() + 100))
      if (change === "review") review.policies = []
    }
  })
  const result = await saveSelectedAdjustedPlanV3({ request, readReview: () => review, locks, isCurrentDraft: () => true })
  expect(injected).toBe(true)
  expect(result).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
  expect(localStorage.getItem(key)).toBeNull()
})
