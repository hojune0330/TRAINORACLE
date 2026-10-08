import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TaskFlowStep } from "./TaskFlowStep"

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("TaskFlowStep", () => {
  it("moves only the marked inset surface for a directional flow", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const rootAnimate = vi.fn(), insetAnimate = vi.fn(() => ({ cancel: vi.fn() }))
    const view = render(<TaskFlowStep stepKey="one" title="첫 질문"><div data-task-motion-surface>선택</div></TaskFlowStep>)
    const root = screen.getByRole("region", { name: "첫 질문" })
    Object.defineProperty(root, "animate", { configurable: true, value: rootAnimate })
    Object.defineProperty(root.querySelector("[data-task-motion-surface]"), "animate", { configurable: true, value: insetAnimate })
    view.rerender(<TaskFlowStep stepKey="two" title="다음 질문" motion="forward"><div data-task-motion-surface>선택</div></TaskFlowStep>)
    expect(rootAnimate).not.toHaveBeenCalled()
    expect(insetAnimate).toHaveBeenCalledOnce()
    expect(screen.getByRole("heading", { name: "다음 질문" })).toHaveFocus()
  })

  it("reveals only the current question and keeps previous answers when returning", async () => {
    function Flow() {
      const [step, setStep] = React.useState("choice")
      const [answer, setAnswer] = React.useState("")
      return <TaskFlowStep stepKey={step} title={step === "choice" ? "언제 했나요?" : "남길 말이 있나요?"}
        onBack={step === "memo" ? () => setStep("choice") : undefined}
        summary={answer && <span>선택: {answer}</span>}>
        {step === "choice" ? <button type="button" aria-pressed={answer === "오전"}
          onClick={() => { setAnswer("오전"); setStep("memo") }}>오전</button> : <label>선택 메모<input /></label>}
      </TaskFlowStep>
    }
    render(<Flow />)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "오전" }))
    expect(screen.queryByRole("button", { name: "오전" })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "선택 메모" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("heading", { name: "남길 말이 있나요?" })).toHaveFocus())
    fireEvent.click(screen.getByRole("button", { name: "이전 질문" }))
    expect(screen.getByRole("button", { name: "오전" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("never submits on step entry or typing; actions remain explicit", () => {
    const save = vi.fn()
    const back = vi.fn()
    const { rerender } = render(<TaskFlowStep stepKey="review" title="기록 확인" onBack={back}
      actions={<button type="button" onClick={save}>저장</button>}><label>글<input /></label></TaskFlowStep>)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "합성 테스트" } })
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "저장" }))
    expect(save).toHaveBeenCalledTimes(1)
    rerender(<TaskFlowStep stepKey="review" title="기록 확인" busy onBack={back}><p>저장 중</p></TaskFlowStep>)
    fireEvent.click(screen.getByRole("button", { name: "이전 질문" }))
    expect(back).not.toHaveBeenCalled()
    expect(screen.getByRole("region", { name: "기록 확인" })).toHaveAttribute("aria-busy", "true")
  })

  it("animates only changed step keys without remounting inputs or delaying the next action", () => {
    const animations: Array<{ cancel: ReturnType<typeof vi.fn> }> = []
    const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => { const animation = { cancel: vi.fn() }; animations.push(animation); return animation })
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const save = vi.fn()
    const view = render(<TaskFlowStep stepKey="choice" title="선택"><input aria-label="입력" defaultValue="보존" /></TaskFlowStep>)
    const surface = screen.getByRole("region", { name: "선택" })
    Object.defineProperty(surface, "animate", { configurable: true, value: animate })
    const input = screen.getByRole("textbox", { name: "입력" })
    view.rerender(<TaskFlowStep stepKey="memo" title="메모" motion="forward"
      actions={<button type="button" onClick={save}>저장</button>}><input aria-label="입력" defaultValue="보존" /></TaskFlowStep>)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0]).toEqual([
      [{ opacity: 0.65, transform: "translateX(8px)" }, { opacity: 1, transform: "none" }],
      { duration: 200, easing: "ease-out" },
    ])
    expect(screen.getByRole("textbox", { name: "입력" })).toBe(input)
    fireEvent.change(input, { target: { value: "수정한 값" } })
    view.rerender(<TaskFlowStep stepKey="memo" title="메모" motion="replace"
      actions={<button type="button" onClick={save}>저장</button>}><input aria-label="입력" defaultValue="보존" /></TaskFlowStep>)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue("수정한 값")
    fireEvent.click(screen.getByRole("button", { name: "저장" }))
    expect(save).toHaveBeenCalledTimes(1)
    view.rerender(<TaskFlowStep stepKey="choice" title="선택" motion="backward"><input aria-label="입력" /></TaskFlowStep>)
    expect(animations[0]?.cancel).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[1]?.[0]).toEqual([{ opacity: 0.65, transform: "translateX(-8px)" }, { opacity: 1, transform: "none" }])
    view.unmount()
    expect(animations[1]?.cancel).toHaveBeenCalledTimes(1)
  })

  it("uses only opacity when direction is unknown and respects reduced motion immediately", () => {
    let reduced = false
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const removeEventListener = vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener))
    vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return reduced },
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener), removeEventListener })))
    const cancel = vi.fn()
    const animate = vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => ({ cancel }))
    const view = render(<TaskFlowStep stepKey="first" title="첫 질문"><button type="button">선택</button></TaskFlowStep>)
    Object.defineProperty(screen.getByRole("region", { name: "첫 질문" }), "animate", { configurable: true, value: animate })
    view.rerender(<TaskFlowStep stepKey="branch" title="선택 입력"><button type="button">선택</button></TaskFlowStep>)
    expect(animate.mock.calls[0]?.[0]).toEqual([{ opacity: 0.65 }, { opacity: 1 }])
    act(() => { reduced = true; listeners.forEach(listener => listener({ matches: true } as MediaQueryListEvent)) })
    expect(cancel).toHaveBeenCalledTimes(1)
    view.rerender(<TaskFlowStep stepKey="last" title="마지막 질문" motion="forward"><button type="button">선택</button></TaskFlowStep>)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "선택" })).toBeEnabled()
    view.unmount()
    expect(removeEventListener).toHaveBeenCalled()
  })

  it("honors the existing in-app reduced-motion choice without a new preference", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const animate = vi.fn(() => ({ cancel: vi.fn() }))
    const view = render(<TaskFlowStep stepKey="first" title="첫 질문"><button type="button">선택</button></TaskFlowStep>)
    Object.defineProperty(screen.getByRole("region", { name: "첫 질문" }), "animate", { configurable: true, value: animate })
    try {
      act(() => {
        localStorage.setItem("trainoracle.calendar-reduced-motion.v1", "true")
        window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
      })
      view.rerender(<TaskFlowStep stepKey="next" title="다음 질문" motion="forward"><button type="button">선택</button></TaskFlowStep>)
      expect(animate).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "선택" })).toBeEnabled()
    } finally {
      act(() => {
        localStorage.removeItem("trainoracle.calendar-reduced-motion.v1")
        window.dispatchEvent(new StorageEvent("storage", { key: "trainoracle.calendar-reduced-motion.v1" }))
      })
    }
  })
})
