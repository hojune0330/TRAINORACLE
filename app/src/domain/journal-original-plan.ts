import type { PostSessionEntry } from "./journal-schema"
import { accountPlanService, accountPlansEnabled, readAccountPlanEntry } from "./account/account-plan-service"
import { materializeAccountPlan } from "./account/account-plan-document-schema"
import { readAccountPlanHistorical } from "./account/account-plan-historical"
import { isJournalVisible } from "./account/local-journal-ownership"
import { plannedSessionLinkSchema, resolveCurrentPlannedSession } from "./planned-session-link"
import { readArchivedOriginalPlans, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE, readStoredAdjustedPlanState } from "./adjusted-plan-storage-schema"
import type { RetainedAdjustedPlanEvidence } from "./adjusted-plan-selection"
import { readAdjustedOriginalPlans } from "./adjusted-plan-archive"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3, readStoredAdjustedPlanStateV5 } from "./adjusted-plan-storage-v5"
import { readAdjustedOriginalPlansV3 } from "./adjusted-plan-archive-v3"
import type { RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { readStoredMultiAdjustedPlanV6, RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "./adjusted-plan-storage-v6"
import { readMultiAdjustedOriginalPlansV3 } from "./multi-adjusted-plan-archive-v3"

/** Lookup only: no current-plan substitution, writes, activation or memo access. */
export function readJournalOriginalPlan(entry: PostSessionEntry,
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  retainedV3: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3,
  retainedMultiV3: readonly RetainedMultiAdjustedEvidenceV3[] = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3) {
  if (!isJournalVisible(entry.id)) return { kind: "unavailable" as const }
  const parsed = plannedSessionLinkSchema.safeParse(entry.plannedSessionLink)
  if (!parsed.success || entry.date !== parsed.data.plannedDate
      || ((entry.activitySlot === "AM" || entry.activitySlot === "PM") && entry.activitySlot !== parsed.data.sessionSlot)) {
    return { kind: "unavailable" as const }
  }
  if (accountPlansEnabled()) {
    const view = accountPlanService()?.snapshot(), document = view?.confirmedDocument
    if (!document) return { kind: "unavailable" as const }
    for (const item of document.data.plans) {
      const read = readAccountPlanHistorical(materializeAccountPlan(item))
      if (!read) continue
      const source = item.planId === document.data.currentPlanId ? "ACTIVE" as const : "ARCHIVED" as const
      const sourceVerificationPending = readAccountPlanEntry(item, () => [...retained, ...retainedV3, ...retainedMultiV3]).kind !== "read_only"
      const session = read.kind === "v2" || read.kind === "v3" ? resolveCurrentPlannedSession(read.state, parsed.data)
        : read.kind === "v4" ? resolveCurrentPlannedSession(read.state.selection, parsed.data)
          : read.kind === "v5" ? resolveCurrentPlannedSession(read.state.selection, parsed.data)
            : resolveCurrentPlannedSession(read.state.selection, parsed.data)
      if (!session) continue
      if (read.kind === "v2" || read.kind === "v3") return { kind: "matched" as const, state: read.state,
        session: resolveCurrentPlannedSession(read.state, parsed.data)!, source, sourceVerificationPending }
      if (read.kind === "v4") return { kind: "matched_adjusted" as const, state: read.state,
        session: resolveCurrentPlannedSession(read.state.selection, parsed.data)!, explanation: read.explanation, source, sourceVerificationPending }
      if (read.kind === "v5") return { kind: "matched_adjusted_v3" as const, state: read.state,
        session: resolveCurrentPlannedSession(read.state.selection, parsed.data)!, explanation: read.explanation, source, sourceVerificationPending }
      return { kind: "matched_multi_adjusted_v3" as const, state: read.state,
        session: resolveCurrentPlannedSession(read.state.selection, parsed.data)!,
        explanation: read.explanations.find(e => e.address.day === session.day && e.address.slot === session.slot)?.explanation,
        source, sourceVerificationPending }
    }
    return view && "historyLoaded" in view && !view.historyLoaded
      ? { kind: "unavailable" as const } : { kind: "missing" as const }
  }
  const active = readPlanBetaStateFromStorage(retained, retainedV3, retainedMultiV3)
  if (active.kind === "multi_adjusted_v3_loaded") {
    const session = resolveCurrentPlannedSession(active.state.selection, parsed.data)
    if (session !== null) return { kind: "matched_multi_adjusted_v3" as const, source: "ACTIVE" as const,
      state: active.state, session, explanation: active.explanations.find(e => e.address.day === session.day && e.address.slot === session.slot)?.explanation }
  }
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
  const v3Archive = readAdjustedOriginalPlansV3(retainedV3)
  const multiArchive = readMultiAdjustedOriginalPlansV3(retainedMultiV3)
  if (multiArchive.kind === "loaded") for (const item of multiArchive.entries) {
    const session = resolveCurrentPlannedSession(item.state.selection, parsed.data)
    if (session === null) continue
    const checked = readStoredMultiAdjustedPlanV6(item.state, retainedMultiV3)
    if (checked.kind === "loaded") return { kind: "matched_multi_adjusted_v3" as const, source: "ARCHIVED" as const,
      state: checked.state, session, explanation: checked.explanations.find(e => e.address.day === session.day && e.address.slot === session.slot)?.explanation }
  }
  if (v3Archive.kind === "loaded") for (const item of v3Archive.entries) {
    const session = resolveCurrentPlannedSession(item.state.selection, parsed.data)
    if (session === null) continue
    const checked = readStoredAdjustedPlanStateV5(item.state, retainedV3)
    if (checked.kind === "loaded") return { kind: "matched_adjusted_v3" as const, source: "ARCHIVED" as const,
      state: checked.state, session, explanation: checked.explanation }
  }
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
