import React from "react"
import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useActiveContentScroll } from "./useActiveContentScroll"

const originalMatchMedia = window.matchMedia

afterEach(() => {
  cleanup()
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
