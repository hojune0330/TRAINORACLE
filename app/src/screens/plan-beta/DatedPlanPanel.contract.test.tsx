import { useState } from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { DatedPlanPanel } from "./DatedPlanPanel"

beforeEach(() => {
  localStorage.clear()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") }
})
afterEach(cleanup)
const sessions = [
  { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT" },
  { day: 1, slot: "PM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT" },
  { day: 2, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT" },
] as const

function Harness() {
  const [day, setDay] = useState(1)
  return <DatedPlanPanel start="2026-09-30" sessions={sessions} day={day} onDayChange={setDay} notice={<p role="alert">몸 상태를 먼저 확인해 주세요</p>}>
    {sessions.filter(session => session.day === day).map(session => <section key={session.slot} data-session-slot={session.slot} tabIndex={-1}>
      <h3>{day}일차 {session.slot} 상세</h3>
    </section>)}
  </DatedPlanPanel>
}

it("shows adjusted AM/PM in a real cross-month calendar, with safety notice in the reader", () => {
  const before = JSON.stringify(sessions)
  render(<Harness />)
  fireEvent.click(within(screen.getByRole("grid")).getByRole("button", { name: /2026년 9월 30일 수요일/ }))
  const reader = screen.getByRole("dialog")
  expect(within(reader).getByRole("alert")).toBeVisible()
  expect(within(reader).getByRole("navigation", { name: "오전·오후 바로가기" })).toBeVisible()
  expect(within(reader).getByText("1일차 AM 상세")).toBeVisible()
  expect(within(reader).getByText("1일차 PM 상세")).toBeVisible()
  fireEvent.click(within(reader).getByRole("button", { name: "크게 보기 다음 날짜" }))
  expect(reader).toHaveAccessibleName("2026년 10월 1일 목요일")
  expect(within(reader).getByText("2일차 AM 상세")).toBeVisible()
  expect(within(reader).queryByText("1일차 PM 상세")).not.toBeInTheDocument()
  fireEvent.click(within(reader).getByRole("button", { name: "크게 보기 다음 날짜" }))
  expect(within(reader).getByText("이 계획에는 이날 예정된 훈련이 없어요.")).toBeVisible()
  expect(within(reader).queryByText("2일차 AM 상세")).not.toBeInTheDocument()
  expect(JSON.stringify(sessions)).toBe(before)
  expect(localStorage.length).toBe(0)
})
