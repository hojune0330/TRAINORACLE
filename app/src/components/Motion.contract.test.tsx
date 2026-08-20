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

  it("gives text fields a press response without moving the caret", () => {
    // 입력칸 21개가 눌러도 아무 반응이 없었다 (작업지시서 UX1 §1-3).
    expect(appCss).toContain(":where(input, select, textarea):not(:disabled):active")
    expect(appCss).toContain("transition: border-color 90ms var(--ease-out-strong)")

    // 입력칸에는 transform 을 쓰지 않는다 — 글자 커서가 흔들린다.
    const inputActiveRule = appCss.slice(
      appCss.indexOf(":where(input, select, textarea):not(:disabled):active"),
    ).slice(0, appCss.slice(appCss.indexOf(":where(input, select, textarea):not(:disabled):active")).indexOf("}"))
    expect(inputActiveRule).not.toContain("transform")
  })

  it("settles a collapsed section briefly without animating layout height", () => {
    expect(appCss).toContain("formsec-settle 120ms var(--ease-out-strong)")
    expect(appCss).toContain("translateY(-2px)")

    // height 를 애니메이션하면 아래 구획이 통째로 밀려 올라와 눈이 위치를 잃는다.
    const keyframesMatch = appCss.match(/@keyframes formsec-settle\s*\{[\s\S]*?^\}/mu)
    expect(keyframesMatch).not.toBeNull()
    const keyframes = keyframesMatch?.[0] ?? ""
    expect(keyframes).not.toMatch(/\bheight\b/u)
    // opacity 0 에서 시작하면 새로 나타나는 느낌이라 산만하다.
    expect(keyframes).toContain("opacity: 0.55")
  })

  it("keeps the collapsed-section motion inside the reduced-motion fallback", () => {
    const reduceBlock = appCss.slice(appCss.indexOf("@media (prefers-reduced-motion: reduce)"))
    expect(reduceBlock).toContain(".formsec--collapsed")
    // 색 반응은 남기고 시간만 없앤다. 움직임을 싫어하는 설정이지
    // 반응이 없기를 바라는 설정이 아니다.
    expect(reduceBlock).toContain(":where(input, select, textarea):not(:disabled):active")
  })

  it("does not introduce a second easing curve or new hard-coded colors", () => {
    // 가속 곡선은 --ease-out-strong 정의 한 줄뿐이어야 한다.
    expect(appCss.match(/cubic-bezier/gu)?.length ?? 0).toBe(1)
    // 색은 인쇄용 블록의 3개뿐 (ADR A3 — 토큰 단일 소스).
    expect(appCss.match(/#[0-9a-fA-F]{3,6}/gu)?.length ?? 0).toBe(3)
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
    const view = render(<SavedToast count={2} phase="enter" rewardMessage="오늘 기록한 날 +4P가 반영됐어요." />)

    expect(screen.getByRole("status")).toHaveClass("saved-toast", "saved-toast--enter")
    expect(screen.getByRole("status")).toHaveTextContent("오늘 기록한 날 +4P가 반영됐어요.")

    view.rerender(<SavedToast count={2} phase="exit" />)
    expect(screen.getByRole("status")).toHaveClass("saved-toast", "saved-toast--exit")
  })

  it("shows the exit phase before unmounting after a save", () => {
    vi.useFakeTimers()
    window.localStorage.clear()

    try {
      render(<AppShell />)
      const tabBar = screen.getByRole("navigation", { name: "주 탭" })

      fireEvent.click(within(tabBar).getByRole("button", { name: "경기기록" }))
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
      fireEvent.click(within(tabBar).getByRole("button", { name: "경기기록" }))
      fireEvent.click(screen.getByRole("button", { name: new RegExp("경기 직전/직후", "u") }))
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
