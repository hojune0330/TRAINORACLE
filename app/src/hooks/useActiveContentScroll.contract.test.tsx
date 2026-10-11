import React from "react"
import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useActiveContentScroll } from "./useActiveContentScroll"
import { beginBrowserPopNavigation } from "../navigation/browserNavigation"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"

const originalMatchMedia = window.matchMedia

afterEach(() => {
  cleanup()
  window.localStorage.removeItem("trainoracle.calendar-reduced-motion.v1")
  vi.useRealTimers()
  vi.restoreAllMocks()
  setActiveLocalAccount(null)
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  })
})

function ScrollHarness({ activeKey, skipInitial = false }: {
  readonly activeKey: string
  readonly skipInitial?: boolean
}) {
  const targetRef = React.useRef<HTMLElement>(null)
  useActiveContentScroll(activeKey, targetRef, undefined, skipInitial)
  return <section ref={targetRef}>새 선택 구간</section>
}

function NestedScrollHarness({ activeKey }: { readonly activeKey: string }) {
  const targetRef = React.useRef<HTMLElement>(null)
  useActiveContentScroll(activeKey, targetRef, undefined, true)
  return <main className="app-scroll-region"><section ref={targetRef}>새 선택 구간</section></main>
}

function FocusHarness({ activeKey, skipInitial = false }: { readonly activeKey: string; readonly skipInitial?: boolean }) {
  const targetRef = React.useRef<HTMLElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  useActiveContentScroll(activeKey, targetRef, headingRef, skipInitial)
  return <><button type="button">다른 화면</button><label>별도 입력<input /></label><section ref={targetRef}>
    <h2 ref={headingRef} tabIndex={-1}>현재 질문</h2><label>작성 중인 메모<textarea /></label>
    <button type="button">같은 구간의 적용</button>
  </section></>
}

function queuedFrames() {
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(frame => { frames.delete(frame) })
  return () => act(() => { for (const [frame, callback] of [...frames]) { frames.delete(frame); callback(16) } })
}

describe("active content scroll", () => {
  it("focuses the new heading after alignment when no later input has taken focus", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" />)
    flushFrames()
    expect(view.getByRole("heading", { name: "현재 질문" })).toHaveFocus()
  })

  it("preserves an input focused before a queued alignment, including across a key change", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" skipInitial />)
    const input = view.getByRole("textbox", { name: "작성 중인 메모" })
    input.focus()
    view.rerender(<FocusHarness activeKey="two" skipInitial />)
    expect(view.getByRole("textbox", { name: "작성 중인 메모" })).toBe(input)
    flushFrames()
    expect(input).toHaveFocus()
  })

  it("does not take focus back from another control selected after alignment was queued", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" />)
    const control = view.getByRole("button", { name: "다른 화면" })
    control.focus()
    flushFrames()
    expect(control).toHaveFocus()
  })

  it("preserves an already focused editable field outside the alignment target", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" skipInitial />)
    const input = view.getByRole("textbox", { name: "별도 입력" })
    input.focus()
    view.rerender(<FocusHarness activeKey="two" skipInitial />)
    flushFrames()
    expect(input).toHaveFocus()
  })

  it("moves an unchanged opener's focus to the new question", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" skipInitial />)
    view.getByRole("button", { name: "다른 화면" }).focus()
    view.rerender(<FocusHarness activeKey="two" skipInitial />)
    flushFrames()
    expect(view.getByRole("heading", { name: "현재 질문" })).toHaveFocus()
  })

  it("moves an unchanged internal apply button to the explicitly requested heading", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" skipInitial />)
    view.getByRole("button", { name: "같은 구간의 적용" }).focus()
    view.rerender(<FocusHarness activeKey="two" skipInitial />)
    flushFrames()
    expect(view.getByRole("heading", { name: "현재 질문" })).toHaveFocus()
  })

  it("preserves an internal control chosen after the new heading alignment was queued", () => {
    const flushFrames = queuedFrames()
    const view = render(<FocusHarness activeKey="one" skipInitial />)
    view.rerender(<FocusHarness activeKey="two" skipInitial />)
    const control = view.getByRole("button", { name: "같은 구간의 적용" })
    control.focus()
    flushFrames()
    expect(control).toHaveFocus()
  })

  it("uses an immediate move for the existing in-app motion preference too", async () => {
    window.localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView })
    render(<ScrollHarness activeKey="one" />)
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start", inline: "nearest" }))
  })

  it("never applies an old queued alignment after an A to B to A account lifetime change", () => {
    vi.useFakeTimers()
    setActiveLocalAccount("synthetic-scroll-a")
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView })
    render(<ScrollHarness activeKey="one" />)
    setActiveLocalAccount("synthetic-scroll-b")
    setActiveLocalAccount("synthetic-scroll-a")
    act(() => { vi.advanceTimersByTime(300) })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("cancels the delayed alignment on POP and lets the next ordinary decision align again", () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView })
    const { rerender } = render(<ScrollHarness activeKey="one" skipInitial />)
    rerender(<ScrollHarness activeKey="two" skipInitial />)
    act(() => { vi.advanceTimersByTime(20) })
    expect(scrollIntoView).toHaveBeenCalledOnce()
    act(() => {
      beginBrowserPopNavigation()
      rerender(<ScrollHarness activeKey="one" skipInitial />)
    })
    act(() => { vi.advanceTimersByTime(300) })
    expect(scrollIntoView).toHaveBeenCalledOnce()
    rerender(<ScrollHarness activeKey="three" skipInitial />)
    act(() => { vi.advanceTimersByTime(20) })
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it("cancels a queued alignment even when POP leaves the active key unchanged", () => {
    vi.useFakeTimers()
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView })
    render(<ScrollHarness activeKey="one" />)
    act(() => { beginBrowserPopNavigation(); vi.advanceTimersByTime(300) })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("keeps the first view still and then follows the next decision step", async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    const { rerender } = render(<ScrollHarness activeKey="one" skipInitial />)
    expect(scrollIntoView).not.toHaveBeenCalled()

    rerender(<ScrollHarness activeKey="two" skipInitial />)
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    }))
  })

  it("uses an immediate move when reduced motion is requested", async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true }) as MediaQueryList),
    })
    render(<ScrollHarness activeKey="one" />)

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
      inline: "nearest",
    }))
  })

  it("positions a target against the app's real scroll container", async () => {
    const scrollTo = vi.fn()
    const { container, rerender } = render(<NestedScrollHarness activeKey="one" />)
    const region = container.querySelector<HTMLElement>(".app-scroll-region")
    const target = container.querySelector<HTMLElement>("section")
    expect(region).not.toBeNull()
    expect(target).not.toBeNull()
    if (region === null || target === null) return
    Object.defineProperty(region, "scrollTo", { configurable: true, value: scrollTo })
    vi.spyOn(region, "getBoundingClientRect").mockReturnValue({ top: 20 } as DOMRect)
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 220 } as DOMRect)

    rerender(<NestedScrollHarness activeKey="two" />)
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 200, behavior: "smooth" }))
  })
})
