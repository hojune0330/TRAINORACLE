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
    detail: "빠른 달리기와 회복을 나눠 중거리 경기 준비",
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

export const CANDIDATE_LABELS: Record<PlanCandidateKind, {
  readonly title: string
  readonly detail: string
}> = {
  BALANCED: {
    title: "편안한 달리기 + 조절 강도",
    detail: "편안한 날 사이에 RPE 5~6인 날을 배치합니다.",
  },
  CONSERVATIVE: {
    title: "편안한 달리기 중심",
    detail: "모든 훈련일을 RPE 2~4로 두고 조절 강도 날은 넣지 않습니다.",
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
      return "휴식일"
    case "EASY":
      return "기초 지구력 달리기"
    case "QUALITY":
      return "조절 강도 달리기"
  }
}

export function prescriptionLabel(session: PlanSession): string {
  if (session.prescription.kind === "REST") {
    return "달리기 일정 없음"
  }
  const duration = `${session.prescription.durationMinutes.minimum}~${session.prescription.durationMinutes.maximum}분`
  const rpe = `RPE ${session.prescription.rpe.minimum}~${session.prescription.rpe.maximum}`
  return session.role === "EASY"
    ? `총 ${duration} · ${rpe} · BASE`
    : `총 ${duration} · ${rpe} · 세부 반복·거리·페이스 미지정`
}

export function sessionIntentLabel(session: PlanSession): string {
  switch (session.role) {
    case "REST":
      return "회복"
    case "EASY":
      return "BASE(기초 지구력)"
    case "QUALITY":
      return "조절 강도 · 세부 에너지 시스템 미지정"
  }
}

export function sessionGuidance(session: PlanSession): string {
  switch (session.role) {
    case "REST":
      return "놓친 훈련을 보충하지 않는 날입니다. 쉬거나 일상 수준으로 가볍게 움직이세요."
    case "EASY":
      return "표시된 총 시간 동안 RPE 2~4 안에서 달리세요. 짧은 대화가 어려워지면 속도를 낮추세요."
    case "QUALITY":
      return "표시된 총 시간 동안 RPE 5~6 안에서 달리세요. 반복 횟수·거리·회복 시간·목표 페이스는 아직 지정하지 않은 베타 훈련입니다."
  }
}

export function candidateSessionSummary(candidate: {
  readonly sessions: readonly PlanSession[]
}): string {
  const counts = candidate.sessions.reduce(
    (current, session) => ({
      training: current.training + (session.role === "REST" ? 0 : 1),
      easy: current.easy + (session.role === "EASY" ? 1 : 0),
      quality: current.quality + (session.role === "QUALITY" ? 1 : 0),
      rest: current.rest + (session.role === "REST" ? 1 : 0),
    }),
    { training: 0, easy: 0, quality: 0, rest: 0 },
  )

  return `훈련 ${counts.training}일 · 기초 지구력 ${counts.easy}일 · 조절 강도 ${counts.quality}일 · 휴식·회복 ${counts.rest}일`
}
