import type { PlanEventGroup } from "@impl/plan-generator/types"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { IntakeStep } from "./PlanIntake"

/**
 * 기존 빠른 질문 흐름. 간편 기록 입력도 같은 누락 사실 질문을 재사용한다.
 * 나머지 항목은 `QUICK_INTAKE_DEFAULTS`로 채우고, 계획을 받은 뒤 "다듬기"에서 바꾼다.
 * 이 기본값은 목적·일정·생성 결과에 영향을 준다. 선수의 응답으로 주장하지 않는다.
 */
export const QUICK_STEP_ORDER = [
  "goal",
  "experience",
  "days",
  "safety",
] as const satisfies readonly IntakeStep[]

/** 다듬기에서 바꿀 수 있는 항목의 전체 순서(이전 11단계 흐름과 같은 순서를 유지). */
const STEP_ORDER = [
  "goal",
  "division",
  "experience",
  "safety",
  "focus",
  "template",
  "days",
  "frame-length",
  "training-time",
  "two-a-day",
  "race-date",
] as const satisfies readonly IntakeStep[]

export const SUPPORTED_PLAN_EVENTS = [
  { distanceM: 800, eventGroup: "MIDDLE_DISTANCE", title: "800m", detail: "트랙 두 바퀴" },
  { distanceM: 1500, eventGroup: "MIDDLE_DISTANCE", title: "1500m", detail: "트랙 중거리" },
  { distanceM: 3000, eventGroup: "MIDDLE_DISTANCE", title: "3000m", detail: "트랙 중장거리" },
  { distanceM: 5000, eventGroup: "FIVE_K", title: "5000m", detail: "5km" },
  { distanceM: 10000, eventGroup: "TEN_K", title: "10km", detail: "첫 대회로 많이 골라요" },
  { distanceM: 21097, eventGroup: "GENERAL_ENDURANCE", title: "하프마라톤", detail: "21.1km" },
  { distanceM: 42195, eventGroup: "GENERAL_ENDURANCE", title: "마라톤", detail: "42.2km" },
] as const satisfies readonly {
  readonly distanceM: PlanBetaIntake["eventDistanceM"]
  readonly eventGroup: PlanEventGroup
  readonly title: string
  readonly detail: string
}[]

export function eventGroupForDistance(
  distanceM: PlanBetaIntake["eventDistanceM"],
): PlanEventGroup {
  if (distanceM === 5000) return "FIVE_K"
  if (distanceM === 10000) return "TEN_K"
  if (distanceM === 21097 || distanceM === 42195) return "GENERAL_ENDURANCE"
  return "MIDDLE_DISTANCE"
}

export function eventDistanceLabel(
  distanceM: PlanBetaIntake["eventDistanceM"] | undefined,
): string {
  if (distanceM === undefined) return "아직 선택되지 않음"
  if (distanceM === 10000) return "10km"
  if (distanceM === 21097) return "하프마라톤"
  if (distanceM === 42195) return "마라톤"
  return `${distanceM}m`
}

export type RefinementStep = Exclude<
  IntakeStep,
  "goal" | "division" | "experience" | "safety" | "race-date" | "preview"
>

/**
 * 부문은 더 이상 질문하지 않는다. 종목과 무관하게 `NOT_PROVIDED`로 시작하고
 * 다듬기에서 바꿀 수 있다. (부문은 계획에 구분을 표시하는 데만 쓰인다.)
 */
export function divisionForGoal(
  _eventGroup: PlanEventGroup,
): CompetitionDivision {
  return "NOT_PROVIDED"
}

/**
 * 빠른 흐름에서 묻지 않는 항목의 기본값.
 * - trainingFocus MIXED: 여러 강도 조합(골고루). 주요 훈련 종류만 정하며 강도 수치는 생성기가 정한다.
 * - selectedDetailedTemplateRef null: RPE 기준. 상세 훈련표는 다듬기에서 고른다.
 * - requestedFrameLength 9: 한 번에 9일 달력.
 * - trainingTimePreference VARIES: 오너 결정(C3A0) 기본값. "오전"으로 몰래 취급하지 않는다.
 * - secondSessionMode SINGLE_SESSION_ONLY: 하루 두 번은 사용자가 직접 고를 때만.
 */
export const QUICK_INTAKE_DEFAULTS = Object.freeze({
  competitionDivision: "NOT_PROVIDED",
  trainingFocus: "MIXED_INTENT",
  selectedDetailedTemplateRef: null,
  requestedFrameLength: 9,
  trainingTimePreference: "VARIES",
  secondSessionMode: "SINGLE_SESSION_ONLY",
} as const satisfies Partial<PlanBetaIntake>)

export type QuickIntakeDefaultKey = keyof typeof QUICK_INTAKE_DEFAULTS

/**
 * 각 질문에서 "추천"으로 표시할 답. 첫 카드에 놓고 한 번 탭하면 넘어간다.
 * 훈련 수치와 무관한 선택 편의 표시다. 안전 질문에는 추천을 두지 않는다.
 */
export const RECOMMENDED_ANSWERS = Object.freeze({
  eventDistanceM: 5000,
  experienceBand: "NEW_TO_RUNNING",
  availableDayCount: 3,
  trainingFocus: QUICK_INTAKE_DEFAULTS.trainingFocus,
  requestedFrameLength: QUICK_INTAKE_DEFAULTS.requestedFrameLength,
  trainingTimePreference: QUICK_INTAKE_DEFAULTS.trainingTimePreference,
  secondSessionMode: QUICK_INTAKE_DEFAULTS.secondSessionMode,
  competitionDivision: QUICK_INTAKE_DEFAULTS.competitionDivision,
} as const satisfies Partial<PlanBetaIntake>)

/** 아직 답하지 않은 항목만 기본값으로 채운다. 사용자가 이미 고른 값은 절대 덮어쓰지 않는다. */
export function withQuickDefaults(
  draft: Partial<PlanBetaIntake>,
): Partial<PlanBetaIntake> {
  const next: Partial<PlanBetaIntake> = { ...draft }
  if (next.competitionDivision === undefined) next.competitionDivision = QUICK_INTAKE_DEFAULTS.competitionDivision
  if (next.trainingFocus === undefined) next.trainingFocus = QUICK_INTAKE_DEFAULTS.trainingFocus
  if (next.selectedDetailedTemplateRef === undefined) next.selectedDetailedTemplateRef = QUICK_INTAKE_DEFAULTS.selectedDetailedTemplateRef
  if (next.requestedFrameLength === undefined) next.requestedFrameLength = QUICK_INTAKE_DEFAULTS.requestedFrameLength
  if (next.trainingTimePreference === undefined) next.trainingTimePreference = QUICK_INTAKE_DEFAULTS.trainingTimePreference
  if (next.secondSessionMode === undefined) next.secondSessionMode = QUICK_INTAKE_DEFAULTS.secondSessionMode
  return next
}

/** 기본값과 다른 항목(사용자가 다듬기에서 바꾼 것)만 돌려준다. 결과 화면 요약에 쓴다. */
export function customizedFromDefaults(
  intake: Partial<PlanBetaIntake>,
): readonly QuickIntakeDefaultKey[] {
  const keys: QuickIntakeDefaultKey[] = []
  if (intake.competitionDivision !== undefined && intake.competitionDivision !== QUICK_INTAKE_DEFAULTS.competitionDivision) keys.push("competitionDivision")
  if (intake.trainingFocus !== undefined && intake.trainingFocus !== QUICK_INTAKE_DEFAULTS.trainingFocus) keys.push("trainingFocus")
  if (intake.selectedDetailedTemplateRef !== undefined && intake.selectedDetailedTemplateRef !== null) keys.push("selectedDetailedTemplateRef")
  if (intake.requestedFrameLength !== undefined && intake.requestedFrameLength !== QUICK_INTAKE_DEFAULTS.requestedFrameLength) keys.push("requestedFrameLength")
  if (intake.trainingTimePreference !== undefined && intake.trainingTimePreference !== QUICK_INTAKE_DEFAULTS.trainingTimePreference) keys.push("trainingTimePreference")
  if (intake.secondSessionMode !== undefined && intake.secondSessionMode !== QUICK_INTAKE_DEFAULTS.secondSessionMode) keys.push("secondSessionMode")
  return keys
}

/** 빠른 흐름은 종목과 무관하게 같은 네 단계다. */
export function visibleIntakeSteps(
  _eventGroup: PlanEventGroup | undefined,
): readonly IntakeStep[] {
  return QUICK_STEP_ORDER
}

/** 다듬기 화면 등에서 전체 순서가 필요할 때 사용. */
export function allIntakeSteps(): readonly IntakeStep[] {
  return STEP_ORDER
}

export function firstUnansweredRefinement(
  draft: Partial<PlanBetaIntake>,
): RefinementStep | null {
  return unansweredRefinements(draft)[0] ?? null
}

export function unansweredRefinements(
  draft: Partial<PlanBetaIntake>,
): readonly RefinementStep[] {
  const steps: RefinementStep[] = []
  if (draft.trainingFocus === undefined) steps.push("focus")
  if (draft.selectedDetailedTemplateRef === undefined) steps.push("template")
  if (draft.availableDayCount === undefined) steps.push("days")
  if (draft.requestedFrameLength === undefined) steps.push("frame-length")
  if (draft.trainingTimePreference === undefined) steps.push("training-time")
  if (draft.secondSessionMode === undefined) steps.push("two-a-day")
  return steps
}

/** 빠른 흐름에서 다음에 보여줄 질문. 세 항목이 모두 있으면 안전 확인(마지막 질문)이다. */
export function firstUnansweredQuickStep(
  draft: Partial<PlanBetaIntake>,
): (typeof QUICK_STEP_ORDER)[number] {
  if (draft.eventDistanceM === undefined) return "goal"
  if (draft.experienceBand === undefined) return "experience"
  if (draft.availableDayCount === undefined) return "days"
  return "safety"
}

export function previousIntakeStep(
  step: IntakeStep,
  _eventGroup: PlanEventGroup | undefined,
): IntakeStep {
  const index = QUICK_STEP_ORDER.indexOf(step as (typeof QUICK_STEP_ORDER)[number])
  if (index > 0) return QUICK_STEP_ORDER[index - 1] ?? "goal"
  if (index === 0) return "goal"
  // 다듬기에서 열린 단계는 항상 결과(안전 확인 뒤)로 돌아간다.
  return "safety"
}
