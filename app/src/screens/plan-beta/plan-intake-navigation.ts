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
): Exclude<IntakeStep, "goal" | "division" | "experience" | "safety" | "preview"> | null {
  if (draft.trainingFocus === undefined) return "focus"
  if (draft.availableDayCount === undefined) return "days"
  if (draft.requestedFrameLength === undefined) return "frame-length"
  if (draft.trainingTimePreference === undefined) return "training-time"
  if (draft.secondSessionMode === undefined) return "two-a-day"
  return null
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
