import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { createGoalTrainingProgramPreview, type GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { GoalProgramPreviewOverview } from "./GoalProgramPreviewOverview"

function fixture() {
  const result = createGoalTrainingProgramPreview({ goalMinutes: 30, dateChoice: { kind: "START", startDate: "2026-10-24" },
    today: "2026-10-24", generatedAt: "2026-10-24T00:00:00.000Z", experienceBand: "EXPERIENCED",
    availableDayCount: 3, trainingTimePreference: "VARIES", goalPaceConfirmed: true })
  if (result.kind !== "preview") throw new Error(result.kind)
  return result.preview
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function show(source: GoalTrainingProgramPreview = fixture()) {
  const edit = vi.fn()
  render(<GoalProgramPreviewOverview source={source} onEditSchedule={edit} onEditBasis={vi.fn()} />)
  return { source, edit }
}
describe("goal preview exploration", () => {
  it("counts actual calendar days, shows validated source steps and never changes the preview", () => {
    const source = fixture(), before = JSON.stringify(source)
    show(source)
    const composition = screen.getByRole("region", { name: "계획 구성" })
    expect(within(composition).getByText("20")).toBeVisible()
    expect(within(composition).getByText("9회")).toBeVisible()
    const first = source.days.find(day => day.session.role !== "REST")!
    const binding = first.session.prescription.kind === "RPE_TIME_RANGE" && first.session.prescription.catalogWorkout
    if (!binding) throw new Error("Expected a bound first workout")
    const calculated = resolveCatalogBinding(binding)!
    fireEvent.click(screen.getByText(`전체 ${calculated.steps.length}구간 보기`))
    expect(screen.getByRole("region", { name: "선택한 훈련 구간" }).querySelectorAll("ol > li")).toHaveLength(calculated.steps.length)
    fireEvent.click(screen.getByRole("button", { name: /2차/ }))
    expect(screen.getByRole("group", { name: "2차 훈련 선택" })).toBeVisible()
    expect(JSON.stringify(source)).toBe(before)
  })
  it("replays only on request, stops at the final segment and resets on a different workout", () => {
    vi.useFakeTimers()
    show()
    const panel = screen.getByRole("region", { name: "선택한 훈련 구간" })
    const initial = panel.textContent
    act(() => { vi.advanceTimersByTime(4000) })
    expect(panel.textContent).toBe(initial)
    fireEvent.click(screen.getByRole("button", { name: "순서 미리보기" }))
    act(() => { vi.advanceTimersByTime(1800) })
    expect(panel.textContent).toMatch(/2 \/ \d+구간/)
    fireEvent.click(screen.getByRole("button", { name: /2차/ }))
    expect(panel.textContent).toMatch(/1 \/ \d+구간/)
    expect(screen.getByRole("button", { name: "순서 미리보기" })).toBeVisible()
  })
  it("keeps manual navigation and removes automatic playback for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    show()
    expect(screen.queryByRole("button", { name: "순서 미리보기" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "다음 구간" }))
    expect(screen.getByRole("region", { name: "선택한 훈련 구간" }).textContent).toMatch(/2 \/ \d+구간/)
  })
  it("does not play a corrupted catalog snapshot or substitute its old duration", () => {
    const source = fixture()
    const first = source.days.find(day => day.session.role !== "REST")!
    if (first.session.prescription.kind !== "RPE_TIME_RANGE" || !first.session.prescription.catalogWorkout) throw new Error("Missing binding")
    const damaged = JSON.parse(JSON.stringify(source)) as GoalTrainingProgramPreview
    const day = damaged.days.find(row => row.date === first.date)!
    const session = { ...day.session, prescription: { ...day.session.prescription, catalogWorkout: {
      ...first.session.prescription.catalogWorkout, catalogFingerprint: "invalid",
    } } }
    const altered = { ...damaged, days: damaged.days.map(row => row.date === first.date ? { ...row, session } : row),
      frames: damaged.frames.map(frame => frame.cycle === first.cycle ? { ...frame, sessions: frame.sessions.map(row => row.day === first.session.day && row.slot === first.session.slot ? session : row) } : frame) } as GoalTrainingProgramPreview
    show(altered)
    expect(screen.getByRole("alert")).toHaveTextContent("구간을 확인하지 못했어요")
    expect(screen.queryByRole("button", { name: "순서 미리보기" })).not.toBeInTheDocument()
  })
})
