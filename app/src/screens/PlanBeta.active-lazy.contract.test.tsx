import React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.resetModules()
})
afterEach(() => {
  cleanup(); vi.doUnmock("./plan-beta/PlanActiveState"); vi.restoreAllMocks()
})

async function storedOriginal() {
  const { stateFixture } = await import("../domain/plan-beta-store.test-fixture")
  const { activePlanBetaStorageKey, savePlanBetaState } = await import("../domain/plan-beta-store")
  expect(savePlanBetaState(stateFixture())).toEqual({ ok: true })
  const key = activePlanBetaStorageKey(), raw = localStorage.getItem(key)
  expect(raw).not.toBeNull()
  return { key, raw }
}

it("does not fetch the saved-plan screen when opening a new personal plan", async () => {
  const load = vi.fn()
  vi.doMock("./plan-beta/PlanActiveState", () => {
    load()
    return { PlanActiveState: () => <p>Unexpected saved plan</p> }
  })
  const { PlanBeta } = await import("./PlanBeta")
  render(<PlanBeta />)
  expect(screen.getByRole("button", { name: "5km" })).toBeVisible()
  expect(load).not.toHaveBeenCalled()
}, 20_000)

it("isolates unrelated plan tools during editing and restores them without a saved-plan write", async () => {
  const original = await storedOriginal()
  const { PlanBeta } = await import("./PlanBeta")
  render(<PlanBeta />)
  await screen.findByRole("heading", { name: "9일 훈련 계획" })
  expect(screen.getByRole("button", { name: "개인 계획 파일 불러오기" })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "계획 수정" }))
  expect(screen.getByRole("region", { name: "계획 수정" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "개인 계획 파일 불러오기" })).not.toBeInTheDocument()
  expect(localStorage.getItem(original.key)).toBe(original.raw)
  fireEvent.click(screen.getByRole("button", { name: "계획 수정 닫기" }))
  expect(screen.getByRole("button", { name: "개인 계획 파일 불러오기" })).toBeVisible()
  expect(localStorage.getItem(original.key)).toBe(original.raw)
})

it("preserves saved raw bytes while the active screen suspends and resumes without an outer Suspense", async () => {
  let release!: () => void
  let ready = false
  const pending = new Promise<void>(resolve => { release = () => { ready = true; resolve() } })
  vi.doMock("./plan-beta/PlanActiveState", async importOriginal => {
    const actual = await importOriginal<typeof import("./plan-beta/PlanActiveState")>()
    return { PlanActiveState: (props: React.ComponentProps<typeof actual.PlanActiveState>) => {
      if (!ready) throw pending
      return <actual.PlanActiveState {...props} />
    } }
  })
  const original = await storedOriginal()
  const { PlanBeta } = await import("./PlanBeta")
  render(<PlanBeta />)
  expect(screen.getByText("저장된 훈련 계획을 열고 있어요.")).toHaveAttribute("role", "status")
  expect(localStorage.getItem(original.key)).toBe(original.raw)
  await act(async () => { release() })
  const heading = await screen.findByRole("heading", { name: "9일 훈련 계획" })
  expect(heading).toBeVisible()
  expect(heading).toHaveFocus()
  expect(localStorage.getItem(original.key)).toBe(original.raw)
})

it("does not steal focus chosen outside the saved-plan fallback while the chunk loads", async () => {
  let release!: () => void
  let ready = false
  const pending = new Promise<void>(resolve => { release = () => { ready = true; resolve() } })
  vi.doMock("./plan-beta/PlanActiveState", async importOriginal => {
    const actual = await importOriginal<typeof import("./plan-beta/PlanActiveState")>()
    return { PlanActiveState: (props: React.ComponentProps<typeof actual.PlanActiveState>) => {
      if (!ready) throw pending
      return <actual.PlanActiveState {...props} />
    } }
  })
  await storedOriginal()
  const { PlanBeta } = await import("./PlanBeta")
  render(<><button type="button">계획 도구 계속 보기</button><PlanBeta /></>)
  expect(screen.getByText("저장된 훈련 계획을 열고 있어요.")).toBeVisible()
  const outside = screen.getByRole("button", { name: "계획 도구 계속 보기" })
  outside.focus()
  expect(outside).toHaveFocus()
  await act(async () => { release() })
  expect(await screen.findByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
  expect(outside).toHaveFocus()
})

it("keeps the saved original and shows recovery when the active-plan chunk fails to load", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.doMock("./plan-beta/PlanActiveState", () => {
    throw new Error("Failed to fetch dynamically imported module: synthetic-active-plan.js")
  })
  const original = await storedOriginal()
  const { PlanBeta } = await import("./PlanBeta")
  render(<PlanBeta />)
  // Vitest wraps a rejected module factory; both wrapped and native import errors
  // must stay inside the stored-plan region and retain the recovery action.
  expect(await screen.findByTestId("error-boundary")).toBeVisible()
  expect(screen.getByRole("button", { name: "다시 열어 보기" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "5km" })).not.toBeInTheDocument()
  expect(localStorage.getItem(original.key)).toBe(original.raw)
  cleanup()
  expect(localStorage.getItem(original.key)).toBe(original.raw)
})
