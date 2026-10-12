import { cleanup, render, screen, within, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { formatPaceSeconds } from "@impl/prescription/record-pace"
import { formatTrainingSeconds } from "./labels"
import { PlanSchedulePreview } from "./PlanSchedulePreview"

const sessions: readonly PlanSession[] = [
  {
    day: 1,
    slot: "AM",
    role: "QUALITY",
    plannedEnergyIntent: "LT_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 5, maximum: 6 },
      durationMinutes: { minimum: 25, maximum: 40 },
    },
  },
  {
    day: 1,
    slot: "PM",
    role: "EASY",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe: { minimum: 1, maximum: 2 },
      durationMinutes: { minimum: 15, maximum: 25 },
    },
  },
  {
    day: 2,
    slot: "AM",
    role: "REST",
    plannedEnergyIntent: "RECOVERY_INTENT",
    prescription: { kind: "REST" },
  },
]

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal")
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", "") } })
})
afterEach(() => {
  cleanup()
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal")
})
afterEach(() => vi.useRealTimers())

describe("plan schedule preview", () => {
  it("keeps explicit rest quiet and shows program boundaries without inventing rest for empty dates", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions}
      presentation="prescription-calendar" dayAnnotations={{ "2026-08-17": "1주기 시작", "2026-08-18": "대회 날짜" }} />)
    const calendar = screen.getByRole("grid", { name: "2026년 8월 달력" })
    const rest = calendar.querySelector<HTMLButtonElement>('button[data-date="2026-08-18"]')!
    expect(rest).toHaveAccessibleName(expect.stringContaining("대회 날짜"))
    expect(rest.querySelector(".prescription-calendar__rest")).toHaveTextContent("휴식")
    expect(rest.querySelector(".calendar-training-mark")).toBeNull()
    const empty = calendar.querySelector<HTMLButtonElement>('button[data-date="2026-08-19"]')!
    expect(empty.querySelector(".prescription-calendar__rest")).toBeNull()
    expect(empty).toHaveTextContent("예정 없음")
  })

  it("projects all 29 program dates without widening a source frame or inventing missing rest", async () => {
    const user = userEvent.setup()
    const projected = [sessions[0]!, { ...sessions[0]!, day: 29 }]
    const original = JSON.stringify(projected)
    render(<PlanSchedulePreview startDate="2026-10-11" sessions={projected}
      presentation="prescription-calendar" showRpeGuide={false}
      programProjection={{ kind: "THREE_CYCLE_PROGRAM", calendarDayCount: 29 }} />)
    expect(screen.getByRole("region", { name: "한 달 훈련표 · 9.5일 × 3" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "하루씩" }))
    const list = screen.getByRole("list", { name: "날짜별 계획 미리보기" })
    expect(list.children).toHaveLength(29)
    expect(within(list).getByRole("button", { name: "11월 8일 일요일 전체 처방 보기" })).toBeVisible()
    expect(list.children[1]).toHaveTextContent("예정 없음")
    expect(list.children[1]).not.toHaveTextContent("휴식일")
    expect(JSON.stringify(projected)).toBe(original)
  })

  it("keeps the standard presentation by default for existing callers", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    expect(screen.queryByRole("group", { name: "계획 일정 보기" })).not.toBeInTheDocument()
  })

  it("shows each workout name and exact core amount in a seven-column prescription calendar", async () => {
    const user = userEvent.setup()
    const original = JSON.stringify(sessions)
    render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={7} sessions={sessions}
      presentation="prescription-calendar" detailsExpanded={false} />)

    const calendar = screen.getByRole("grid", { name: "2026년 8월 달력" })
    expect(calendar.querySelectorAll("thead th")).toHaveLength(7)
    expect(calendar.querySelectorAll("tbody tr:first-child td")).toHaveLength(7)

    const firstPlanDate = calendar.querySelector<HTMLButtonElement>('button[data-date="2026-08-17"]')
    expect(firstPlanDate).not.toBeNull()
    expect(screen.getByRole("button", { name: "선택한 날짜 처방 보기" })).toBeVisible()
    expect(within(firstPlanDate!).getByText("템포 훈련 · LT")).toBeVisible()
    expect(within(firstPlanDate!).getByText("전체 25–40분 · 힘든 정도 5–6/10")).toBeVisible()
    expect(firstPlanDate).toBeVisible()
    expect(firstPlanDate).toHaveAttribute("aria-label", expect.stringContaining("전체 25–40분 · 힘든 정도 5–6/10"))
    expect(firstPlanDate).toHaveAttribute("aria-label", expect.stringContaining("전체 15–25분 · 힘든 정도 1–2/10"))

    await user.click(firstPlanDate!)
    const reader = screen.getByRole("dialog", { name: "2026년 8월 17일 월요일" })
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오전 세션" })).toHaveTextContent(
      "전체 25–40분 · 힘든 정도 5–6/10",
    )
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toHaveTextContent(
      "전체 15–25분 · 힘든 정도 1–2/10",
    )
    expect(JSON.stringify(sessions)).toBe(original)
  })

  it("offers daily slides with unchanged prescriptions and reader actions", async () => {
    const user = userEvent.setup()
    const original = JSON.stringify(sessions)
    render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={7} sessions={sessions}
      presentation="prescription-calendar" detailsExpanded={false}
      sessionProgress={session => session.day === 1 ? "COMPLETED" : undefined}
      renderSessionAction={session => session.day === 1 ? <button type="button">이 훈련 일지 쓰기</button> : null}
      renderSessionFooter={() => <button type="button">진행 기록 자세히</button>} />)

    await user.click(screen.getByRole("button", { name: "하루씩" }))

    expect(screen.getByRole("button", { name: "하루씩" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("list", { name: "날짜별 계획 미리보기" })).toHaveAttribute("data-display-mode", "swipe")
    await user.click(screen.getByRole("button", { name: "8월 17일 월요일 선택" }))
    expect(screen.getByRole("button", { name: "이전 날짜" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "다음 날짜" }))
    expect(screen.getByRole("button", { name: "8월 18일 화요일 선택" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "8월 23일 일요일 선택" }))
    expect(screen.getByRole("button", { name: "다음 날짜" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "8월 17일 월요일 선택" }))
    expect(screen.queryByRole("grid", { name: "2026년 8월 달력" })).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "날짜별 계획 미리보기" })).toBeVisible()
    const summary = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    expect(summary).toHaveTextContent(
      "전체 25–40분 · 힘든 정도 5–6/10",
    )
    expect(summary).toHaveTextContent("완료")
    expect(within(summary).getByRole("button", { name: "이 훈련 일지 쓰기" })).toBeVisible()
    expect(within(summary).queryByRole("button", { name: /설명 보기/u })).not.toBeInTheDocument()
    expect(within(summary).queryByRole("button", { name: /크게 보기/u })).not.toBeInTheDocument()
    expect(within(summary).queryByText("오전 훈련 방법과 기록")).not.toBeInTheDocument()
    expect(within(summary).queryByRole("button", { name: "훈련 방법과 이유" })).not.toBeInTheDocument()
    expect(within(summary).queryByRole("button", { name: "진행 기록 자세히" })).not.toBeInTheDocument()
    const restSummary = screen.getByRole("group", { name: "8월 18일 화요일 오전 세션" })
    expect(restSummary).toHaveTextContent("휴식")
    expect(restSummary).not.toHaveTextContent("훈련 없음")
    const emptyDay = screen.getByRole("group", { name: "8월 19일 수요일 · 비움" })
    expect(emptyDay).toHaveTextContent("예정 없음")
    expect(emptyDay).not.toHaveTextContent("휴식")

    const dateButton = screen.getByRole("button", { name: "8월 17일 월요일 전체 처방 보기" })
    await user.click(dateButton)
    const reader = screen.getByRole("dialog", { name: "2026년 8월 17일 월요일" })
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오전 세션" })).toHaveTextContent(
      "전체 25–40분 · 힘든 정도 5–6/10",
    )
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toHaveTextContent(
      "전체 15–25분 · 힘든 정도 1–2/10",
    )
    expect(within(reader).getAllByRole("button", { name: "훈련 방법과 이유" })).toHaveLength(2)
    const readerMorning = within(reader).getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    await user.click(within(readerMorning).getByText("일지·진행 기록"))
    expect(within(readerMorning).getByRole("button", { name: "진행 기록 자세히" })).toBeVisible()
    await user.click(within(reader).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(dateButton).toHaveFocus())
    expect(JSON.stringify(sessions)).toBe(original)
  })

  it("starts narrow viewports in list mode and leaves later view changes to the user", async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia")
    const matchMedia = vi.fn((query: string) => ({
      matches: query === "(max-width: 767px)", media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }))
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia })
    try {
      const user = userEvent.setup()
      render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={7} sessions={sessions}
        presentation="prescription-calendar" detailsExpanded={false} />)

      expect(screen.getByRole("button", { name: "하루씩" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.queryByRole("grid", { name: "2026년 8월 달력" })).not.toBeInTheDocument()
      matchMedia.mockImplementation((query: string) => ({
        matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      }))
      expect(screen.getByRole("button", { name: "하루씩" })).toHaveAttribute("aria-pressed", "true")

      await user.click(screen.getByRole("button", { name: "달력" }))
      expect(screen.getByRole("button", { name: "달력" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("grid", { name: "2026년 8월 달력" })).toBeVisible()
    } finally {
      if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia)
      else Reflect.deleteProperty(window, "matchMedia")
    }
  })

  it("shows validated catalog totals and formatted pace without mutating prescriptions", () => {
    const source = { ...(sessions[0]! as Extract<PlanSession, { readonly role: "QUALITY" }>), plannedEnergyIntent: "VO2_INTENT" as const }
    const inputs: WorkoutCalculationInputs = {
      eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [],
    }
    const bound = bindCatalogSession(source, "X-VO2-08", inputs, true)
    expect(bound?.prescription.kind).toBe("RPE_TIME_RANGE")
    if (!bound || bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) throw Error("binding failed")
    const calculation = resolveCatalogBinding(bound.prescription.catalogWorkout)
    expect(calculation?.totals.seconds).not.toBeNull()
    const total = calculation!.totals.seconds!
    const catalogLabel = `전체 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : ` ~ ${formatTrainingSeconds(total.maximum)}`}`
    const catalogBefore = JSON.stringify(bound)
    const { rerender } = render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={7} sessions={[bound]}
      presentation="prescription-calendar" detailsExpanded={false} />)
    const catalogDate = screen.getByRole("grid", { name: "2026년 8월 달력" })
      .querySelector<HTMLButtonElement>('button[data-date="2026-08-17"]')!
    expect(within(catalogDate).getByText(catalogLabel)).toBeVisible()
    expect(catalogDate).not.toHaveTextContent("힘든 정도")
    expect(JSON.stringify(bound)).toBe(catalogBefore)

    const pacePrescription = {
      kind: "PACE_TARGET", setCount: 1, repetitionsPerSet: 5, repetitionDistanceM: 1000,
      targetRepSeconds: 300, targetEventDistanceM: 5000, repetitionRecoverySeconds: 60,
      repetitionRecoveryMode: "JOG", setRecoverySeconds: null, setRecoveryMode: "NOT_APPLICABLE",
    }
    const paceSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT",
      prescription: pacePrescription } as unknown as PlanSession
    const paceBefore = JSON.stringify(paceSession)
    rerender(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={7} sessions={[paceSession]}
      presentation="prescription-calendar" detailsExpanded={false} />)
    const paceDate = screen.getByRole("grid", { name: "2026년 8월 달력" })
      .querySelector<HTMLButtonElement>('button[data-date="2026-08-17"]')!
    expect(within(paceDate).getByText(`5 × 1km · 1km당 ${formatPaceSeconds(300)}`)).toBeVisible()
    expect(JSON.stringify(paceSession)).toBe(paceBefore)
  })

  it("keeps a returned journal slot open when StrictMode replays initialization", async () => {
    render(<StrictMode><PlanSchedulePreview startDate="2026-08-17" frameLengthDays={9}
      sessions={sessions} displayMode="swipe" detailsExpanded={false}
      focusSession={{ day: 1, slot: "PM" }} /></StrictMode>)
    await waitFor(() => expect(screen.getByRole("group", { name: /오후 세션 · 일지에서 돌아온 세션/u })).toBeVisible())
    expect(screen.getByRole("button", { name: "날짜별 카드 접기" })).toHaveAttribute("aria-expanded", "true")
  })
  it("opens an ended saved plan at its last calendar day even when it has no workout", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-30T12:00:00+09:00"))
    render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={9} sessions={sessions} displayMode="swipe" />)
    expect(screen.getByRole("button", { name: "다음 날짜" })).toBeDisabled()
    expect(screen.getByText("9/9")).toBeVisible()
    expect(document.querySelector('[data-date="2026-08-25"]')).toHaveAttribute("data-selected", "true")
  })
  it("keeps the actual date and AM/PM overview visible when instructions collapse", () => {
    const { rerender } = render(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={9}
      sessions={sessions} detailsExpanded={false} detailsId="schedule-details" />)
    expect(screen.getByLabelText("9일 훈련 일정")).toBeVisible()
    expect(screen.getByRole("button", { name: "2026년 8월 17일 월요일 · 오전 주요 훈련 LT · 오후 회복 운동" })).toBeVisible()
    expect(document.getElementById("schedule-details")).not.toBeVisible()
    expect(screen.queryByLabelText("힘든 정도 쉽게 보기")).not.toBeInTheDocument()
    rerender(<PlanSchedulePreview startDate="2026-08-17" frameLengthDays={9}
      sessions={sessions} detailsExpanded detailsId="schedule-details" />)
    expect(document.getElementById("schedule-details")).toBeVisible()
    expect(screen.getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toBeVisible()
  })

  it("projects only days 1-7 from a full canonical session list", () => {
    const dayEightSession: PlanSession = {
      day: 8,
      slot: "AM",
      role: "EASY",
      plannedEnergyIntent: "BASE_INTENT",
      prescription: {
        kind: "RPE_TIME_RANGE",
        rpe: { minimum: 3, maximum: 4 },
        durationMinutes: { minimum: 30, maximum: 45 },
      },
    }

    render(
      <PlanSchedulePreview
        startDate="2026-08-17"
        frameLengthDays={7}
        sessions={[...sessions, dayEightSession]}
      />,
    )

    expect(screen.getByLabelText("7일 훈련 일정")).toBeVisible()
    expect(screen.getByRole("group", { name: /8월 23일 일요일/u })).toBeVisible()
    expect(screen.queryByRole("group", { name: /8월 24일 월요일/u })).not.toBeInTheDocument()
  })

  it("shows a chosen date as two separate same-day training slots", () => {
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const flow = screen.getByLabelText("9.5일 훈련 일정")
    expect(flow).toContainElement(screen.getByRole("button", {
      name: "2026년 8월 17일 월요일 · 오전 주요 훈련 LT · 오후 회복 운동",
    }))
    expect(screen.getByRole("button", {
      name: "2026년 8월 17일 월요일 · 오전 주요 훈련 LT · 오후 회복 운동",
    })).toHaveTextContent("오전주요오후회복")

    const restFlowDay = screen.getByRole("button", {
      name: /8월 18일.*훈련 없음/u,
    })
    expect(restFlowDay).toHaveTextContent("휴식")

    const firstDay = screen.getByRole("group", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    expect(firstDay).toHaveTextContent("오전")
    expect(firstDay).toHaveTextContent("오후")
    expect(screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })).toBeVisible()
    expect(screen.getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toBeVisible()
    expect(firstDay).toHaveTextContent("지속 페이스")
    expect(firstDay).toHaveTextContent("회복 운동 · Recovery")

    expect(screen.getByRole("group", {
      name: "8월 18일 화요일 · 휴식",
    })).toHaveTextContent("휴식 · Rest")
  })

  it("keeps morning and afternoon in one swipe card and orders morning first", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-08-17T12:00:00+09:00"))
    const user = userEvent.setup()
    render(
      <PlanSchedulePreview
        startDate="2026-08-17"
        sessions={[sessions[1]!, sessions[0]!, sessions[2]!]}
        displayMode="swipe"
        timelineHeading="날짜별 훈련"
      />,
    )

    const firstDay = screen.getByRole("group", {
      name: "8월 17일 월요일 · 훈련 2개",
    })
    const morning = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    const afternoon = screen.getByRole("group", { name: "8월 17일 월요일 오후 세션" })

    expect(firstDay).toContainElement(morning)
    expect(firstDay).toContainElement(afternoon)
    expect(morning.compareDocumentPosition(afternoon) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(within(firstDay).getByText("본운동")).not.toBeVisible()

    await user.click(within(morning).getByText("오전 훈련 방법과 기록"))
    expect(within(firstDay).getByText("본운동")).toBeVisible()
    expect(screen.getByRole("button", { name: "이전 날짜" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "다음 날짜" })).toBeEnabled()
    expect(screen.getByText("1/10")).toBeVisible()
  })

  it("returns a linked journal to its exact DAY and AM/PM session", () => {
    render(
      <PlanSchedulePreview
        startDate="2026-08-17"
        sessions={sessions}
        displayMode="swipe"
        focusSession={{ day: 1, slot: "PM" }}
      />,
    )

    expect(screen.getByRole("group", {
      name: "8월 17일 월요일 오후 세션 · 일지에서 돌아온 세션",
    })).toHaveAttribute("data-returned-session", "true")
    expect(screen.getByText("1/10")).toBeVisible()
  })

  it("presents notation, plain execution, and optional RPE detail in order", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions.slice(0, 1)} />)

    const session = screen.getByRole("group", { name: "8월 17일 월요일 오전 세션" })
    expect(session).toHaveTextContent("전체 25–40min @ RPE 5–6")
    expect(session).toHaveTextContent("본운동")
    expect(session).toHaveTextContent(/숨은 차지만.*짧은 문장이 가능/u)

    const rpeHelp = screen.getByRole("button", { name: "운동 자각도 RPE 설명 보기" })
    await user.click(rpeHelp)
    expect(screen.getByText(/내 몸의 느낌으로 매기는 1~10점/u)).toBeVisible()
    expect(screen.getByRole("link", { name: "왜 이런 이름인가요?" })).toHaveAttribute(
      "href",
      "?terms=1&term=rpe",
    )
  })

  it("opens beginner explanations from the legend and the dated session badge", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    await user.click(screen.getByText("훈련 구분·약어"))
    await user.click(screen.getByRole("button", { name: "주요 훈련 MAIN 일정표 구분 설명 보기" }))
    expect(screen.getByText(/준비 목표를 가장 직접적으로 다루는 훈련/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "주요 훈련 MAIN, 지속 페이스 LT 훈련 설명 보기" }))
    expect(screen.getByText(/조금 힘든 느낌을 비교적 일정하게 유지/u)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "회복 운동 REC 일정표 구분 설명 보기" }))
    expect(screen.getByText(/빠른 걷기.*아주 가벼운 조깅.*느린 자전거/u)).toBeVisible()
  })

  it("marks only today's date while the frame is being followed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-17T12:00:00"))
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} />)

    const today = screen.getByRole("button", {
      name: "2026년 8월 17일 월요일 · 오전 주요 훈련 LT · 오후 회복 운동",
    })
    expect(today).toHaveAttribute("aria-current", "date")
    expect(screen.getByRole("button", {
      name: "2026년 8월 24일 월요일 · 예정 훈련 없음",
    })).not.toHaveAttribute("aria-current")
  })

  it("opens collapsed AM/PM details from a date without changing the plan", async () => {
    const user = userEvent.setup()
    const original = JSON.stringify(sessions)
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} detailsExpanded={false} />)
    await user.click(screen.getByRole("button", { name: /2026년 8월 17일 월요일 · 오전/u }))
    const reader = screen.getByRole("dialog", { name: "2026년 8월 17일 월요일" })
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오전 세션" })).toBeVisible()
    expect(within(reader).getByRole("group", { name: "8월 17일 월요일 오후 세션" })).toBeVisible()
    expect(JSON.stringify(sessions)).toBe(original)
    await user.click(within(reader).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("opens a session in a large reader and preserves the exact journal action and next-date limits", async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    const original = JSON.stringify(sessions)
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} frameLengthDays={7}
      readerNotice={<p role="status">몸 상태를 먼저 확인해 주세요</p>}
      renderSessionAction={session => <button onClick={() => write(session)}>일지 쓰기 {session.slot}</button>}
      renderSessionFooter={() => <span>명시적으로 진행 선택</span>} />)
    const opener = screen.getByRole("button", { name: "8월 17일 월요일 오후 훈련과 일지 크게 보기" })
    await user.click(opener)
    const reader = screen.getByRole("dialog")
    expect(within(reader).getByRole("status")).toHaveTextContent("몸 상태를 먼저 확인해 주세요")
    expect(within(reader).getByRole("button", { name: "크게 보기 이전 날짜" })).toBeEnabled()
    const afternoon = within(reader).getByRole("group", { name: "8월 17일 월요일 오후 세션" })
    expect(within(afternoon).getByText("일지·진행 기록").closest("details")).not.toHaveAttribute("open")
    expect(within(afternoon).getByRole("button", { name: "일지 쓰기 PM" }).closest("details")).toBeNull()
    await user.click(within(reader).getByRole("button", { name: "일지 쓰기 PM" }))
    expect(write).toHaveBeenCalledExactlyOnceWith(sessions[1])
    expect(JSON.stringify(sessions)).toBe(original)
    await user.click(within(reader).getByRole("button", { name: "크게 보기 다음 날짜" }))
    expect(screen.getByRole("dialog")).toHaveAccessibleName("2026년 8월 18일 화요일")
    expect(within(reader).queryByRole("button", { name: "일지 쓰기 PM" })).toBeNull()
    await user.click(within(reader).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(opener).toHaveFocus()
  })

  it("shows no scheduled event, not a rest prescription, when today is outside the plan", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2025-08-17" sessions={sessions} />)
    await user.click(screen.getByRole("button", { name: "오늘" }))
    expect(screen.getByRole("status")).toHaveTextContent("이 계획의 일정이 없어요")
    expect(screen.queryByRole("group", { name: "8월 17일 일요일 오전 세션" })).toBeNull()
  })

  it("opens the requested slot's progress controls without saving or changing prescription", () => {
    const write = vi.fn()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions}
      readerRequest={{ day: 1, slot: "PM", sequence: 1, section: "records" }}
      renderSessionFooter={session => <button onClick={() => write(session)}>진행 기록 {session.slot}</button>} />)
    const reader = screen.getByRole("dialog")
    expect(within(reader).getByRole("button", { name: "진행 기록 PM" })).toBeVisible()
    expect(within(reader).getByText("진행 기록 AM")).not.toBeVisible()
    expect(within(reader).getByText("진행 기록 PM").closest("details")).toHaveAttribute("open")
    expect(within(reader).getByRole("button", { name: "오후" })).toHaveAttribute("aria-current", "location")
    expect(write).not.toHaveBeenCalled()
  })

  it("projects explicit outcomes only and offers a way back from months outside the plan", async () => {
    const user = userEvent.setup()
    render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions}
      sessionProgress={session => session.day === 1 && session.slot === "AM" ? "RESTED" : undefined} />)
    const day = screen.getByRole("button", { name: /2026년 8월 17일 월요일 · 오전/ })
    expect(day).toHaveAccessibleName(/오전 주요 훈련 LT · 휴식 · 오후 회복 운동/)
    expect(day).not.toHaveAccessibleName(/완료/)
    await user.click(screen.getByRole("button", { name: "다음 달" }))
    await user.click(screen.getByRole("button", { name: /2026년 9월 15일/ }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("status")).toHaveTextContent("이 계획의 일정이 없어요")
    await user.click(screen.getByRole("button", { name: "계획 시작일로" }))
    expect(screen.getByRole("grid", { name: "2026년 8월 달력" })).toBeVisible()
    expect(screen.getByRole("button", { name: /2026년 8월 17일 월요일 · 오전/ })).toHaveAttribute("data-selected", "true")
    expect(screen.queryByText(/에는 이 계획의 일정이 없어요/)).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("does not reopen a dismissed reader when the same plan data refreshes", async () => {
    const request = { day: 1, slot: "PM", sequence: 1, section: "records" } as const
    const { rerender } = render(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} readerRequest={request} />)
    await userEvent.setup().click(within(screen.getByRole("dialog")).getByRole("button", { name: "달력으로 돌아가기" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    rerender(<PlanSchedulePreview startDate="2026-08-17" sessions={[...sessions]} readerRequest={request} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    rerender(<PlanSchedulePreview startDate="2026-08-17" sessions={sessions} readerRequest={{ ...request, sequence: 2 }} />)
    expect(screen.getByRole("dialog")).toBeVisible()
  })
})
