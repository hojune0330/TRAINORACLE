import type { PlanGenerationSuccess, PlanCandidate } from "@impl/plan-generator/types"
import type { InstantPlanRecommendation } from "../../domain/instant-plan-contract"
import { isoShift, isoToDate, isValidIsoDate } from "../../domain/dates"
import { candidateDurationSummary, sessionLabel, sessionSlotLabel } from "./labels"
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
  return {
    id: candidate.candidateId,
    title: `${eventDistanceLabel(candidate.eventDistanceM)} · ${length}일 훈련`,
    reason: candidate.kind === "BALANCED"
      ? "기초·회복 운동을 표시된 시간 범위 안에서 선택할 수 있는 안을 먼저 보여드려요."
      : "기초·회복 운동을 제시 범위의 짧은 시간으로 배치했어요.",
    periodLabel: `${startDate} ~ ${isoShift(startDate, length - 1)} · ${length}일`,
    sessionCount: projected.filter(session => session.role !== "REST").length,
    durationLabel: candidateDurationSummary(candidate),
    firstSessionLabel: first ? `${isoShift(startDate, first.day - 1)} ${sessionSlotLabel(first.slot)} · ${sessionLabel(first)}` : "예정된 훈련 없음",
    days: Array.from({ length }, (_, index) => {
      const date = isoShift(startDate, index), dateValue = isoToDate(date)
      return { date, dayLabel: `${dateValue.getMonth() + 1}/${dateValue.getDate()} ${["일", "월", "화", "수", "목", "금", "토"][dateValue.getDay()]}`,
        sessions: projected.filter(session => session.day === index + 1).map(session => ({
          id: `${candidate.candidateId}:${session.day}:${session.slot}`, slotLabel: sessionSlotLabel(session.slot),
          title: sessionLabel(session), role: session.role === "REST" ? "OFF" as const
            : session.role === "QUALITY" ? "MAIN" as const
            : session.plannedEnergyIntent === "RECOVERY_INTENT" ? "REC" as const : "BASE" as const,
        })) }
    }),
    source: { kind: "GENERAL" },
  }
}
