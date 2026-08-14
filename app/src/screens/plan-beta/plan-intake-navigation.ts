import type { PlanEventGroup } from "@impl/plan-generator/types"
import type { CompetitionDivision } from "../../domain/plan-beta-schema"
import type { IntakeStep } from "./PlanIntake"

const STEP_ORDER = [
  "goal",
  "division",
  "experience",
  "focus",
  "days",
  "frame-length",
  "training-time",
  "two-a-day",
  "safety",
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

export function previousIntakeStep(
  step: IntakeStep,
  eventGroup: PlanEventGroup | undefined,
): IntakeStep {
  const steps = visibleIntakeSteps(eventGroup)
  const index = steps.indexOf(step)
  return index <= 0 ? "goal" : steps[index - 1] ?? "goal"
}
