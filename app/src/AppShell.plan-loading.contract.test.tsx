import React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { DeferredMobileScreens } from "./DeferredMobileScreens"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { PLAN_BETA_STORAGE_KEY } from "./domain/plan-beta-store"
import { stateFixture } from "./domain/plan-beta-store.test-fixture"

const originalInbox = DeferredMobileScreens.PlanProposalInbox
const loadInbox = vi.fn<() => Promise<{ default: () => React.ReactElement | null }>>()

// Warm the real plan module; only the optional inbox's import is fault-injected.
beforeAll(async () => { await import("./screens/PlanBeta") }, 60000)
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  window.history.replaceState(null, "", "/?app=1")
  vi.stubEnv("VITE_ACCOUNT_PUBLIC_ENABLED", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT", "true")
  loadInbox.mockReset()
  DeferredMobileScreens.PlanProposalInbox = React.lazy(loadInbox)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup(); DeferredMobileScreens.PlanProposalInbox = originalInbox
  vi.restoreAllMocks(); vi.unstubAllEnvs()
})

it.each([
  ["feature off", "false", "false", "rejected"],
  ["kill switch", "true", "true", "pending"],
] as const)("disabled plan proposal chunks do not block the guest personal plan: %s", async (_name, enabled, killed, failure) => {
  vi.stubEnv("VITE_FEATURE_PLAN_PROPOSALS", enabled)
  vi.stubEnv("VITE_KILL_PLAN_PROPOSALS", killed)
  loadInbox.mockImplementation(() => failure === "pending" ? new Promise(() => undefined)
    : Promise.reject(new Error("Failed to fetch dynamically imported module: synthetic optional inbox")))
  const user = userEvent.setup(); render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "훈련" }))
  expect(await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" })).toBeVisible()
  expect(loadInbox).not.toHaveBeenCalled()
  expect(screen.queryByTestId("error-boundary")).toBeNull()
})

it.each(["rejected", "pending"] as const)("shows the saved guest plan without loading a disabled %s proposal chunk", async failure => {
  vi.stubEnv("VITE_FEATURE_PLAN_PROPOSALS", "false")
  vi.stubEnv("VITE_KILL_PLAN_PROPOSALS", "true")
  loadInbox.mockImplementation(() => failure === "pending" ? new Promise(() => undefined)
    : Promise.reject(new Error("Failed to fetch dynamically imported module: synthetic optional inbox")))
  const raw = JSON.stringify(stateFixture())
  localStorage.setItem(PLAN_BETA_STORAGE_KEY, raw)
  const user = userEvent.setup(); render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "훈련" }))
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  expect(loadInbox).not.toHaveBeenCalled()
  expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(raw)
})

it("still loads plan proposals when their feature is explicitly enabled", async () => {
  vi.stubEnv("VITE_FEATURE_PLAN_PROPOSALS", "true")
  vi.stubEnv("VITE_KILL_PLAN_PROPOSALS", "false")
  loadInbox.mockResolvedValue({ default: () => <h2>확인할 계획 제안</h2> })
  const user = userEvent.setup(); render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "훈련" }))
  expect(await screen.findByRole("heading", { name: "확인할 계획 제안" })).toBeVisible()
  expect(screen.getByRole("heading", { name: "어떤 종목을 준비하세요?" })).toBeVisible()
  expect(loadInbox).toHaveBeenCalledTimes(1)
})
