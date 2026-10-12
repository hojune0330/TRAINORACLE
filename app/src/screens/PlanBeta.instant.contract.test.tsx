import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import { todayISO } from "../domain/journal-store"
import { loadAthleteRecords } from "../domain/athlete-records"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"
import * as selection from "./plan-beta/plan-selection"
import * as prescriptionSchema from "../domain/plan-session-schema"
import { isoShift } from "../domain/dates"
import { projectCurrentInstantToday } from "./plan-beta/instant-plan-today-context"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function safetyAndExperience() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }))
  await user.click(screen.getByRole("button", { name: /^매일/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
}

describe("integrated minimal entry to selected plan", () => {
  it.each([["800", "2", "1.5"], ["1500", "4", "23.4"], ["3000", "10", "55"], ["5000", "18", "31"]])(
    "binds the exact %sm non-divisible result after explicit confirmation", async (distance, minutes, seconds) => {
      const user = userEvent.setup()
      render(<PlanBeta />)
      await user.click(screen.getByRole("button", { name: distance === "5000" ? "5km" : `${distance}m` }))
      await user.click(screen.getByRole("button", { name: "내 기록" }))
      await user.type(screen.getByLabelText("분"), minutes!)
      await user.type(screen.getByLabelText("초"), seconds!)
      await user.click(screen.getByText("기록 날짜 추가", { selector: "summary span" }))
      fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: todayISO() } })
      await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
      await safetyAndExperience()
      expect(screen.queryByRole("button", { name: "이 일정으로 시작" })).toBeNull()
      expect(loadPlanBetaState()).toBeNull()
      await user.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
      await user.click(screen.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
      await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
      const stored = loadPlanBetaState()
      const prescription = stored?.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")?.prescription
      expect(prescription?.kind).toBe("PACE_TARGET")
      if (prescription?.kind !== "PACE_TARGET") throw new Error("Expected exact personalized prescription")
      expect(prescription.selectedAnchor.performanceSeconds).toBe(Number(minutes) * 60 + Number(seconds))
      expect(prescription.targetEventDistanceM).toBe(Number(distance))
      expect(await screen.findByRole("heading", { name: "오늘 훈련" }, { timeout: 10_000 })).toBeVisible()
      if (distance === "800") {
        const session = stored!.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")!
        const day = isoShift(stored!.intake.startDate!, session.day - 1)
        const authority = vi.spyOn(prescriptionSchema, "recheckStoredDetailedPrescriptionAuthority")
          .mockReturnValue({ kind: "blocked", operation: "START", code: "TRUSTED_APPROVAL_UNAVAILABLE" })
        expect(projectCurrentInstantToday(stored!, new Date(`${day}T03:00:00Z`)))
          .toMatchObject({ state: "UNAVAILABLE", sessions: [] })
        expect(authority).toHaveBeenCalled()
        expect(loadPlanBetaState()).toEqual(stored)
      }
    }, 20_000)

  it.each([
    ["unknown", null],
    ["stale", isoShift(todayISO(), -730)],
  ] as const)("keeps an %s-date record and starts an RPE plan without personal pace", async (_dateState, achievedOn) => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await user.click(screen.getByRole("button", { name: "1500m" }))
    await user.click(screen.getByRole("button", { name: "내 기록" }))
    await user.type(screen.getByLabelText("분"), "4")
    await user.type(screen.getByLabelText("초"), "23.4")
    if (achievedOn !== null) {
      await user.click(screen.getByText("기록 날짜 추가", { selector: "summary span" }))
      fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: achievedOn } })
    }
    await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
    await safetyAndExperience()
    const records = loadAthleteRecords()
    expect(records).toMatchObject([{ purpose: "RECENT_RESULT", eventDistanceM: 1500,
      performanceSeconds: 263.4, achievedOn }])
    expect(loadPlanBetaState()).toBeNull()
    const start = screen.getByRole("button", { name: "이 일정으로 시작" })
    expect(start).toBeEnabled()
    await user.click(start)
    const stored = loadPlanBetaState()
    expect(stored).not.toBeNull()
    expect(stored!.activePlan.sessions.some(session => session.prescription.kind === "RPE_TIME_RANGE")).toBe(true)
    expect(stored!.activePlan.sessions.some(session => session.prescription.kind === "PACE_TARGET")).toBe(false)
    expect(loadAthleteRecords()).toEqual(records)
    expect(await screen.findByRole("heading", { name: "오늘 훈련" }, { timeout: 10_000 })).toBeVisible()
  }, 20_000)

  it("goal-only remains aspirational when explicitly applied to a marathon pace plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await user.click(screen.getByRole("button", { name: "마라톤" }))
    await user.click(screen.getByRole("button", { name: "목표만 있어요" }))
    await user.type(screen.getByLabelText("분"), "180")
    await user.type(screen.getByLabelText("초"), "0")
    await user.click(screen.getByRole("button", { name: "목표 입력 완료" }))
    await safetyAndExperience()
    expect(loadAthleteRecords()).toMatchObject([{ purpose: "RACE_GOAL", eventDistanceM: 42195,
      performanceSeconds: 10800, achievedOn: null }])
    await user.click(screen.getByRole("button", { name: "추천 근거" }))
    expect(within(screen.getByRole("region", { name: "추천 근거" })).getByText("내 목표")).toBeVisible()
    expect(loadPlanBetaState()).toBeNull()
    await user.click(screen.getByRole("button", { name: "훈련 조절" }))
    // Scope pace controls to their named region, not every calendar button.
    // Check attachment/visibility after each rerender instead of retaining a
    // detached control or rescanning all calendar buttons for every action.
    const paceRegion = screen.getByRole("region", { name: "최근 기록으로 페이스 추천" })
    const paceOffer = () => {
      expect(paceRegion).toBeInTheDocument()
      expect(paceRegion).toBeVisible()
      expect(paceRegion).toHaveAccessibleName("최근 기록으로 페이스 추천")
      return within(paceRegion)
    }
    expect(paceOffer().getByRole("button", { name: "이 기록으로 목표 페이스 보기" })).toBeDisabled()
    await user.click(paceOffer().getByText("기준 바꾸기", { exact: true }))
    await user.selectOptions(paceOffer().getByRole("combobox", { name: "기준 기록" }), loadAthleteRecords()[0]!.id)
    expect(paceOffer().getByRole("button", { name: "이 기록으로 목표 페이스 보기" })).toBeEnabled()
    await user.click(paceOffer().getByRole("button", { name: "이 기록으로 목표 페이스 보기" }))
    const start = screen.getByText("이 일정으로 시작", { selector: "button", exact: true })
    expect(start).toBeVisible()
    expect(start).toHaveRole("button")
    expect(start).toHaveAccessibleName("이 일정으로 시작")
    await user.click(start)
    const stored = loadPlanBetaState()
    expect(stored).not.toBeNull()
    const references = stored!.activePlan.sessions.flatMap(item => item.prescription.kind === "RPE_TIME_RANGE"
      ? item.prescription.catalogWorkout?.inputs.paceReferences ?? [] : [])
    expect(references.length).toBeGreaterThan(0)
    expect(references.every(reference => reference.kind === "GOAL" && reference.eventDistanceM === 42195
      && reference.performanceSeconds === 10800 && reference.achievedOn === null)).toBe(true)
    expect(stored!.activePlan.sessions.some(item => item.prescription.kind === "PACE_TARGET")).toBe(false)
  })

  it("a pending server write cannot be repeated or presented as an activated plan", async () => {
    const user = userEvent.setup()
    let complete!: (value: selection.CandidateSaveResult) => void
    const save = vi.spyOn(selection, "saveSelectedPlanCandidate").mockImplementation(() => new Promise(resolve => { complete = resolve }))
    render(<PlanBeta />)
    await enterPlanWithoutRecord(); await safetyAndExperience()
    const start = screen.getByRole("button", { name: "이 일정으로 시작" })
    await user.dblClick(start)
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "저장 중" })).toBeDisabled()
    await act(async () => { complete({ kind: "rejected", code: "ACCOUNT_PLAN_PENDING" }) })
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "저장 다시 시도" })).toBeNull()
    expect(loadPlanBetaState()).toBeNull()
  }, 20_000)

  it("keeps the actual recommended calendar visible while alternative calendars are collapsed", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await enterPlanWithoutRecord(); await safetyAndExperience()
    const recommended = within(screen.getByRole("region", { name: "이번 일정" }))
    expect(recommended.getByRole("grid")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "일정·운동 시간" }))
    const alternatives = within(screen.getByRole("region", { name: "다른 계획 비교" }))
    const expandA = alternatives.getByRole("button", { name: "계획안 A 일정 펼치기" })
    expect(expandA).toHaveAttribute("aria-expanded", "false")
    expect(alternatives.getByRole("button", { name: "계획안 B 일정 펼치기" })).toHaveAttribute("aria-expanded", "false")
    const calendars = alternatives.getAllByLabelText("9일 훈련 일정")
    expect(calendars).toHaveLength(2)
    calendars.forEach(calendar => expect(calendar).not.toBeVisible())
    await user.click(expandA)
    expect(calendars[0]).toBeVisible()
    expect(calendars[1]).not.toBeVisible()
    expect(alternatives.getAllByText(/주요 훈련/u).length).toBeGreaterThan(0)
  }, 20_000)

  it.each(["ACCOUNT_PLAN_STALE", "ACCOUNT_PLAN_EVIDENCE_REQUIRED", "ACCOUNT_PLAN_REVIEW_REQUIRED"])(
    "%s allows fresh questions without blindly retrying a rejected save", async code => {
      const user = userEvent.setup()
      vi.spyOn(selection, "saveSelectedPlanCandidate").mockResolvedValue({ kind: "rejected", code })
      render(<PlanBeta />)
      await enterPlanWithoutRecord(); await safetyAndExperience()
      await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
      expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
      expect(screen.queryByRole("button", { name: "저장 다시 시도" })).toBeNull()
      await user.click(screen.getByRole("button", { name: "질문 다시 보기" }))
      expect(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u })).toBeVisible()
      expect(loadPlanBetaState()).toBeNull()
    }, 20_000)
})
