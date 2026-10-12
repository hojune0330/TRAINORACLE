import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { DeferredMobileScreens } from "./DeferredMobileScreens"
import { registerUnsavedDraftGuard } from "./domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "./domain/account/local-journal-ownership"
import { BROWSER_BACK_LAYER_HISTORY_KEY, hasPendingBrowserBackLayer } from "./navigation/browserNavigation"
import { enterPlanWithoutRecord } from "./screens/plan-beta/instant-plan.test-helper"
import type { TrainingLexicon } from "./screens/TrainingLexicon"

const originalLexicon = DeferredMobileScreens.TrainingLexicon
let resolveLexicon: (module: { default: typeof TrainingLexicon }) => void
let trainingLexicon: typeof TrainingLexicon

beforeAll(async () => {
  const [, module] = await Promise.all([import("./screens/PlanBeta"), import("./screens/TrainingLexicon")])
  trainingLexicon = module.TrainingLexicon
}, 60000)

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  window.history.replaceState(null, "", "/?app=1")
  vi.stubEnv("VITE_ACCOUNT_PUBLIC_ENABLED", "false")
  vi.stubEnv("VITE_KILL_ACCOUNT", "true")
  DeferredMobileScreens.TrainingLexicon = React.lazy(() => new Promise(resolve => { resolveLexicon = resolve }))
})

afterEach(async () => {
  cleanup()
  await act(async () => { await Promise.resolve() })
  await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(false), { timeout: 5000 })
  DeferredMobileScreens.TrainingLexicon = originalLexicon
  vi.unstubAllEnvs()
})

it.each(["native Back", "in-app Back"] as const)("keeps the plan's history and draft through a cold glossary load and %s", async back => {
  const user = userEvent.setup()
  render(<AppShell />)
  await user.click(screen.getByRole("button", { name: "훈련" }))
  await screen.findByRole("heading", { name: "어떤 종목을 준비하세요?" }, { timeout: 10000 })
  await enterPlanWithoutRecord()
  expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
  await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(false))
  const parentState = structuredClone(window.history.state)
  expect(parentState[BROWSER_BACK_LAYER_HISTORY_KEY]).toMatch(/^task-flow-/u)
  const beforeStorage = Object.fromEntries(Object.entries(localStorage))
  const blocked = vi.fn()
  const unregister = registerUnsavedDraftGuard({ isUnsafe: () => true, onBlocked: blocked })
  try {
    await user.click(screen.getByRole("button", { name: /훈련 경험 설명 보기/u }))
    await user.click(screen.getByRole("link", { name: "왜 이런 이름인가요?" }))
    expect(screen.getByText("화면을 준비하고 있어요.")).toBeVisible()
    await act(async () => { await Promise.resolve() })
    await waitFor(() => expect(hasPendingBrowserBackLayer()).toBe(false), { timeout: 5000 })
    expect(window.history.state).toEqual({ ...parentState, trainoracleOverlay: {
      kind: "term", term: "plan-experience", owner: expect.stringMatching(/^shell-/u), version: 1,
    } })
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(beforeStorage)
    expect(blocked).not.toHaveBeenCalled()

    await act(async () => { resolveLexicon({ default: trainingLexicon }) })
    expect(await screen.findByRole("heading", { name: "훈련 경험" })).toBeVisible()
    expect(window.location.search).toBe("?app=1")
    if (back === "native Back") act(() => window.history.back())
    else await user.click(screen.getByRole("button", { name: "이전 화면" }))
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    expect(window.history.state).toEqual(parentState)
    expect(Object.fromEntries(Object.entries(localStorage))).toEqual(beforeStorage)
    expect(blocked).not.toHaveBeenCalled()
  } finally { unregister() }
}, 15000)
