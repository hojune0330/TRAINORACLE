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
import { PLANNED_ENERGY_INTENTS } from "@impl/plan-generator/types"

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
}> = {
  NEW_TO_RUNNING: {
    title: "달리기를 막 시작했어요",
    detail: "규칙적인 달리기 습관을 만드는 중",
  },
  DEVELOPING: {
    title: "훈련 계획에 맞춰 달려 본 경험이 있어요",
    detail: "규칙적으로 달리고 있음",
  },
  EXPERIENCED: {
    title: "구조화된 훈련과 경기 경험이 많아요",
    detail: "강도일과 회복일을 나눠 훈련해 봄",
  },
}

export const ENERGY_INTENT_LABELS: Record<PlannedEnergyIntent, {
  readonly title: string
  readonly detail: string
  readonly term: "base" | "lt" | "vo2" | "gly" | "atp" | "energy-system" | "rpe"
}> = {
  RECOVERY_INTENT: {
    title: "가벼운 회복 움직임",
    detail: "걷기, 아주 가벼운 조깅, 느린 자전거처럼 몸을 편하게 움직이는 날이에요.",
    term: "rpe",
  },
  BASE_INTENT: {
    title: "기초 지구력 · BASE",
    detail: "땀이 나도 친구와 대화하거나 전화 통화가 가능한 기본 유산소 달리기예요.",
    term: "base",
  },
  LT_INTENT: {
    title: "지속 페이스 · LT",
    detail: "조금 힘든 느낌을 일정하게 유지하는 날이에요. 반복 수와 페이스는 아직 정하지 않아요.",
    term: "lt",
  },
  VO2_INTENT: {
    title: "반복 인터벌 · VO2",
    detail: "숨이 많이 차는 반복 훈련을 준비하는 목적이에요. 정확한 반복 구성은 아직 정하지 않아요.",
    term: "vo2",
  },
  GLY_INTENT: {
    title: "스피드 지구력 · GLY",
    detail: "빠른 구간을 여러 번 이어 가는 힘을 준비하는 목적이에요. 세트와 회복은 아직 정하지 않아요.",
    term: "gly",
  },
  ATP_PC_INTENT: {
    title: "짧고 빠른 가속 · ATP-PC",
    detail: "짧은 가속과 충분한 회복을 준비하는 목적이에요. 100·200·400m 전용 계획은 아직 만들지 않아요.",
    term: "atp",
  },
  MIXED_INTENT: {
    title: "섞어 하는 강도 · MIXED",
    detail: "한 가지 목적만 고정하지 않은 강도 안내예요. 현재 새 계획에서는 직접 고르지 않아요.",
    term: "energy-system",
  },
}

export function candidateLabel(
  kind: PlanCandidateKind,
  selectedEnergyIntent: PlannedEnergyIntent,
): {
  readonly title: string
  readonly detail: string
} {
  if (kind === "CONSERVATIVE") {
    if (selectedEnergyIntent === "RECOVERY_INTENT") {
      return {
        title: "회복 목적 · 부담 낮춤",
        detail: "고른 회복 목적은 유지하고, 움직임 양을 줄이거나 쉬는 날을 늘립니다.",
      }
    }
    return {
      title: `${ENERGY_INTENT_LABELS[selectedEnergyIntent].title.split(" · ")[0]} · 부담 낮춤`,
      detail: `고른 ${ENERGY_INTENT_LABELS[selectedEnergyIntent].title} 목적은 유지하고, 훈련량을 줄이거나 회복 여유를 늘립니다.`,
    }
  }

  if (selectedEnergyIntent === "RECOVERY_INTENT") {
    return {
      title: "가벼운 회복 움직임",
      detail: "가능한 날에 RPE 1~2 회복 움직임을 배치합니다.",
    }
  }
  if (selectedEnergyIntent === "BASE_INTENT") {
    return {
      title: "기초 지구력 중심",
      detail: "가능한 날에 RPE 3~4 기본 유산소 달리기를 배치합니다.",
    }
  }
  return {
    title: `${ENERGY_INTENT_LABELS[selectedEnergyIntent].title.split(" · ")[0]} 포함`,
    detail: `기초 지구력 날 사이에 ${ENERGY_INTENT_LABELS[selectedEnergyIntent].title} 목적의 RPE 안내를 배치합니다.`,
  }
}

export const PROGRESS_LABELS: Record<PlanProgressState, string> = {
  COMPLETED: "완료",
  RESTED: "휴식",
  SKIPPED: "건너뜀",
  PAIN_CHECKIN: "통증 체크",
}

export function sessionLabel(session: PlanSession): string {
  switch (session.role) {
    case "REST":
      return "휴식일"
    case "EASY":
      return session.plannedEnergyIntent === "RECOVERY_INTENT"
        ? session.slot === "PM"
          ? "오후 회복 운동"
          : "가벼운 회복 움직임"
        : "기초 지구력 달리기"
    case "QUALITY":
      return `${ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title} 훈련`
  }
}

export function prescriptionLabel(session: PlanSession): string {
  if (session.prescription.kind === "REST") {
    return "달리기 일정 없음"
  }
  if (session.prescription.kind === "PACE_TARGET") {
    return `총 ${session.prescription.totals.totalRepetitions}회 · 품질 거리 ${session.prescription.totals.qualityDistanceM}m · ${session.prescription.repetitionDistanceM}m ${formatTrainingSeconds(session.prescription.targetRepSeconds)}`
  }
  const duration = `${session.prescription.durationMinutes.minimum}~${session.prescription.durationMinutes.maximum}분`
  const rpe = `RPE ${session.prescription.rpe.minimum}~${session.prescription.rpe.maximum}`
  const intent = ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title
  if (session.role === "EASY") {
    return `총 ${duration} · ${rpe} · ${intent}`
  }
  return `총 ${duration} · ${rpe} · ${intent} · 거리\u2060·\u2060목표\u00a0페이스는 지정하지 않음`
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
  switch (session.role) {
    case "REST":
      return "놓친 훈련을 보충하지 않는 날입니다. 쉬거나 일상 수준으로 가볍게 움직이세요."
    case "EASY":
      return session.plannedEnergyIntent === "RECOVERY_INTENT"
        ? "표시된 총 시간 동안 RPE 1~2로 움직이세요. 빨리 걷기, 걷는 속도보다 조금 빠른 조깅, 천천히 자전거 타기, 완만한 산길 걷기처럼 숨이 편한 움직임이면 됩니다."
        : "표시된 총 시간 동안 RPE 3~4로 달리세요. 땀이 나고 숨은 조금 차도 친구와 대화하거나 전화 통화는 가능한 정도입니다. 워치의 Zone 2와 같은 뜻으로 단정하지는 않습니다."
    case "QUALITY":
      return qualityGuidance(session.plannedEnergyIntent)
  }
}

export function sessionExecution(session: PlanSession): string {
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
  readonly title: string
  readonly detail: string
}

export function sessionExecutionSteps(session: PlanSession): readonly SessionExecutionStep[] {
  if (session.role !== "QUALITY" || session.prescription.kind !== "RPE_TIME_RANGE") return []

  return [
    {
      title: "준비",
      detail: "표시된 총 시간 안에서 걷거나 천천히 달리며 몸이 부드럽게 움직이는지 확인하세요.",
    },
    {
      title: "본운동",
      detail: qualityExecution(session.plannedEnergyIntent, session.prescription.rpe),
    },
    {
      title: "정리",
      detail: "남은 총 시간은 천천히 달리거나 걸으세요. 통증\u2060·\u2060어지럼\u2060·\u2060자세\u00a0무너짐이 생기면 시간을 채우지 말고 중단하세요.",
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
      return `${effort} 빠른\u00a0구간과 천천히 움직이는 회복 구간을 번갈아\u00a0하세요. 자세나 속도가 흐트러지기 전에 빠른\u00a0구간을 끝내세요. 짧은 말이 가능할 만큼 숨이\u00a0가라앉으면 다음 구간을 시작하세요. 같은 강도로 한 번 더 달릴\u00a0여유가 없으면 본운동을 끝내세요.`
    case "GLY_INTENT":
      return `${effort}으로 달리다가 자세나 속도가 흐트러지기 전에 빠른\u00a0구간을 끝내세요. 그 뒤에는 천천히 움직이세요. 짧은 말이 가능할 만큼 숨이\u00a0가라앉으면 다음\u00a0빠른\u00a0구간을 시작하세요. 같은 강도로 한 번 더 달릴\u00a0여유가 없으면 본운동을 끝내세요.`
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
      return "표시된 총 시간 동안 RPE 6~7로 달리세요. 한 가지 에너지 목적의 상세 처방이 아니라 섞어 하는 강도 안내이며, 반복·거리·페이스는 아직 정하지 않았습니다."
    case "RECOVERY_INTENT":
    case "BASE_INTENT":
      return "표시된 목적과 RPE 범위를 벗어나지 않도록 조절하세요. 상세 반복·거리·페이스는 아직 정하지 않았습니다."
    default:
      return intent satisfies never
  }
}

export function candidateSessionSummary(candidate: {
  readonly sessions: readonly PlanSession[]
  readonly frame?: { readonly projectionLengthDays?: 7 | 9 | 9.5 | 10 }
}): string {
  const projectionLengthDays = candidate.frame?.projectionLengthDays
  const visibleSessions = projectionLengthDays === undefined
    ? candidate.sessions
    : candidate.sessions.filter((session) => session.day <= Math.ceil(projectionLengthDays))
  const counts = visibleSessions.reduce(
    (current, session) => ({
      training: current.training + (session.role === "REST" ? 0 : 1),
      easy: current.easy + (session.role === "EASY" ? 1 : 0),
      quality: current.quality + (session.role === "QUALITY" ? 1 : 0),
      rest: current.rest + (session.role === "REST" ? 1 : 0),
    }),
    { training: 0, easy: 0, quality: 0, rest: 0 },
  )

  const intentionCounts = visibleSessions.reduce<Record<PlannedEnergyIntent, number>>(
    (current, session) => ({
      ...current,
      [session.plannedEnergyIntent]: current[session.plannedEnergyIntent] + 1,
    }),
    {
      RECOVERY_INTENT: 0,
      BASE_INTENT: 0,
      LT_INTENT: 0,
      VO2_INTENT: 0,
      GLY_INTENT: 0,
      ATP_PC_INTENT: 0,
      MIXED_INTENT: 0,
    },
  )
  const qualityIntent = PLANNED_ENERGY_INTENTS.find((intent) => (
    intent !== "RECOVERY_INTENT"
    && intent !== "BASE_INTENT"
    && intentionCounts[intent] > 0
  ))
  const qualityLabel = qualityIntent === undefined
    ? "고강도 0일"
    : `${ENERGY_INTENT_LABELS[qualityIntent].title} ${intentionCounts[qualityIntent]}일`

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
    ? `${plannedDuration.minimum}분`
    : `${plannedDuration.minimum}~${plannedDuration.maximum}분`

  const twoADayTrainingDays = twoADayTrainingDayCount(visibleSessions)
  const secondSession = twoADayTrainingDays === 0
    ? ""
    : ` · 하루 2회 훈련 ${twoADayTrainingDays}일`
  const hasDetailedPrescription = candidate.sessions.some(
    (session) => session.prescription.kind === "PACE_TARGET",
  )
  const timeLabel = hasDetailedPrescription
    ? `RPE 세션 시간 ${durationLabel} · 상세 페이스 세션 별도 표시`
    : `총 계획 시간 ${durationLabel}`
  return `운동 ${counts.training}회 · 기초 지구력 ${intentionCounts.BASE_INTENT}일 · ${qualityLabel} · 휴식 ${counts.rest}일 · ${timeLabel}${secondSession}`
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
