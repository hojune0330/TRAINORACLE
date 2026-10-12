import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanIntake, type IntakeStep } from "./PlanIntake"
import * as templates from "./plan-template-options"
import * as store from "../../domain/plan-beta-store"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

const draft: store.PlanBetaIntake = { eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
  experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
  trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING",
  selectedDetailedTemplateRef: null }
const callbacks = () => ({
  onBack: vi.fn(), onGoal: vi.fn(), onDivision: vi.fn(), onExperience: vi.fn(), onFocus: vi.fn(),
  onTemplate: vi.fn(), onDays: vi.fn(), onFrameLength: vi.fn(), onTrainingTime: vi.fn(),
  onSecondSession: vi.fn(), onManageRecords: vi.fn(), onOpenNotationReader: vi.fn(),
  onSafety: vi.fn(), onContinue: vi.fn(),
})

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); setActiveLocalAccount(null) })

describe("intake rendering only the requested question", () => {
  it.each(["goal", "experience", "days", "safety", "preview", "division", "focus", "frame-length", "training-time", "two-a-day", "race-date"] as const satisfies readonly IntakeStep[])(
    "%s does not resolve unused template recommendations or scan their stored history", step => {
      const resolve = vi.spyOn(templates, "resolveDetailedPlanTemplateOptions")
      const history = vi.spyOn(store, "loadPlanMethodHistorySnapshot")
      render(<PlanIntake step={step} draft={draft} {...callbacks()} />)
      expect(screen.getByRole("heading", { level: 1 })).toBeVisible()
      expect(resolve).not.toHaveBeenCalled()
      expect(history).not.toHaveBeenCalled()
    },
  )

  it("still resolves the current template recommendations and selects the same approved option", () => {
    const expected = templates.resolveDetailedPlanTemplateOptions(draft)
    expect(expected).toHaveLength(1)
    const expectedOption = expected[0]
    if (expectedOption === undefined) throw Error("Expected the approved template option")
    const resolve = vi.spyOn(templates, "resolveDetailedPlanTemplateOptions")
    const history = vi.spyOn(store, "loadPlanMethodHistorySnapshot")
    const actions = callbacks()
    render(<PlanIntake step="template" draft={draft} {...actions} />)
    const currentQuestionCalls = resolve.mock.calls.flatMap(([value], index) => value === draft ? [index] : [])
    expect(currentQuestionCalls).toHaveLength(1)
    expect(history).toHaveBeenCalled()
    const currentQuestionCall = currentQuestionCalls[0]
    if (currentQuestionCall === undefined) throw Error("Expected the current template resolution")
    expect(resolve.mock.results[currentQuestionCall]?.value).toEqual(expected)
    expect(screen.getByText(expectedOption.notation, { selector: "code" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /5000m 경기 페이스 상세 훈련 포함/u }))
    expect(actions.onTemplate).toHaveBeenCalledExactlyOnceWith(expectedOption.ref)
  })
})
