import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG, type WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import * as binding from "@impl/prescription/catalog-session-binding"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { sessionExecutionSteps } from "../plan-beta/labels"
import { TrainingHome } from "./TrainingHome"

function splitEasy(): PlanSession {
  const source = ALL_WORKOUT_CATALOG.find(entry => entry.id === "X-BASE-09")!
  const session: PlanSession = { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 60, maximum: 60 } } }
  const result = binding.bindCatalogSession(session, source.id, {
    eventDistanceM: 10000, experience: source.experience[0] as WorkoutCalculationInputs["experience"],
    availableSeconds: null, confirmedRequirements: [], fiveK: null, segmentPaces: [],
  }, true)
  if (!result) throw Error("Expected a verified synthetic Split Easy session")
  return result
}
function model(session = splitEasy(), date = "2026-10-18"): TrainingHomeViewModel {
  if (session.role === "REST") throw Error("Expected a training session")
  return { homeMode: "TRAINING", todayMessage: "", todayRecordCount: 0, journalSummary: "", flowSummary: "",
    planSummary: "", analysisSummary: "", showMinjiPrompt: true, briefing: "",
    nextTraining: { date, session, laterSameDaySession: { ...session, slot: "PM" } } }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T12:00:00")) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe("compact home training destination", () => {
  it("uses the verified 47-minute total including walking, while keeping the full prescription and destination", () => {
    const session = splitEasy()
    const source = model(session)
    const before = JSON.stringify(source)
    const open = vi.fn()
    render(<TrainingHome model={source} introductionAllowed={false} onOpenNextTraining={open} />)
    const card = screen.getByRole("button", { name: /^다음 훈련 ·/ })
    const section = screen.getByRole("region", { name: "다음 훈련" })
    expect(section.querySelector("time")).toHaveTextContent(/^오늘$/)
    expect(section.querySelector("time")).toHaveAttribute("datetime", "2026-10-18")
    expect(card).toHaveTextContent("중간 걷기 조깅 · Split Easy")
    expect(card).toHaveAccessibleDescription("총 47분")
    expect(card).toHaveAccessibleName(/오늘\(10월 18일\).*오전.*기본/)
    expect(card.textContent).not.toMatch(/오늘|오전|기본|훈련 내용 보기|오후 훈련도|RPE|3–4/)
    const full = sessionExecutionSteps(session, true)
    expect(full.map(step => step.detail).join(" ")).toMatch(/22분.*2분 걷기.*23분/)
    expect(full.map(step => step.detail).join(" ")).toContain("힘든 정도(RPE) 3–4/10")
    fireEvent.click(card)
    expect(open).toHaveBeenCalledOnce()
    expect(JSON.stringify(source)).toBe(before)
    expect(source.nextTraining!.laterSameDaySession!.slot).toBe("PM")
  })

  it.each([["2026-10-19", "내일"], ["2026-10-21", "10월 21일"], ["2027-01-01", "2027년 1월 1일"]])(
    "keeps one unambiguous date for %s", (date, label) => {
      render(<TrainingHome model={model(splitEasy(), date)} introductionAllowed={false} />)
      expect(screen.getByRole("region", { name: "다음 훈련" }).querySelector("time")).toHaveTextContent(label)
    })

  it("shows a corrupt binding warning rather than reusing the old 60-minute envelope", () => {
    const session = splitEasy()
    if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("Expected binding")
    const invalid = { ...session, prescription: { ...session.prescription, catalogWorkout: {
      ...session.prescription.catalogWorkout, calculationFingerprint: "invalid-synthetic-fingerprint",
    } } } as PlanSession
    render(<TrainingHome model={model(invalid)} introductionAllowed={false} />)
    const card = screen.getByRole("button", { name: /^다음 훈련 ·/ })
    expect(card).toHaveAccessibleDescription("훈련 내용 확인 필요")
    expect(card).not.toHaveTextContent(/총 47분|총 60분/)
  })

  it("does not invent a total when the verified calculation has unresolved duration", () => {
    const session = splitEasy()
    if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("Expected binding")
    const calculation = binding.resolveCatalogBinding(session.prescription.catalogWorkout)!
    vi.spyOn(binding, "resolveCatalogBinding").mockReturnValue({ ...calculation, totals: { ...calculation.totals, seconds: null } })
    render(<TrainingHome model={model(session)} introductionAllowed={false} />)
    expect(screen.getByRole("button", { name: /^다음 훈련 ·/ })).toHaveAccessibleDescription("시간 확인 필요")
  })
})
