import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "../../domain/plan-beta-flow"
import { parsePlanBetaState } from "../../domain/plan-beta-schema"
import { findCatalogConditionReview } from "../../domain/catalog-condition-review"
import { PlanCandidates } from "./PlanCandidates"
import { CatalogWorkoutPicker } from "./CatalogWorkoutPicker"
import { replaceCandidateCatalogWorkout } from "../../domain/catalog-plan-binding"
import { catalogScheduleConditions } from "../../domain/catalog-schedule-conditions"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); setActiveLocalAccount(null) })
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
function withAppliedCondition(source = fixture()) {
  const offer = findCatalogConditionReview(source.generated, source.intake)!
  const generated = replaceCandidateCatalogWorkout(source.generated, offer, offer.catalogId, {
    eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
    confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentPaces: [], fiveK: null,
  })
  if (!generated) throw Error("valid bound fixture required")
  return { source, generated, initial: props(source) }
}
describe("condition review to explicit detail application", () => {
  it("opens the exact slot with no preconfirmation and only applies after the user's actual answer", () => {
    const source = fixture(), initial = props(source), offer = findCatalogConditionReview(source.generated, source.intake)!
    const snapshot = JSON.stringify(source.generated)
    const view = render(<PlanCandidates {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/u }))
    expect(screen.getByRole("region", { name: "다른 훈련으로 바꾸기" })).toBeVisible()
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

  it("requires a new calendar review after changing dates, without changing the applied workout or writing storage", () => {
    const initial = props(), view = render(<PlanCandidates {...initial} />)
    // The calendar has many buttons. Find this exact visible action without
    // recomputing every calendar button's accessible name on each rerender.
    const visibleButton = (name: string | RegExp) => {
      const button = screen.getByText(name, { selector: "button", exact: true })
      expect(button).toBeVisible()
      expect(button).toHaveRole("button")
      expect(button).toHaveAccessibleName(name)
      return button
    }
    const startButton = () => visibleButton("이 일정으로 시작")
    fireEvent.click(visibleButton(/공간 확인하고 상세 훈련 보기/u))
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    fireEvent.click(visibleButton("이 구성으로 바꾸기"))
    const changed = vi.mocked(initial.onCatalogChange!).mock.calls[0]![0]
    const snapshot = JSON.stringify(changed)
    view.rerender(<PlanCandidates {...initial} generated={changed} />)
    expect(screen.queryByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })).toBeNull()
    expect(startButton()).toBeEnabled()

    view.rerender(<PlanCandidates {...initial} generated={changed} startDateValue="2026-11-02" />)
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    expect(within(review).getByRole("checkbox")).not.toBeChecked()
    expect(screen.queryByText(/공간 확인하고 상세 훈련 보기/u, { selector: "button" })).toBeNull()
    expect(review).toHaveTextContent("2026-11-")
    expect(startButton()).toBeDisabled()
    fireEvent.click(visibleButton("일정·운동 시간"))
    expect(visibleButton("계획 A로 시작")).toBeDisabled()
    for (const action of screen.getAllByRole("button", { name: /계획 [AB]로 시작$/u })) expect(action).toBeDisabled()
    fireEvent.click(within(review).getByRole("checkbox"))
    expect(startButton()).toBeDisabled()
    fireEvent.click(within(review).getByRole("button", { name: "이 날짜의 조건 확인" }))
    expect(startButton()).toBeEnabled()
    expect(JSON.stringify(changed)).toBe(snapshot)
    expect(screen.queryByText(/공간 확인하고 상세 훈련 보기/u, { selector: "button" })).toBeNull()
    expect(initial.onCatalogChange).toHaveBeenCalledOnce()
    expect(initial.onSelect).not.toHaveBeenCalled()
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    fireEvent.click(startButton())
    expect(initial.onSelect).toHaveBeenCalledWith({ candidateId: changed.candidates[0].candidateId, startDate: "2026-11-02" })
  })

  it("does not treat stored confirmations as calendar review and groups repeated dates into one question", () => {
    const source = fixture(), offer = findCatalogConditionReview(source.generated, source.intake)!
    let generated = source.generated
    const slots = generated.candidates[0].sessions.filter(session => session.role === "QUALITY")
    expect(slots.length).toBeGreaterThan(1)
    for (const slot of slots) {
      const changed = replaceCandidateCatalogWorkout(generated, slot, offer.catalogId, {
        eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
        confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentPaces: [], fiveK: null,
      })
      expect(changed).not.toBeNull()
      generated = changed!
    }
    const initial = props(source), view = render(<PlanCandidates {...initial} generated={generated} />)
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    expect(within(review).getAllByRole("checkbox")).toHaveLength(1)
    for (const condition of catalogScheduleConditions(generated, "2026-10-02", null)) {
      expect(review).toHaveTextContent(condition.date)
    }
    fireEvent.click(within(review).getByRole("checkbox"))
    view.rerender(<PlanCandidates {...initial} generated={generated} startDateValue="2026-11-02" />)
    const updated = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    expect(within(updated).getByRole("checkbox")).not.toBeChecked()
    expect(within(updated).getByRole("button")).toBeDisabled()
  })

  it("keeps a typed segment time when the date changes and clears only its environment answer", () => {
    const source = fixture(), onChange = vi.fn()
    const initial = { generated: source.generated, intake: source.intake, records: [], onChange, startDate: "2026-10-02" }
    const view = render(<CatalogWorkoutPicker {...initial} />)
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    const time = screen.getByRole("spinbutton")
    fireEvent.change(time, { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    view.rerender(<CatalogWorkoutPicker {...initial} startDate="2026-11-02" />)
    expect(screen.getByRole("spinbutton")).toHaveValue(7.25)
    expect(screen.getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
  })

  it("does not extend one slot's explicit application to unreviewed conditions on another date", () => {
    const source = fixture(), offer = findCatalogConditionReview(source.generated, source.intake)!
    let generated = source.generated
    const slots = generated.candidates[0].sessions.filter(session => session.role === "QUALITY")
    expect(slots).toHaveLength(2)
    for (const slot of slots) generated = replaceCandidateCatalogWorkout(generated, slot, offer.catalogId, {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentPaces: [], fiveK: null,
    })!
    const initial = props(source), view = render(<PlanCandidates {...initial} generated={generated} />)
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    const picker = screen.getByRole("region", { name: "다른 훈련으로 바꾸기" })
    expect(within(picker).getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    fireEvent.click(within(picker).getByRole("checkbox", { name: spaceLabel }))
    fireEvent.click(within(picker).getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(initial.onCatalogChange).toHaveBeenCalledOnce()
    const next = vi.mocked(initial.onCatalogChange!).mock.calls[0]![0]
    view.rerender(<PlanCandidates {...initial} generated={next} />)
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    const other = catalogScheduleConditions(generated, "2026-10-02", null).find(condition => condition.day === slots[1]!.day)!
    expect(review).toHaveTextContent(other.date)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(initial.onSelect).not.toHaveBeenCalled()
  })

  it("never carries a calendar review into another account, including a stale click before rerender", () => {
    const initial = props(), view = render(<PlanCandidates {...initial} />)
    setActiveLocalAccount("synthetic-other-account")
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(initial.onSelect).not.toHaveBeenCalled()
    view.rerender(<PlanCandidates {...initial} />)
    expect(initial.onCatalogChange).not.toHaveBeenCalled()
  })

  it("does not resurrect the old checkbox when an edited date is restored", () => {
    const source = fixture(), initial = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: "2026-10-02" }
    const view = render(<CatalogWorkoutPicker {...initial} />)
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    view.rerender(<CatalogWorkoutPicker {...initial} startDate="2026-11-02" />)
    expect(screen.getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    view.rerender(<CatalogWorkoutPicker {...initial} />)
    expect(screen.getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    expect(initial.onChange).not.toHaveBeenCalled()
  })

  it("honors withdrawing an environment answer after grouped review", () => {
    const { generated, initial } = withAppliedCondition()
    render(<PlanCandidates {...initial} generated={generated} />)
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    fireEvent.click(within(review).getByRole("checkbox"))
    fireEvent.click(within(review).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    const checkbox = screen.getByRole("checkbox", { name: spaceLabel })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "변경 취소" })).toBeVisible()
    expect(initial.onSelect).not.toHaveBeenCalled()
  })

  it("requires an environment answer again when the exact segment time changes", () => {
    const source = fixture()
    render(<CatalogWorkoutPicker generated={source.generated} intake={source.intake} records={[]} onChange={vi.fn()} startDate="2026-10-02" />)
    fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true }))
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: spaceLabel }))
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "8.25" } })
    expect(screen.getByRole("checkbox", { name: spaceLabel })).not.toBeChecked()
    expect(screen.getByRole("spinbutton")).toHaveValue(8.25)
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  })

  it("requires a new review when a removed binding is brought back", () => {
    const { source, generated, initial } = withAppliedCondition()
    const view = render(<PlanCandidates {...initial} generated={generated} />)
    const review = screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })
    fireEvent.click(within(review).getByRole("checkbox"))
    fireEvent.click(within(review).getByRole("button"))
    view.rerender(<PlanCandidates {...initial} generated={source.generated} />)
    expect(screen.queryByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })).toBeNull()
    view.rerender(<PlanCandidates {...initial} generated={generated} />)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(within(screen.getByRole("group", { name: "이 날짜에도 운동할 환경이 갖춰져 있나요?" })).getByRole("checkbox")).not.toBeChecked()
  })
})
