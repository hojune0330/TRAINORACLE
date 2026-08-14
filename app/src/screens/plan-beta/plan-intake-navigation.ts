import type { IntakeStep } from "./PlanIntake"

const STEP_ORDER: readonly IntakeStep[] = [
  "goal",
  "division",
  "experience",
  "focus",
  "days",
  "training-time",
  "two-a-day",
  "safety",
]

export function previousIntakeStep(step: IntakeStep): IntakeStep {
  const index = STEP_ORDER.indexOf(step)
  return index <= 0 ? "goal" : STEP_ORDER[index - 1] ?? "goal"
}
