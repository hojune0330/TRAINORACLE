import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AccountRewardResult } from "../domain/account/account-reward-client"
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock("../domain/account/account-reward-client", () => ({ requestAccountRewards: mocks.request }))
// Plan persistence has its own native IndexedDB suite; this suite renders rewards.
vi.mock("../domain/plan-beta-store", () => ({ readPlanBetaStateFromStorage: () => ({ kind: "missing" }) }))
import { Home } from "./Home"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { disposeAccountRewards } from "../domain/account/account-reward-service"
import { setAccountAuthState } from "../domain/account/account-auth-state"
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

it("keeps confirmed guest rewards and spending on the device ledger with the account flag on", async () => {
  setActiveLocalAccount(null)
  setAccountAuthState("GUEST")
  seedGuest()
  const accountKey = `${ENGAGEMENT_STORAGE_KEY}.account.${A}`
  localStorage.setItem(accountKey, "untouched account source")
  render(<Home />)
  const strip = screen.getByRole("region", { name: "기록 습관" })
  expect(within(strip).getByText("3P")).toBeVisible()
  expect(screen.getByText(/이 기기의 게스트 포인트예요/)).toBeVisible()
  await userEvent.click(screen.getByRole("button", { name: "오늘 방문 확인 +1P" }))
  expect(within(strip).getByText("4P")).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(6)
  expect(loadDecorationState().spentPoints).toBe(2)
  expect(mocks.request).not.toHaveBeenCalled()
  expect(localStorage.getItem(accountKey)).toBe("untouched account source")
})

it("does not read or write the guest ledger while auth resolves or fails; explicit guest resolution reconnects it", async () => {
  setActiveLocalAccount(null)
  const raw = seedGuest()
  render(<Home />)
  expect(screen.getByText(/로그인 상태를 확인하고 있어요/)).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(0)
  expect(recordDailyVisit("2026-09-08").kind).toBe("SAVE_FAILED")
  act(() => setAccountAuthState("FAILED"))
  expect(screen.getByText(/게스트 장부로 전환하지 않았어요/)).toBeVisible()
  expect(loadDecorationState().spentPoints).toBe(0)
  expect(recordDailyVisit("2026-09-08").kind).toBe("SAVE_FAILED")
  expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(raw)
  expect(mocks.request).not.toHaveBeenCalled()
  act(() => setAccountAuthState("GUEST"))
  expect(screen.getByText(/이 기기의 게스트 포인트예요/)).toBeVisible()
  expect(screen.getByText("3P")).toBeVisible()
})

it("does not fall back from an account reward failure even after a prior guest session", async () => {
  setAccountAuthState("GUEST")
  const raw = seedGuest()
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  render(<Home />)
  expect(await screen.findByText("계정 포인트를 불러오지 못했어요.")).toBeVisible()
  expect(loadEngagementSummary("2026-09-08").points).toBe(0)
  expect(loadDecorationState().spentPoints).toBe(0)
  expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(raw)
  expect(screen.queryByText(/이 기기의 게스트 포인트예요/)).not.toBeInTheDocument()
})

it("renders verified asynchronous credit and refreshes debit after the decoration event", async () => {
  render(<Home />)
  const strip = screen.getByRole("region", { name: "기록 습관" })
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
  render(<Home />)
  await screen.findByText("4P")
  mocks.request.mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  act(() => { setActiveLocalAccount(B) })
  await waitFor(() => expect(screen.queryByText("4P")).not.toBeInTheDocument())
  expect(await screen.findByText("계정 포인트를 불러오지 못했어요.")).toBeVisible()
})
