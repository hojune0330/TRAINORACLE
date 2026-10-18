import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { usePlanScheduleView } from "./usePlanScheduleView"

afterEach(() => {
  cleanup()
  setActiveLocalAccount("reset-plan-schedule-view")
  setActiveLocalAccount(null)
  vi.unstubAllGlobals()
})

it("retains the chosen view through remount and keeps plans separate within one account", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 767px)" }))
  const first = renderHook(({ identity }) => usePlanScheduleView(identity), { initialProps: { identity: "plan-a" } })
  expect(first.result.current.view).toBe("list")
  act(() => first.result.current.selectView("calendar"))
  first.rerender({ identity: "plan-b" })
  expect(first.result.current.view).toBe("list")
  first.rerender({ identity: "plan-a" })
  expect(first.result.current.view).toBe("calendar")
  first.unmount()
  const remounted = renderHook(() => usePlanScheduleView("plan-a"))
  expect(remounted.result.current.view).toBe("calendar")
})

it("discards choices on every account change and rejects a stale setter after A to B to A", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  setActiveLocalAccount("owner-a")
  const hook = renderHook(() => usePlanScheduleView("same-plan"))
  act(() => hook.result.current.selectView("list"))
  const staleSelect = hook.result.current.selectView
  act(() => setActiveLocalAccount("owner-b"))
  expect(hook.result.current.view).toBe("calendar")
  act(() => hook.result.current.selectView("list"))
  act(() => setActiveLocalAccount("owner-a"))
  expect(hook.result.current.view).toBe("calendar")
  act(() => staleSelect("list"))
  expect(hook.result.current.view).toBe("calendar")
})

it("leaves a controlled consumer's preference to its owner", () => {
  const hook = renderHook(() => usePlanScheduleView("controlled-plan", false))
  act(() => hook.result.current.selectView("list"))
  expect(hook.result.current.view).toBe("calendar")
})
