import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppShell, SavedToast } from "../AppShell"
import { PopCard, usePopover } from "./Popover"

afterEach(cleanup)

const appCss = readFileSync("src/styles/app.css", "utf8")

function PopoverHarness() {
  const popover = usePopover()

  return (
    <>
      <span ref={popover.wrapRef}>
        <button type="button" onClick={popover.toggle}>도움말</button>
        <PopCard
          open={popover.open}
          align="right"
          accentBorder={{ border: "#aaa", bar: "#333" }}
        >
          팝오버 내용
        </PopCard>
      </span>
      <button type="button">바깥</button>
    </>
  )
}

describe("motion CSS contract", () => {
  it("gives enabled pressables fast strong ease-out feedback without unsafe shortcuts", () => {
    expect(appCss).toContain("--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1)")
    expect(appCss).toContain(
      'button:not(:disabled):not([aria-disabled="true"]):active',
    )
    expect(appCss).toContain("transition: transform 90ms var(--ease-out-strong)")
    expect(appCss).toContain("transform: scale(0.97)")
    expect(appCss).not.toMatch(/transition\s*:\s*all/iu)
    expect(appCss).not.toMatch(/\bease-in\b(?!-out)/iu)
    expect(appCss).not.toContain("scale(0)")
  })

  it("keeps keyboard focus visible and avoids unguarded hover motion", () => {
    expect(appCss).toContain(":focus-visible")
    expect(appCss).toContain("outline: 2px solid var(--focus-ring)")

    if (appCss.includes(":hover")) {
      expect(appCss).toContain("@media (hover: hover) and (pointer: fine)")
    }
  })

  it("animates only the popover surface while the positioner owns collision translation", () => {
    expect(appCss).toContain(".popover-surface")
    expect(appCss).toContain("popover-enter 150ms var(--ease-out-strong)")
    expect(appCss).toContain("transform: scale(0.96)")
    expect(appCss).toContain('data-align="right"')
    expect(appCss).toContain('data-side="top"')
  })

  it("uses short transform and opacity phases for the saved toast", () => {
    expect(appCss).toContain("saved-toast-enter 200ms var(--ease-out-strong)")
    expect(appCss).toContain("saved-toast-exit 150ms var(--ease-out-strong)")
    expect(appCss).toMatch(/@keyframes saved-toast-enter[\s\S]*opacity[\s\S]*transform/iu)
    expect(appCss).toMatch(/@keyframes saved-toast-exit[\s\S]*opacity[\s\S]*transform/iu)
  })

  it("removes spatial movement when reduced motion is requested", () => {
    expect(appCss).toContain("@media (prefers-reduced-motion: reduce)")
    expect(appCss).toContain("animation-name: ui-fade-in")
    expect(appCss).toContain("transform: none")
  })
})

describe("popover motion structure", () => {
  it("keeps origin-aware surface motion separate from collision positioning", () => {
    render(
      <PopCard
        open
        align="right"
        accentBorder={{ border: "#aaa", bar: "#333" }}
      >
        팝오버 내용
      </PopCard>,
    )

    const surface = screen.getByRole("note")
    const positioner = surface.parentElement

    expect(surface).toHaveClass("popover-surface")
    expect(surface.style.transform).toBe("")
    expect(positioner).toHaveClass("popover-positioner")
    expect(positioner).toHaveAttribute("data-align", "right")
    expect(positioner).toHaveAttribute("data-side", "bottom")
    expect(positioner?.style.transform).toMatch(/^translateX\(-?\d+px\)$/u)
  })

  it("closes immediately on Escape and outside press", () => {
    const view = render(<PopoverHarness />)

    fireEvent.click(screen.getByRole("button", { name: "도움말" }))
    expect(screen.getByRole("note")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("note")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "도움말" }))
    expect(screen.getByRole("note")).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("button", { name: "바깥" }))
    expect(screen.queryByRole("note")).not.toBeInTheDocument()

    view.unmount()
  })
})

describe("saved toast motion structure", () => {
  it("announces immediately and remains mounted for its exit phase", () => {
    const view = render(<SavedToast count={2} phase="enter" />)

    expect(screen.getByRole("status")).toHaveClass("saved-toast", "saved-toast--enter")

    view.rerender(<SavedToast count={2} phase="exit" />)
    expect(screen.getByRole("status")).toHaveClass("saved-toast", "saved-toast--exit")
  })

  it("shows the exit phase before unmounting after a save", () => {
    vi.useFakeTimers()
    window.localStorage.clear()

    try {
      render(<AppShell />)
      const tabBar = screen.getByRole("navigation", { name: "주 탭" })

      fireEvent.click(within(tabBar).getByRole("button", { name: /기록/u }))
      fireEvent.click(screen.getByRole("button", { name: /훈련 후/u }))
      fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

      expect(screen.getByRole("status")).toHaveClass("saved-toast--enter")

      act(() => vi.advanceTimersByTime(4050))
      expect(screen.getByRole("status")).toHaveClass("saved-toast--exit")

      act(() => vi.advanceTimersByTime(149))
      expect(screen.getByRole("status")).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps review attention until the athlete dismisses it", () => {
    vi.useFakeTimers()
    window.localStorage.clear()

    try {
      render(<AppShell />)
      const tabBar = screen.getByRole("navigation", { name: "주 탭" })
      fireEvent.click(within(tabBar).getByRole("button", { name: /기록/u }))
      fireEvent.click(screen.getByRole("button", { name: /경기/u }))
      fireEvent.change(screen.getByRole("textbox", { name: "경기 메모" }), { target: { value: "무릎이 아파" } })
      fireEvent.click(screen.getByRole("radio", { name: "훈련 메모" }))
      fireEvent.click(screen.getByRole("button", { name: /^저장/u }))

      expect(screen.getByRole("alert")).toHaveTextContent("분석 결과를 확인해야 해요")
      act(() => vi.advanceTimersByTime(10_000))
      expect(screen.getByRole("alert")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "검토 안내 닫기" }))
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
