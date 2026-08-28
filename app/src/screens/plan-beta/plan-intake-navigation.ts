import type { PlanEventGroup } from "@impl/plan-generator/types"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { IntakeStep } from "./PlanIntake"

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
  { distanceM: 800, eventGroup: "MIDDLE_DISTANCE", title: "800m", detail: "두 바퀴 경기 준비 · 빠른 반복과 속도 지구력 중심" },
  { distanceM: 1500, eventGroup: "MIDDLE_DISTANCE", title: "1500m", detail: "중거리 경기 준비 · 경기 속도와 유산소 능력을 함께 다룸" },
  { distanceM: 3000, eventGroup: "MIDDLE_DISTANCE", title: "3000m", detail: "중장거리 경기 준비 · 유산소 능력과 경기 속도 유지 중심" },
  { distanceM: 5000, eventGroup: "FIVE_K", title: "5000m", detail: "5km 경기 준비 · 지구력과 5km 경기 속도 중심" },
  { distanceM: 10000, eventGroup: "TEN_K", title: "10km", detail: "10km 경기 준비 · 지속 능력과 경기 속도 조절 중심" },
  { distanceM: 21097, eventGroup: "GENERAL_ENDURANCE", title: "하프마라톤", detail: "21.097km 경기 준비 · 오래 달리는 힘과 페이스 유지 중심" },
  { distanceM: 42195, eventGroup: "GENERAL_ENDURANCE", title: "마라톤", detail: "42.195km 경기 준비 · 장거리 적응과 안정적인 페이스 운영 중심" },
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

export function divisionForGoal(
  eventGroup: PlanEventGroup,
): CompetitionDivision | undefined {
  return eventGroup === "GENERAL_ENDURANCE" ? "NOT_PROVIDED" : undefined
}

export function visibleIntakeSteps(
  eventGroup: PlanEventGroup | undefined,
): readonly IntakeStep[] {
  return eventGroup === "GENERAL_ENDURANCE"
    ? STEP_ORDER.filter((step) => step !== "division")
    : STEP_ORDER
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

export function previousIntakeStep(
  step: IntakeStep,
  eventGroup: PlanEventGroup | undefined,
): IntakeStep {
  if (step === "preview") return "safety"
  const steps = visibleIntakeSteps(eventGroup)
  const index = steps.indexOf(step)
  return index <= 0 ? "goal" : steps[index - 1] ?? "goal"
}
