import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstantPlanActionState, InstantPlanRecommendation } from "../../domain/instant-plan-contract"
import { InstantPlanRecommendationView } from "./InstantPlanRecommendationView"

afterEach(cleanup)

// Display-only synthetic values, not an approved training recipe.
const recommendation: InstantPlanRecommendation = {
  id: "personal-candidate-1",
  title: "표시 시험 프로그램",
  reason: "선택한 기록과 일정으로 준비한 후보예요.",
  periodLabel: "2026-09-21 ~ 2026-09-29 · 9일",
  sessionCount: 2,
  durationLabel: "보통 35분 · 가장 긴 훈련 50분",
  firstSessionLabel: "2026-09-21 오전 · 준비 훈련",
  source: { kind: "GENERAL" },
  days: [
    { date: "2026-09-21", dayLabel: "1일차", sessions: [
      { id: "s-am", slotLabel: "오전", title: "준비 훈련", role: "BASE" },
      { id: "s-pm", slotLabel: "오후", title: "주요 반복 훈련", role: "MAIN" },
    ] },
    { date: "2026-09-22", dayLabel: "2일차", sessions: [
      { id: "s-rest", slotLabel: "하루", title: "계획된 휴식", role: "OFF" },
    ] },
  ],
}

describe("InstantPlanRecommendationView", () => {
  it("shows the commitment and compact dated AM/PM roles before one explicit start", () => {
    const onStart = vi.fn()
    render(<InstantPlanRecommendationView recommendation={recommendation} actionState={{ kind: "READY" }} onStart={onStart} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(recommendation.title)
    expect(screen.getByText(recommendation.periodLabel)).toBeVisible()
    expect(screen.getByText("2회")).toBeVisible()
    expect(screen.getByText(recommendation.durationLabel)).toBeVisible()
    expect(screen.getByText(recommendation.firstSessionLabel)).toBeVisible()
    const schedule = screen.getByRole("region", { name: "이번 일정" })
    expect(within(schedule).getByText("9/21 (월)")).toHaveAttribute("dateTime", "2026-09-21")
    expect(within(schedule).getByText("9/22 (화)")).toBeVisible()
    expect(within(schedule).getByText("오전")).toBeVisible()
    expect(within(schedule).getByText("오후")).toBeVisible()
    expect(within(schedule).getByText("핵심 훈련")).toBeVisible()
    expect(within(schedule).getByText("기초 지구력")).toBeVisible()
    expect(within(schedule).getByText("휴식")).toBeVisible()
    expect(within(schedule).queryByText(/주요 반복 훈련|계획된 휴식/)).not.toBeInTheDocument()
    expect(onStart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(onStart).toHaveBeenCalledExactlyOnceWith("personal-candidate-1")
  })

  it("keeps nine days compact while full session titles and the reason remain accessible on demand", () => {
    const days: InstantPlanRecommendation["days"] = Array.from({ length: 9 }, (_, index) => ({
      date: `2026-09-${21 + index}`,
      dayLabel: `${index + 1}일차`,
      sessions: [{ id: `session-${index}`, slotLabel: "오전", role: "BASE" as const, title: `긴 훈련 제목 ${index + 1}: 준비와 상세 반복 안내` }],
    }))
    render(<InstantPlanRecommendationView recommendation={{ ...recommendation, days }} actionState={{ kind: "READY" }} onStart={vi.fn()} />)
    const schedule = screen.getByRole("region", { name: "이번 일정" })
    expect(within(schedule).getAllByRole("heading", { level: 4 })).toHaveLength(9)
    expect(within(schedule).getByText("9/29 (화)")).toBeVisible()
    expect(within(schedule).queryByText(/긴 훈련 제목/)).not.toBeInTheDocument()
    const titles = screen.getAllByText(/긴 훈련 제목/)
    expect(titles).toHaveLength(9)
    for (const title of titles) expect(title).not.toBeVisible()
    const summary = screen.getByText("전체 훈련 내용")
    expect(summary.closest("details")).not.toHaveAttribute("open")
    expect(screen.getByRole("button", { name: "이 일정으로 시작" })).toBeVisible()
    fireEvent.click(summary)
    for (const title of titles) expect(title).toBeVisible()
    expect(screen.getByText(recommendation.reason)).not.toBeVisible()
    fireEvent.click(screen.getByText("추천 이유"))
    expect(screen.getByText(recommendation.reason)).toBeVisible()
  })

  it("keeps current evidence, goal, and actual program purpose separately labelled", () => {
    render(<InstantPlanRecommendationView
      recommendation={recommendation} actionState={{ kind: "READY" }} onStart={vi.fn()}
      anchorLabel="5km 25:00 · 2026-09-10" goalLabel="5km 22:00" programPurposeLabel="검토된 시작 단계"
    />)
    expect(screen.getByText("기준 기록").nextElementSibling).toHaveTextContent("5km 25:00 · 2026-09-10")
    expect(screen.getByText("내 목표").nextElementSibling).toHaveTextContent("5km 22:00")
    expect(screen.getByText("이번 프로그램의 목적").nextElementSibling).toHaveTextContent("검토된 시작 단계")
    expect(screen.getByText(/목표 기록은 현재 능력/)).toBeVisible()
  })

  it("does not invent a current record for a goal-only result", () => {
    render(<InstantPlanRecommendationView recommendation={recommendation} actionState={{ kind: "READY" }} onStart={vi.fn()} goalLabel="5km 22:00" />)
    expect(screen.queryByText("기준 기록")).not.toBeInTheDocument()
    expect(screen.getByText("내 목표").nextElementSibling).toHaveTextContent("5km 22:00")
  })

  it("preserves creator identity but starts the personal candidate, not its source ID", () => {
    const onStart = vi.fn()
    render(<InstantPlanRecommendationView recommendation={{ ...recommendation,
      source: { kind: "CREATOR", programId: "creator-original", version: "1.0" },
      creatorLabel: "시험 제작자의 프로그램 · 같은 구성, 개인 페이스",
    }} actionState={{ kind: "READY" }} onStart={onStart} />)
    expect(screen.getByText("시험 제작자의 프로그램 · 같은 구성, 개인 페이스")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "이 일정으로 시작" }))
    expect(onStart).toHaveBeenCalledExactlyOnceWith(recommendation.id)
  })

  it.each<InstantPlanActionState>([
    { kind: "SAVING" },
    { kind: "PENDING", message: "계정 저장 확인을 기다리고 있어요." },
    { kind: "FAILED", message: "저장하지 못했어요. 다시 시도해 주세요." },
    { kind: "BLOCKED", message: "계획의 적용 조건을 다시 확인해 주세요." },
  ])("keeps the result and prevents start during $kind", actionState => {
    const onStart = vi.fn()
    const onRetry = vi.fn()
    render(<InstantPlanRecommendationView recommendation={recommendation} actionState={actionState} onStart={onStart} onRetry={onRetry} />)
    const start = screen.getByRole("button", { name: actionState.kind === "SAVING" ? "저장 중" : "이 일정으로 시작" })
    expect(start).toBeDisabled()
    fireEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
    expect(screen.getByText(recommendation.periodLabel)).toBeVisible()
    expect(within(screen.getByRole("region", { name: "이번 일정" })).getByText("핵심 훈련")).toBeVisible()
    expect(screen.getByText(/주요 반복 훈련/)).not.toBeVisible()
    const status = screen.getByRole(actionState.kind === "FAILED" || actionState.kind === "BLOCKED" ? "alert" : "status")
    expect(status).toBeVisible()
    if ("message" in actionState) expect(status).toHaveTextContent(actionState.message)
    expect(screen.queryByText(/시작됐어요|저장 완료/)).not.toBeInTheDocument()
    if (actionState.kind === "FAILED") {
      const recovery = screen.getByRole("region", { name: "계획 저장 상태" })
      expect(within(recovery).getByRole("alert")).toHaveTextContent(actionState.message)
      fireEvent.click(within(recovery).getByRole("button", { name: "저장 다시 시도" }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    } else {
      expect(screen.queryByRole("button", { name: "저장 다시 시도" })).not.toBeInTheDocument()
    }
  })

  it("offers optional controls only when their existing handlers are available", () => {
    const onEditSchedule = vi.fn()
    const onShowAlternatives = vi.fn()
    const { rerender } = render(<InstantPlanRecommendationView recommendation={recommendation} actionState={{ kind: "READY" }} onStart={vi.fn()} />)
    expect(screen.getAllByRole("button")).toHaveLength(1)
    rerender(<InstantPlanRecommendationView recommendation={recommendation} actionState={{ kind: "READY" }} onStart={vi.fn()}
      onEditSchedule={onEditSchedule} onShowAlternatives={onShowAlternatives} />)
    fireEvent.click(screen.getByRole("button", { name: "시작일·훈련일 바꾸기" }))
    fireEvent.click(screen.getByRole("button", { name: "다른 계획 보기" }))
    expect(onEditSchedule).toHaveBeenCalledTimes(1)
    expect(onShowAlternatives).toHaveBeenCalledTimes(1)
    rerender(<InstantPlanRecommendationView recommendation={recommendation} actionState={{ kind: "PENDING", message: "확인 중" }} onStart={vi.fn()}
      onEditSchedule={onEditSchedule} onShowAlternatives={onShowAlternatives} />)
    expect(screen.getByRole("button", { name: "시작일·훈련일 바꾸기" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "다른 계획 보기" })).toBeDisabled()
  })

  it("does not label a missing session projection as a prescribed rest day", () => {
    render(<InstantPlanRecommendationView recommendation={{ ...recommendation, days: [
      { date: "2026-09-21", dayLabel: "1일차", sessions: [] },
    ] }} actionState={{ kind: "BLOCKED", message: "일정을 확인해 주세요." }} onStart={vi.fn()} />)
    expect(screen.getByText("등록된 훈련 없음")).toBeVisible()
    expect(screen.queryByText("휴식")).not.toBeInTheDocument()
  })
})
