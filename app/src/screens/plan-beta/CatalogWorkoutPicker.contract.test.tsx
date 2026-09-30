import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import { catalogRecommendationMethodKey } from "@impl/prescription/catalog-method-selection"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "../../domain/catalog-plan-binding"
import { createSelfReportedAthleteRecord } from "../../domain/athlete-records"
import { CatalogWorkoutPicker } from "./CatalogWorkoutPicker"
import { PlanCandidates } from "./PlanCandidates"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function fixture(experienceBand: "NEW_TO_RUNNING" | "EXPERIENCED" = "EXPERIENCED") {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand, availableDayCount: 5, requestedFrameLength: 9,
    trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "VARIES",
    selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result
}
function openPicker() { fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true })) }

describe("catalog picker actionable and truthful review", () => {
  it("checks the shorter candidate budget before applying one workout to both candidates", () => {
    const source = generatePlanFromDraft({ ...fixture("NEW_TO_RUNNING").intake,
      eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 3000, availableDayCount: "EVERY_DAY",
      requestedFrameLength: 7, trainingFocus: "BASE_INTENT" }, "NO_KNOWN_RISK")
    if (source.kind !== "generated") throw Error(source.kind)
    const onChange = vi.fn()
    render(<CatalogWorkoutPicker generated={source.generated} intake={source.intake} records={[]} onChange={onChange} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "바꿀 일정" }), { target: { value: "4:AM" } })
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-BASE-C-1500" } })
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    fireEvent.click(screen.getByRole("checkbox", { name: /준비·회복·정리까지 최대/u }))
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(onChange).toHaveBeenCalledOnce()
    const candidates = onChange.mock.calls[0]![0].candidates
    for (const candidate of candidates) {
      const prescription = candidate.sessions.find((s: { day: number; slot: string }) => s.day === 4 && s.slot === "AM").prescription
      expect(prescription.catalogWorkout.catalogId).toBe("P-BASE-C-1500")
      expect(prescription.durationMinutes).toEqual({ minimum: 25, maximum: 25 })
    }
  })

  it("exhausts eligible unseen methods before repeating and never draws an unconfirmed alternative", () => {
    const generated = generatePlanFromDraft({ ...fixture().intake, trainingFocus: "VO2_INTENT" }, "NO_KNOWN_RISK")
    if (generated.kind !== "generated") throw Error(generated.kind)
    const session = generated.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("fixture")
    const inputs = { eventDistanceM: 5000, experience: "EXPERIENCED" as const, availableSeconds: (session.prescription.catalogWorkout?.originalEnvelope.durationMinutes.maximum ?? session.prescription.durationMinutes.maximum) * 60,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] }
    const eligible = ALL_WORKOUT_CATALOG.filter(e => e.family === "VO2" && !calculateCatalogWorkout(e.id, inputs)?.unavailable.length)
    const methodCount = new Set(eligible.map(catalogRecommendationMethodKey)).size
    expect(methodCount).toBeGreaterThan(2)
    vi.spyOn(Math, "random").mockReturnValue(0)
    render(<CatalogWorkoutPicker generated={generated.generated} intake={generated.intake} records={[]} onChange={vi.fn()} />)
    openPicker()
    const select = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    const seen = new Set([catalogRecommendationMethodKey(ALL_WORKOUT_CATALOG.find(e => e.id === select.value)!)])
    for (let index = 1; index < methodCount; index++) {
      fireEvent.click(screen.getByRole("button", { name: "같은 목적의 다른 훈련" }))
      const entry = ALL_WORKOUT_CATALOG.find(e => e.id === select.value)!
      const identity = catalogRecommendationMethodKey(entry)
      expect(seen.has(identity)).toBe(false)
      expect(calculateCatalogWorkout(entry.id, inputs)?.unavailable).toEqual([])
      seen.add(identity)
    }
  })

  it("explains an empty immediate draw pool without inventing equipment confirmation", () => {
    const generated = generatePlanFromDraft({ ...fixture("NEW_TO_RUNNING").intake, trainingFocus: "ATP_PC_INTENT" }, "NO_KNOWN_RISK")
    if (generated.kind !== "generated") throw Error(generated.kind)
    render(<CatalogWorkoutPicker generated={generated.generated} intake={generated.intake} records={[]} onChange={vi.fn()} />)
    openPicker()
    const select = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    const original = select.value
    const draw = screen.getByRole("button", { name: "같은 목적의 다른 훈련" })
    expect(draw).toBeDisabled()
    fireEvent.click(draw)
    expect(select.value).toBe(original)
    expect(screen.getByText(/지금 바로 바꿀 수 있는 다른 구성이 없어요/)).toBeVisible()
  })
  it("never offers a workout outside the selected event or experience", () => {
    const source = fixture("NEW_TO_RUNNING")
    render(<CatalogWorkoutPicker generated={source.generated} intake={source.intake} records={[]} onChange={vi.fn()} />)
    openPicker()
    const select = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    expect(select.options.length).toBeGreaterThan(0)
    for (const option of Array.from(select.options)) {
      const entry = ALL_WORKOUT_CATALOG.find(row => row.id === option.value)!
      expect(entry.eventDistances, entry.id).toContain(5000)
      expect(entry.experience, entry.id).toContain("NEW_TO_RUNNING")
      expect(entry.hold, entry.id).toBeNull()
    }
  })

  it("keeps required unresolved targets visible instead of hiding why apply is disabled", () => {
    const source = fixture()
    render(<CatalogWorkoutPicker generated={source.generated} intake={source.intake} records={[]} onChange={vi.fn()} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "X-LT-01" } })
    expect(screen.getByRole("spinbutton", { name: /1000m 운동 구간/u })).toBeVisible()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  })

  it("restores the exact applied record and duration acceptance when revisiting a workout", () => {
    const source = fixture()
    const record = createSelfReportedAthleteRecord({ id: "review-current-5k", purpose: "RECENT_RESULT", eventDistanceM: 5000,
      performanceSeconds: 1111.7, achievedOn: "2026-09-01", seasonId: null }, new Date("2026-09-30T03:00:00Z"))!
    const session = source.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    const changed = replaceCandidateCatalogWorkout(source.generated, session, "X-LT-01", {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null, confirmedRequirements: [], segmentPaces: [],
      fiveK: { recordId: record.id, seconds: record.performanceSeconds, achievedAt: record.achievedOn!, evaluatedAt: "2026-09-30" },
    }, true)
    expect(changed).not.toBeNull()
    render(<CatalogWorkoutPicker generated={changed!} intake={source.intake} records={[record]} onChange={vi.fn()} />)
    openPicker()
    expect(screen.getByRole("combobox", { name: "참고 페이스에 사용할 5km 기록" })).toHaveValue(record.id)
    expect(screen.getByRole("checkbox", { name: /준비·회복·정리까지 최대/u })).toBeChecked()
    expect(screen.queryByRole("spinbutton")).toBeNull()
  })

  it("blocks plan finalization for an unapplied workout draft and offers explicit discard", () => {
    const source = fixture()
    const onSelect = vi.fn()
    render(<PlanCandidates generated={source.generated} intake={source.intake} athleteEvidence={source.athleteEvidence}
      athleteRecords={[]} selectedRecordId={null} comparisonRecordId={null} prescriptionBinding={source.prescriptionBinding}
      recordConfirmationPending={false} onSelectRecord={vi.fn()} onCompareRecord={vi.fn()} onConfirmRecord={vi.fn()}
      onBack={vi.fn()} onSelect={onSelect} onCatalogChange={vi.fn()} startDateValue="2026-09-30" />)
    fireEvent.click(screen.getByRole("button", { name: "처방 확인·조절" }))
    expect(screen.getByText("다른 훈련으로 바꾸기", { exact: true }).closest("details")).toHaveAttribute("open")
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "X-LT-01" } })
    expect(screen.getByRole("button", { name: "이 계획으로 시작하기" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "바꿀 일정" })).toBeDisabled()
    expect(screen.getByText("바꾼 훈련을 적용하거나 취소해 주세요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
    expect(screen.getByRole("button", { name: "이 계획으로 시작하기" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(screen.getByRole("combobox", { name: "바꿀 일정" })).toBeEnabled()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
