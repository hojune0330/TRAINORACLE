import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { calendarReducedMotion, useCalendarMotion } from "./useCalendarMotion"
afterEach(() => { cleanup(); localStorage.clear(); window.dispatchEvent(new StorageEvent("storage", { key: null })); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it("honors OS reduction and survives a denied preference write for the current tab", () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList))
  const hook = renderHook(useCalendarMotion)
  expect(hook.result.current.reduced).toBe(false)
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("synthetic denied storage") })
  act(() => hook.result.current.setReduced(true))
  expect(calendarReducedMotion()).toBe(true)
  expect(hook.result.current.reduced).toBe(true)
  act(() => hook.result.current.setReduced(false))
  expect(calendarReducedMotion()).toBe(false)
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
  expect(calendarReducedMotion()).toBe(true)
})
