import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { TrainingHome } from "./TrainingHome"

const BASE = { homeMode: "WELCOME", todayMessage: "아직 오늘 기록이 없어요.", todayRecordCount: 0, journalSummary: "아직 기록이 없어요", flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택", planSummary: "저장된 계획 없음 · 계획안 만들기", analysisSummary: "기록이 쌓이면 변화를 볼 수 있어요", showMinjiPrompt: true, nextTraining: null, briefing: "" } satisfies TrainingHomeViewModel
const TRAINING = { ...BASE, homeMode: "TRAINING", planSummary: "저장된 계획 · 2개 일정", nextTraining: { date: "2026-08-20", laterSameDaySession: null, session: { day: 2, slot: "PM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 5, maximum: 6 }, durationMinutes: { minimum: 25, maximum: 40 } } } } } satisfies TrainingHomeViewModel

afterEach(cleanup)

describe("training home presentation", () => {
  it("keeps welcome concise and exposes learning and decoration entry points", () => {
    const learn = vi.fn(); const decorate = vi.fn(); const guide = vi.fn()
    render(<TrainingHome model={BASE} onOpenContent={learn} onOpenRewards={decorate} onOpenGuide={guide} />)
    expect(screen.getByRole("heading", { name: "오늘 운동을 기록해요" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련 배우기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지 꾸미기" })).toBeVisible()
    expect(screen.getByRole("button", { name: "일지 예시 보기" })).toBeVisible()
    expect(screen.getByRole("navigation", { name: "바로 시작하기" }).querySelectorAll("button")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "훈련 배우기" })); fireEvent.click(screen.getByRole("button", { name: "일지 꾸미기" }))
    expect(learn).toHaveBeenCalledOnce(); expect(decorate).toHaveBeenCalledOnce()
  })
  it("places safety notice immediately after the header", () => {
    render(<TrainingHome model={BASE} safetyNotice={<div data-testid="safety">안전 안내</div>} />)
    expect(screen.getByRole("banner").nextElementSibling).toBe(screen.getByTestId("safety"))
  })
  it("uses next-training callback first and preserves prescription metadata", () => {
    const next = vi.fn(); const plan = vi.fn()
    render(<TrainingHome model={TRAINING} onOpenNextTraining={next} onOpenPlan={plan} />)
    const card = screen.getByRole("button", { name: /^다음 훈련 ·/u })
    expect(card).toHaveTextContent(/총 25~40분.*RPE 5~6/u); fireEvent.click(card)
    expect(next).toHaveBeenCalledOnce(); expect(plan).not.toHaveBeenCalled()
  })
  it("does not claim all training is complete when today has a record", () => {
    render(<TrainingHome model={{ ...TRAINING, todayRecordCount: 1, briefing: "오늘 기록 · 수면 7h" }} />)
    expect(screen.getByText("오늘 기록을 남겼어요.")).toBeVisible(); expect(screen.getByText("다음 훈련")).toBeVisible(); expect(screen.queryByText(/모든 훈련을 마쳤어요/u)).toBeNull()
  })
})
