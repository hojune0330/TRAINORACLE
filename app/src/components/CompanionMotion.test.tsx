import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CompanionMotion } from "./CompanionMotion"

const preferences = vi.hoisted(() => ({ reduced: false }))
vi.mock("../hooks/useCalendarMotion", () => ({ useCalendarMotion: () => preferences }))
let callback: FrameRequestCallback
beforeEach(() => {
  preferences.reduced = false
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { callback = cb; return 1 }))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("loads motion only after a click, plays once and leaves the action usable", () => {
  const { container } = render(<CompanionMotion interactive motion="run" />)
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "수달 동작 보기" }))
  fireEvent.load(container.querySelector('.companion-motion__atlas')!)
  expect(container.querySelector('.companion-motion__poster')).not.toBeVisible()
  act(() => callback(0))
  act(() => callback(700))
  expect(container.querySelector('.companion-motion__atlas')).not.toHaveStyle({ transform: "translateX(-0%)" })
  act(() => callback(1300))
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
  expect(screen.getByRole("button", { name: "수달 동작 보기" })).toBeEnabled()
  expect(container.querySelector('.companion-motion__poster')).toBeVisible()
})

it("keeps the static image and downloads no motion when reduced motion is requested", () => {
  preferences.reduced = true
  const { container } = render(<CompanionMotion autoPlay motion="nod" />)
  expect(container.querySelector('.companion-motion__poster')).toBeInTheDocument()
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
})

it("starts one nod for a confirmed host and does not restart on ordinary rerenders", () => {
  const view = render(<CompanionMotion autoPlay motion="nod" />)
  fireEvent.load(view.container.querySelector('.companion-motion__atlas')!)
  act(() => callback(0)); act(() => callback(1250))
  view.rerender(<CompanionMotion autoPlay motion="nod" />)
  expect(view.container.querySelector('.companion-motion__atlas')).toBeNull()
})

it("falls back to the static image when a motion asset fails", () => {
  const { container } = render(<CompanionMotion autoPlay motion="nod" />)
  fireEvent.error(container.querySelector('.companion-motion__atlas')!)
  expect(container.querySelector('.companion-motion__poster')).toBeInTheDocument()
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
})
