import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { derivePlanCycleResponse, type PlanCycleResponse } from "./plan-cycle-response"
import { loadEntriesForPlanSafety } from "./journal-store"
import { readArchivedOriginalPlans } from "./plan-beta-store"
import { localAccountScopeSnapshot } from "./account/local-account-scope"
import { currentConfirmedAccountJournalVersions } from "./account/account-journal-projection"
import { readAdjustedCyclePredecessor, adjustedCycleStructuredSource,
  type AdjustedCyclePredecessor, type AdjustedCycleEvidence } from "./adjusted-cycle-successor"

export type CatalogCycleDraftContext = {
  readonly version: 1
  readonly sourceFingerprint: string
}

/** Only structured comparison rows enter the key. Private text is never retained. */
export function readCatalogCycleDraftSource(predecessor: PlanBetaStateV3 | AdjustedCyclePredecessor,
  adjustedEvidence?: AdjustedCycleEvidence): {
  readonly response: PlanCycleResponse
  readonly context: CatalogCycleDraftContext
} | null {
  const journal = loadEntriesForPlanSafety()
  if (journal.status !== "complete") return null
  const account = localAccountScopeSnapshot()
  const journalVersions = account ? currentConfirmedAccountJournalVersions() : null
  if (account && (!journalVersions || journal.entries.some(entry => !journalVersions.some(row => row.entryId === entry.id)))) return null
  const adjusted = predecessor.version !== 3
    ? adjustedEvidence && readAdjustedCyclePredecessor(predecessor, adjustedEvidence) : null
  if (predecessor.version !== 3 && !adjusted) return null
  const source = adjusted ? adjustedCycleStructuredSource(adjusted, journal.entries) : null
  const response = source ? source.response : predecessor.version === 3
    ? derivePlanCycleResponse(journal.entries, predecessor, readArchivedOriginalPlans()) : null
  if (!response) return null
  return { response, context: { version: 1, sourceFingerprint: canonicalJsonFingerprint("catalog-cycle-source-v1", {
    account, journalVersions, predecessor,
    rows: [...response.rows].sort((a, b) => a.currentPlannedSessionId.localeCompare(b.currentPlannedSessionId)
      || a.plannedSessionId.localeCompare(b.plannedSessionId)),
    rejectedLinkCount: response.rejectedLinkCount,
    duplicateCount: response.duplicateCount,
    conflictCount: response.conflictCount,
    historyReadIncomplete: response.historyReadIncomplete,
    ...(source ? { adjustedDetails: source.details } : {}),
  }) } }
}

export function catalogCycleDraftSourceStillCurrent(predecessor: PlanBetaStateV3 | AdjustedCyclePredecessor,
  context: CatalogCycleDraftContext, adjustedEvidence?: AdjustedCycleEvidence): boolean {
  try {
    if (Object.keys(context).sort().join() !== "sourceFingerprint,version" || context.version !== 1) return false
    return readCatalogCycleDraftSource(predecessor, adjustedEvidence)?.context.sourceFingerprint === context.sourceFingerprint
  } catch { return false }
}
