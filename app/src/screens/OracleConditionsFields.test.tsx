import React from "react"
import { fireEvent, render, screen, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OracleConditionsFields } from "./OracleConditionsFields"

afterEach(cleanup)
it("keeps unknown costs absent and explicitly entered zero as zero", () => {
  const change = vi.fn()
  const { rerender } = render(<OracleConditionsFields kind="event" value={{}} records={[]} onChange={change} />)
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-24" } })
  fireEvent.click(screen.getByRole("button", { name: "일정 추가" }))
  const first = change.mock.calls[0]![0]
  expect(first.events[0].cost).toBeUndefined()
  expect(first.events[0].travelMinutes).toBeUndefined()
  rerender(<OracleConditionsFields kind="event" value={first} records={[]} onChange={change} />)
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-25" } })
  fireEvent.change(screen.getByLabelText("예상 비용 · 선택"), { target: { value: "0" } })
  fireEvent.click(screen.getByRole("button", { name: "일정 추가" }))
  expect(change.mock.calls[1]![0].events[1].cost).toEqual({ amount: 0, currency: "KRW" })
})
it("does not publish invalid meeting intervals", () => {
  const change = vi.fn()
  render(<OracleConditionsFields kind="meeting" value={{}} records={[]} onChange={change} />)
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-24" } })
  fireEvent.change(screen.getByLabelText("시작"), { target: { value: "19:00" } })
  fireEvent.change(screen.getByLabelText("끝"), { target: { value: "18:00" } })
  fireEvent.click(screen.getByRole("button", { name: "시간 추가" }))
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("끝"), { target: { value: "20:00" } })
  fireEvent.click(screen.getByRole("button", { name: "시간 추가" }))
  expect(change.mock.calls[0]![0].meetingWindows).toEqual([{ date: "2026-10-24", startMinute: 1140, endMinute: 1200 }])
})
it("distinguishes unavailable records from a confirmed empty list", () => {
  const { rerender } = render(<OracleConditionsFields kind="race" value={{}} records={null} onChange={vi.fn()} />)
  expect(screen.getByText("경기 기록을 아직 확인하지 못했어요.")).toBeTruthy()
  rerender(<OracleConditionsFields kind="race" value={{}} records={[]} onChange={vi.fn()} />)
  expect(screen.getByText("경기 기록을 먼저 남기면 그날의 조건을 연결할 수 있어요.")).toBeTruthy()
})
