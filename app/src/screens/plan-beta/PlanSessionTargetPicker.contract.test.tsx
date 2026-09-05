import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlanSessionTargetPicker } from "./PlanSessionTargetPicker"

afterEach(cleanup)

describe("detailed session target choice", () => {
  const targets = [{ day: 2, slot: "AM" }, { day: 5, slot: "PM" }] as const
  it("shows calendar dates and keeps AM/PM separate while forwarding the exact choice", () => {
    const onChange = vi.fn()
    render(<PlanSessionTargetPicker targets={targets} selected={null} startDate="2026-09-05" onChange={onChange} />)
    fireEvent.click(screen.getByText("상세 훈련을 적용할 날"))
    expect(screen.getByRole("radio", { name: "09/06 (일) 오전" })).toBeChecked()
    fireEvent.click(screen.getByRole("radio", { name: "09/09 (수) 오후" }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 날짜에 적용" }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ day: 5, slot: "PM" })
  })
  it("preserves a selected slot when the calendar start changes", () => {
    const props = { targets, selected: targets[1], onChange: vi.fn() }
    const view = render(<PlanSessionTargetPicker {...props} startDate="2026-09-05" />)
    fireEvent.click(screen.getByText("상세 훈련을 적용할 날"))
    view.rerender(<PlanSessionTargetPicker {...props} startDate="2026-09-06" />)
    expect(screen.getByRole("radio", { name: "09/10 (목) 오후" })).toBeChecked()
    expect(props.onChange).not.toHaveBeenCalled()
  })
  it("does not invent dates or a second choice", () => {
    const view = render(<PlanSessionTargetPicker targets={targets} selected={null} startDate="" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("상세 훈련을 적용할 날"))
    expect(screen.getByRole("radio", { name: "5일 차 오후" })).toBeInTheDocument()
    view.rerender(<PlanSessionTargetPicker targets={[targets[0]]} selected={null} startDate="" onChange={vi.fn()} />)
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })
  it("requests a new choice instead of displaying an unavailable prior slot", () => {
    render(<PlanSessionTargetPicker targets={[targets[0]]} selected={{ day: 8, slot: "PM" }} startDate="2026-09-05" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText("상세 훈련을 적용할 날"))
    expect(screen.getByRole("status")).toHaveTextContent("적용할 날을 다시 골라주세요")
    expect(screen.getByRole("radio")).not.toBeChecked()
    expect(screen.queryByText("09/12 (토) 오후")).not.toBeInTheDocument()
  })
  it("cancels an unapplied choice without changing the plan", () => {
    const onChange = vi.fn()
    render(<PlanSessionTargetPicker targets={targets} selected={null} startDate="2026-09-05" onChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: "09/09 (수) 오후", hidden: true }))
    fireEvent.click(screen.getByRole("button", { name: "변경 취소", hidden: true }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("radio", { name: "09/06 (일) 오전", hidden: true })).toBeChecked()
  })
  it("invalidates a pending choice when its date scope changes", () => {
    const onChange = vi.fn()
    const view = render(<PlanSessionTargetPicker targets={targets} selected={null} startDate="2026-09-05" onChange={onChange} />)
    fireEvent.click(screen.getByRole("radio", { name: "09/09 (수) 오후", hidden: true }))
    view.rerender(<PlanSessionTargetPicker targets={targets} selected={null} startDate="2026-09-06" onChange={onChange} />)
    expect(screen.queryByRole("button", { name: "이 날짜에 적용", hidden: true })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
