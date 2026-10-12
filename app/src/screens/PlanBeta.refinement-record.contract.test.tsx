import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PlanBeta } from "./PlanBeta"
import { todayISO } from "../domain/journal-store"
import { loadAthleteRecords } from "../domain/athlete-records"
import { loadPlanBetaState } from "../domain/plan-beta-store"

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(cleanup)

async function confirmedPersonalPlan() {
  const user = userEvent.setup()
  render(<PlanBeta />)
  await user.click(screen.getByRole("button", { name: "1500m" }))
  await user.click(screen.getByRole("button", { name: "내 기록" }))
  await user.type(screen.getByLabelText("분"), "4")
  await user.type(screen.getByLabelText("초"), "23.4")
  await user.click(screen.getByText("기록 날짜 추가", { selector: "summary span" }))
  fireEvent.change(screen.getByLabelText("기록 달성일"), { target: { value: todayISO() } })
  await user.click(screen.getByRole("button", { name: "기록 입력 완료" }))
  await user.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }))
  await user.click(screen.getByRole("button", { name: /^매일/u }))
  await user.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
  await user.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
  await user.click(screen.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
  expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
  return user
}

describe("personal plan refinement without a dead end", () => {
  it("keeps the chosen same-event record after changing the calendar but requires a fresh confirmation", async () => {
    const user = await confirmedPersonalPlan()
    await user.click(screen.getByRole("button", { name: "일정·운동 시간" }))
    const schedule = within(screen.getByRole("region", { name: "일정 조건" }))
    await user.click(schedule.getByRole("button", { name: /^달력 길이 바꾸기/u }))
    await user.click(screen.getByRole("button", { name: /^7일만 먼저 받기/u }))
    expect(loadPlanBetaState()).toBeNull()
    await user.click(screen.getByRole("button", { name: "기준 기록 확인하기" }))
    expect(screen.getByRole("button", { name: "이 기록으로 개인 페이스 적용" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "이 기록으로 개인 페이스 적용" }))
    await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(loadPlanBetaState()?.intake.requestedFrameLength).toBe(7)
    expect(loadPlanBetaState()?.activePlan.sessions.some(session => session.prescription.kind === "PACE_TARGET")).toBe(true)
  }, 25000)

  it.each([/달리기를 막 시작했어요/u, /훈련 계획에 맞춰 달려 본 경험/u])(
    "returns to an eligible time/effort plan when the experience is changed to %s", async answer => {
      const user = await confirmedPersonalPlan()
      const records = loadAthleteRecords()
      await user.click(screen.getByRole("button", { name: "훈련 조절" }))
      const workout = within(screen.getByRole("region", { name: "훈련 조건" }))
      await user.click(workout.getByRole("button", { name: /^경험 바꾸기/u }))
      await user.click(screen.getByRole("button", { name: answer }))
      expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeEnabled()
      expect(screen.queryByRole("button", { name: "기준 기록 확인하기" })).toBeNull()
      await user.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
      const stored = loadPlanBetaState()
      expect(stored).not.toBeNull()
      expect(stored!.activePlan.sessions.some(session => session.prescription.kind === "PACE_TARGET")).toBe(false)
      expect(stored!.intake.selectedDetailedTemplateRef).toBeNull()
      expect(loadAthleteRecords()).toEqual(records)
    }, 25000)
})
