import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanBeta } from "./PlanBeta"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { loadAthleteRecords } from "../domain/athlete-records"
import * as generation from "../domain/plan-beta-flow"
import { enterPlanWithoutRecord } from "./plan-beta/instant-plan.test-helper"

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await initializeCanonicalJournalFixture() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("precision intake shares generation and explicit activation", () => {
  it("keeps the exact unsaved numeric entry when switching input mode", async () => {
    const user = userEvent.setup()
    render(<PlanBeta />)
    expect(screen.getByRole("button", { name: "간단히" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "직접 설정" })).toHaveAttribute("aria-pressed", "false")
    await user.click(screen.getByRole("button", { name: "1500m" }))
    await user.click(screen.getByRole("button", { name: "내 기록" }))
    await user.type(screen.getByLabelText("분", { exact: true }), "4")
    await user.type(screen.getByLabelText("초", { exact: true }), "23.4")
    const seconds = screen.getByLabelText("초", { exact: true })
    await user.click(screen.getByRole("button", { name: "직접 설정" }))
    expect(screen.getByRole("button", { name: "직접 설정" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("초", { exact: true })).toBe(seconds)
    expect(seconds).toHaveValue("23.4")
    await user.click(screen.getByRole("button", { name: "간단히" }))
    expect(seconds).toHaveValue("23.4")
    expect(screen.getByRole("button", { name: "기록 저장하고 계속" })).toBeEnabled()
    expect(loadAthleteRecords()).toEqual([])
    expect(loadPlanBetaState()).toBeNull()
  })

  it("generates only after final body confirmation and saves chosen precision settings only on start", async () => {
    const generate = vi.spyOn(generation, "generatePlanFromDraft")
    render(<PlanBeta />)
    fireEvent.click(screen.getByRole("button", { name: "직접 설정" }))
    await enterPlanWithoutRecord("1500m")
    fireEvent.click(screen.getByRole("button", { name: /빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요/u }))
    fireEvent.click(screen.getByRole("button", { name: "날짜 없이 계속" }))
    fireEvent.click(screen.getByRole("button", { name: "오늘부터 · 기본값" }))
    fireEvent.click(screen.getByRole("button", { name: /^7일/u }))
    fireEvent.click(screen.getByRole("button", { name: /^3일/u }))
    fireEvent.click(screen.getByRole("button", { name: /저녁에 운동해요/u }))
    fireEvent.click(screen.getByRole("button", { name: /선택한 조건/u }))
    expect(screen.getByRole("heading", { name: "계획 기준 확인" })).toBeVisible()
    expect(generate).not.toHaveBeenCalled()
    expect(loadPlanBetaState()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /몸 상태 확인으로/u }))
    expect(generate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /통증은 없고 몸 상태는 평소와 같아요/u }))
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ requestedFrameLength: 7, availableDayCount: 3, trainingTimePreference: "EVENING" })
    expect(loadPlanBetaState()).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(await screen.findByRole("heading", { name: "오늘 훈련" }, { timeout: 10000 })).toBeVisible()
    expect(loadPlanBetaState()?.intake).toMatchObject({ requestedFrameLength: 7, availableDayCount: 3, trainingTimePreference: "EVENING" })
  }, 20000)

  it("cannot skip unanswered required facts by jumping to review", async () => {
    const generate = vi.spyOn(generation, "generatePlanFromDraft")
    render(<PlanBeta />)
    fireEvent.click(screen.getByRole("button", { name: "직접 설정" }))
    await enterPlanWithoutRecord()
    fireEvent.click(screen.getByRole("button", { name: /선택한 조건/u }))
    expect(screen.getByRole("button", { name: /몸 상태 확인으로/u })).toBeDisabled()
    expect(generate).not.toHaveBeenCalled()
    expect(loadPlanBetaState()).toBeNull()
  })
})
