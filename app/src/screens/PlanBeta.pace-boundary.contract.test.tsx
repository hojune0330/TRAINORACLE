import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "../domain/athlete-records"
import { PlanBeta } from "./PlanBeta"

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(cleanup)

async function answerMinimumPlanQuestions(): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /^5000m/u }))
  await user.click(screen.getByRole("button", { name: /고등부/u }))
  await user.click(screen.getByRole("button", {
    name: /훈련 계획에 맞춰 달려 본 경험/u,
  }))
  await user.click(screen.getByRole("button", {
    name: /통증은 없고 몸 상태는 평소와 같아요/u,
  }))
  await user.click(screen.getByRole("button", { name: "내 계획 완성하기" }))
  await user.click(screen.getByRole("button", { name: /지속 페이스.*LT/u }))
  await user.click(screen.getByRole("button", { name: /RPE 기준으로 받기/u }))
  await user.click(screen.getByRole("button", { name: /^3일/u }))
  await user.click(screen.getByRole("button", { name: /9일 계획 받기/u }))
  await user.click(screen.getByRole("button", { name: /날마다 달라요/u }))
  await user.click(screen.getByRole("button", { name: /하루 한 번 운동/u }))
  await user.click(screen.getByRole("button", { name: "날짜 없이 계획 후보 보기" }))
}

function saveCurrentSameEventRecord(): void {
  const today = new Date("2026-07-30T00:00:00.000Z")
  const record = createSelfReportedAthleteRecord({
    id: "current-5000m",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-07-20",
    seasonId: null,
  }, today)
  expect(record).not.toBeNull()
  if (record === null) return
  expect(saveAthleteRecord(record, today).ok).toBe(true)
}

describe("plan beta pace authority boundary", () => {
  it("does not automatically select a matching current record", async () => {
    saveCurrentSameEventRecord()

    render(<PlanBeta />)
    await answerMinimumPlanQuestions()

    expect(screen.getByText(
      /경기 기록 1개 · 최근 일지 0개 연결/u,
    )).toBeInTheDocument()
    expect(screen.queryByText(/3:42/u)).toBeNull()
    expect(screen.queryByText(/오늘 반복 목표/u)).toBeNull()
  })
})
