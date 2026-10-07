import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanCandidates } from "./PlanCandidates"
import * as catalog from "./CatalogWorkoutPicker"
import * as methods from "./PlanMethodPicker"
import * as pace from "./PaceEvidenceFlow"
import * as templates from "./plan-template-options"
import * as store from "../../domain/plan-beta-store"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null)
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); setActiveLocalAccount(null) })

function fixture(detailed = false): React.ComponentProps<typeof PlanCandidates> {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9, trainingFocus: "VO2_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error("Expected generated fixture")
  const option = resolveDetailedPlanTemplateOptions(result.intake)[0]
  if (!option) throw Error("Expected approved detailed option")
  return {
    generated: result.generated, intake: { ...result.intake, selectedDetailedTemplateRef: detailed ? option.ref : null },
    athleteEvidence: result.athleteEvidence, prescriptionBinding: result.prescriptionBinding,
    athleteRecords: [], selectedRecordId: null, comparisonRecordId: null, recordConfirmationPending: detailed,
    onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(), onChangeMethod: vi.fn(),
    onBack: vi.fn(), onSelect: vi.fn(), onCatalogChange: vi.fn(),
  }
}
const toggleWorkout = () => fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))

describe("deferred workout editors on a candidate result", () => {
  it("does not mount unused catalog and method editors before opening workout controls", () => {
    const catalogRender = vi.spyOn(catalog, "CatalogWorkoutPicker")
    const methodRender = vi.spyOn(methods, "PlanMethodPicker")
    const props = fixture()
    const resolve = vi.spyOn(templates, "resolveDetailedPlanTemplateOptions")
    const history = vi.spyOn(store, "loadPlanMethodHistorySnapshot")
    render(<PlanCandidates {...props} />)
    expect(catalogRender).not.toHaveBeenCalled()
    expect(methodRender).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
    expect(history).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "일정 바꾸기" }))
    expect(screen.getByLabelText("계획 시작 날짜")).toBeEnabled()
    expect(catalogRender).not.toHaveBeenCalled()
    expect(methodRender).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
    expect(history).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(props.onSelect).toHaveBeenCalledTimes(1)
  })

  it("mounts record evidence on the existing review action without confirming or selecting silently", () => {
    const methodRender = vi.spyOn(methods, "PlanMethodPicker")
    const paceRender = vi.spyOn(pace, "PaceEvidenceFlow")
    const props = fixture(true)
    render(<PlanCandidates {...props} />)
    expect(methodRender).not.toHaveBeenCalled()
    expect(paceRender).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
    expect(screen.getByRole("region", { name: "개인 페이스 기준 기록" })).toBeVisible()
    expect(methodRender).toHaveBeenCalled()
    expect(paceRender).toHaveBeenCalled()
    expect(props.onConfirmRecord).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it("keeps the same unaccepted method editor and save block through collapse and reopen", () => {
    const props = fixture()
    render(<PlanCandidates {...props} />)
    toggleWorkout()
    fireEvent.click(screen.getByRole("button", { name: "기록으로 페이스 받기" }))
    const apply = screen.getByRole("button", { name: "이 훈련으로 변경" })
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    toggleWorkout()
    expect(apply).not.toBeVisible()
    expect(apply).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    toggleWorkout()
    expect(screen.getByRole("button", { name: "이 훈련으로 변경" })).toBe(apply)
    expect(screen.getByRole("region", { name: "훈련 미리보기" })).toBeVisible()
    expect(props.onChangeMethod).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it("keeps a changed catalog choice mounted and unaccepted through collapse and reopen", () => {
    const props = fixture()
    render(<PlanCandidates {...props} />)
    toggleWorkout()
    const choice = screen.getByRole("combobox", { name: "훈련 구성" }) as HTMLSelectElement
    const alternative = [...choice.options].find(option => option.value !== choice.value)
    if (!alternative) throw Error("Expected another approved catalog choice")
    fireEvent.change(choice, { target: { value: alternative.value } })
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    toggleWorkout()
    expect(choice).not.toBeVisible()
    expect(choice).toBeInTheDocument()
    toggleWorkout()
    expect(screen.getByRole("combobox", { name: "훈련 구성" })).toBe(choice)
    expect(choice).toHaveValue(alternative.value)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(props.onCatalogChange).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
  })
})
