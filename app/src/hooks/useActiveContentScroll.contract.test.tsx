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

describe("active content scroll", () => {
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
