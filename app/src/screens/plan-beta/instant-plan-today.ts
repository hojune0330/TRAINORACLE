import type { PlanSession } from "@impl/plan-generator/types"
import type { InstantPlanToday } from "../../domain/instant-plan-contract"
import type { PlanBetaState } from "../../domain/plan-beta-store"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { formatTrainingSeconds, prescriptionLabel, sessionExecution, sessionExecutionSteps, sessionLabel, sessionSlotLabel } from "./labels"

export function instantSessionId(session: Pick<PlanSession, "day" | "slot">): string {
  return `${session.day}:${session.slot}`
}

/** Reads the selected snapshot only. It neither shifts missed work nor clears safety. */
export function projectInstantToday(state: PlanBetaState, today: string, linkedSessionIds: readonly string[] = []): InstantPlanToday {
  const start = state.intake.startDate ?? state.generatedAt.slice(0, 10)
  const base = { dateLabel: today, title: "오늘 훈련", sessions: [] } as const
  if (!isValidIsoDate(start) || !isValidIsoDate(today)) return { ...base, state: "UNAVAILABLE" }
  const frame = state.activePlan.frame
  const length = Math.ceil("projectionLengthDays" in frame ? frame.projectionLengthDays ?? frame.lengthDays : frame.lengthDays)
  const days = Array.from({ length }, (_, i) => isoShift(start, i))
  if (state.progress.some(item => item.state === "PAIN_CHECKIN")) {
    return { ...base, title: "몸 상태 확인이 남아 있어요", state: "UNAVAILABLE" }
  }
  if (today > days[length - 1]!) return { ...base, title: "계획 기간이 끝났어요", state: "COMPLETED" }
  const before = today < start
  const sessions = state.activePlan.sessions
    .filter(session => session.day >= 1 && session.day <= length)
    .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  const first = sessions.find(session => session.role !== "REST")
  const day = before ? first?.day : days.indexOf(today) + 1
  const selected = sessions.filter(session => session.day === day)
  if (!selected.length) return { ...base, state: "UNAVAILABLE" }
  const training = selected.filter(session => session.role !== "REST")
  if (!training.length) return { ...base, state: "REST" }
  const projection = training.map(session => ({
    id: instantSessionId(session), slotLabel: sessionSlotLabel(session.slot), title: sessionLabel(session),
    recorded: linkedSessionIds.includes(instantSessionId(session))
      || state.progress.some(item => item.sessionDay === session.day && item.sessionSlot === session.slot),
    steps: projectInstantExecutionSteps(session),
  }))
  const recorded = projection.filter(session => session.recorded).length
  return { ...base, dateLabel: before ? isoShift(start, day! - 1) : today,
    title: before ? "첫 훈련을 확인하세요" : "오늘 훈련",
    state: before ? "BEFORE_START" : recorded === projection.length ? "RECORDED"
      : recorded > 0 ? "PARTLY_RECORDED" : "SCHEDULED",
    sessions: projection }
}

export function projectInstantExecutionSteps(session: PlanSession): InstantPlanToday["sessions"][number]["steps"] {
  const prescription = session.prescription
  if (prescription.kind !== "PACE_TARGET") {
    return [{ label: "총 시간·강도", instruction: prescriptionLabel(session) },
      ...sessionExecutionSteps(session).map(step => ({ label: step.title, instruction: step.detail })),
      ...(session.role === "QUALITY" ? [] : [{ label: "방법", instruction: sessionExecution(session) }])]
  }
  const { warmup, cooldown } = prescription.operationalComponents
  const recoveryMode = { WALK: "걷기", JOG: "조깅", STAND: "서서 쉬기", NOT_APPLICABLE: "지정 없음" }
  return [
    { label: "준비", instruction: `${warmup.easyDurationMinutes}분 RPE ${warmup.rpeMin}~${warmup.rpeMax}. ${warmup.strides.durationSeconds}초 점진 가속 ${warmup.strides.repetitions}회, 사이 ${warmup.strides.recoverySeconds}초 걷기·조깅.` },
    { label: "본운동", instruction: `${prescription.repetitionDistanceM}m × ${prescription.repetitionsPerSet}회 × ${prescription.setCount}세트. 반복당 ${formatTrainingSeconds(prescription.targetRepSeconds)} · 총 ${prescription.totals.totalRepetitions}회.` },
    { label: "회복", instruction: [
      prescription.repetitionRecoverySeconds === null ? "반복 회복 시간 지정 없음" : `반복 사이 ${formatTrainingSeconds(prescription.repetitionRecoverySeconds)} ${recoveryMode[prescription.repetitionRecoveryMode]}`,
      ...(prescription.setCount > 1 ? [prescription.setRecoverySeconds === null ? "세트 회복 시간 지정 없음" : `세트 사이 ${formatTrainingSeconds(prescription.setRecoverySeconds)} ${recoveryMode[prescription.setRecoveryMode]}`] : []),
    ].join(" · ") },
    { label: "정리", instruction: `${cooldown.easyDurationMinutes}분 RPE ${cooldown.rpeMin}~${cooldown.rpeMax}. 통증이나 몸 이상이 생기면 중단하세요.` },
  ]
}
