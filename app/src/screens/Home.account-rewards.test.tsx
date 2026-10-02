import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountRewardResult } from "../domain/account/account-reward-client"
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("../domain/account/account-reward-client", () => ({ requestAccountRewards: mocks.request }))
// Plan persistence has its own native IndexedDB suite; this suite renders rewards.
vi.mock("../domain/plan-beta-store", () => ({ readPlanBetaStateFromStorage: () => ({ kind: "missing" }) }))
import { JournalRewards } from "./JournalRewards"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { accountAuthState, setAccountAuthState } from "../domain/account/account-auth-state"
import { accountRewardsEnabled, disposeAccountRewards } from "../domain/account/account-reward-service"
import { ENGAGEMENT_STORAGE_KEY, loadEngagementSummary, recordDailyVisit } from "../domain/engagement"
import { createEmptyDecorationState, loadDecorationState } from "../domain/decorations"
import { DECORATION_STORAGE_KEY_V3 } from "../domain/decoration-store"

const A = "a1111111-1111-4111-8111-111111111111"
const B = "b2222222-2222-4222-8222-222222222222"
function result(ownerId = A, visit = false, spent = 0): AccountRewardResult {
  return { ok: true, awardedPoints: visit ? 1 : 0, summary: { kind: "rewardSummary", ownerId, today: "2026-09-08",
    points: visit ? 5 : 4, spentPoints: spent, availablePoints: (visit ? 5 : 4) - spent,
    journalDays: 1, visitDays: visit ? 1 : 0, visitedToday: visit, journalRecordedToday: true } }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-08T03:00:00.000Z"))
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true"); vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  localStorage.clear(); disposeAccountRewards(); setActiveLocalAccount(A)
  setAccountAuthState("RESOLVING")
  mocks.request.mockReset(); mocks.request.mockResolvedValue(result())
})
afterEach(() => { cleanup(); disposeAccountRewards(); setActiveLocalAccount(null); setAccountAuthState("RESOLVING"); vi.unstubAllEnvs(); vi.useRealTimers() })

function seedGuest() {
  const raw = JSON.stringify({ version: 2, visitDates: ["2026-09-01"], journalDates: ["2026-09-01"],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" })
  localStorage.setItem(ENGAGEMENT_STORAGE_KEY, raw)
  localStorage.setItem(DECORATION_STORAGE_KEY_V3, JSON.stringify({ ...createEmptyDecorationState(), spentPoints: 2 }))
  return raw
}

async function openRewardDetails() {
  await userEvent.click(await screen.findByRole("button", { name: "꾸미기 재료 도구" }))
  await userEvent.click(await screen.findByText("포인트와 활동 보상"))
  return screen.findByRole("region", { name: "기록 습관" })
}

it("keeps confirmed guest rewards and spending on the device ledger with the account flag on", async () => {
  setActiveLocalAccount(null)
  setAccountAuthState("GUEST")
  seedGuest()
  const accountKey = `${ENGAGEMENT_STORAGE_KEY}.account.${A}`
  localStorage.setItem(accountKey, "untouched account source")
  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} onDecorateToday={vi.fn()} />)
  const strip = await openRewardDetails()
  expect(within(strip).getByText("3P")).toBeVisible()
  expect(screen.getByText("게스트 포인트는 어디에 보관되나요?")).toBeVisible()
  await userEvent.click(screen.getByRole("button", { name: "오늘 방문 확인 +1P" }))
  expect(within(strip).getByText("4P")).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(6)
  expect(loadDecorationState().spentPoints).toBe(2)
  expect(mocks.request).not.toHaveBeenCalled()
  expect(localStorage.getItem(accountKey)).toBe("untouched account source")
})

it("initializes a resolving guest's decoration ledger after commit without a render-phase update", async () => {
  setActiveLocalAccount(null)
  setAccountAuthState("RESOLVING")
  const rawEngagement = JSON.stringify({ version: 2, visitDates: ["2026-09-01"], journalDates: ["2026-09-01"],
    pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" })
  localStorage.setItem(ENGAGEMENT_STORAGE_KEY, rawEngagement)
  const errors: unknown[][] = []
  const consoleError = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args) })

  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} />)
  act(() => setAccountAuthState("GUEST"))
  expect(accountAuthState()).toBe("GUEST")
  expect(accountRewardsEnabled()).toBe(false)
  const strip = await openRewardDetails()

  await waitFor(() => expect(localStorage.getItem(DECORATION_STORAGE_KEY_V3)).not.toBeNull())
  expect(JSON.parse(localStorage.getItem(DECORATION_STORAGE_KEY_V3) ?? "null").spentPoints).toBe(0)
  await waitFor(() => expect(within(strip).getByText(/사용 0P/u)).toBeVisible())
  expect(loadDecorationState().spentPoints).toBe(0)
  expect(mocks.request).not.toHaveBeenCalled()
  expect(errors.flat().some((arg) => typeof arg === "string" && arg.includes("Cannot update a component"))).toBe(false)
  consoleError.mockRestore()
})

it("does not read or write the guest ledger while auth resolves or fails; explicit guest resolution reconnects it", async () => {
  setActiveLocalAccount(null)
  const raw = seedGuest()
  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} onDecorateToday={vi.fn()} />)
  await openRewardDetails()
  expect(screen.getByText("로그인 상태를 확인하고 있어요.")).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(0)
  expect(recordDailyVisit("2026-09-08").kind).toBe("SAVE_FAILED")
  act(() => setAccountAuthState("FAILED"))
  expect(screen.getByText(/게스트 장부로 전환하지 않았어요/)).toBeVisible()
  expect(loadDecorationState().spentPoints).toBe(0)
  expect(recordDailyVisit("2026-09-08").kind).toBe("SAVE_FAILED")
  expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(raw)
  expect(mocks.request).not.toHaveBeenCalled()
  act(() => setAccountAuthState("GUEST"))
  expect(screen.getByText("게스트 포인트는 어디에 보관되나요?")).toBeVisible()
  expect(screen.getByText("3P")).toBeVisible()
})

it("does not fall back from an account reward failure even after a prior guest session", async () => {
  setAccountAuthState("GUEST")
  const raw = seedGuest()
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} onDecorateToday={vi.fn()} />)
  await openRewardDetails()
  expect(await screen.findByText("계정 포인트를 불러오지 못했어요.")).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(0)
  expect(loadDecorationState().spentPoints).toBe(0)
  expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(raw)
  expect(screen.queryByText("게스트 포인트는 어디에 보관되나요?")).not.toBeInTheDocument()
})

it("renders verified asynchronous credit and refreshes debit after the decoration event", async () => {
  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} onDecorateToday={vi.fn()} />)
  const strip = await openRewardDetails()
  await waitFor(() => expect(within(strip).getByText("4P")).toBeVisible())
  mocks.request.mockResolvedValue(result(A, true))
  await userEvent.click(screen.getByRole("button", { name: "오늘 방문 확인 +1P" }))
  await waitFor(() => expect(within(strip).getByText("5P")).toBeVisible())
  expect(screen.getByText("오늘 방문 +1P가 반영됐어요.")).toBeVisible()
  expect(mocks.request.mock.calls.some(args => args[1] === "visit")).toBe(true)
  mocks.request.mockResolvedValue(result(A, true, 3))
  act(() => { window.dispatchEvent(new Event("trainoracle:account-decorations-changed")) })
  await waitFor(() => expect(within(strip).getByText("2P")).toBeVisible())
  expect(within(strip).getByText("누적 5P · 사용 3P")).toBeVisible()
})

it("clears another account's rendered balance while B loads and shows read failure instead of A credit", async () => {
  render(<JournalRewards onBack={vi.fn()} onOpenMore={vi.fn()} onDecorateToday={vi.fn()} />)
  const strip = await openRewardDetails()
  await waitFor(() => expect(within(strip).getByText("4P")).toBeVisible())
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  act(() => { setActiveLocalAccount(B) })
  await waitFor(() => expect(within(strip).queryByText("4P")).not.toBeInTheDocument())
  const refreshedStrip = await openRewardDetails()
  expect(await within(refreshedStrip).findByText("계정 포인트를 불러오지 못했어요.")).toBeVisible()
})
