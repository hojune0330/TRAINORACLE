import { CalendarDays } from "lucide-react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { eventDistanceLabel } from "./plan-intake-navigation"
import { EXPERIENCE_LABELS } from "./labels"
import { useCalendarPosition } from "../../hooks/useCalendarPosition"
import { MonthCalendar, calendarDayLabel } from "../../components/MonthCalendar"
import { useLocalToday } from "../../hooks/useLocalToday"
import { isValidIsoDate, isoShift } from "../../domain/dates"

/**
 * 질문에 답할 때마다 조금씩 채워지는 달력 그림.
 * 계획을 만들기 전이라 훈련 내용은 없다 — 어떤 날에 운동 칸이 생길지만 보여준다.
 * 안전 확인 전에는 절대 훈련 종류·강도·시간을 표시하지 않는다.
 */
export function IntakeCalendarPeek({
  draft,
  frameLengthDays = 9,
}: {
  readonly draft: Partial<PlanBetaIntake>
  readonly frameLengthDays?: 7 | 9 | 10
}) {
  const today = useLocalToday()
  const start = draft.startDate && isValidIsoDate(draft.startDate) ? draft.startDate : today
  const { month, date: selected, selectMonth: setMonth, selectDate: setSelected } = useCalendarPosition(`intake:${start}`, start)
  const activeDays = draft.availableDayCount === undefined
    ? new Set<number>()
    : new Set(previewTrainingDays(draft.availableDayCount, frameLengthDays))
  const filled = [
    draft.eventDistanceM !== undefined,
    draft.experienceBand !== undefined,
    draft.availableDayCount !== undefined,
  ].filter(Boolean).length
  const caption = draft.eventDistanceM === undefined
    ? "목표를 고르면 달력이 생겨요"
    : draft.experienceBand === undefined
      ? `${eventDistanceLabel(draft.eventDistanceM)} 달력 준비 중`
      : draft.availableDayCount === undefined
        ? `${eventDistanceLabel(draft.eventDistanceM)} · ${shortExperience(draft.experienceBand)}`
        : `${eventDistanceLabel(draft.eventDistanceM)} · ${shortExperience(draft.experienceBand)} · ${dayCountLabel(draft.availableDayCount, frameLengthDays)}`

  const exampleDates = new Set([...activeDays].map(day => isoShift(start, day - 1)))
  return (
    <figure
      className="intake-calendar-peek"
      data-filled={filled}
      aria-label={`계획 달력 미리보기 · ${caption}`}
    >
      <figcaption>
        <CalendarDays aria-hidden="true" size={15} />
        <span>{caption}</span>
        <small>{filled}/3</small>
      </figcaption>
      <details>
        <summary>{calendarDayLabel(start)}부터 · {frameLengthDays}일 달력 보기</summary>
        <MonthCalendar month={month} today={today} selectedDate={selected} onMonthChange={setMonth} onSelectDate={setSelected}
          highlightedRange={{ start, end: isoShift(start, frameLengthDays - 1) }}
          dayDescription={date => exampleDates.has(date) ? "훈련일 배치 예시 · 아직 계획 아님" : "계획 생성 전"}
          renderDay={date => exampleDates.has(date) ? <span className="month-calendar__event">예시</span> : null} />
        <p>훈련일 배치 예시예요. 실제 훈련과 날짜는 계획을 만든 뒤 확인해요.</p>
      </details>
    </figure>
  )
}

/** 실제 생성기의 배치와 무관한 "미리보기용" 균등 분포. 계획을 만들면 생성기 결과로 대체된다. */
export function previewTrainingDays(
  count: PlanBetaIntake["availableDayCount"],
  frameLengthDays: number,
): readonly number[] {
  if (count === "EVERY_DAY") return Array.from({ length: frameLengthDays }, (_, index) => index + 1)
  if (count <= 1) return [1]
  return Array.from(
    { length: count },
    (_, index) => Math.round(1 + (index * (frameLengthDays - 1)) / (count - 1)),
  )
}

function shortExperience(band: PlanBetaIntake["experienceBand"]): string {
  return EXPERIENCE_LABELS[band].short
}

function dayCountLabel(count: PlanBetaIntake["availableDayCount"], frameLengthDays: number): string {
  return count === "EVERY_DAY" ? "매일" : `${frameLengthDays}일 중 ${count}일`
}
