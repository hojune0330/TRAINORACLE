import { accountJournalPreviewEnabled } from "./account-journal-api"
import { accountAuthState } from "./account-auth-state"
import { activeLocalAccount, onLocalJournalScopeChange } from "./local-journal-ownership"
import { requestAccountRewards, type AccountRewardResult, type AccountRewardSummary } from "./account-reward-client"

export const ACCOUNT_REWARD_EVENT = "trainoracle:account-rewards-changed"
export type AccountRewardStatus = "IDLE" | "LOADING" | "READY" | "FAILED" | "AUTH_REQUIRED"
let owner: string | null = null
let generation = 0
let summary: AccountRewardSummary | null = null
let status: AccountRewardStatus = "IDLE"
let queue: Promise<unknown> = Promise.resolve()
let hydration: Promise<AccountRewardResult> | null = null
let unsubscribe: (() => void) | null = null

// Only confirmed guests may use the existing device ledger; errors never fall back.
export function accountRewardsEnabled() { return accountJournalPreviewEnabled() && accountAuthState() !== "GUEST" }
function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_REWARD_EVENT)) }
export function accountRewardStatus(): AccountRewardStatus {
  if (accountRewardsEnabled() && activeLocalAccount() === null) return "AUTH_REQUIRED"
  return owner === activeLocalAccount() ? status : "IDLE"
}
export function readAccountRewardSummary(): AccountRewardSummary | null {
  return accountRewardsEnabled() && owner !== null && owner === activeLocalAccount() && status === "READY" && summary
    ? { ...summary } : null
}
export function disposeAccountRewards() {
  generation += 1; owner = null; summary = null; status = "IDLE"
  queue = Promise.resolve(); hydration = null; unsubscribe?.(); unsubscribe = null; notify()
}
async function run(action: "rewardSummary" | "visit"): Promise<AccountRewardResult> {
  const user = activeLocalAccount()
  if (!accountRewardsEnabled() || !user) return { ok: false, code: "AUTH_REQUIRED" }
  if (owner !== user) {
    disposeAccountRewards(); owner = user
    unsubscribe = onLocalJournalScopeChange(disposeAccountRewards)
  }
  const epoch = generation
  const current = () => owner === user && generation === epoch && activeLocalAccount() === user && accountRewardsEnabled()
  const work = queue.catch(() => undefined).then(async (): Promise<AccountRewardResult> => {
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    status = "LOADING"; notify()
    const result = await requestAccountRewards(user, action, current)
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (result.ok) { summary = { ...result.summary }; status = "READY" }
    else { summary = null; status = "FAILED" }
    notify(); return result
  })
  queue = work; return work
}
export function hydrateAccountRewards(): Promise<AccountRewardResult> {
  if (hydration) return hydration
  const work = run("rewardSummary")
  hydration = work
  void work.finally(() => { if (hydration === work) hydration = null })
  return work
}
export function recordAccountDailyVisit(): Promise<AccountRewardResult> { return run("visit") }
