import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InstantPlanEntryForm } from "./InstantPlanEntryForm"

afterEach(cleanup)

describe("10km goal shortcuts", () => {
  it.each([60, 50, 45, 40, 30])("passes %i minutes as intention, never as current performance", minutes => {
    const submit = vi.fn()
    render(<InstantPlanEntryForm today="2026-10-11" onSubmit={submit} />)
    fireEvent.click(screen.getByRole("button", { name: "10km" }))
    fireEvent.click(screen.getByRole("button", { name: "목표만 있어요" }))
    expect(screen.queryByLabelText("분")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: `${minutes}분 목표` }))
    expect(submit).toHaveBeenCalledExactlyOnceWith({ kind: "GOAL_ONLY", eventDistanceM: 10000, performanceSeconds: minutes * 60 })
  })
  it("keeps custom targets available without exposing all inputs first", () => {
    const submit = vi.fn()
    render(<InstantPlanEntryForm today="2026-10-11" onSubmit={submit}
      initialEntry={{ kind: "GOAL_ONLY", eventDistanceM: 10000, performanceSeconds: 2100 }} />)
    fireEvent.click(screen.getByRole("button", { name: "다른 목표 직접 입력" }))
    expect(screen.getByLabelText("분")).toHaveValue("35")
    expect(screen.getByLabelText("분")).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: "목표 입력 완료" }))
    expect(submit).toHaveBeenCalledExactlyOnceWith({ kind: "GOAL_ONLY", eventDistanceM: 10000, performanceSeconds: 2100 })
  })
  it("does not turn a current record form into goal presets", () => {
    render(<InstantPlanEntryForm today="2026-10-11" onSubmit={vi.fn()}
      initialEntry={{ kind: "CURRENT_RECORD", eventDistanceM: 10000, performanceSeconds: 1800, achievedOn: "2026-10-01" }} />)
    expect(screen.queryByRole("group", { name: "10km 목표 선택" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("분")).toHaveValue("30")
  })
  it("does not submit a preset while the parent is saving", () => {
    const submit = vi.fn()
    render(<InstantPlanEntryForm today="2026-10-11" onSubmit={submit} isSubmitting
      initialEntry={{ kind: "GOAL_ONLY", eventDistanceM: 10000, performanceSeconds: 1800 }} />)
    fireEvent.click(screen.getByRole("button", { name: "30분 목표" }))
    expect(submit).not.toHaveBeenCalled()
  })
})
