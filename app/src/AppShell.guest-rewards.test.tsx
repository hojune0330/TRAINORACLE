import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ current: vi.fn(), change: vi.fn(), reward: vi.fn() }))
vi.mock("./domain/account/auth", () => ({ currentUser: mocks.current, onAuthChange: mocks.change }))
vi.mock("./domain/account/config", () => ({ accountFeatureEnabled: () => true }))
vi.mock("./domain/account/product-analytics-service", () => ({ trackProductEvent: vi.fn() }))
vi.mock("./domain/account/account-reward-client", () => ({ requestAccountRewards: mocks.reward }))
vi.mock("./domain/plan-beta-store", () => ({ readPlanBetaStateFromStorage: () => ({ kind: "missing" }) }))
import { AppShell } from "./AppShell"
import { accountAuthState, setAccountAuthState } from "./domain/account/account-auth-state"
import { activeLocalAccount, setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { disposeAccountRewards } from "./domain/account/account-reward-service"
import { ENGAGEMENT_STORAGE_KEY } from "./domain/engagement"

beforeEach(() => {
  vi.stubEnv("VITE_FEATURE_ACCOUNT_JOURNAL", "true")
  vi.stubEnv("VITE_KILL_ACCOUNT_JOURNAL", "false")
  localStorage.clear()
  setActiveLocalAccount(null)
  setAccountAuthState("RESOLVING")
  mocks.current.mockReset()
  mocks.change.mockReset().mockReturnValue(() => undefined)
  mocks.reward.mockReset().mockResolvedValue({ ok: false, code: "UNAVAILABLE" })
  localStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify({ version: 2, visitDates: ["2026-09-01"],
    journalDates: ["2026-09-01"], pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA" }))
})
afterEach(() => { cleanup(); disposeAccountRewards(); setActiveLocalAccount(null); setAccountAuthState("RESOLVING"); vi.unstubAllEnvs() })

it("connects the guest ledger only after successful initial auth and invalidates it on unmount", async () => {
  let resolve!: (user: null) => void
  const pending = new Promise(done => { resolve = done })
  mocks.current.mockImplementation(options => options?.throwOnFailure ? pending : Promise.resolve(null))
  const view = render(<AppShell />)
  expect(screen.getByText(/로그인 상태를 확인하고 있어요/)).toBeVisible()
  expect(screen.queryByText("5P")).not.toBeInTheDocument()
  await act(async () => resolve(null))
  expect(screen.getByText(/이 기기의 게스트 포인트예요/)).toBeVisible()
  expect(screen.getByText("5P")).toBeVisible()
  expect(mocks.current).toHaveBeenCalledWith({ throwOnFailure: true })
  expect(mocks.change.mock.calls.some(call => call[1]?.ignoreInitialSession === true)).toBe(true)
  expect(mocks.reward).not.toHaveBeenCalled()
  view.unmount()
  expect(accountAuthState()).toBe("RESOLVING")
})

it("does not interpret failed authentication as signed-out or alter the guest ledger", async () => {
  const raw = localStorage.getItem(ENGAGEMENT_STORAGE_KEY)
  mocks.current.mockImplementation(options => options?.throwOnFailure
    ? Promise.reject(new Error("AUTH_UNAVAILABLE")) : Promise.resolve(null))
  render(<AppShell />)
  expect(await screen.findByText(/게스트 장부로 전환하지 않았어요/)).toBeVisible()
  expect(accountAuthState()).toBe("FAILED")
  expect(screen.queryByText("5P")).not.toBeInTheDocument()
  expect(localStorage.getItem(ENGAGEMENT_STORAGE_KEY)).toBe(raw)
})

it("does not let a late failed initial lookup revoke a newer authenticated owner", async () => {
  let reject!: (reason: Error) => void
  const pending = new Promise((_done, fail) => { reject = fail })
  mocks.current.mockImplementation(options => options?.throwOnFailure ? pending : Promise.resolve(null))
  render(<AppShell />)
  act(() => mocks.change.mock.calls.find(call => call[1]?.ignoreInitialSession === true)![0]({ id: "a1111111-1111-4111-8111-111111111111" }))
  await act(async () => reject(new Error("AUTH_UNAVAILABLE")))
  expect(activeLocalAccount()).toBe("a1111111-1111-4111-8111-111111111111")
  expect(accountAuthState()).toBe("ACCOUNT")
  expect(screen.queryByText("5P")).not.toBeInTheDocument()
})
