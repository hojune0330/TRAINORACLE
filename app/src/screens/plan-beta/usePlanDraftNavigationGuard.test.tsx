import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { usePlanDraftNavigationGuard } from "./usePlanDraftNavigationGuard"

afterEach(() => { cleanup(); setActiveLocalAccount(null); vi.restoreAllMocks() })

it("keeps an unsaved plan on cancel and leaves only after explicit discard", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  renderHook(() => usePlanDraftNavigationGuard(true))
  const navigate = vi.fn()
  expect(runDraftSafeNavigation(navigate)).toBe(false)
  expect(navigate).not.toHaveBeenCalled()
  const unload = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  confirm.mockReturnValue(true)
  expect(runDraftSafeNavigation(navigate)).toBe(true)
  expect(navigate).toHaveBeenCalledTimes(1)
})

it("does not add a confirmation to an empty or saved plan", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const { rerender } = renderHook(({ dirty }) => usePlanDraftNavigationGuard(dirty), { initialProps: { dirty: false } })
  expect(runDraftSafeNavigation(vi.fn())).toBe(true)
  rerender({ dirty: true })
  rerender({ dirty: false })
  expect(runDraftSafeNavigation(vi.fn())).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
})

it("removes its guard after unmount and never blocks a different account", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
  const { unmount } = renderHook(() => usePlanDraftNavigationGuard(true))
  act(() => setActiveLocalAccount("synthetic-other-owner"))
  expect(runDraftSafeNavigation(vi.fn())).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
  unmount()
  act(() => setActiveLocalAccount(null))
  expect(runDraftSafeNavigation(vi.fn())).toBe(true)
})

it("uses replacement-specific wording and never treats an in-flight save as discarded", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
  const navigate = vi.fn()
  const { rerender } = renderHook(({ saving }) => usePlanDraftNavigationGuard(true, "변경을 취소하고 이동할까요?", saving), { initialProps: { saving: true } })
  expect(runDraftSafeNavigation(navigate)).toBe(false)
  expect(confirm).not.toHaveBeenCalled()
  rerender({ saving: false })
  expect(runDraftSafeNavigation(navigate)).toBe(true)
  expect(confirm).toHaveBeenCalledWith("변경을 취소하고 이동할까요?")
})
