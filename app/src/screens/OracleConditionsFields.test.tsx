import React from "react"
import { fireEvent, render, screen, cleanup } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { OracleConditionsFields, type OracleConditionsHandle } from "./OracleConditionsFields"
import type { OracleProfileContext } from "../domain/oracle-profile-context"
import type { AthleteRecord } from "../domain/athlete-records"

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

function StatefulConditions({ kind = "event", initial = {}, records = [] }: {
  kind?: "race" | "event" | "meeting"; initial?: OracleProfileContext["conditions"]; records?: AthleteRecord[]
}) {
  const [value, setValue] = React.useState(initial)
  const ref = React.useRef<OracleConditionsHandle>(null)
  return <><OracleConditionsFields ref={ref} kind={kind} value={value} records={records} onChange={setValue} />
    <button onClick={() => ref.current?.finish()}>검사용 입력 마치기</button><output data-testid="conditions-state">{JSON.stringify(value)}</output></>
}

it("keeps a pending new event when switching to edit another saved row", () => {
  render(<StatefulConditions initial={{ events: [{ id: "synthetic-existing", date: "2026-10-20" }] }} />)
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-24" } })
  fireEvent.change(screen.getByLabelText("이동 시간 (분) · 선택"), { target: { value: "60" } })
  fireEvent.click(screen.getByRole("button", { name: "2026-10-20 일정 수정" }))
  expect(JSON.parse(screen.getByTestId("conditions-state").textContent!)).toMatchObject({ events: [
    { id: "synthetic-existing", date: "2026-10-20" }, { date: "2026-10-24", travelMinutes: 60 },
  ] })
  expect(screen.getByLabelText("날짜")).toHaveValue("2026-10-20")
})

it("does not clear the pending row when deleting a different event", () => {
  render(<StatefulConditions initial={{ events: [{ id: "synthetic-existing", date: "2026-10-20" }] }} />)
  fireEvent.change(screen.getByLabelText("날짜"), { target: { value: "2026-10-24" } })
  fireEvent.change(screen.getByLabelText("이동 시간 (분) · 선택"), { target: { value: "60" } })
  fireEvent.click(screen.getByRole("button", { name: "2026-10-20 일정 삭제" }))
  fireEvent.click(screen.getByRole("button", { name: "검사용 입력 마치기" }))
  expect(JSON.parse(screen.getByTestId("conditions-state").textContent!)).toMatchObject({ events: [{ date: "2026-10-24", travelMinutes: 60 }] })
})

it("commits the edited race conditions before switching the selected race", () => {
  const records: AthleteRecord[] = ["synthetic-race-a", "synthetic-race-b"].map((id, index) => ({
    id, schemaVersion: 1, purpose: "RECENT_RESULT", eventDistanceM: 3000, performanceSeconds: 720,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: "synthetic-test", savedAt: "2026-10-09T00:00:00Z",
    achievedOn: `2026-10-${String(index + 1).padStart(2, "0")}`, seasonId: null,
  }))
  render(<StatefulConditions kind="race" records={records} />)
  fireEvent.change(screen.getByLabelText("경기 선택"), { target: { value: records[0]!.id } })
  fireEvent.change(screen.getByLabelText("코스"), { target: { value: "TRACK" } })
  fireEvent.change(screen.getByLabelText("경기 선택"), { target: { value: records[1]!.id } })
  expect(JSON.parse(screen.getByTestId("conditions-state").textContent!)).toMatchObject({ races: [{ recordId: records[0]!.id, course: "TRACK" }] })
  fireEvent.change(screen.getByLabelText("날씨"), { target: { value: "WIND" } })
  fireEvent.click(screen.getByRole("button", { name: "검사용 입력 마치기" }))
  expect(JSON.parse(screen.getByTestId("conditions-state").textContent!)).toMatchObject({ races: [
    { recordId: records[0]!.id, course: "TRACK" }, { recordId: records[1]!.id, weather: "WIND" },
  ] })
})
