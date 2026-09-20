import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
  await user.click(screen.getByRole("button", { name: /구조화된 훈련과 경기 경험/u }))
  await user.click(screen.getByRole("button", { name: /^매일/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
}

describe("integrated minimal entry to selected plan", () => {
  it.each([["800", "2", "1.5"], ["1500", "4", "23.4"], ["3000", "10", "55"], ["5000", "18", "31"]])(
    "binds the exact %sm non-divisible result after explicit confirmation", async (distance, minutes, seconds) => {
      const user = userEvent.setup()
      render(<PlanBeta />)
      await user.selectOptions(screen.getByRole("combobox", { name: "종목" }), distance!)
      await user.type(screen.getByLabelText("분"), minutes!)
      await user.type(screen.getByLabelText("초"), seconds!)
      fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: todayISO() } })
      await user.click(screen.getByRole("button", { name: "내 계획 받기" }))
      await safetyAndExperience()
      expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeDisabled()
      expect(loadPlanBetaState()).toBeNull()
      await user.click(screen.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
      await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
      const stored = loadPlanBetaState()
      const prescription = stored?.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")?.prescription
      expect(prescription?.kind).toBe("PACE_TARGET")
      if (prescription?.kind !== "PACE_TARGET") throw new Error("Expected exact personalized prescription")
      expect(prescription.selectedAnchor.performanceSeconds).toBe(Number(minutes) * 60 + Number(seconds))
      expect(prescription.targetEventDistanceM).toBe(Number(distance))
      expect(screen.getByRole("heading", { name: "오늘 훈련" })).toBeVisible()
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

  it("goal-only remains a goal and can start a non-pace plan", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await user.click(screen.getByRole("radio", { name: "목표만 있어요" }))
    await user.selectOptions(screen.getByRole("combobox", { name: "종목" }), "42195")
    await user.type(screen.getByLabelText("분"), "180")
    await user.type(screen.getByLabelText("초"), "0")
    await user.click(screen.getByRole("button", { name: "내 계획 받기" }))
    await safetyAndExperience()
    expect(loadAthleteRecords()).toEqual([])
    expect(screen.getByText("내 목표")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(loadPlanBetaState()?.activePlan.sessions.some(item => item.prescription.kind === "PACE_TARGET")).toBe(false)
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
  })

  it("keeps actual calendar previews when both alternatives are collapsed", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    await enterPlanWithoutRecord(); await safetyAndExperience()
    await user.click(screen.getByRole("button", { name: "다른 계획 보기" }))
    expect(screen.getByRole("button", { name: "계획안 A 일정 펼치기" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "계획안 B 일정 펼치기" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getAllByLabelText("9일 훈련 일정")).toHaveLength(2)
    expect(screen.getAllByText(/주요 훈련/u).length).toBeGreaterThan(0)
  })

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
    })
})
