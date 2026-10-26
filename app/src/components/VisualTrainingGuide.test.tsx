import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { VisualTrainingGuide } from "./VisualTrainingGuide"
import type { VisualTrainingGuideData } from "../domain/visual-training-guide"
import { useReaderDialog } from "../hooks/useReaderDialog"
import { registerBrowserBackLayer } from "../navigation/browserNavigation"

const fixture: VisualTrainingGuideData = {
  id: "synthetic-session-a", title: "한눈에 보기", contextLabel: "일반 구조 예시",
  steps: [
    { id: "run-1", kind: "work", label: "달리기", amount: "10분", instruction: "첫 달리기 구간이에요." },
    { id: "walk-1", kind: "walk", label: "걷기", amount: "1분", instruction: "1분 걸은 뒤 다음 달리기로 이어져요." },
    { id: "run-2", kind: "work", label: "달리기", amount: "10분", instruction: "두 번째 달리기 구간이에요." },
  ], notes: ["가상 구성으로 순서만 설명해요."],
}

beforeEach(() => {
  window.history.replaceState({ origin: "synthetic-guide" }, "", window.location.href)
  vi.spyOn(window.history, "back").mockImplementation(() => undefined)
})
afterEach(async () => {
  cleanup()
  await Promise.resolve()
  // Settle any queued layer disposal so the next case starts without pending Back.
  window.history.replaceState({ origin: "synthetic-guide" }, "", window.location.href)
  fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
  localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks()
})

describe("visual training guide interaction", () => {
  it("keeps exact amounts visible and opens a voluntary Mari explanation for the selected step", () => {
    render(<VisualTrainingGuide guide={fixture} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /2 걷기 1분/ }))
    const entry = screen.getByRole("button", { name: "마리 설명" })
    entry.focus(); fireEvent.click(entry)
    const dialog = screen.getByRole("dialog", { name: "마리의 설명" })
    expect(dialog).toHaveTextContent("걷기")
    expect(dialog).toHaveTextContent("1분 걸은 뒤 다음 달리기로 이어져요.")
    expect(within(dialog).getByRole("button", { name: "마리 설명 닫기" })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(entry).toHaveFocus()
    expect(screen.getByRole("button", { name: /2 걷기 1분/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("pauses playback on explanation, keeps it paused after close, and resets on a different prescription", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const view = render(<VisualTrainingGuide guide={fixture} />)
    fireEvent.click(screen.getByRole("button", { name: "순서 재생" }))
    act(() => { vi.advanceTimersByTime(1800) })
    expect(screen.getByRole("button", { name: /2 걷기 1분/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    act(() => { vi.advanceTimersByTime(5400) })
    expect(screen.getByRole("dialog")).toHaveTextContent("걷기")
    fireEvent.click(screen.getByRole("button", { name: "마리 설명 닫기" }))
    expect(screen.getByRole("button", { name: "순서 재생" })).toHaveAttribute("aria-pressed", "false")
    window.history.replaceState({ origin: "synthetic-guide" }, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: window.history.state }))
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    view.rerender(<VisualTrainingGuide guide={{ ...fixture, id: "synthetic-session-b" }} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("button", { name: /1 달리기 10분/ })).toHaveAttribute("aria-pressed", "true")
  })

  it("stops at the final step and never wraps unless the user starts again", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    render(<VisualTrainingGuide guide={fixture} />)
    fireEvent.click(screen.getByRole("button", { name: "순서 재생" }))
    for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(1800) })
    expect(screen.getByRole("button", { name: /3 달리기 10분/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "순서 재생" })).toHaveAttribute("aria-pressed", "false")
  })

  it("supports manual steps with reduced motion and retains text if artwork fails", () => {
    localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
    window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
    const view = render(<VisualTrainingGuide guide={fixture} />)
    expect(screen.queryByRole("button", { name: "순서 재생" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "다음 구간" }))
    for (const img of view.container.querySelectorAll("img")) fireEvent.error(img)
    expect(screen.getByRole("button", { name: /2 걷기 1분/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("1분 걸은 뒤 다음 달리기로 이어져요.")
  })

  it("consumes one browser Back for Mari without closing its parent reader", () => {
    const parentClose = vi.fn()
    function Parent() {
      const ref = React.useRef<HTMLDialogElement>(null)
      useReaderDialog(ref, parentClose)
      return <dialog ref={ref} aria-label="부모 훈련 안내"><VisualTrainingGuide guide={fixture} /></dialog>
    }
    render(<Parent />)
    const parentState = window.history.state
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    expect(screen.getAllByRole("dialog")).toHaveLength(2)
    window.history.replaceState(parentState, "", window.location.href)
    fireEvent(window, new PopStateEvent("popstate", { state: parentState }))
    expect(screen.queryByRole("dialog", { name: "마리의 설명" })).toBeNull()
    expect(screen.getByRole("dialog", { name: "부모 훈련 안내" })).toBeInTheDocument()
    expect(parentClose).not.toHaveBeenCalled()
  })

  it("does not offer playback for factual records and keeps units and source context", () => {
    render(<VisualTrainingGuide guide={{ ...fixture, layout: "facts", contextLabel: "직접 입력한 기록" }} />)
    expect(screen.queryByRole("button", { name: "순서 재생" })).toBeNull()
    expect(screen.getByText("직접 입력한 기록")).toBeInTheDocument()
    expect(screen.queryByText(/수행 타이머/)).toBeNull()
  })

  it("closes an open explanation when its parent becomes disabled", () => {
    const select = vi.fn()
    const view = render(<VisualTrainingGuide guide={fixture} onSelect={select} />)
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    view.rerender(<VisualTrainingGuide guide={fixture} onSelect={select} disabled />)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByRole("button", { name: "다음 구간" })).toBeDisabled()
    expect(select).not.toHaveBeenCalled()
  })

  it("returns focus to the explanation button while its enclosing page layer remains active", () => {
    const parent = registerBrowserBackLayer({ id: "synthetic-article", canClose: () => true, onClose: vi.fn() })
    const view = render(<VisualTrainingGuide guide={fixture} />)
    const entry = screen.getByRole("button", { name: "마리 설명" })
    entry.focus(); fireEvent.click(entry)
    fireEvent.click(screen.getByRole("button", { name: "마리 설명 닫기" }))
    expect(entry).toHaveFocus()
    view.unmount(); parent.dispose()
  })

  it("releases the parent scroll lock when both nested dialogs unmount", () => {
    document.body.style.overflow = "auto"
    function Parent() {
      const ref = React.useRef<HTMLDialogElement>(null)
      useReaderDialog(ref, () => undefined)
      return <dialog ref={ref} aria-label="부모 훈련 안내"><VisualTrainingGuide guide={fixture} /></dialog>
    }
    const view = render(<Parent />)
    fireEvent.click(screen.getByRole("button", { name: "마리 설명" }))
    expect(document.body.style.overflow).toBe("hidden")
    view.unmount()
    expect(document.body.style.overflow).toBe("auto")
    document.body.style.overflow = ""
  })
})
