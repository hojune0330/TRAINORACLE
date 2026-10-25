import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanIntakeMode } from "./PlanIntakeMode"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("plan entry mode choice", () => {
  it("keeps captions separate from stable button names and changes mode without submitting", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    function Entry() {
      const [mode, setMode] = useState<"quick" | "precision">("quick")
      return <form onSubmit={onSubmit}><PlanIntakeMode value={mode} onChange={next => { onChange(next); setMode(next) }} /></form>
    }
    render(<Entry />)
    const quick = screen.getByRole("button", { name: "간단히" })
    const precision = screen.getByRole("button", { name: "직접 설정" })
    const quickMark = quick.querySelector(".plan-intake-mode__check")
    const precisionMark = precision.querySelector(".plan-intake-mode__check")
    expect(quick).toHaveAttribute("aria-pressed", "true")
    expect(quick).toHaveAccessibleDescription("기본 질문만")
    expect(precision).toHaveAccessibleDescription("일정·구성도 조절")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    precision.focus()
    await user.keyboard(" ")
    expect(precision).toHaveAttribute("aria-pressed", "true")
    expect(quick).toHaveAttribute("aria-pressed", "false")
    expect(quick.querySelector(".plan-intake-mode__check")).toBe(quickMark)
    expect(precision.querySelector(".plan-intake-mode__check")).toBe(precisionMark)
    expect(precision).toHaveFocus()
    expect(screen.getByText("종목·기록을 고른 뒤, 일정과 훈련 구성을 차례로 설정해요.")).toBeVisible()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(quick)
    expect(quick).toHaveAttribute("aria-pressed", "true")
    expect(onChange.mock.calls).toEqual([["precision"], ["quick"]])
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("opens comparison only on request and restores its opener after Escape", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlanIntakeMode value="quick" onChange={onChange} />)
    const opener = screen.getByRole("button", { name: "차이 보기" })
    expect(opener).toHaveAttribute("aria-haspopup", "dialog")
    await user.click(opener)
    const dialog = screen.getByRole("dialog", { name: "입력 방식 차이" })
    expect(dialog).toHaveAttribute("open")
    expect(screen.getByRole("button", { name: "입력 방식 차이 닫기" })).toBeVisible()
    expect(dialog).toHaveTextContent("방식을 바꿔도 입력한 내용은 유지돼요.")
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).not.toBe("hidden")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not change the selected mode or open comparison while a record is being prepared", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlanIntakeMode value="quick" onChange={onChange} disabled />)
    for (const label of ["간단히", "직접 설정", "차이 보기"]) {
      const button = screen.getByRole("button", { name: label })
      expect(button).toBeDisabled()
      await user.click(button)
    }
    expect(screen.getByRole("status")).toHaveTextContent("기록을 준비하는 동안 입력 방식은 잠시 바꿀 수 없어요.")
    expect(screen.getByRole("button", { name: "간단히" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
