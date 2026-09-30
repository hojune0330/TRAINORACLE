import { isoShift } from "./dates"
import type { JournalEntry } from "./journal-schema"
import type { PlanBetaStateV3 } from "./plan-beta-schema"

/** Protection is not a claim that this journal performed the planned workout. */
export function journalProtectsPlanSlot(entry: JournalEntry, date: string, slot: "AM" | "PM") {
  if (entry.kind !== "post-session") return false
  return entry.date === date && (!["AM", "PM"].includes(entry.activitySlot ?? "") || entry.activitySlot === slot || entry.plannedSessionLink?.sessionSlot === slot)
    || entry.plannedSessionLink?.plannedDate === date && entry.plannedSessionLink.sessionSlot === slot
}

export function recordedPlanSlots(state: PlanBetaStateV3, entries: readonly JournalEntry[], today: string) {
  return state.activePlan.sessions.filter(s => {
    const date = isoShift(state.intake.startDate!, s.day - 1)
    return date <= today || state.progress.some(p => p.sessionDay === s.day && p.sessionSlot === s.slot)
      || entries.some(e => journalProtectsPlanSlot(e, date, s.slot))
  }).map(s => ({ day: s.day, slot: s.slot }))
}
