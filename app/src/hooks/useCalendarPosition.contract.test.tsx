import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { useCalendarPosition } from "./useCalendarPosition"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

afterEach(() => { cleanup(); setActiveLocalAccount("reset-navigation"); setActiveLocalAccount(null) })
it("waits for confirmed records, then retains manual navigation across updates and remount", () => {
  const props = { date: "2026-09-30", ready: false }
  const first = renderHook(({ date, ready }) => useCalendarPosition("late-records", date, ready), { initialProps: props })
  expect(first.result.current.initialized).toBe(false)
  first.rerender({ date: "2026-07-10", ready: true })
  expect(first.result.current.date).toBe("2026-07-10")
  act(() => first.result.current.selectMonth("2025-02"))
  first.rerender({ date: "2026-09-29", ready: true })
  expect(first.result.current.month).toBe("2025-02")
  first.unmount()
  const second = renderHook(() => useCalendarPosition("late-records", "2026-09-29"))
  expect(second.result.current.month).toBe("2025-02")
})
it("keeps a manual move during loading and discards all navigation on account changes", () => {
  const hook = renderHook(({ date, ready }) => useCalendarPosition("scope-calendar", date, ready), { initialProps: { date: "2026-09-30", ready: false } })
  act(() => hook.result.current.selectDate("2025-01-01"))
  hook.rerender({ date: "2026-08-01", ready: true })
  expect(hook.result.current.date).toBe("2025-01-01")
  act(() => setActiveLocalAccount("owner-b"))
  expect(hook.result.current.date).toBe("2026-08-01")
  act(() => hook.result.current.selectDate("2026-02-01"))
  act(() => setActiveLocalAccount(null))
  expect(hook.result.current.date).toBe("2026-08-01")
})
it("keeps candidates and the intake separate", () => {
  const a = renderHook(() => useCalendarPosition("candidate:a", "2026-10-01"))
  const b = renderHook(() => useCalendarPosition("candidate:b", "2026-10-01"))
  act(() => a.result.current.selectDate("2026-10-05"))
  expect(b.result.current.date).toBe("2026-10-01")
})
it("does not move after scrolling while the first load is pending", () => {
  const hook = renderHook(({ date, ready }) => useCalendarPosition("scroll-intent", date, ready), { initialProps: { date: "2026-09-30", ready: false } })
  act(() => hook.result.current.markManual())
  hook.rerender({ date: "2025-02-02", ready: true })
  expect(hook.result.current.date).toBe("2026-09-30")
  act(() => hook.result.current.selectDate("2025-02-02"))
  expect(hook.result.current.date).toBe("2025-02-02")
})
