import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AccountRewardResult } from "./account-reward-client"
const mocks = vi.hoisted(() => ({ owner: "a1111111-1111-4111-8111-111111111111" as string | null,
  enabled: true, request: vi.fn(), changed: null as null | (() => void) }))
vi.mock("./account-journal-api", () => ({ accountJournalPreviewEnabled: () => mocks.enabled }))
vi.mock("./local-journal-ownership", () => ({ activeLocalAccount: () => mocks.owner,
  onLocalJournalScopeChange: (fn: () => void) => { mocks.changed = fn; return () => { mocks.changed = null } } }))
vi.mock("./account-reward-client", () => ({ requestAccountRewards: mocks.request }))
import { hydrateAccountRewards, readAccountRewardSummary, recordAccountDailyVisit, disposeAccountRewards, accountRewardStatus } from "./account-reward-service"
import { loadEngagementSummary, recordDailyVisit, reconcileJournalAwards, ENGAGEMENT_STORAGE_KEY } from "../engagement"
const A = "a1111111-1111-4111-8111-111111111111"
const B = "b2222222-2222-4222-8222-222222222222"
function result(ownerId = A): AccountRewardResult {
  return { ok: true, awardedPoints: 0, summary: { kind: "rewardSummary", ownerId, today: "2026-09-08",
    points: 5, spentPoints: 3, availablePoints: 2, journalDays: 1, visitDays: 1, visitedToday: true, journalRecordedToday: true } }
}
beforeEach(() => { disposeAccountRewards(); mocks.owner = A; mocks.enabled = true; mocks.request.mockReset(); mocks.request.mockResolvedValue(result()); window.localStorage.clear() })
describe("account reward isolation and verified cache", () => {
  it("does not read or mutate unscoped local points in account mode", async () => {
    const local = JSON.stringify({ version: 2, visitDates: ["2026-09-08"], journalDates: ["2026-09-07", "2026-09-08"], pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" })
    localStorage.setItem(ENGAGEMENT_STORAGE_KEY, local)
    expect(loadEngagementSummary("2026-09-08").points).toBe(0)
    await hydrateAccountRewards()
    expect(loadEngagementSummary("2026-09-08").points).toBe(5)
    expect(recordDailyVisit("1900-01-01").kind).toBe("PENDING")
    reconcileJournalAwards([{ date: "2026-09-08", kind: "evening" }], "2026-09-08")
    await hydrateAccountRewards()
    expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(local)
  })
  it("late A response and signed-out gaps never supply B or device balances", async () => {
    let resolve!: (value: AccountRewardResult) => void
    mocks.request.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const work = hydrateAccountRewards()
    await Promise.resolve(); await Promise.resolve()
    mocks.owner = B; mocks.changed?.()
    expect(readAccountRewardSummary()).toBeNull()
    resolve(result(A)); expect(await work).toMatchObject({ ok: false, code: "STALE_RESPONSE" })
    mocks.request.mockResolvedValue(result(B)); await hydrateAccountRewards()
    expect(readAccountRewardSummary()?.ownerId).toBe(B)
    mocks.owner = null; mocks.changed?.()
    expect(loadEngagementSummary("2026-09-08").points).toBe(0)
  })
  it("only explicit visits invoke visit; hydration coalesces and failures invalidate credit", async () => {
    await Promise.all([hydrateAccountRewards(), hydrateAccountRewards()])
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.request.mock.calls[0]?.[1]).toBe("rewardSummary")
    await recordAccountDailyVisit(); expect(mocks.request.mock.calls[1]?.[1]).toBe("visit")
    mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" }); await hydrateAccountRewards()
    expect(accountRewardStatus()).toBe("FAILED"); expect(readAccountRewardSummary()).toBeNull()
  })
})
