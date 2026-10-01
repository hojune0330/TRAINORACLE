import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "../../domain/plan-beta-flow"
import { parsePlanBetaState } from "../../domain/plan-beta-schema"
import { findCatalogConditionReview } from "../../domain/catalog-condition-review"
import { PlanCandidates } from "./PlanCandidates"
import { CatalogWorkoutPicker } from "./CatalogWorkoutPicker"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)
function fixture() {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9, trainingFocus: "ATP_PC_INTENT",
    secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result
}
const spaceLabel = "가속하고 속도를 줄일 충분한 공간이 있어요"
function props(source = fixture()): React.ComponentProps<typeof PlanCandidates> {
  return { generated: source.generated, intake: source.intake, athleteEvidence: source.athleteEvidence,
    athleteRecords: [], selectedRecordId: null, comparisonRecordId: null, prescriptionBinding: source.prescriptionBinding,
    recordConfirmationPending: false, onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(),
    onBack: vi.fn(), onSelect: vi.fn(), onCatalogChange: vi.fn(), startDateValue: "2026-10-02" }
}
describe("condition review to explicit detail application", () => {
  it("opens the exact slot with no preconfirmation and only applies after the user's actual answer", () => {
    const source = fixture(), initial = props(source), offer = findCatalogConditionReview(source.generated, source.intake)!
    const snapshot = JSON.stringify(source.generated)
    const view = render(<PlanCandidates {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/u }))
    expect(screen.getByText("다른 훈련으로 바꾸기", { exact: true }).closest("details")).toHaveAttribute("open")
    expect(screen.getByRole("combobox", { name: "바꿀 일정" })).toHaveValue(`${offer.day}:${offer.slot}`)
    expect(screen.getByRole("combobox", { name: "훈련 구성" })).toHaveValue(offer.catalogId)
    expect(screen.getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    expect(screen.queryByRole("spinbutton")).toBeNull()
    expect(initial.onSelect).not.toHaveBeenCalled()
    expect(initial.onCatalogChange).not.toHaveBeenCalled()
    expect(JSON.stringify(source.generated)).toBe(snapshot)
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })).toBeDisabled()
    expect(initial.onCatalogChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(initial.onCatalogChange).toHaveBeenCalledOnce()
    const changed = vi.mocked(initial.onCatalogChange!).mock.calls[0]![0]
    const selected = selectPlanForActivation(changed.candidates[0].candidateId, changed, source.gate, source.intake, source.athleteEvidence)
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") throw Error(selected.kind)
    expect(parsePlanBetaState(selected.state)).not.toBeNull()
    view.rerender(<PlanCandidates {...initial} generated={changed} />)
    expect(screen.queryByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })).toBeNull()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(initial.onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(initial.onSelect).toHaveBeenCalledOnce()
  })

  it("keeps the general plan reachable without making the environment question compulsory", () => {
    const initial = props()
    render(<PlanCandidates {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(initial.onSelect).toHaveBeenCalledOnce()
    expect(initial.onCatalogChange).not.toHaveBeenCalled()
  })

  it("does not erase an in-progress answer when another condition request arrives", () => {
    const source = fixture(), offer = findCatalogConditionReview(source.generated, source.intake)!, onChange = vi.fn()
    const initial = { generated: source.generated, intake: source.intake, records: [], onChange,
      startDate: "2026-10-02", conditionRequest: { ...offer, revision: 1, startDate: "2026-10-02", accountScope: null } }
    const view = render(<CatalogWorkoutPicker {...initial} />)
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    view.rerender(<CatalogWorkoutPicker {...initial} conditionRequest={{ ...initial.conditionRequest, revision: 2 }} />)
    expect(screen.getByRole("checkbox", { name: spaceLabel })).toBeChecked()
    expect(screen.getByRole("button", { name: "변경 취소" })).toBeVisible()
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each(["pairId", "catalogId", "catalogFingerprint", "day", "startDate", "accountScope"] as const)("rejects a stale %s request without applying or prechecking", field => {
    const source = fixture(), offer = findCatalogConditionReview(source.generated, source.intake)!, onChange = vi.fn()
    const request = { ...offer, revision: 1, startDate: "2026-10-02", accountScope: null, ...field === "day" ? { day: offer.day + 1 } : { [field]: "stale" } }
    render(<CatalogWorkoutPicker generated={source.generated} intake={source.intake} records={[]} onChange={onChange} conditionRequest={request} startDate="2026-10-02" />)
    expect(screen.getByText("다른 훈련으로 바꾸기", { exact: true }).closest("details")).not.toHaveAttribute("open")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("updates the displayed date and blocks the shortcut during uncertain account storage", () => {
    const initial = props()
    const view = render(<PlanCandidates {...initial} />)
    const firstLabel = screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/u }).textContent
    view.rerender(<PlanCandidates {...initial} startDateValue="2026-11-02" saveCode="ACCOUNT_PLAN_PENDING" saveError="저장 확인 중" />)
    const shortcut = screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })
    expect(shortcut.textContent).not.toBe(firstLabel)
    expect(shortcut).toBeDisabled()
    expect(initial.onCatalogChange).not.toHaveBeenCalled()
  })
})
