import type { PostSessionEntry } from "./journal-schema"
import { isJournalVisible } from "./account/local-journal-ownership"
import { plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"
import { readArchivedOriginalPlans, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE, readStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./adjusted-plan-selection"
import { readAdjustedOriginalPlans } from "./adjusted-plan-archive"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "./adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"

/** Lookup only: no current-plan substitution, writes, activation or memo access. */
export function readJournalOriginalPlan(entry: PostSessionEntry,
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  retainedV3: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3) {
  if (!isJournalVisible(entry.id)) return { kind: "unavailable" as const }
  const parsed = plannedSessionLinkSchema.safeParse(entry.plannedSessionLink)
  if (!parsed.success || entry.date !== parsed.data.plannedDate
      || ((entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== parsed.data.sessionSlot)) {
    return { kind: "unavailable" as const }
  }
  const active = readPlanBetaStateFromStorage(retained, retainedV3)
  if (active.kind === "adjusted_v3_loaded") {
    const session = resolveCurrentPlannedSession(active.state.selection, parsed.data)
    if (session !== null) return { kind: "matched_adjusted_v3" as const, source: "ACTIVE" as const,
      state: active.state, session, explanation: active.explanation }
  }
  if (active.kind === "adjusted_loaded") {
    const session = resolveCurrentPlannedSession(active.state.selection, parsed.data)
    if (session !== null) return { kind: "matched_adjusted" as const, source: "ACTIVE" as const,
      state: active.state, session, explanation: active.explanation }
  }
  if (active.kind === "loaded") {
    const session = resolveCurrentPlannedSession(active.state, parsed.data)
    if (session !== null) return { kind: "matched" as const, source: "ACTIVE" as const, state: active.state, session }
  }
  const adjustedArchive = readAdjustedOriginalPlans(retained)
  if (adjustedArchive.kind === "loaded") for (const item of adjustedArchive.entries) {
    const session = resolveCurrentPlannedSession(item.state.selection, parsed.data)
    if (session !== null) {
      const checked = readStoredAdjustedPlanState(item.state, retained)
      if (checked.kind === "loaded") return { kind: "matched_adjusted" as const, source: "ARCHIVED" as const,
        state: item.state, session, explanation: checked.explanation }
    }
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
