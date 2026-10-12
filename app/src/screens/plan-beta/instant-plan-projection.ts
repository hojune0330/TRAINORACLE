import type { PlanGenerationSuccess, PlanCandidate } from "@impl/plan-generator/types"
import type { InstantPlanRecommendation } from "../../domain/instant-plan-contract"
import { isoShift, isoToDate, isValidIsoDate } from "../../domain/dates"
import { candidateDurationSummary, prescriptionLabel, sessionLabel, sessionSlotLabel } from "./labels"
import { eventDistanceLabel } from "./plan-intake-navigation"

export const INSTANT_RECOMMENDATION_POLICY = "SUPPORT_DURATION_RANGE_FIRST_V1" as const

/** A transparent presentation default, not a scientific ranking or new dose policy. */
export function defaultInstantCandidate(generated: PlanGenerationSuccess): PlanCandidate {
  return generated.candidates.find(candidate => candidate.kind === "BALANCED") ?? generated.candidates[0]
}

export function projectInstantRecommendation(candidate: PlanCandidate, startDate: string): InstantPlanRecommendation | null {
  if (!isValidIsoDate(startDate)) return null
  const length = Math.ceil(candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays)
  const projected = candidate.sessions.filter(session => session.day >= 1 && session.day <= length)
    .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  const first = projected.find(session => session.role !== "REST")
  const generalMainCount = projected.filter(session => session.role === "QUALITY"
    && session.prescription.kind === "RPE_TIME_RANGE" && !session.prescription.catalogWorkout).length
  return {
    id: candidate.candidateId,
    title: `${eventDistanceLabel(candidate.eventDistanceM)} · ${length}일 훈련`,
    guidanceNotice: generalMainCount > 0
      ? `주요 훈련 ${generalMainCount}회는 시간·체감 강도 안내예요. 반복·회복 구성은 아직 정하지 않았어요.` : undefined,
    reason: generalMainCount > 0
      ? "선택한 목적과 가능한 날짜로 일정을 배치했어요. 세부 구성이 없는 주요 훈련은 아직 반복·회복까지 정한 처방이 아니에요."
      : projected.some(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout)
      ? "날짜별로 훈련 구성과 회복을 정했어요. 저장하기 전에는 같은 목적의 다른 훈련으로 바꿀 수 있어요."
      : "기초·회복 운동 시간은 일정에 표시했어요. 범위가 있으면 그 안에서 시간을 정할 수 있어요.",
    periodLabel: `${startDate} ~ ${isoShift(startDate, length - 1)} · ${length}일`,
    sessionCount: projected.filter(session => session.role !== "REST").length,
    durationLabel: candidateDurationSummary(candidate),
    firstSessionLabel: first ? `${isoShift(startDate, first.day - 1)} ${sessionSlotLabel(first.slot)} · ${sessionLabel(first)}` : "예정된 훈련 없음",
    days: Array.from({ length }, (_, index) => {
      const date = isoShift(startDate, index), dateValue = isoToDate(date)
      return { date, dayLabel: `${dateValue.getMonth() + 1}/${dateValue.getDate()} ${["일", "월", "화", "수", "목", "금", "토"][dateValue.getDay()]}`,
        sessions: projected.filter(session => session.day === index + 1).map(session => ({
          id: `${candidate.candidateId}:${session.day}:${session.slot}`, slotLabel: sessionSlotLabel(session.slot),
          notation: session.role === "REST" ? undefined : prescriptionLabel(session),
          title: sessionLabel(session), role: session.role === "REST" ? "OFF" as const
            : session.role === "QUALITY" ? "MAIN" as const
            : session.plannedEnergyIntent === "RECOVERY_INTENT" ? "REC" as const : "BASE" as const,
        })) }
    }),
    source: { kind: "GENERAL" },
  }
}
