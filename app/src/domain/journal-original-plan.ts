import type { PostSessionEntry } from "./journal-schema"
import { isJournalVisible } from "./account/local-journal-ownership"
import { plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"
import { readArchivedOriginalPlans, readPlanBetaStateFromStorage } from "./plan-beta-store"

/** Lookup only: no current-plan substitution, writes, activation or memo access. */
export function readJournalOriginalPlan(entry: PostSessionEntry) {
  if (!isJournalVisible(entry.id)) return { kind: "unavailable" as const }
  const parsed = plannedSessionLinkSchema.safeParse(entry.plannedSessionLink)
  if (!parsed.success || entry.date !== parsed.data.plannedDate
      || ((entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== parsed.data.sessionSlot)) {
    return { kind: "unavailable" as const }
  }
  const active = readPlanBetaStateFromStorage()
  if (active.kind === "loaded") {
    const session = resolveCurrentPlannedSession(active.state, parsed.data)
    if (session !== null) return { kind: "matched" as const, source: "ACTIVE" as const, state: active.state, session }
  }
  const archived = readArchivedOriginalPlans()
  if (archived.kind !== "loaded") return { kind: "unavailable" as const }
  for (const state of archived.plans) {
    const session = resolveCurrentPlannedSession(state, parsed.data)
    if (session !== null) return { kind: "matched" as const, source: "ARCHIVED" as const, state, session }
  }
  return active.kind === "invalid" || active.kind === "storage_error"
    ? { kind: "unavailable" as const } : { kind: "missing" as const }
}
