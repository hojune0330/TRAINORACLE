import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import { PlannedSegmentEditor } from "./PlannedSegmentEditor"
import { usePlannedNumberInputs } from "./planned-number-input"
import type { ExerciseLog } from "../../domain/exercise-log"
import type { PlannedSessionLink } from "../../domain/planned-session-link"

const workout = calculateCatalogWorkout("X-VO2-08", { eventDistanceM: 5000, experience: "EXPERIENCED",
  availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [] })!
const link = { plannedSessionId: `sha256:${"a".repeat(64)}`, sessionContentFingerprint: `sha256:${"b".repeat(64)}` } as PlannedSessionLink
afterEach(cleanup)
function Harness() {
  const [value, setValue] = React.useState<ExerciseLog>({ version: 1, source: "SELF_REPORTED", components: [] })
  const inputs = usePlannedNumberInputs()
  return <><PlannedSegmentEditor workout={workout} link={link} value={value} onChange={setValue} inputs={inputs} />
    <output data-testid="record">{JSON.stringify(value)}</output>
    <button onClick={inputs.revealFirstInvalid}>잘못된 입력으로 이동</button>
    <button disabled={inputs.invalidKeys.length > 0}>기록 저장</button></>
}
const read = () => JSON.parse(screen.getByTestId("record").textContent!) as ExerciseLog
describe("optional catalog segment input", () => {
  it("jumps directly to the last work/recovery page without filling missing actual values", () => {
    render(<Harness />)
    fireEvent.click(screen.getByText("구간별로 자세히 남기기"))
    const steps = workout.steps.filter(s => s.phase === "main")
    expect(steps.length).toBeGreaterThan(30)
    const jump = screen.getByRole("combobox", { name: "세트·구간 바로 이동" })
    fireEvent.change(jump, { target: { value: String(Math.ceil(steps.length / 2) - 1) } })
    expect(screen.getByLabelText(`${steps.length}번 운동 구간 실제 시간`)).toHaveValue("")
    expect(read().plannedSegments).toBeUndefined()
  })
  it("retains invalid input across jumps and prevents final save until corrected", () => {
    render(<Harness />); fireEvent.click(screen.getByText("구간별로 자세히 남기기"))
    const field = () => screen.getByLabelText("1번 운동 구간 실제 시간")
    fireEvent.change(field(), { target: { value: "15.4" } })
    fireEvent.change(field(), { target: { value: "-1" } })
    expect(field()).toHaveValue("-1")
    expect(screen.getByRole("alert")).toHaveTextContent("0보다 크고")
    expect(screen.getByRole("button", { name: "기록 저장" })).toBeDisabled()
    expect(read().plannedSegments?.results[0]?.seconds).toBe(15.4)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "12" } })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "0" } })
    expect(field()).toHaveValue("-1")
    fireEvent.change(field(), { target: { value: "15.5" } })
    expect(screen.getByRole("button", { name: "기록 저장" })).toBeEnabled()
    expect(read().plannedSegments?.results[0]?.seconds).toBe(15.5)
  })
  it("accepts zero recovery but rejects zero work and fractional RPE without losing drafts", () => {
    render(<Harness />); fireEvent.click(screen.getByText("구간별로 자세히 남기기"))
    fireEvent.change(screen.getByLabelText("2번 회복 구간 실제 시간"), { target: { value: "0" } })
    expect(read().plannedSegments?.results[0]?.seconds).toBe(0)
    fireEvent.change(screen.getByLabelText("1번 운동 구간 RPE"), { target: { value: "5.5" } })
    expect(screen.getByRole("alert")).toHaveTextContent("1~10 사이 정수")
    fireEvent.change(screen.getByLabelText("1번 운동 구간 RPE"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("1번 운동 구간 실제 시간"), { target: { value: "0" } })
    expect(screen.getByRole("button", { name: "기록 저장" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("1번 운동 구간 실제 시간"), { target: { value: "" } })
    expect(screen.getByRole("button", { name: "기록 저장" })).toBeEnabled()
    expect(read().plannedSegments?.results).toHaveLength(1)
  })
  it("opens the hidden page and focuses the invalid field only after a correction request", () => {
    render(<Harness />); fireEvent.click(screen.getByText("구간별로 자세히 남기기"))
    fireEvent.change(screen.getByLabelText("1번 운동 구간 실제 시간"), { target: { value: "-1" } })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "12" } })
    fireEvent.click(screen.getByText("구간별로 자세히 남기기"))
    fireEvent.click(screen.getByRole("button", { name: "잘못된 입력으로 이동" }))
    expect(screen.getByLabelText("1번 운동 구간 실제 시간")).toHaveFocus()
    expect(screen.getByLabelText("1번 운동 구간 실제 시간").closest("details")).toHaveAttribute("open")
    expect(screen.getByLabelText("1번 운동 구간 실제 시간")).toHaveValue("-1")
  })
})
