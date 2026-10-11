import React from "react"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AppShellFrame } from "./AppShellFrame"

beforeEach(() => localStorage.removeItem("trainoracle.calendar-reduced-motion.v1"))
afterEach(() => { cleanup(); localStorage.removeItem("trainoracle.calendar-reduced-motion.v1") })

function shell(wideResults = false, wideTask = false) {
  return render(<AppShellFrame scrollRegionRef={React.createRef<HTMLElement>()}
    savedToast={null} tab="trends" onDismissToast={vi.fn()} onOpenTrends={vi.fn()} onTab={vi.fn()}
    wideResults={wideResults} wideTask={wideTask}><h1>합성 결과</h1></AppShellFrame>)
}

it("opts results into a wider reading layout without widening diary/default shells", () => {
  const view = shell(true)
  expect(view.container.querySelector(".app-shell")).toHaveClass("app-shell--results")
  view.unmount()
  expect(shell().container.querySelector(".app-shell")).not.toHaveClass("app-shell--results")
})

it("keeps focused task layout when both roles are requested", () => {
  const root = shell(true, true).container.querySelector(".app-shell")
  expect(root).toHaveClass("app-shell--task")
  expect(root).not.toHaveClass("app-shell--results")
})

it("reacts to the existing app reduced-motion preference", () => {
  const root = shell().container.querySelector(".app-shell")
  act(() => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
  })
  expect(root).toHaveAttribute("data-reduced-motion", "true")
})
