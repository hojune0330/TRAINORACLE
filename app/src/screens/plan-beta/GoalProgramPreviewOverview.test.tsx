import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { createGoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { GoalProgramPreviewOverview, GoalProgramSession } from "./GoalProgramPreviewOverview"

function fixture() {
  const result = createGoalTrainingProgramPreview({ goalMinutes: 30, dateChoice: { kind: "START", startDate: "2026-10-24" },
    today: "2026-10-24", generatedAt: "2026-10-24T00:00:00.000Z", experienceBand: "EXPERIENCED",
    availableDayCount: 3, trainingTimePreference: "VARIES", goalPaceConfirmed: true })
  if (result.kind !== "preview") throw new Error(result.kind)
  return result.preview
}
type ProgramDay = ReturnType<typeof fixture>["days"][number]
function firstWorkout() {
  return fixture().days.find(day => day.session.role !== "REST")!
}
function showSession(day: ProgramDay = firstWorkout()) {
  const changed = vi.fn()
  function Session() {
    const [stepIndex, setStep] = React.useState(0)
    return <GoalProgramSession session={day.session} date={day.date} label="첫 훈련" stepIndex={stepIndex}
      onStepChange={index => { changed(index); setStep(index) }} />
  }
  render(<Session />)
  return { day, changed }
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe("goal preview summary and shared prescription", () => {
  it("counts actual source days and separates initial defaults from personal recommendations", () => {
    const source = fixture(), before = JSON.stringify(source), edit = vi.fn()
    const view = render(<GoalProgramPreviewOverview source={source} scheduleOrigin="DEFAULT"
      onEditSchedule={edit} onEditBasis={vi.fn()} />)
    const composition = screen.getByRole("region", { name: "계획 구성" })
    expect(composition).toHaveTextContent("훈련 9회")
    expect(composition).toHaveTextContent("휴식 20일")
    expect(composition).toHaveTextContent("훈련일 기본값")
    fireEvent.click(screen.getByText("계획을 만든 기준"))
    expect(screen.getByText(/개인에게 필요한 횟수를 계산한 값은 아니에요/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "훈련 횟수 바꾸기" }))
    expect(edit).toHaveBeenCalledOnce()
    expect(screen.queryByRole("region", { name: "선택한 훈련 구간" })).not.toBeInTheDocument()
    view.rerender(<GoalProgramPreviewOverview source={source} scheduleOrigin="USER" />)
    expect(composition).toHaveTextContent("훈련할 날 수는 직접 선택한 값이에요.")
    expect(composition).not.toHaveTextContent("훈련일 기본값")
    view.rerender(<GoalProgramPreviewOverview source={source} />)
    expect(composition).toHaveTextContent("직접 선택인지 기본값인지는 확인할 수 없어요.")
    expect(JSON.stringify(source)).toBe(before)
  })

  it("shows every verified source step immediately, keeping the exact recovery without extra repeats or warmup", () => {
    const day = firstWorkout(), before = JSON.stringify(day)
    const binding = day.session.prescription.kind === "RPE_TIME_RANGE" && day.session.prescription.catalogWorkout
    if (!binding) throw new Error("Expected a bound first workout")
    const calculated = resolveCatalogBinding(binding)!
    // The real generated first workout is the catalog's 22 + 2 + 23 minute session.
    expect(calculated.steps.map(step => step.seconds?.minimum)).toEqual([1320, 120, 1380])
    showSession(day)
    const sequence = screen.getByRole("list", { name: "전체 훈련 순서" })
    const rows = within(sequence).getAllByRole("listitem")
    expect(rows).toHaveLength(calculated.steps.length)
    rows.forEach(row => expect(row).toBeVisible())
    expect(rows[0]).toHaveTextContent("달리기 · 22분")
    expect(rows[1]).toHaveTextContent("걷기 · 2분")
    expect(rows[2]).toHaveTextContent("달리기 · 23분")
    expect(sequence).not.toHaveTextContent("걷기 120초")
    expect(sequence).not.toHaveTextContent("준비")
    expect(sequence).not.toHaveTextContent("정리")
    expect(screen.getByText("총 47분")).toBeVisible()
    expect(screen.getByRole("button", { name: "순서 미리보기" })).not.toBeVisible()
    expect(JSON.stringify(day)).toBe(before)
  })

  it("replays only on request, stops at the last step, and does nothing when the same step is selected", () => {
    vi.useFakeTimers()
    const { changed } = showSession()
    const steps = within(screen.getByRole("list", { name: "전체 훈련 순서" })).getAllByRole("button")
    act(() => { vi.advanceTimersByTime(5400) })
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(steps[0]!)
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("구간 순서 재생"))
    expect(screen.getByRole("button", { name: "순서 미리보기" })).toBeVisible()
    act(() => { vi.advanceTimersByTime(1800) })
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "순서 미리보기" }))
    act(() => { vi.advanceTimersByTime(1800) })
    expect(changed).toHaveBeenLastCalledWith(1)
    expect(steps[1]).toHaveAttribute("aria-pressed", "true")
    act(() => { vi.advanceTimersByTime(1800) })
    expect(changed).toHaveBeenLastCalledWith(2)
    act(() => { vi.advanceTimersByTime(1800) })
    expect(screen.getByRole("button", { name: "순서 미리보기" })).toBeVisible()
    expect(changed).toHaveBeenCalledTimes(2)
    fireEvent.click(steps[2]!)
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it("keeps all steps and manual navigation when reduced motion removes automatic playback", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const { changed } = showSession()
    expect(within(screen.getByRole("list", { name: "전체 훈련 순서" })).getAllByRole("listitem")).toHaveLength(3)
    fireEvent.click(screen.getByText("구간 순서 재생"))
    expect(screen.queryByRole("button", { name: "순서 미리보기" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "다음 구간" }))
    expect(changed).toHaveBeenLastCalledWith(1)
    expect(screen.getByRole("status")).toHaveTextContent("2 / 3구간 · 걷기")
    fireEvent.click(screen.getByRole("button", { name: "이전 구간" }))
    expect(changed).toHaveBeenLastCalledWith(0)
  })

  it("does not show unverified steps or substitute the old duration when the catalog fingerprint is damaged", () => {
    const day = firstWorkout()
    if (day.session.role === "REST" || day.session.prescription.kind !== "RPE_TIME_RANGE" || !day.session.prescription.catalogWorkout) throw new Error("Missing binding")
    const damaged: ProgramDay = { ...day, session: { ...day.session, prescription: {
      ...day.session.prescription, durationMinutes: { minimum: 123, maximum: 123 },
      catalogWorkout: { ...day.session.prescription.catalogWorkout, catalogFingerprint: "invalid" },
    } } }
    showSession(damaged)
    expect(screen.getByRole("alert")).toHaveTextContent("구간을 확인하지 못했어요")
    expect(screen.queryByRole("list", { name: "전체 훈련 순서" })).not.toBeInTheDocument()
    expect(screen.queryByText("구간 순서 재생")).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "선택한 훈련 구간" })).not.toHaveTextContent(/123분|47분|22분|23분/)
  })

  it("shows explicit rest without workout steps, playback, or invented recovery tasks", () => {
    const rest = fixture().days.find(day => day.session.role === "REST")!
    showSession(rest)
    expect(screen.getByRole("region", { name: "선택한 날짜의 휴식" })).toHaveTextContent("이 날짜에는 훈련이 배치되지 않았어요.")
    expect(screen.queryByRole("list", { name: "전체 훈련 순서" })).not.toBeInTheDocument()
    expect(screen.queryByText("구간 순서 재생")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
