import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GoalProgramEntry } from "./GoalProgramEntry"

afterEach(cleanup)

describe("goal program entry presentation", () => {
  it("offers 30 minutes and shows no current-record or safety fields before preview", () => {
    const onPreview = vi.fn()
    render(<GoalProgramEntry today="2026-10-11" onPreview={onPreview} onBack={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "10km, 몇 분을 목표로 할까요?" })).toBeVisible()
    expect(screen.getByText("1km에 3분")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "30분 목표" }))
    expect(screen.getByRole("heading", { name: "언제 시작할까요?" })).toBeVisible()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(onPreview).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ goalMinutes: 30,
      window: expect.objectContaining({ startDate: "2026-10-11", endDate: "2026-11-08", deadline: null }) }))
  })
  it("reverse-aligns a deadline without activating or shortening a program", () => {
    const onPreview = vi.fn()
    render(<GoalProgramEntry today="2026-10-11" onPreview={onPreview} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "50분 목표" }))
    fireEvent.click(screen.getByRole("button", { name: "대회 날짜에 맞추기" }))
    expect(screen.getByText("대회 전 훈련량은 자동으로 줄이지 않아요.")).toBeVisible()
    fireEvent.change(screen.getByLabelText("대회 날짜"), { target: { value: "2026-11-15" } })
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(onPreview.mock.calls[0]?.[0]).toMatchObject({ window: { startDate: "2026-10-18", endDate: "2026-11-15", deadline: "2026-11-15" } })
  })
  it("keeps a close deadline separate from the explicitly requested today-start alternative", () => {
    const onPreview = vi.fn()
    render(<GoalProgramEntry today="2026-10-11" onPreview={onPreview} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "60분 목표" }))
    fireEvent.click(screen.getByRole("button", { name: "대회 날짜에 맞추기" }))
    fireEvent.change(screen.getByLabelText("대회 날짜"), { target: { value: "2026-10-20" } })
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(onPreview).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("2026-09-22")
    fireEvent.click(screen.getByRole("button", { name: "오늘을 시작일로 선택" }))
    expect(onPreview.mock.calls[0]?.[0]).toMatchObject({ window: { startDate: "2026-10-11", deadline: null } })
    expect(screen.getByLabelText("대회 날짜")).toHaveValue("2026-10-20")
  })
  it("preserves the date when revisiting the goal and rereads today across midnight", () => {
    const onPreview = vi.fn()
    render(<GoalProgramEntry today="2026-10-11" readToday={() => "2026-10-12"} onPreview={onPreview} onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "45분 목표" }))
    fireEvent.click(screen.getByRole("button", { name: "시작일 선택" }))
    fireEvent.change(screen.getByLabelText("시작일"), { target: { value: "2026-10-18" } })
    fireEvent.click(screen.getByRole("button", { name: "목표 다시 선택" }))
    fireEvent.click(screen.getByRole("button", { name: "40분 목표" }))
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-10-18")
    fireEvent.click(screen.getByRole("button", { name: "오늘부터" }))
    fireEvent.click(screen.getByRole("button", { name: "다음" }))
    expect(onPreview.mock.calls[0]?.[0]).toMatchObject({ goalMinutes: 40, window: { startDate: "2026-10-12" } })
  })
})
