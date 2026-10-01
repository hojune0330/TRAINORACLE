import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../app/src/domain/plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "../../app/src/domain/catalog-plan-binding"
import { catalogScheduleConditions } from "../../app/src/domain/catalog-schedule-conditions"
import { setActiveLocalAccount } from "../../app/src/domain/account/local-journal-ownership"
import { CatalogWorkoutPicker } from "../../app/src/screens/plan-beta/CatalogWorkoutPicker"
import { CatalogScheduleReview } from "../../app/src/screens/plan-beta/CatalogScheduleReview"
import { PlanCandidates } from "../../app/src/screens/plan-beta/PlanCandidates"

const space = "가속하고 속도를 줄일 충분한 공간이 있어요"
const reviewName = "이 날짜에도 운동할 환경이 갖춰져 있나요?"
const dateA = "2026-10-02", dateB = "2026-11-02"
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); setActiveLocalAccount(null) })

function fixture(trainingFocus: "ATP_PC_INTENT" | "MIXED_INTENT" = "ATP_PC_INTENT") {
  const source = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus, secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
  if (source.kind !== "generated") throw Error(source.kind)
  return source
}

function bindQuality(source = fixture(), id = "P-ATP-T", all = false) {
  let generated = source.generated
  const slots = generated.candidates[0].sessions.filter(s => s.role === "QUALITY")
  expect(slots.length).toBeGreaterThan(1)
  for (const session of all ? slots : slots.slice(0, 1)) {
    const next = replaceCandidateCatalogWorkout(generated, session, id, {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentPaces: [], fiveK: null,
      ...(id === "P-ATP-A" ? { segmentSeconds: [{ segmentId: "M-ATP-A", seconds: 7.25 }] } : {}),
    })
    if (!next) throw Error(`Cannot bind fixture ${id}`)
    generated = next
  }
  return generated
}

function candidatesProps(source = fixture(), generated = source.generated): React.ComponentProps<typeof PlanCandidates> {
  return { generated, intake: source.intake, athleteEvidence: source.athleteEvidence,
    athleteRecords: [], selectedRecordId: null, comparisonRecordId: null,
    prescriptionBinding: source.prescriptionBinding, recordConfirmationPending: false,
    onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(),
    onBack: vi.fn(), onSelect: vi.fn(), onCatalogChange: vi.fn(), startDateValue: dateA }
}
function openPicker() { fireEvent.click(screen.getByText("다른 훈련으로 바꾸기", { exact: true })) }
function group() { return screen.getByRole("group", { name: reviewName }) }
function confirmGroup() {
  const review = group()
  within(review).getAllByRole("checkbox").forEach(box => fireEvent.click(box))
  fireEvent.click(within(review).getByRole("button", { name: "이 날짜의 조건 확인" }))
}

describe("independent schedule review controls", () => {
  it("C01 groups repeated slot dates once, deduplicates identical A/B conditions, and changes keys for dates/accounts", () => {
    const generated = bindQuality(fixture(), "P-ATP-T", true)
    const conditions = catalogScheduleConditions(generated, dateA, null)
    expect(conditions).toHaveLength(2)
    expect(new Set(conditions.map(c => c.key)).size).toBe(2)
    expect(catalogScheduleConditions(generated, dateB, null).map(c => c.key)).not.toEqual(conditions.map(c => c.key))
    expect(catalogScheduleConditions(generated, dateA, "synthetic-account").map(c => c.key)).not.toEqual(conditions.map(c => c.key))
    const onConfirm = vi.fn()
    render(<CatalogScheduleReview conditions={conditions} disabled={false} onConfirm={onConfirm} />)
    expect(within(group()).getAllByRole("checkbox")).toHaveLength(1)
    for (const condition of conditions) expect(group()).toHaveTextContent(`${condition.date} 오후`)
    expect(within(group()).getByRole("button")).toBeDisabled()
    confirmGroup()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("C02 blocks every initial start action until review, then date change blocks them again without writes", () => {
    const source = fixture(), generated = bindQuality(source, "P-ATP-T", true)
    const props = candidatesProps(source, generated), snapshot = JSON.stringify(generated)
    const view = render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "다른 계획 보기" }))
    const starts = () => screen.getAllByRole("button", { name: /이 일정으로 시작|이 계획으로 시작하기|선택하기$/u })
    expect(starts()).toHaveLength(3)
    for (const button of starts()) { expect(button).toBeDisabled(); fireEvent.click(button) }
    expect(props.onSelect).not.toHaveBeenCalled()
    confirmGroup()
    for (const button of starts()) expect(button).toBeEnabled()
    view.rerender(<PlanCandidates {...props} startDateValue={dateB} />)
    for (const button of starts()) expect(button).toBeDisabled()
    expect(within(group()).getByRole("checkbox")).not.toBeChecked()
    expect(JSON.stringify(generated)).toBe(snapshot)
    expect(props.onCatalogChange).not.toHaveBeenCalled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it("C03 account change invalidates a reviewed schedule; stale click before rerender is ignored", () => {
    const source = fixture(), generated = bindQuality(source)
    const props = candidatesProps(source, generated), view = render(<PlanCandidates {...props} />)
    confirmGroup()
    act(() => setActiveLocalAccount("synthetic-account-B"))
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(props.onSelect).not.toHaveBeenCalled()
    view.rerender(<PlanCandidates {...props} />)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(within(group()).getByRole("checkbox")).not.toBeChecked()
  })

  it("C04 a date change preserves a typed segment number and clears only environment confirmation", () => {
    const source = fixture(), props = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: dateA }
    const view = render(<CatalogWorkoutPicker {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateB} />)
    expect(screen.getByRole("spinbutton")).toHaveValue(7.25)
    expect(screen.getByRole("checkbox", { name: space })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it("C05 applying one reviewed slot does not authorize another slot", () => {
    const source = fixture(), generated = bindQuality(source, "P-ATP-T", true)
    const props = candidatesProps(source, generated), view = render(<PlanCandidates {...props} />)
    openPicker()
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(props.onCatalogChange).toHaveBeenCalledOnce()
    const next = vi.mocked(props.onCatalogChange!).mock.calls[0]![0]
    view.rerender(<PlanCandidates {...props} generated={next} />)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    const conditions = catalogScheduleConditions(next, dateA, null)
    expect(group()).toHaveTextContent(conditions[1]!.date)
    expect(group()).not.toHaveTextContent(conditions[0]!.date)
  })

  it("C06 keeps actual compound-training experience and typed segment values after date changes", () => {
    const source = fixture("MIXED_INTENT")
    const props = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: dateA }
    const view = render(<CatalogWorkoutPicker {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "X-MIX-10" } })
    const experience = screen.getByRole("checkbox", { name: "서로 다른 강도를 묶은 복합 훈련 경험이 있어요" })
    fireEvent.click(experience)
    const numbers = screen.getAllByRole("spinbutton")
    expect(numbers.length).toBeGreaterThan(0)
    numbers.forEach((input, index) => fireEvent.change(input, { target: { value: String(100 + index) } }))
    const before = numbers.map(input => (input as HTMLInputElement).value)
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateB} />)
    expect(experience).toBeChecked()
    expect(screen.getAllByRole("spinbutton").map(input => (input as HTMLInputElement).value)).toEqual(before)
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it("C07 grouped re-review remains usable with untouched editor and suppresses a second condition shortcut", () => {
    const source = fixture(), props = candidatesProps(source, bindQuality(source))
    const view = render(<PlanCandidates {...props} />)
    confirmGroup()
    view.rerender(<PlanCandidates {...props} startDateValue={dateB} />)
    const review = group()
    expect(within(review).getByRole("checkbox")).toBeEnabled()
    expect(screen.queryByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })).toBeNull()
    confirmGroup()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /공간 확인하고 상세 훈련 보기/u })).toBeNull()
  })
})

describe("independent adversarial regressions (expected contract assertions)", () => {
  it("R01 date A to B to A must not resurrect an unapplied environment answer", () => {
    const source = fixture(), props = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: dateA }
    const view = render(<CatalogWorkoutPicker {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateB} />)
    expect(screen.getByRole("checkbox", { name: space })).not.toBeChecked()
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateA} />)
    expect(screen.getByRole("spinbutton")).toHaveValue(7.25)
    expect(screen.getByRole("checkbox", { name: space })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  })

  it("R02 editor checkbox can withdraw an environment answer after grouped review", () => {
    const source = fixture(), generated = bindQuality(source)
    const props = candidatesProps(source, generated)
    render(<PlanCandidates {...props} />)
    confirmGroup()
    openPicker()
    const checkbox = screen.getByRole("checkbox", { name: space })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "변경 취소" })).toBeVisible()
  })

  it("R03 changing exact segment calculation invalidates its old environment answer", () => {
    const source = fixture(), props = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: dateA }
    render(<CatalogWorkoutPicker {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "8.25" } })
    expect(screen.getByRole("checkbox", { name: space })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeDisabled()
  })

  it("R04 returning to an old binding after removing it requires new schedule review", () => {
    const source = fixture(), generated = bindQuality(source)
    const props = candidatesProps(source, generated), view = render(<PlanCandidates {...props} />)
    confirmGroup()
    view.rerender(<PlanCandidates {...props} generated={source.generated} />)
    expect(screen.queryByRole("group", { name: reviewName })).toBeNull()
    view.rerender(<PlanCandidates {...props} generated={generated} />)
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(within(group()).getByRole("checkbox")).not.toBeChecked()
  })
})

describe("observed consequence receipts (assert present bug, not acceptance)", () => {
  it("O01 stale date answer actually permits applying on the restored date", () => {
    const source = fixture(), props = { generated: source.generated, intake: source.intake, records: [], onChange: vi.fn(), startDate: dateA }
    const view = render(<CatalogWorkoutPicker {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateB} />)
    view.rerender(<CatalogWorkoutPicker {...props} startDate={dateA} />)
    expect(screen.getByRole("checkbox", { name: space })).toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(props.onChange).toHaveBeenCalledOnce()
  })

  it("O02 failed withdrawal leaves plan start enabled and actually calls onSelect", () => {
    const source = fixture(), props = candidatesProps(source, bindQuality(source))
    render(<PlanCandidates {...props} />)
    confirmGroup()
    openPicker()
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    expect(screen.getByRole("checkbox", { name: space })).toBeChecked()
    expect(screen.queryByRole("button", { name: "변경 취소" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(props.onSelect).toHaveBeenCalledOnce()
  })

  it("O03 edited numeric input is applied and reviewed for start without a fresh environment answer", () => {
    const source = fixture(), props = candidatesProps(source), view = render(<PlanCandidates {...props} />)
    openPicker()
    fireEvent.change(screen.getByRole("combobox", { name: "훈련 구성" }), { target: { value: "P-ATP-A" } })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "7.25" } })
    fireEvent.click(screen.getByRole("checkbox", { name: space }))
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "8.25" } })
    expect(screen.getByRole("checkbox", { name: space })).toBeChecked()
    expect(screen.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "이 구성으로 바꾸기" }))
    expect(props.onCatalogChange).toHaveBeenCalledOnce()
    const next = vi.mocked(props.onCatalogChange!).mock.calls[0]![0]
    const target = next.candidates[0].sessions.find(s => s.role === "QUALITY")!
    if (target.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong fixture prescription")
    expect(target.prescription.catalogWorkout!.inputs.segmentSeconds![0]!.seconds).toBe(8.25)
    view.rerender(<PlanCandidates {...props} generated={next} />)
    expect(screen.queryByRole("group", { name: reviewName })).toBeNull()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
  })
})
