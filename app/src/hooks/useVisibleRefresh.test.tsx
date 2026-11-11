import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useVisibleRefresh } from "./useVisibleRefresh"
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-07T00:00:00Z")); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }) })
afterEach(() => { cleanup(); vi.useRealTimers() })
it("recovers a failed request with backoff and merges focus/online events", async () => {
  const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
  renderHook(() => useVisibleRefresh(refresh, true, "a"))
  await act(async () => { window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")) })
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(refresh).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(refresh).toHaveBeenCalledTimes(3)
})
it("pauses hidden/offline work and cancels the old owner's schedule", async () => {
  const refresh = vi.fn().mockResolvedValue(true)
  const { rerender, unmount } = renderHook(({ owner }) => useVisibleRefresh(refresh, true, owner), { initialProps: { owner: "a" } })
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  act(() => document.dispatchEvent(new Event("visibilitychange")))
  await act(async () => { await vi.advanceTimersByTimeAsync(180000) })
  expect(refresh).not.toHaveBeenCalled()
  rerender({ owner: "b" })
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")) })
  expect(refresh).toHaveBeenCalledTimes(1)
  unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(180000) })
  expect(refresh).toHaveBeenCalledTimes(1)
})
it("does not overlap a slow request", async () => {
  let finish!: (value: boolean) => void
  const refresh = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve }))
  renderHook(() => useVisibleRefresh(refresh, true, "a"))
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  await act(async () => { await vi.advanceTimersByTimeAsync(180000); window.dispatchEvent(new Event("focus")) })
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => finish(true))
})
