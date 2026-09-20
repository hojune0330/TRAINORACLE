import { CalendarDays } from "lucide-react"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { eventDistanceLabel } from "./plan-intake-navigation"
import { EXPERIENCE_LABELS } from "./labels"

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
  const days = Array.from({ length: frameLengthDays }, (_, index) => index + 1)
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
      <ol className="intake-calendar-peek__days" aria-hidden="true">
        {days.map((day) => (
          <li
            key={day}
            data-state={
              draft.eventDistanceM === undefined
                ? "empty"
                : activeDays.has(day)
                  ? "training"
                  : draft.availableDayCount === undefined
                    ? "pending"
                    : "rest"
            }
          >
            <span>{day}</span>
          </li>
        ))}
      </ol>
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
