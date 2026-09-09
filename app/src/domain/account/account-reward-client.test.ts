import { describe, expect, it, vi } from "vitest"
import { requestAccountRewards, type AccountRewardSummary } from "./account-reward-client"
import type { supabase } from "./supabase-client"

const A = "a1111111-1111-4111-8111-111111111111"
const B = "b2222222-2222-4222-8222-222222222222"
const summary: AccountRewardSummary = { kind: "rewardSummary", ownerId: A, today: "2026-09-08",
  points: 5, spentPoints: 3, availablePoints: 2, journalDays: 1, visitDays: 1, visitedToday: true, journalRecordedToday: true }
function fixture(data: unknown = summary) {
  const invoke = vi.fn(async () => ({ data, error: null }))
  const client = { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: A } } }, error: null })) }, functions: { invoke } }
  const dependencies = { client: (async () => client) as unknown as typeof supabase, owner: () => A as string | null }
  return { client, dependencies, invoke }
}
describe("account reward wire trust", () => {
  it("legacy spending is separate from verified debit and cannot inflate available credit", async () => {
    const legacy = { ...summary, legacySpentPoints: 200 }
    expect(await requestAccountRewards(A, "rewardSummary", () => true, fixture(legacy).dependencies))
      .toEqual({ ok: true, summary: legacy, awardedPoints: 0 })
    for (const invalid of [{ ...legacy, legacySpentPoints: -1 }, { ...legacy, availablePoints: 202 }]) {
      expect(await requestAccountRewards(A, "rewardSummary", () => true, fixture(invalid).dependencies))
        .toEqual({ ok: false, code: "INVALID_RESPONSE" })
    }
  })
  it("sends only the narrow action and verifies owner and arithmetic", async () => {
    const f = fixture()
    expect(await requestAccountRewards(A, "rewardSummary", () => true, f.dependencies)).toEqual({ ok: true, summary, awardedPoints: 0 })
    expect(f.invoke).toHaveBeenCalledWith("account-journal", { body: { action: "rewardSummary" } })
    for (const invalid of [{ ...summary, ownerId: B }, { ...summary, availablePoints: 999 }, { ...summary, points: 999 }, { ...summary, memo: "synthetic" }]) {
      expect(await requestAccountRewards(A, "rewardSummary", () => true, fixture(invalid).dependencies)).toEqual({ ok: false, code: "INVALID_RESPONSE" })
    }
  })
  it("visit accepts only 0/1 server-confirmed credit and never a client date", async () => {
    const f = fixture({ kind: "visit", summary, awardedPoints: 1 })
    expect((await requestAccountRewards(A, "visit", () => true, f.dependencies))).toMatchObject({ ok: true, awardedPoints: 1 })
    expect(f.invoke).toHaveBeenCalledWith("account-journal", { body: { action: "visit" } })
    expect(await requestAccountRewards(A, "visit", () => true, fixture({ kind: "visit", summary, awardedPoints: 4 }).dependencies))
      .toEqual({ ok: false, code: "INVALID_RESPONSE" })
  })
  it("auth mismatch cannot invoke and stale responses cannot reach the current owner", async () => {
    const f = fixture()
    f.client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: B } } }, error: null })
    expect(await requestAccountRewards(A, "rewardSummary", () => true, f.dependencies)).toMatchObject({ ok: false, code: "AUTH_REQUIRED" })
    expect(f.invoke).not.toHaveBeenCalled()
    const other = fixture()
    let current = true
    other.invoke.mockImplementation(async () => { current = false; return { data: summary, error: null } })
    expect(await requestAccountRewards(A, "rewardSummary", () => current, other.dependencies)).toMatchObject({ ok: false, code: "STALE_RESPONSE" })
  })
})
