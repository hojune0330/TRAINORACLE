import type { PlanGenerationSuccess } from "@impl/plan-generator/types"

export type PlanSessionTarget = { readonly day: number; readonly slot: "AM" | "PM" }

export function samePlanSessionTarget(left: PlanSessionTarget | null, right: PlanSessionTarget | null): boolean {
  return left === null || right === null ? left === right : left.day === right.day && left.slot === right.slot
}

/** Only offer slots shared by both schedule variants; never redirect a missing slot. */
export function listDetailedSessionTargets(generated: PlanGenerationSuccess): readonly PlanSessionTarget[] {
  const [first, second] = generated.candidates
  return first.sessions.flatMap((session) => {
    if (session.role !== "QUALITY" || session.plannedEnergyIntent !== first.selectedEnergyIntent) return []
    const matches = second.sessions.filter(other => other.day === session.day && other.slot === session.slot)
    if (first.sessions.filter(other => other.day === session.day && other.slot === session.slot).length !== 1
      || matches.length !== 1 || matches[0]?.role !== "QUALITY"
      || matches[0].plannedEnergyIntent !== session.plannedEnergyIntent) return []
    return [{ day: session.day, slot: session.slot }]
  })
}
