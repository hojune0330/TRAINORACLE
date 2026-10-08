import type {
  ExperienceBand,
  PlanCandidateKind,
  PlanEventGroup,
  PlanProgressState,
  PlanSession,
  PlanSessionSlot,
  PlannedEnergyIntent,
  RpeTimeRange,
} from "@impl/plan-generator/types"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { calculatedWorkoutSequence } from "@impl/prescription/all-workout-calculator"
import { sequencePhaseNotation, sessionWorkoutName, sessionWorkoutNotation, type WorkoutDisplaySession } from "../../domain/workout-notation"
import type { InstantPlanStepRole } from "../../domain/instant-plan-contract"

export const EVENT_LABELS: Record<PlanEventGroup, {
  readonly title: string
  readonly detail: string
}> = {
  MIDDLE_DISTANCE: {
    title: "800m · 1500m · 3000m",
    detail: "저장한 같은 종목 기록으로 빠른 달리기와 회복을 구체적으로 준비",
  },
  FIVE_K: {
    title: "5km",
    detail: "5km를 끝까지 일정하게 달리는 힘 준비",
  },
  TEN_K: {
    title: "10km",
    detail: "10km 동안 유지할 수 있는 지구력 준비",
  },
  GENERAL_ENDURANCE: {
    title: "기초 지구력",
    detail: "경기 날짜 없이 달리기 습관과 기초 체력 준비",
  },
}

export const EXPERIENCE_LABELS: Record<ExperienceBand, {
  readonly title: string
  readonly detail: string
  /** 달력 미리보기·요약 줄에 쓰는 두세 글자 표현 */
  readonly short: string
}> = {
  NEW_TO_RUNNING: {
    title: "달리기를 막 시작했어요",
    detail: "습관을 만드는 중",
    short: "처음",
  },
  DEVELOPING: {
    title: "훈련 계획에 맞춰 달려 본 경험이 있어요",
    detail: "꾸준히 달리고 있어요",
    short: "꾸준히",
  },
  EXPERIENCED: {
    title: "빠른 훈련과 쉬운 훈련을 나눠 꾸준히 해왔어요",
    detail: "반복 달리기와 대회 경험이 많아요",
    short: "경험자",
  },
}

export const ENERGY_INTENT_LABELS: Record<PlannedEnergyIntent, {
  readonly title: string
  /** 한 줄 이하. 원리·경계 설명은 `term` 물음표 뒤로. */
  readonly detail: string
  readonly term: "base" | "lt" | "vo2" | "gly" | "atp" | "energy-system" | "rpe"
}> = {
  MIXED_INTENT: {
    title: "혼합 훈련",
    detail: "빠른 달리기와 가벼운 달리기를 조합",
    term: "energy-system",
  },
  BASE_INTENT: {
    title: "기초 지구력",
    detail: "대화하며 뛸 수 있는 속도로",
    term: "base",
  },
  LT_INTENT: {
    title: "지속 페이스 훈련",
    detail: "살짝 힘든 속도를 일정하게",
    term: "lt",
  },
  VO2_INTENT: {
    title: "유산소 반복 훈련",
    detail: "빠른 구간과 천천히 움직이는 구간을 번갈아",
    term: "vo2",
  },
  GLY_INTENT: {
    title: "고강도 반복 훈련",
    detail: "짧고 강한 구간을 여러 번",
    term: "gly",
  },
  ATP_PC_INTENT: {
    title: "스피드 훈련",
    detail: "아주 짧은 가속과 충분한 휴식",
    term: "atp",
  },
  RECOVERY_INTENT: {
    title: "회복 운동",
    detail: "걷기·아주 가벼운 조깅",
    term: "rpe",
  },
}

export function candidateLabel(
  kind: PlanCandidateKind,
  selectedEnergyIntent: PlannedEnergyIntent,
  _hasCatalog = false,
): {
  readonly title: string
  readonly detail: string
} {
  // A saved kind does not prove shorter exercise after catalog binding or edits.
  // Actual session times are shown alongside these neutral identifiers.
  return {
    title: kind === "BALANCED" ? "계획 A" : "계획 B",
    detail: `훈련 목표 · ${ENERGY_INTENT_LABELS[selectedEnergyIntent].title}`,
  }
}

export const PROGRESS_LABELS: Record<PlanProgressState, string> = {
  COMPLETED: "완료",
  RESTED: "휴식",
  SKIPPED: "건너뜀",
  PAIN_CHECKIN: "통증 체크",
}

export function sessionLabel(session: WorkoutDisplaySession): string {
  return sessionWorkoutName(session)
}

export function prescriptionLabel(session: PlanSession, plain = false): string {
  return sessionWorkoutNotation(session, plain ? "PLAIN" : "COACH")
}

export function sessionIntentLabel(session: PlanSession): string {
  return ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title
}

export function sessionSlotLabel(slot: PlanSessionSlot): string {
  switch (slot) {
    case "AM":
      return "오전"
    case "PM":
      return "오후"
    default:
      return slot satisfies never
  }
}

export function sessionGuidance(session: PlanSession): string {
  if (session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout) {
    return "표시된 거리·시간과 반복 횟수를 따르고, 반복 사이와 세트 사이 회복을 구분하세요. 전체 시간에는 준비·회복·정리가 포함돼요."
  }
  switch (session.role) {
    case "REST":
      return "놓친 훈련을 보충하지 않는 날입니다. 쉬거나 일상 수준으로 가볍게 움직이세요."
    case "EASY":
      return session.plannedEnergyIntent === "RECOVERY_INTENT"
        ? `표시된 총 시간 동안 RPE ${session.prescription.rpe.minimum}~${session.prescription.rpe.maximum}로 움직이세요. 빨리 걷기, 걷는 속도보다 조금 빠른 조깅, 천천히 자전거 타기, 완만한 산길 걷기처럼 숨이 편한 움직임이면 됩니다.`
        : "표시된 총 시간 동안 RPE 3~4로 달리세요. 땀이 나고 숨은 조금 차도 친구와 대화하거나 전화 통화는 가능한 정도입니다. 워치의 Zone 2와 같은 뜻으로 단정하지는 않습니다."
    case "QUALITY":
      return qualityGuidance(session.plannedEnergyIntent)
  }
}

export function sessionExecution(session: PlanSession): string {
  if (session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout) {
    const calculation = resolveCatalogBinding(session.prescription.catalogWorkout)
    if (calculation) return `본운동 ${calculation.totals.workOccurrences}개 구간과 표시된 회복을 순서대로 진행하세요.`
  }
  if (session.prescription.kind === "PACE_TARGET") {
    return `준비, ${session.prescription.totals.totalRepetitions}회 본운동과 ${session.prescription.totals.repetitionRecoveryOccurrences}번의 사이 회복, 정리 순서로 진행하세요.`
  }
  switch (session.role) {
    case "REST":
      return "달리기 일정은 없습니다. 쉬거나 일상 수준으로 가볍게 움직이세요."
    case "EASY":
      return session.plannedEnergyIntent === "RECOVERY_INTENT"
        ? "표시된 시간 동안 숨이 편한 걷기·가벼운 조깅·느린 자전거 중 하나로 움직이세요."
        : "표시된 시간 동안 친구와 대화할 수 있는 정도로 편하게 달리세요."
    case "QUALITY":
      return "준비·본운동·정리 순서대로 타이머를 맞춰 진행하세요."
  }
}

export function formatTrainingSeconds(value: number): string {
  const rounded = Math.round(value)
  if (rounded < 60) return `${rounded}초`
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`
}

export type SessionExecutionStep = {
  readonly role: InstantPlanStepRole
  readonly title: string
  readonly detail: string
}

const EXECUTION_STOP_CUE = "통증\u2060·\u2060어지럼\u2060·\u2060자세\u00a0무너짐이 생기면 시간을 채우지 말고 중단하세요."

export function sessionExecutionSteps(session: PlanSession): readonly SessionExecutionStep[] {
  if (session.prescription.kind === "RPE_TIME_RANGE" && session.prescription.catalogWorkout) {
    const calculation = resolveCatalogBinding(session.prescription.catalogWorkout)
    const sequence = calculation && calculatedWorkoutSequence(calculation)
    if (sequence) {
      const total = calculation.totals.seconds
      const phases = ([['warmup', '준비', 'PREPARATION'], ['main', '본운동', 'MAIN'], ['cooldown', '정리', 'COOLDOWN']] as const)
        .filter(([phase]) => sequence[phase].length > 0)
      const hasCooldown = phases.some(([phase]) => phase === "cooldown")
      const totalStep: SessionExecutionStep[] = total === null ? [] : [{
        role: "TOTAL_DURATION",
        title: "총 시간",
        detail: `준비·회복·정리 포함 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : `~${formatTrainingSeconds(total.maximum)}`}`,
      }]
      return [...totalStep, ...phases.map(([phase, title, role], index) => ({
        role,
        title,
        detail: `${sequencePhaseNotation(sequence, phase, [], "PLAIN")}${phase === "cooldown" || (!hasCooldown && index === phases.length - 1) ? ` ${EXECUTION_STOP_CUE}` : ""}`,
      }))]
    }
    return []
  }
  if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE") return []

  return [
    {
      role: "PREPARATION",
      title: "준비",
      detail: "표시된 총 시간 안에서 걷거나 천천히 달리며 몸이 부드럽게 움직이는지 확인하세요.",
    },
    {
      role: "MAIN",
      title: "본운동",
      detail: qualityExecution(session.plannedEnergyIntent, session.prescription.rpe),
    },
    {
      role: "COOLDOWN",
      title: "정리",
      detail: `남은 총 시간은 천천히 달리거나 걸으세요. ${EXECUTION_STOP_CUE}`,
    },
  ]
}

function qualityExecution(
  intent: Extract<PlanSession, { readonly role: "QUALITY" }>["plannedEnergyIntent"],
  rpe: RpeTimeRange["rpe"],
): string {
  const effort = `RPE ${rpe.minimum}~${rpe.maximum}`
  switch (intent) {
    case "LT_INTENT":
      return `${effort}으로 일정하게 달리세요. 숨은 차지만 짧은 문장이 가능하고, 속도를 크게 바꾸지 않는 수준입니다.`
    case "VO2_INTENT":
      return `${effort} 강한\u00a0구간과 천천히 움직이는 회복 구간을 번갈아\u00a0하세요. 자세나 속도가 흐트러지기 전에 강한\u00a0구간을 끝내세요. 짧은 말이 가능할 만큼 숨이\u00a0가라앉으면 다음 구간을 시작하세요. 같은 강도로 한 번 더 달릴\u00a0여유가 없으면 본운동을 끝내세요.`
    case "GLY_INTENT":
      return `${effort}의 짧은 고강도 구간을 달리다가 자세나 속도가 흐트러지기 전에 끝내세요. 그 뒤에는 천천히 움직이세요. 짧은 말이 가능할 만큼 숨이\u00a0가라앉으면 다음 구간을 시작하세요. 같은 강도로 한 번 더 달릴\u00a0여유가 없으면 본운동을 끝내세요.`
    case "ATP_PC_INTENT":
      return `${effort}에 닿으면 더 세게 밀지 말고 한\u00a0번의\u00a0가속\u00a0구간을 끝내세요. 그 뒤에는 걷거나 천천히 움직이세요. 숨과 다리가 편해지면 다음 가속을 시작하고, 전력질주가 되거나 가속 자세가 흐트러지면 본운동을 끝내세요.`
    case "MIXED_INTENT":
      return `${effort} 구간과 천천히 움직이는 회복 구간을 번갈아 하세요. 짧은 말이 가능할 만큼 숨이 가라앉은 뒤 다음 구간을 시작하고, 한 번에 완전히 지치지 않도록 힘을 남기세요.`
    default:
      return intent satisfies never
  }
}

function qualityGuidance(intent: PlannedEnergyIntent): string {
  switch (intent) {
    case "LT_INTENT":
      return "오늘 시간은 준비·본운동·정리를 모두 합친 값입니다. 목표 페이스는 추정하지 않으며, RPE와 말하기 정도로 강도를 조절합니다."
    case "VO2_INTENT":
    case "GLY_INTENT":
      return "오늘 시간은 준비·빠른 구간·회복 구간·정리를 모두 합친 값입니다. 고강도 총시간 전체를 계속 달리는 뜻이 아니며, 거리\u2060·\u2060목표\u00a0페이스·고정 횟수는 추정하지 않습니다."
    case "ATP_PC_INTENT":
      return "오늘 시간은 준비·짧은 가속·충분한 회복·정리를 모두 합친 값입니다. 100·200·400m 전용 스프린트 처방이나 목표 기록은 만들지 않습니다."
    case "MIXED_INTENT":
      return "총 시간은 준비·강한 구간·회복·정리를 포함합니다. 전체를 같은 강도로 계속 달리는 뜻이 아니며, 구간별 목적·반복·거리·회복이 확정된 복합 처방은 아닙니다."
    case "RECOVERY_INTENT":
    case "BASE_INTENT":
      return "표시된 목적과 RPE 범위를 벗어나지 않도록 조절하세요. 상세 반복·거리·페이스는 아직 정하지 않았습니다."
    default:
      return intent satisfies never
  }
}

type CandidateSummarySource = {
  readonly sessions: readonly PlanSession[]
  readonly frame?: { readonly lengthDays?: number; readonly projectionLengthDays?: 7 | 9 | 9.5 | 10 }
}

export function formatTotalMinutes(totalMinutes: number): string {
  // Format the overview only; keep the exact prescription values unchanged.
  const totalSeconds = Math.round(totalMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [
    hours > 0 ? `${hours}시간` : null,
    minutes > 0 ? `${minutes}분` : null,
    seconds > 0 ? `${seconds}초` : null,
  ].filter(Boolean).join(" ") || "0분"
}

function candidateSessionFacts(candidate: CandidateSummarySource) {
  const projectionLengthDays = candidate.frame?.projectionLengthDays ?? candidate.frame?.lengthDays
  const visibleSessions = projectionLengthDays === undefined
    ? candidate.sessions
    : candidate.sessions.filter((session) => session.day >= 1 && session.day <= Math.ceil(projectionLengthDays))
  const counts = visibleSessions.reduce(
    (current, session) => ({
      training: current.training + (session.role === "REST" ? 0 : 1),
      easy: current.easy + (session.role === "EASY" ? 1 : 0),
      quality: current.quality + (session.role === "QUALITY" ? 1 : 0),
      rest: current.rest + (session.role === "REST" ? 1 : 0),
    }),
    { training: 0, easy: 0, quality: 0, rest: 0 },
  )

  const trainingDays = new Set(visibleSessions.filter(session => session.role !== "REST").map(session => session.day))
  const restDays = new Set(visibleSessions.filter(session => session.role === "REST" && !trainingDays.has(session.day)).map(session => session.day)).size

  const plannedDuration = visibleSessions.reduce(
    (current, session) => {
      if (session.prescription.kind === "REST") {
        return current
      }
      if (session.prescription.kind === "PACE_TARGET") {
        return current
      }
      return {
        minimum: current.minimum + session.prescription.durationMinutes.minimum,
        maximum: current.maximum + session.prescription.durationMinutes.maximum,
      }
    },
    { minimum: 0, maximum: 0 },
  )
  const durationLabel = plannedDuration.minimum === plannedDuration.maximum
    ? formatTotalMinutes(plannedDuration.minimum)
    : `${formatTotalMinutes(plannedDuration.minimum)}~${formatTotalMinutes(plannedDuration.maximum)}`

  const twoADayTrainingDays = twoADayTrainingDayCount(visibleSessions)
  const hasDetailedPrescription = visibleSessions.some(
    (session) => session.prescription.kind === "PACE_TARGET",
  )
  const hasUnknownDuration = visibleSessions.some(session => session.prescription.kind === "RPE_TIME_RANGE"
    && session.prescription.catalogWorkout !== undefined && resolveCatalogBinding(session.prescription.catalogWorkout) === null)
  return {
    counts,
    restDays,
    durationLabel,
    twoADayTrainingDays,
    hasDetailedPrescription,
    hasUnknownDuration,
    projectionLengthDays,
  }
}

export function candidateSharedSessionSummary(candidate: CandidateSummarySource): string {
  const facts = candidateSessionFacts(candidate)
  const secondSession = facts.twoADayTrainingDays === 0
    ? ""
    : ` · 하루 2회 훈련 ${facts.twoADayTrainingDays}일`
  return [
    `운동 ${facts.counts.training}회`,
    facts.counts.easy > 0 ? `기초·회복 ${facts.counts.easy}회` : null,
    facts.counts.quality > 0 ? `주요 훈련 ${facts.counts.quality}회` : null,
    facts.restDays > 0 ? `쉬는 날 ${facts.restDays}일` : null,
  ].filter(Boolean).join(" · ") + secondSession
}

export function candidateDurationSummary(candidate: CandidateSummarySource): string {
  const facts = candidateSessionFacts(candidate)
  if (facts.hasUnknownDuration) return "전체 시간 확인 필요 · 일부 운동의 시간을 읽지 못했어요"
  const frameLabel = facts.projectionLengthDays === undefined
    ? ""
    : `${facts.projectionLengthDays}일 동안 `
  return facts.hasDetailedPrescription
    ? `${frameLabel}시간 안내 훈련 합계 ${facts.durationLabel} · 페이스로 안내한 훈련은 제외`
    : `${frameLabel}표시된 시간 합계 ${facts.durationLabel}`
}

export function candidateSessionSummary(candidate: CandidateSummarySource): string {
  return `${candidateSharedSessionSummary(candidate)} · ${candidateDurationSummary(candidate)}`
}

export function twoADayTrainingDayCount(sessions: readonly PlanSession[]): number {
  const trainingSessionsByDay = new Map<number, number>()

  for (const session of sessions) {
    if (session.role === "REST") {
      continue
    }
    trainingSessionsByDay.set(
      session.day,
      (trainingSessionsByDay.get(session.day) ?? 0) + 1,
    )
  }

  return [...trainingSessionsByDay.values()].filter((count) => count >= 2).length
}
