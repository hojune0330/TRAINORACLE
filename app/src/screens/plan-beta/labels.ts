import type {
  ExperienceBand,
  PlanCandidateKind,
  PlanEventGroup,
  PlanProgressState,
  PlanSession,
} from "@impl/plan-generator/types"

export const EVENT_LABELS: Record<PlanEventGroup, {
  readonly title: string
  readonly detail: string
}> = {
  MIDDLE_DISTANCE: {
    title: "800m · 1500m",
    detail: "중거리 경기 준비",
  },
  FIVE_K: {
    title: "5km",
    detail: "지구력과 리듬을 함께",
  },
  TEN_K: {
    title: "10km",
    detail: "지속 가능한 지구력 중심",
  },
  GENERAL_ENDURANCE: {
    title: "기초 지구력",
    detail: "특정 경기 없이 꾸준히",
  },
}

export const EXPERIENCE_LABELS: Record<ExperienceBand, {
  readonly title: string
  readonly detail: string
}> = {
  NEW_TO_RUNNING: {
    title: "시작 단계",
    detail: "달리기 습관을 만드는 중",
  },
  DEVELOPING: {
    title: "훈련 경험 있음",
    detail: "규칙적으로 달리고 있음",
  },
  EXPERIENCED: {
    title: "경기·훈련 경험 많음",
    detail: "구조화된 훈련에 익숙함",
  },
}

export const CANDIDATE_LABELS: Record<PlanCandidateKind, {
  readonly title: string
  readonly detail: string
}> = {
  BALANCED: {
    title: "균형형",
    detail: "쉬운 날과 자극일을 고르게 배치",
  },
  CONSERVATIVE: {
    title: "보수형",
    detail: "자극일 없이 편안한 훈련과 회복 여유를 확보",
  },
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
      return "휴식 또는 가벼운 회복"
    case "EASY":
      return "편안한 지구력"
    case "QUALITY":
      return "조절된 자극"
  }
}

export function prescriptionLabel(session: PlanSession): string {
  if (session.prescription.kind === "REST") {
    return "훈련을 채우지 않아도 되는 날"
  }
  return `${session.prescription.durationMinutes.minimum}~${session.prescription.durationMinutes.maximum}분 · RPE ${session.prescription.rpe.minimum}~${session.prescription.rpe.maximum}`
}
