import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CompanionMotion } from "./CompanionMotion"

const preferences = vi.hoisted(() => ({ reduced: false }))
vi.mock("../hooks/useCalendarMotion", () => ({ useCalendarMotion: () => preferences }))
let callback: FrameRequestCallback
let visibility: DocumentVisibilityState
beforeEach(() => {
  preferences.reduced = false
  visibility = "visible"
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
  vi.stubGlobal("IntersectionObserver", undefined)
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { callback = cb; return 1 }))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("loops a calm idle by default, interrupts for one requested gesture and returns to idle", () => {
  const { container } = render(<CompanionMotion interactive motion="run" />)
  expect(container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
  fireEvent.load(container.querySelector('.companion-motion__atlas')!)
  act(() => callback(0)); act(() => callback(6500))
  expect(container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
  expect(container.querySelector('.companion-motion__atlas')).not.toHaveStyle({ transform: "translateX(-0%)" })
  fireEvent.click(screen.getByRole("button", { name: "수달 동작 보기" }))
  expect(container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-run-atlas.webp"))
  fireEvent.load(container.querySelector('.companion-motion__atlas')!)
  expect(container.querySelector('.companion-motion__poster')).not.toBeVisible()
  act(() => callback(0))
  act(() => callback(700))
  expect(container.querySelector('.companion-motion__atlas')).not.toHaveStyle({ transform: "translateX(-0%)" })
  act(() => callback(1300))
  expect(container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
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
  expect(view.container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
})

it("falls back to the static image when a motion asset fails", () => {
  const { container } = render(<CompanionMotion autoPlay motion="nod" />)
  fireEvent.error(container.querySelector('.companion-motion__atlas')!)
  expect(container.querySelector('.companion-motion__poster')).toBeInTheDocument()
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
})

it("keeps idle paused after a manually requested gesture and resumes only by choice", () => {
  const { container } = render(<CompanionMotion interactive motion="run" />)
  fireEvent.load(container.querySelector('.companion-motion__atlas')!)
  fireEvent.click(screen.getByRole("button", { name: "수달 움직임 멈추기" }))
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
  expect(cancelAnimationFrame).toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "수달 동작 보기" }))
  fireEvent.load(container.querySelector('.companion-motion__atlas')!)
  act(() => callback(0)); act(() => callback(1300))
  expect(container.querySelector('.companion-motion__atlas')).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "수달 움직임 켜기" }))
  expect(container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
})

it("stops outside the viewport and in a hidden tab, then resumes idle without replaying the save nod", () => {
  let intersect: (entries: { isIntersecting: boolean }[]) => void
  const disconnect = vi.fn()
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: typeof intersect) { intersect = cb }
    observe() {}
    disconnect = disconnect
  })
  const view = render(<CompanionMotion autoPlay motion="nod" />)
  expect(view.container.querySelector('.companion-motion__atlas')).toBeNull()
  act(() => intersect([{ isIntersecting: true }]))
  expect(view.container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-nod-atlas.webp"))
  fireEvent.load(view.container.querySelector('.companion-motion__atlas')!)
  act(() => intersect([{ isIntersecting: false }]))
  expect(view.container.querySelector('.companion-motion__atlas')).toBeNull()
  act(() => intersect([{ isIntersecting: true }]))
  expect(view.container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
  visibility = "hidden"
  fireEvent(document, new Event("visibilitychange"))
  expect(view.container.querySelector('.companion-motion__atlas')).toBeNull()
  visibility = "visible"
  fireEvent(document, new Event("visibilitychange"))
  expect(view.container.querySelector('.companion-motion__atlas')).toHaveAttribute("src", expect.stringContaining("otter-idle-atlas.webp"))
  view.unmount()
  expect(disconnect).toHaveBeenCalled()
})
