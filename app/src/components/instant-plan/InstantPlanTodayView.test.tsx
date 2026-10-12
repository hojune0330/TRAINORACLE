import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InstantPlanToday } from "../../domain/instant-plan-contract"
import { InstantPlanTodayView } from "./InstantPlanTodayView"

afterEach(cleanup)

// Synthetic display values verify transcription; they authorize no prescription.
const today: InstantPlanToday = {
  dateLabel: "2026-09-21 월요일",
  state: "SCHEDULED",
  title: "오늘 할 훈련",
  sourceLabel: "시험 제작자의 프로그램 · 2회차 · 같은 구성, 개인 페이스",
  sessions: [
    { id: "am", slotLabel: "오전", title: "준비 훈련", recorded: false, steps: [
      { role: "PREPARATION", label: "준비", instruction: "준비 동작 8분" },
      { role: "MAIN", label: "본운동", instruction: "안내된 동작 12분" },
    ] },
    { id: "pm", slotLabel: "오후", title: "반복 훈련", recorded: false, steps: [
      { role: "PREPARATION", label: "준비", instruction: "준비 달리기 10분" },
      { role: "MAIN", label: "본운동", instruction: "400m × 3회 · 400m 한 번에 100초 · 1km당 페이스 4분 10초" },
      { role: "RECOVERY", label: "사이 회복", instruction: "각 반복 사이 90초 걷기" },
      { role: "COOLDOWN", label: "정리", instruction: "정리 달리기 5분" },
    ] },
  ],
}

describe("InstantPlanTodayView", () => {
  it("keeps incomplete repeat guidance visible and opens only the selected method", () => {
    const onViewSession = vi.fn()
    render(<InstantPlanTodayView today={{ ...today, sessions: [{ ...today.sessions[0]!,
      guidanceNotice: "반복 횟수와 회복 시간은 정해지지 않았어요.",
      steps: [{ role: "TOTAL_DURATION", label: "총 시간", instruction: "총 35분 · RPE 6~7" },
        { role: "METHOD", label: "방법", instruction: "저장된 안내" }],
    }] }} compact onViewSession={onViewSession} />)
    expect(screen.getByRole("note")).toBeVisible()
    expect(screen.getByText("반복 횟수와 회복 시간은 정해지지 않았어요.")).not.toBeVisible()
    expect(screen.getByText("이 시간 내내 강하게 뛰지 마세요.")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "반복·휴식이 아직 없어요" }))
    expect(screen.getByText("반복 횟수와 회복 시간은 정해지지 않았어요.")).toBeVisible()
    expect(screen.queryByText("저장된 안내")).not.toBeInTheDocument()
    expect(screen.queryByText("훈련 방법", { selector: "summary" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "오전 훈련 방법·근거" }))
    expect(onViewSession).toHaveBeenCalledExactlyOnceWith("am")
  })
  it("prioritizes recording while retaining every main step and recovery in compact mode", () => {
    const record = vi.fn(), view = vi.fn()
    const session = { ...today.sessions[1]!, steps: [
      ...today.sessions[1]!.steps,
      { role: "MAIN" as const, label: "본운동", instruction: "마지막 200m · 45초" },
      { role: "RECOVERY" as const, label: "회복", instruction: "세트 사이 3분 서서 쉬기" },
    ] }
    render(<InstantPlanTodayView compact today={{ ...today, sessions: [session] }} onRecordSession={record} onViewSession={view} />)
    const button = screen.getByRole("button", { name: "오후 훈련 기록 남기기" })
    const explanation = screen.getByRole("button", { name: "오후 훈련 방법·근거" })
    expect(button).toHaveClass("instant-plan__button")
    expect(button.compareDocumentPosition(explanation) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    for (const step of session.steps.filter(step => ["본운동", "회복", "사이 회복"].includes(step.label))) {
      expect(screen.getByText(step.instruction)).toBeVisible()
    }
    fireEvent.click(button)
    expect(record).toHaveBeenCalledExactlyOnceWith("pm")
    expect(view).not.toHaveBeenCalled()
  })
  it("shows both session summaries first and expands only the selected session", () => {
    const { container } = render(<InstantPlanTodayView today={today} />)
    expect(screen.getByRole("heading", { level: 2, name: today.title })).toHaveClass("app-heading--screen", "app-heading--accent")
    expect(screen.getByText(today.dateLabel)).toBeVisible()
    expect(screen.getByText(today.sourceLabel!)).toBeVisible()
    const picker = screen.getByRole("group", { name: "오늘 세션 선택" })
    expect(within(picker).getAllByRole("button")).toHaveLength(2)
    expect(within(picker).getByRole("button", { name: /오전.*준비 훈련/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(picker).getByRole("button", { name: /오후.*반복 훈련/ })).toHaveAttribute("aria-pressed", "false")

    const morning = screen.getByRole("region", { name: "오전 · 준비 훈련" })
    for (const step of today.sessions[0]!.steps) {
      expect(within(morning).getByText(step.label)).toBeVisible()
      expect(within(morning).getByText(step.instruction)).toBeVisible()
    }
    expect(screen.queryByRole("region", { name: "오후 · 반복 훈련" })).not.toBeInTheDocument()
    expect(screen.queryByText("각 반복 사이 90초 걷기")).not.toBeInTheDocument()

    fireEvent.click(within(picker).getByRole("button", { name: /오후.*반복 훈련/ }))
    const afternoon = screen.getByRole("region", { name: "오후 · 반복 훈련" })
    expect(within(afternoon).getByText("각 반복 사이 90초 걷기")).toBeVisible()
    expect(screen.queryByRole("region", { name: "오전 · 준비 훈련" })).not.toBeInTheDocument()
    expect(within(picker).getByRole("button", { name: /오후.*반복 훈련/ })).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelector("details")).toBeNull()
    expect(screen.queryByText("미수행")).not.toBeInTheDocument()
  })

  it("shows a single session directly without adding a selection step", () => {
    render(<InstantPlanTodayView today={{ ...today, sessions: [today.sessions[0]!] }} />)
    expect(screen.queryByRole("group", { name: "오늘 세션 선택" })).not.toBeInTheDocument()
    const region = screen.getByRole("region", { name: "오전 · 준비 훈련" })
    expect(within(region).getByText("준비 동작 8분")).toBeVisible()
    expect(within(region).getByText("안내된 동작 12분")).toBeVisible()
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    expect(screen.queryByText("이 시간 내내 강하게 뛰지 마세요.")).not.toBeInTheDocument()
  })

  it("records the specific slot only after an explicit user action", () => {
    const onRecordSession = vi.fn()
    const onChangeSchedule = vi.fn()
    render(<InstantPlanTodayView today={today} onRecordSession={onRecordSession} onChangeSchedule={onChangeSchedule} />)
    expect(onRecordSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: /오후.*반복 훈련/ }))
    fireEvent.click(screen.getByRole("button", { name: "오후 훈련 기록 남기기" }))
    expect(onRecordSession).toHaveBeenCalledExactlyOnceWith("pm")
    fireEvent.click(screen.getByRole("button", { name: "일정 확인" }))
    expect(onChangeSchedule).toHaveBeenCalledExactlyOnceWith("pm")
  })

  it("keeps the second slot visible after the first slot has a report", () => {
    const onRecordSession = vi.fn()
    render(<InstantPlanTodayView today={{ ...today, state: "PARTLY_RECORDED", sessions: [
      { ...today.sessions[0]!, recorded: true }, today.sessions[1]!,
    ] }} onRecordSession={onRecordSession} />)
    expect(screen.getByRole("status")).toHaveTextContent("일부 세션")
    const picker = screen.getByRole("group", { name: "오늘 세션 선택" })
    expect(within(picker).getByRole("button", { name: /오전.*준비 훈련/ })).toHaveTextContent("남긴 기록 있음")
    expect(screen.queryByRole("region", { name: "오전 · 준비 훈련" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "오전 훈련 기록 남기기" })).not.toBeInTheDocument()
    expect(screen.getByText("각 반복 사이 90초 걷기")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "오후 훈련 기록 남기기" }))
    expect(onRecordSession).toHaveBeenCalledExactlyOnceWith("pm")
    expect(screen.queryByText(/오늘 훈련 완료|모두 완료/)).not.toBeInTheDocument()
  })

  it("treats recorded sessions as reports instead of claiming a measured performance", () => {
    const onContinue = vi.fn()
    render(<InstantPlanTodayView today={{ ...today, state: "RECORDED", sessions: today.sessions.map(session => ({ ...session, recorded: true })) }}
      onRecordSession={vi.fn()} onContinue={onContinue} />)
    expect(screen.getByRole("status")).toHaveTextContent("오늘 남긴 기록과 다음 일정")
    expect(within(screen.getByRole("group", { name: "오늘 세션 선택" })).getAllByText("남긴 기록 있음")).toHaveLength(2)
    expect(screen.queryByText(/측정 완료|검증된 기록|오늘 훈련 완료/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /훈련 기록 남기기/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "다음 일정 확인" }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("shows upcoming preparation before start without encouraging a workout now", () => {
    render(<InstantPlanTodayView today={{ ...today, state: "BEFORE_START" }} onRecordSession={vi.fn()} onChangeSchedule={vi.fn()} onContinue={vi.fn()} />)
    expect(screen.getByRole("status")).toHaveTextContent("시작일 전")
    expect(screen.queryByText("각 반복 사이 90초 걷기")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /오후.*반복 훈련/ }))
    expect(screen.getByText("각 반복 사이 90초 걷기")).toBeVisible()
    expect(screen.queryByRole("button", { name: /훈련 기록 남기기|오늘은 어려워요/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "전체 일정 확인" })).toBeEnabled()
  })

  it.each([
    { state: "REST", message: "휴식일", action: "다음 일정 확인" },
    { state: "RETURN_AFTER_GAP", message: "기록이 없다고 미수행으로 판단하지 않아요", action: "이어가기 전 확인" },
    { state: "COMPLETED", message: "계획 기간이 끝났어요", action: "다음 단계 확인" },
    { state: "UNAVAILABLE", message: "훈련을 안내할 수 없어요", action: "계획 상태 확인" },
  ] as const)("does not expose stale workout instructions or record actions in $state", ({ state, message, action }) => {
    const onContinue = vi.fn()
    const onRecordSession = vi.fn()
    render(<InstantPlanTodayView today={{ ...today, state }} onRecordSession={onRecordSession} onChangeSchedule={vi.fn()} onContinue={onContinue} />)
    expect(screen.getByRole(state === "UNAVAILABLE" ? "alert" : "status")).toHaveTextContent(message)
    expect(screen.queryByText("각 반복 사이 90초 걷기")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /훈련 기록 남기기|오늘은 어려워요/ })).not.toBeInTheDocument()
    expect(onRecordSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: action }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("does not create nonfunctional controls when callbacks are absent", () => {
    render(<InstantPlanTodayView today={{ ...today, state: "RETURN_AFTER_GAP" }} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toBeVisible()
  })

  it("keeps total time and every execution phase visible; only method details are collapsed", async () => {
    const compactToday: InstantPlanToday = { ...today, sourceLabel: undefined, sessions: [{ ...today.sessions[1]!, steps: [
      { role: "TOTAL_DURATION", label: "총 시간", instruction: "총 35분 · RPE 3~4" }, ...today.sessions[1]!.steps,
      { role: "METHOD", label: "방법", instruction: "별도 훈련 방법" },
    ] }] }
    const { rerender } = render(<InstantPlanTodayView today={compactToday} compact />)
    expect(screen.getByText("총 35분 · RPE 3~4")).toBeVisible()
    expect(screen.queryByText("아직 기록 없음")).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByText("준비 달리기 10분")).toBeVisible()
    expect(screen.getByText("각 반복 사이 90초 걷기")).toBeVisible()
    expect(screen.getByText(/400m × 3회/)).toBeVisible()
    expect(screen.getByText("정리 달리기 5분")).toBeVisible()
    expect(screen.queryByText("별도 훈련 방법")).not.toBeVisible()
    fireEvent.click(screen.getByText("훈련 방법"))
    expect(screen.getByText("별도 훈련 방법")).toBeVisible()
    expect(screen.getByText("각 반복 사이 90초 걷기")).toBeVisible()
    expect(screen.getByText(/400m × 3회/)).toBeVisible()
    rerender(<InstantPlanTodayView today={{ ...compactToday, state: "UNAVAILABLE" }} compact />)
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.queryByText("총 35분 · RPE 3~4")).toBeNull()
  })
})
