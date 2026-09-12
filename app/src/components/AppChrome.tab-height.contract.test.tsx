import React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TabBar } from "./AppChrome"

const tabHeight = { value: 0 }
const observers: ResizeObserverMock[] = []
const originalResizeObserver = globalThis.ResizeObserver

function rectWithHeight(height: number): DOMRect {
  return {
    x: 0, y: 0, top: 0, right: 375, bottom: height, left: 0,
    width: 375, height, toJSON: () => ({}),
  }
}

class ResizeObserverMock {
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  update(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

function setResizeObserver(value: typeof ResizeObserver | undefined): void {
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, writable: true, value })
}

beforeEach(() => {
  tabHeight.value = 0
  observers.length = 0
  setResizeObserver(ResizeObserverMock as unknown as typeof ResizeObserver)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rectWithHeight(tabHeight.value))
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    paddingBottom: "8px",
    borderTopWidth: "1px",
    borderBottomWidth: "1px",
  } as CSSStyleDeclaration)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  setResizeObserver(originalResizeObserver)
})

describe("TabBar measured shell height", () => {
  it("updates from ResizeObserver and restores the previous inline value", () => {
    tabHeight.value = 70
    const { container, unmount } = render(
      <div className="app-shell" style={{ "--app-shell-tab-bar-height": "47px" } as React.CSSProperties}>
        <TabBar tab="home" onTab={vi.fn()} />
      </div>,
    )
    const nav = container.querySelector(".app-tab-bar") as HTMLElement
    const shell = nav.closest(".app-shell") as HTMLElement

    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("60px")
    expect(observers).toHaveLength(1)
    expect(observers[0]?.observe).toHaveBeenCalledWith(nav)

    tabHeight.value = 82
    observers[0]?.update()
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("72px")

    unmount()
    expect(observers[0]?.disconnect).toHaveBeenCalledTimes(1)
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("47px")
  })

  it("does not write a zero measurement and removes a newly-added value on cleanup", () => {
    const { container, unmount } = render(<div className="app-shell"><TabBar tab="home" onTab={vi.fn()} /></div>)
    const shell = (container.querySelector(".app-tab-bar") as HTMLElement).closest(".app-shell") as HTMLElement
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("")

    tabHeight.value = 54
    observers[0]?.update()
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("44px")

    unmount()
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("")
  })

  it("takes an initial measurement when ResizeObserver is unavailable", () => {
    setResizeObserver(undefined)
    tabHeight.value = 54
    const { container, unmount } = render(<div className="app-shell"><TabBar tab="home" onTab={vi.fn()} /></div>)
    const shell = (container.querySelector(".app-tab-bar") as HTMLElement).closest(".app-shell") as HTMLElement

    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("44px")
    expect(observers).toHaveLength(0)
    unmount()
    expect(shell.style.getPropertyValue("--app-shell-tab-bar-height")).toBe("")
  })
})
