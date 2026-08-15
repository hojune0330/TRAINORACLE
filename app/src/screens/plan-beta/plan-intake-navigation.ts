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
  "days",
  "frame-length",
  "training-time",
  "two-a-day",
] as const satisfies readonly IntakeStep[]

export type RefinementStep = Exclude<
  IntakeStep,
  "goal" | "division" | "experience" | "safety" | "preview"
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
