import type { PlanSession } from "@impl/plan-generator/types"

type LayoutSession = Pick<PlanSession, "day" | "slot" | "role" | "plannedEnergyIntent">
const address = (s: LayoutSession) => `${s.day}:${s.slot}`

/** Describes planned slots only, not elapsed recovery, biological exposure or safety clearance. */
export function summarizeMultiPlanLayoutV3(sessions: readonly LayoutSession[]) {
  const keys = sessions.map(address)
  if (new Set(keys).size !== keys.length || sessions.some(s => !Number.isInteger(s.day) || s.day < 1
    || !["AM", "PM"].includes(s.slot))) throw Error("INVALID_PLAN_LAYOUT")
  const ordered = [...sessions].sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
  const days = [...new Set(ordered.map(s => s.day))].map(day => {
    const slots = ordered.filter(s => s.day === day)
    return { day, slots, trainingSlots: slots.filter(s => s.role !== "REST").length }
  })
  return {
    trainingSlots: ordered.filter(s => s.role !== "REST").length,
    mainSlots: ordered.filter(s => s.role === "QUALITY"),
    twoADayDays: days.filter(d => d.trainingSlots === 2).map(d => d.day),
    days,
  }
}

export function compareMultiPlanLayoutV3(before: readonly LayoutSession[], after: readonly LayoutSession[]) {
  const original = summarizeMultiPlanLayoutV3(before), adjusted = summarizeMultiPlanLayoutV3(after)
  const layout = (value: readonly LayoutSession[]) => [...value]
    .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))
    .map(s => [s.day, s.slot, s.role, s.plannedEnergyIntent])
  return { original, adjusted, placementAndPurposeUnchanged: JSON.stringify(layout(before)) === JSON.stringify(layout(after)) }
}
