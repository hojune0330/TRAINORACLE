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
  it("opens the selected full workout from a category card without recording or changing either slot", () => {
    const view = vi.fn(), record = vi.fn()
    const original = JSON.stringify(today)
    render(<InstantPlanTodayView today={today} navigationCards onViewSession={view} onRecordSession={record} />)
    expect(screen.queryByText("각 반복 사이 90초 걷기")).toBeNull()
    const afternoon = screen.getByRole("button", { name: "오후 훈련 내용 보기 · 반복 훈련" })
    expect(afternoon).toHaveAttribute("data-category", "training")
    expect(afternoon).toHaveClass("category-card")
    expect(afternoon).toHaveTextContent("반복 훈련")
    expect(afternoon).not.toHaveTextContent("훈련 내용 보기")
    fireEvent.click(afternoon)
    expect(view).toHaveBeenCalledExactlyOnceWith("pm")
    expect(record).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "오전 훈련 기록 남기기" }))
    expect(record).toHaveBeenCalledExactlyOnceWith("am")
    expect(JSON.stringify(today)).toBe(original)
  })

  it("uses the existing total once in entry cards and retains exact slot navigation and detailed steps", () => {
    const view = vi.fn(), record = vi.fn()
    const compact = { ...today, sessions: [{ ...today.sessions[1]!, title: "중간 걷기 조깅 · Split Easy", steps: [
      { role: "TOTAL_DURATION" as const, label: "총 시간", instruction: "준비·회복·정리 포함 47분" },
      { role: "MAIN" as const, label: "본운동", instruction: "22분 · RPE 3–4 → 2분 걷기 → 23분 · RPE 3–4" },
    ] }] }
    const original = JSON.stringify(compact)
    const { rerender } = render(<InstantPlanTodayView today={compact} navigationCards
      compactSessionSummary={id => id === "pm"} sessionRoleLabel={() => "기본"} onViewSession={view} onRecordSession={record} />)
    const card = screen.getByRole("button", { name: "오후 훈련 내용 보기 · 중간 걷기 조깅 · Split Easy" })
    expect(card).toHaveTextContent("오후 · 기본")
    expect(card).toHaveAccessibleDescription("기본 · 총 47분")
    expect(screen.getAllByText("총 47분")).toHaveLength(1)
    expect(card).not.toHaveTextContent("22분")
    fireEvent.click(within(card).getByRole("heading", { name: "중간 걷기 조깅 · Split Easy" }))
    expect(view).toHaveBeenCalledExactlyOnceWith("pm")
    expect(record).not.toHaveBeenCalled()
    rerender(<InstantPlanTodayView today={compact} />)
    expect(screen.getByText("47분")).toBeVisible()
    expect(screen.getByText("준비·회복·정리 포함")).toBeVisible()
    const main = screen.getByRole("list", { name: "본운동 순서" })
    expect(main).toHaveTextContent(/22분.*RPE 3–4.*2분 걷기.*23분.*RPE 3–4/)
    expect(JSON.stringify(compact)).toBe(original)
  })

  it.each(["주요", "기본", undefined])("does not infer a compact summary from the %s display label", role => {
    const main = "400m × 3회 · 400m 한 번에 100초 · 반복 사이 90초 걷기"
    const projected = { ...today, sessions: [{ ...today.sessions[1]!, steps: [
      { role: "TOTAL_DURATION" as const, label: "총 시간", instruction: "준비·회복·정리 포함 23분" },
      { role: "MAIN" as const, label: "본운동", instruction: main },
    ] }] }
    const original = JSON.stringify(projected)
    render(<InstantPlanTodayView today={projected} navigationCards sessionRoleLabel={() => role} onViewSession={vi.fn()} />)
    const card = screen.getByRole("button", { name: "오후 훈련 내용 보기 · 반복 훈련" })
    expect(card).toHaveTextContent("총 23분")
    expect(card).toHaveTextContent(main)
    expect(card).toHaveAccessibleDescription([role, `총 23분 · ${main}`].filter(Boolean).join(" · "))
    expect(JSON.stringify(projected)).toBe(original)
  })

  it("keeps incomplete-workout warnings outside the navigation card and blocks recording when unavailable", () => {
    const warned = { ...today, sessions: [{ ...today.sessions[0]!, guidanceNotice: "반복 횟수와 회복 시간은 정해지지 않았어요.",
      steps: [{ role: "TOTAL_DURATION" as const, label: "총 시간", instruction: "총 35분 · RPE 6~7" }, ...today.sessions[0]!.steps],
    }] }
    const props = { navigationCards: true, onViewSession: vi.fn(), onRecordSession: vi.fn() }
    const { rerender } = render(<InstantPlanTodayView today={warned} {...props} />)
    expect(screen.getByText("이 시간 내내 강하게 뛰지 마세요.")).toBeVisible()
    expect(screen.getByText("이 시간 내내 강하게 뛰지 마세요.").closest("details")).toBeNull()
    expect(screen.getByRole("button", { name: "오전 훈련 내용 보기 · 준비 훈련" })).toHaveTextContent("안내된 동작 12분")
    rerender(<InstantPlanTodayView today={{ ...warned, state: "UNAVAILABLE" }} {...props} />)
    expect(screen.getByRole("alert")).toBeVisible()
    expect(screen.queryByRole("button", { name: /훈련 기록 남기기|훈련 내용 보기/ })).toBeNull()
  })

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
    fireEvent.click(screen.getByRole("button", { name: "오전 훈련 내용 보기" }))
    expect(onViewSession).toHaveBeenCalledExactlyOnceWith("am")
  })
  it("opens full training before offering recording while retaining every main step and recovery", () => {
    const record = vi.fn(), view = vi.fn()
    const session = { ...today.sessions[1]!, steps: [
      ...today.sessions[1]!.steps,
      { role: "MAIN" as const, label: "본운동", instruction: "마지막 200m · 45초" },
      { role: "RECOVERY" as const, label: "회복", instruction: "세트 사이 3분 서서 쉬기" },
    ] }
    render(<InstantPlanTodayView compact today={{ ...today, sessions: [session] }} onRecordSession={record} onViewSession={view} />)
    const button = screen.getByRole("button", { name: "오후 훈련 기록 남기기" })
    const explanation = screen.getByRole("button", { name: "오후 훈련 내용 보기" })
    expect(button).toHaveClass("instant-plan__entry-record")
    expect(explanation.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
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
    { state: "UNAVAILABLE", message: "훈련을 불러올 수 없어요", action: "일정 보기" },
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

  it("shows one specific compact notice and only the supplied action, retaining embedded date context", () => {
    const open = vi.fn()
    const unavailable = { ...today, state: "UNAVAILABLE" as const, unavailableReason: "PAIN_PROGRESS" as const, sessions: [] }
    const { rerender } = render(<InstantPlanTodayView today={unavailable} compact dateContext="embedded"
      unavailableAction={{ label: "통증 기록 보기", onClick: open }} />)
    const notice = screen.getByRole("region", { name: "훈련 안내" })
    expect(notice).toHaveAccessibleDescription(today.dateLabel)
    expect(within(notice).queryByRole("heading")).toBeNull()
    expect(within(notice).getByRole("alert")).toHaveTextContent(/^통증 기록이 있어 훈련 안내를 멈췄어요$/)
    expect(within(notice).getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByText(today.dateLabel)).toBeNull()
    fireEvent.click(within(notice).getByRole("button", { name: "통증 기록 보기" }))
    expect(open).toHaveBeenCalledOnce()
    rerender(<InstantPlanTodayView today={{ ...unavailable, unavailableReason: "DETAILED_AUTHORITY" }} compact dateContext="embedded" />)
    expect(screen.getByRole("alert")).toHaveTextContent("이 훈련을 지금 시작해도 되는지 확인할 수 없어요.")
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByText(/통증 기록/)).toBeNull()
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
