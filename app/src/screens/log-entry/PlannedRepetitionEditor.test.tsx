import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlannedRepetitionEditor } from "./PlannedRepetitionEditor"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { repetitionFixture, REPETITION_TEST_NOW } from "../../domain/planned-repetition.test-fixture"
import type { ExerciseLog } from "../../domain/exercise-log"
vi.mock("../../domain/journal-original-plan", () => ({ readJournalOriginalPlan: vi.fn() }))
let fixture: ReturnType<typeof repetitionFixture>
beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(REPETITION_TEST_NOW)
  fixture = repetitionFixture(); vi.useRealTimers()
  vi.mocked(readJournalOriginalPlan).mockReturnValue(fixture.original)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
function Harness() {
  const [value, setValue] = React.useState<ExerciseLog>({ version: 1, source: "SELF_REPORTED", components: [] })
  return <><PlannedRepetitionEditor entryId={fixture.entry.id} date={fixture.entry.date} link={fixture.link} value={value} onChange={setValue} />
    <output data-testid="record">{JSON.stringify(value)}</output></>
}
const read = () => JSON.parse(screen.getByTestId("record").textContent!) as ExerciseLog
describe("optional compact repetition input", () => {
  it("starts empty and only saves explicitly entered actual distance/time; page turns preserve input", () => {
    render(<Harness />)
    expect(read().plannedRepetitions).toBeUndefined()
    fireEvent.click(screen.getByText("반복별 기록 남기기"))
    expect(screen.getByLabelText("1세트 1회 실제 거리")).toHaveValue(null)
    expect(screen.getByLabelText("1세트 1회 실제 시간")).toHaveValue(null)
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 거리"), { target: { value: "1000" } })
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 시간"), { target: { value: "222.3" } })
    expect(read().plannedRepetitions?.results).toEqual([{ set: 1, repetition: 1, distanceM: 1000, seconds: 222.3 }])
    fireEvent.click(screen.getByRole("button", { name: "뒤 반복 보기" }))
    expect(screen.getByLabelText("1세트 4회 실제 거리")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "앞 반복 보기" }))
    expect(screen.getByLabelText("1세트 1회 실제 시간")).toHaveValue(222.3)
  })
  it("clears only on explicit confirmation and returns to genuinely missing evidence", () => {
    render(<Harness />); fireEvent.click(screen.getByText("반복별 기록 남기기"))
    fireEvent.change(screen.getByLabelText("1세트 1회 실제 시간"), { target: { value: "222" } })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    fireEvent.click(screen.getByRole("button", { name: "입력한 반복 기록 지우기" }))
    expect(read().plannedRepetitions).toBeDefined()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole("button", { name: "입력한 반복 기록 지우기" }))
    expect(read().plannedRepetitions).toBeUndefined()
  })
  it("does not invent a plan when the original is unavailable", () => {
    vi.mocked(readJournalOriginalPlan).mockReturnValue({ kind: "unavailable" })
    render(<Harness />)
    expect(screen.queryByText("반복별 기록 남기기")).toBeNull()
  })
})
