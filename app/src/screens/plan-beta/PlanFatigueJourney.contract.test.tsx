import type React from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "../PlanBeta"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { loadPlanBetaState } from "../../domain/plan-beta-store"
import { PlanCandidates } from "./PlanCandidates"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

function candidateProps(): React.ComponentProps<typeof PlanCandidates> {
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "NOT_PROVIDED",
    experienceBand: "EXPERIENCED", availableDayCount: 5, requestedFrameLength: 9,
    trainingFocus: "ATP_PC_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "EVENING", selectedDetailedTemplateRef: null,
  }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error("Expected generated fixture")
  return {
    generated: result.generated, intake: result.intake, athleteEvidence: result.athleteEvidence,
    prescriptionBinding: result.prescriptionBinding, athleteRecords: [], selectedRecordId: null,
    comparisonRecordId: null, recordConfirmationPending: false, startDateValue: "2026-10-07",
    onSelectRecord: vi.fn(), onCompareRecord: vi.fn(), onConfirmRecord: vi.fn(), onBack: vi.fn(),
    onSelect: vi.fn(), onCatalogChange: vi.fn(), onRefine: vi.fn(), onStartDateChange: vi.fn(),
  }
}

describe("batch2 purpose-first plan journey", () => {
  it("keeps import at entry and result, not every question, without losing explicit activation", async () => {
    render(<PlanBeta />)
    expect(screen.getByRole("button", { name: "개인 계획 파일 불러오기" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "800m" }))
    fireEvent.click(screen.getByRole("button", { name: "기록 없이" }))
    expect(await screen.findByRole("heading", { name: "지금까지 어떻게 달려왔나요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "개인 계획 파일 불러오기" })).toBeNull()
    expect(screen.queryByText(/일 달력 보기/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /달리기를 막 시작했어요/ }))
    fireEvent.click(screen.getByRole("button", { name: "3일" }))
    expect(screen.getByRole("heading", { name: "지금 몸은 어때요?" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "개인 계획 파일 불러오기" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/ }))
    expect(await screen.findByRole("heading", { name: "계획이 준비됐어요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "개인 계획 파일 불러오기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
    expect(loadPlanBetaState()).toBeNull()
  })

  it("exposes three purpose entries and keeps each refinement reachable without stacked wrappers", async () => {
    const props = candidateProps(), original = JSON.stringify(props.generated)
    render(<PlanCandidates {...props} />)
    const entries = within(screen.getByRole("group", { name: "계획 확인·변경" }))
    expect(entries.getAllByRole("button").map(button => button.textContent)).toEqual(["일정 바꾸기", "훈련 조절", "추천 근거"])
    for (const label of ["일정·훈련 바꾸기", "기록·시작일·다른 일정 확인", "계획 다듬기", "추천 이유·계획 기준", "추천 이유"]) {
      expect(screen.queryByText(label, { selector: "summary" })).toBeNull()
    }
    fireEvent.click(entries.getByRole("button", { name: "일정 바꾸기" }))
    const schedule = within(screen.getByRole("region", { name: "일정 바꾸기" }))
    const startDate = schedule.getByLabelText("계획 시작 날짜")
    expect(startDate).toBeVisible()
    await waitFor(() => expect(startDate).toHaveFocus())
    for (const label of ["운동할 날", "달력 길이", "시간대", "하루 두 번", "대회 날짜"]) {
      expect(schedule.getByRole("button", { name: new RegExp(`^${label} 바꾸기`) })).toBeVisible()
    }
    fireEvent.change(screen.getByLabelText("계획 시작 날짜"), { target: { value: "2026-10-08" } })
    expect(props.onStartDateChange).toHaveBeenCalledWith("2026-10-08")
    expect(schedule.getByRole("button", { name: "계획안 A 일정 펼치기" })).toBeVisible()
    fireEvent.click(entries.getByRole("button", { name: "훈련 조절" }))
    expect(screen.queryByRole("region", { name: "일정 바꾸기" })).toBeNull()
    const workout = within(screen.getByRole("region", { name: "훈련 조절" }))
    expect(workout.getByRole("combobox", { name: "바꿀 일정" })).toBeVisible()
    for (const label of ["목표", "경험", "훈련 종류", "참가 부문"]) {
      expect(workout.getByRole("button", { name: new RegExp(`^${label} 바꾸기`) })).toBeVisible()
    }
    fireEvent.click(workout.getByRole("button", { name: /^경험 바꾸기/ }))
    expect(props.onRefine).toHaveBeenCalledWith("experience")
    fireEvent.click(entries.getByRole("button", { name: "추천 근거" }))
    expect(screen.getByRole("heading", { name: "전체 훈련 시간·목표" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "무엇을 기준으로 만든 훈련인가요?" })).toBeVisible()
    expect(screen.queryByText("무엇을 기준으로 만든 훈련인가요?", { selector: "summary" })).toBeNull()
    expect(JSON.stringify(props.generated)).toBe(original)
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onCatalogChange).not.toHaveBeenCalled()
  })

  it("keeps uncommitted workout conditions and the activation block across purpose switches", () => {
    const props = candidateProps()
    render(<PlanCandidates {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /공간 확인하고 상세 훈련 보기/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: "가속하고 속도를 줄일 충분한 공간이 있어요" }))
    const start = screen.getByRole("button", { name: "이 일정으로 시작" })
    expect(start).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "추천 근거" }))
    expect(start).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("바꾼 훈련을 적용하거나 취소")
    fireEvent.click(screen.getByRole("button", { name: "훈련 조절" }))
    expect(screen.getByRole("checkbox", { name: "가속하고 속도를 줄일 충분한 공간이 있어요" })).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "변경 취소" }))
    expect(start).toBeEnabled()
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onCatalogChange).not.toHaveBeenCalled()
  })
})
