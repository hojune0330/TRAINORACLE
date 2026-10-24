import { initializeCanonicalJournalFixture } from "../../test/canonical-journal-fixture"
import React from "react"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { PlanCandidates } from "./PlanCandidates"
import * as templateOptions from "./plan-template-options"
import { defaultInstantCandidate } from "./instant-plan-projection"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { isoShift } from "../../domain/dates"
import { formatTrainingSeconds, prescriptionLabel, sessionExecutionSteps, sessionLabel, sessionSlotLabel } from "./labels"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { loadAthleteRecords } from "../../domain/athlete-records"
import { listDetailedSessionTargets } from "../../domain/plan-session-target"
import { saveCurrentRecord } from "../../domain/prescription-quality-matrix.test-fixtures"

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear(); await initializeCanonicalJournalFixture()
  // Keep this dated fixture eligible while preserving real input and RAF timers.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 8, 5, 12))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

function setup() {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "HIGH_SCHOOL",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected generated fixture")
  const first = templateOptions.resolveDetailedPlanTemplateOptions(result.intake, "2026-09-05T00:00:00.000Z", [])[0]!
  const other = { ...first, ref: { ...first.ref, templateId: "UI-ONLY" },
    method: { familyId: "ui-only-family", configurationId: "UI-ONLY", version: "1" }, mainSummary: "다른 방법 예시" }
  const resolver = vi.spyOn(templateOptions, "resolveDetailedPlanTemplateOptions").mockImplementation((_draft, _now, _history, preference) => (
    preference === "PREFER_VARIETY" ? [other, { ...first, recommended: false }] : [first, other]
  ))
  const props: React.ComponentProps<typeof PlanCandidates> = {
    generated: result.generated, intake: { ...result.intake, selectedDetailedTemplateRef: first.ref },
    athleteEvidence: result.athleteEvidence, prescriptionBinding: result.prescriptionBinding,
    athleteRecords: [], selectedRecordId: null, comparisonRecordId: null,
    recordConfirmationPending: false, onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(),
    onChangeMethod: vi.fn(), onBack: vi.fn(), onSelect: vi.fn(), onSelectionDetailsChange: vi.fn(),
  }
  return { props, resolver }
}

describe("candidate-owned optional recommendation preference", () => {
  it("shows actual QUALITY prescription steps with date and amounts without selecting silently", () => {
    const { props } = setup()
    const candidate = defaultInstantCandidate(props.generated)
    const supportedWorkout = candidate.sessions.find(session => {
      if (session.role !== "QUALITY") return false
      const roles = projectInstantExecutionSteps(session).map(step => step.role)
      return roles.includes("PREPARATION") && roles.includes("COOLDOWN")
    })
    if (!supportedWorkout) throw Error("Expected an existing QUALITY prescription with preparation and cooldown")
    // Reorder existing sessions only so this real QUALITY prescription is first; no new dose.
    const projectedDays = Math.ceil(candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays)
    const sessions = [{ ...supportedWorkout, day: 1 }, ...candidate.sessions.filter(session =>
      session !== supportedWorkout && session.day > 1 && session.day <= projectedDays)]
    const withDisplayedSessions = (item: typeof props.generated.candidates[number]) =>
      item.candidateId === candidate.candidateId ? { ...item, sessions } : item
    const generated = { ...props.generated, candidates: [
      withDisplayedSessions(props.generated.candidates[0]), withDisplayedSessions(props.generated.candidates[1]),
    ] as const }
    const original = JSON.stringify(generated)
    const startDate = "2026-09-05"
    const displayProps = { ...props, generated, intake: { ...props.intake, selectedDetailedTemplateRef: null }, startDateValue: startDate }
    const view = render(<PlanCandidates {...displayProps} />)
    const first = screen.getByRole("region", { name: "선택한 계획 요약" })
    const firstSession = sessions[0]!
    const calculation = firstSession.prescription.kind === "RPE_TIME_RANGE" && firstSession.prescription.catalogWorkout
      ? resolveCatalogBinding(firstSession.prescription.catalogWorkout) : null
    const steps = calculation ? sessionExecutionSteps(firstSession, true).map(step => ({ role: step.role, label: step.title, instruction: step.detail }))
      : projectInstantExecutionSteps(firstSession)
    const qualityRow = within(first).getByRole("heading", {
      name: `${startDate} · ${sessionSlotLabel(sessions[0]!.slot)} · ${sessionLabel(sessions[0]!)}`,
    }).closest("li")!
    expect(qualityRow).toBeVisible()
    fireEvent.click(within(qualityRow).getByText("준비·정리 방법"))
    for (const step of steps) {
      const label = within(qualityRow).getByText(step.label)
      expect(label).toBeVisible()
      expect(label.nextElementSibling).toBeVisible()
      const total = calculation?.totals.seconds
      const expected = step.role === "TOTAL_DURATION" && total
        ? `전체 구간 합계 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : `~${formatTrainingSeconds(total.maximum)}`}`
        : step.instruction
      expect(label.nextElementSibling?.textContent).toBe(expected)
    }
    const calendar = screen.getByRole("region", { name: "이번 일정" })
    expect(within(calendar).getAllByRole("grid")).toHaveLength(1)
    for (const session of sessions) {
      const day = calendar.querySelector<HTMLButtonElement>(`button[data-date="${isoShift(startDate, session.day - 1)}"]`)
      expect(day).not.toBeNull()
      for (const label of within(day!).getAllByText(session.role === "REST" ? "휴식" : sessionLabel(session))) expect(label).toBeVisible()
      if (session.role === "REST") expect(day).toHaveAccessibleName(expect.stringContaining(sessionLabel(session)))
      if (session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout) {
        const calculation = resolveCatalogBinding(session.prescription.catalogWorkout)
        const total = calculation?.totals.seconds
        if (!total) throw Error("Expected a verified catalog duration in this fixture")
        const expected = `전체 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : ` ~ ${formatTrainingSeconds(total.maximum)}`}`
        expect(within(day!).getByText(expected)).toBeVisible()
      } else if (session.role !== "REST") expect(within(day!).getByText(prescriptionLabel(session, true))).toBeVisible()
    }
    const onRetrySave = vi.fn()
    view.rerender(<PlanCandidates {...displayProps} saveCode="PLAN_STORAGE_WRITE_FAILED"
      saveError="기기에 저장하지 못했어요. 결과와 입력은 그대로 두었어요." onRetrySave={onRetrySave} />)
    expect(screen.getByRole("alert")).toHaveTextContent("결과와 입력은 그대로")
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    const rerenderedOverview = within(screen.getByRole("region", { name: "선택한 계획 요약" }))
    const rerenderedQualityRow = rerenderedOverview.getByRole("heading", {
      name: `${startDate} · ${sessionSlotLabel(sessions[0]!.slot)} · ${sessionLabel(sessions[0]!)}`,
    }).closest("li")!
    const preparationDisclosure = within(rerenderedQualityRow).getByText("준비·정리 방법")
    if (!preparationDisclosure.closest("details")?.open) fireEvent.click(preparationDisclosure)
    expect(within(rerenderedQualityRow).getByText("준비")).toBeVisible()
    expect(within(rerenderedQualityRow).getByText("정리")).toBeVisible()
    expect(screen.getByRole("region", { name: "이번 일정" })).toBeVisible()
    expect(onRetrySave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }))
    expect(onRetrySave).toHaveBeenCalledOnce()
    expect(JSON.stringify(generated)).toBe(original)
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it("takes the blocked primary action to record confirmation without selecting or confirming silently", () => {
    const { props } = setup()
    render(<PlanCandidates {...props} recordConfirmationPending />)
    const review = screen.getByRole("button", { name: "기준 기록 확인하기" })
    expect(review).toBeEnabled()
    fireEvent.click(review)
    expect(screen.getByRole("region", { name: "개인 페이스 기준 기록" })).toBeVisible()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onConfirmRecord).not.toHaveBeenCalled()
  })

  it("keeps the selected candidate consistent across the overview, calendar, and single start action", () => {
    const { props } = setup()
    const eligibleProps = { ...props, intake: { ...props.intake, selectedDetailedTemplateRef: null } }
    render(<PlanCandidates {...eligibleProps} startDateValue="2026-09-05" />)
    const alternate = props.generated.candidates.find(candidate => candidate.kind !== "BALANCED")!
    fireEvent.click(screen.getByRole("button", { name: "B안 선택" }))
    expect(screen.getByRole("button", { name: "B안 선택됨" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "선택한 계획 요약" })).toBeVisible()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(props.onSelect).toHaveBeenCalledWith({ candidateId: alternate.candidateId, startDate: "2026-09-05" })
  })

  it("blocks the global start action while a candidate target change is pending and restores it on cancel", () => {
    const { props } = setup()
    const recordId = saveCurrentRecord(5000, 1110)
    const detailed = generatePlanFromDraft({ ...props.intake, availableDayCount: "EVERY_DAY" }, "NO_KNOWN_RISK", { selectedRecordId: recordId })
    if (detailed.kind !== "generated") throw new Error("Expected a bound detailed candidate fixture")
    expect(detailed.prescriptionBinding.kind).toBe("bound")
    const targets = listDetailedSessionTargets(detailed.generated)
    expect(targets.length).toBeGreaterThan(1)
    const onChangeCandidateSessionTarget = vi.fn()
    render(<PlanCandidates {...props} generated={detailed.generated} intake={detailed.intake}
      athleteEvidence={detailed.athleteEvidence} prescriptionBinding={detailed.prescriptionBinding}
      athleteRecords={loadAthleteRecords()} selectedRecordId={recordId} startDateValue="2026-09-05"
      onChangeCandidateSessionTarget={onChangeCandidateSessionTarget} />)

    fireEvent.click(screen.getByRole("button", { name: "계획안 A 일정 펼치기" }))
    fireEvent.click(screen.getAllByRole("button", { name: "이 훈련을 개인 페이스로 받기" }).at(-1)!)
    const start = screen.getByRole("button", { name: "이 일정으로 시작" })
    expect(start).toBeDisabled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(onChangeCandidateSessionTarget).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
    expect(start).toBeEnabled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(onChangeCandidateSessionTarget).not.toHaveBeenCalled()
  })

  it("does not offer record confirmation while an account write is pending", () => {
    const { props } = setup()
    render(<PlanCandidates {...props} recordConfirmationPending saveCode="ACCOUNT_PLAN_PENDING" />)
    expect(screen.queryByRole("button", { name: "기준 기록 확인하기" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
  })

  it("starts neutral and changes ranking without changing the selected method or confirmation", () => {
    const { props, resolver } = setup()
    render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    fireEvent.click(screen.getByText("훈련 목록·다른 설정"))
    expect(screen.getByRole("radio", { name: "선호 없음" })).toBeChecked()
    expect(resolver.mock.lastCall?.[3]).toBe("NEUTRAL")
    fireEvent.click(screen.getByRole("radio", { name: "덜 해본 방법 선호" }))
    expect(resolver.mock.lastCall?.[3]).toBe("PREFER_VARIETY")
    expect(screen.getByRole("radio", { name: /5 × 1km @ 5K RP/u })).toBeChecked()
    expect(props.onChangeMethod).not.toHaveBeenCalled()
    expect(props.onSelectionDetailsChange).not.toHaveBeenCalled()
    expect(props.onConfirmRecord).not.toHaveBeenCalled()
  })

  it.each([
    { eventDistanceM: 3000 }, { eventGroup: "MIDDLE_DISTANCE" }, { trainingFocus: "LT_INTENT" }, { experienceBand: "DEVELOPING" },
  ] as const)("resets preference to neutral when intake context changes %j", (change) => {
    const { props, resolver } = setup()
    const view = render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    fireEvent.click(screen.getByText("훈련 목록·다른 설정"))
    fireEvent.click(screen.getByRole("radio", { name: "해본 방법 선호" }))
    expect(resolver.mock.lastCall?.[3]).toBe("PREFER_REPEAT")
    view.rerender(<PlanCandidates {...props} intake={{ ...props.intake, ...change }} />)
    expect(resolver.mock.lastCall?.[3]).toBe("NEUTRAL")
    expect(screen.getByRole("radio", { name: "선호 없음" })).toBeChecked()
    expect(props.onChangeMethod).not.toHaveBeenCalled()
  })

  it("keeps preference on an unrelated start-date rerender", () => {
    const { props } = setup()
    const view = render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    fireEvent.click(screen.getByText("훈련 목록·다른 설정"))
    fireEvent.click(screen.getByRole("radio", { name: "해본 방법 선호" }))
    view.rerender(<PlanCandidates {...props} startDateValue="2026-09-12" />)
    expect(screen.getByRole("radio", { name: "해본 방법 선호" })).toBeChecked()
  })
})
