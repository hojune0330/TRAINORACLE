import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { saveSelectedAdjustedPlan } from "./adjusted-plan-store"
import { saveAdjustedPlanProgress } from "./adjusted-plan-progress"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => callback({}) }
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
async function setup() {
  const { request, review, retained } = adjustedPlanSelectionFixture()
  const result = await saveSelectedAdjustedPlan({ request, readReview: () => review, isCurrentDraft: () => true, locks })
  if (result.kind !== "saved") throw Error(result.code)
  const session = result.state.selection.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
  const input = { expectedFingerprint: result.state.contentFingerprint, retained, locks,
    progress: { sessionDay: session.day, sessionSlot: session.slot, state: "COMPLETED" as const } }
  return { input, state: result.state }
}
it("writes only outcome and retains immutable numbers and reasons", async () => {
  const { input, state } = await setup()
  const result = await saveAdjustedPlanProgress(input)
  expect(result.kind).toBe("saved")
  if (result.kind !== "saved") throw Error(result.code)
  expect(result.state.selection).toEqual(state.selection)
  expect(result.state.progress).toEqual([input.progress])
  expect(JSON.parse(localStorage.getItem(activePlanBetaStorageKey())!)).toEqual(result.state)
  expect(await saveAdjustedPlanProgress(input)).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
})
it("does not erase pain by marking completion", async () => {
  const { input } = await setup()
  const pain = await saveAdjustedPlanProgress({ ...input, progress: { ...input.progress, state: "PAIN_CHECKIN" } })
  if (pain.kind !== "saved") throw Error(pain.code)
  expect(await saveAdjustedPlanProgress({ ...input, expectedFingerprint: pain.state.contentFingerprint }))
    .toMatchObject({ kind: "rejected", code: "PAIN_REVIEW_REQUIRED" })
})
it("rejects unknown occurrences and unavailable locks without writing", async () => {
  const { input } = await setup()
  const before = localStorage.getItem(activePlanBetaStorageKey())
  expect(await saveAdjustedPlanProgress({ ...input, progress: { ...input.progress, sessionDay: 999 } })).toMatchObject({ kind: "rejected" })
  expect(await saveAdjustedPlanProgress({ ...input, locks: null })).toMatchObject({ code: "MUTATION_LOCK_UNAVAILABLE" })
  expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(before)
})
it("rejects account changes while waiting for the lock", async () => {
  const { input } = await setup()
  const result = await saveAdjustedPlanProgress({ ...input, locks: { request: async (_n, _o, callback) => {
    setActiveLocalAccount("another-account"); return callback({})
  } } })
  expect(result).toMatchObject({ kind: "rejected", code: "STALE_BASE" })
})
it("restores exact old bytes when a write throws after storing", async () => {
  const { input } = await setup()
  const key = activePlanBetaStorageKey()
  const before = localStorage.getItem(key)
  const original = Storage.prototype.setItem
  let once = true
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, k, value) {
    original.call(this, k, value)
    if (k === key && once) { once = false; throw Error("Synthetic write failure") }
  })
  expect(await saveAdjustedPlanProgress(input)).toMatchObject({ kind: "rejected", code: "PLAN_STORAGE_WRITE_FAILED" })
  expect(localStorage.getItem(key)).toBe(before)
})
