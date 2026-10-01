import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanBetaStateV3 } from "./plan-beta-schema"
import { derivePlanCycleResponse, type PlanCycleResponse } from "./plan-cycle-response"
import { loadEntriesForPlanSafety } from "./journal-store"
import { readArchivedOriginalPlans } from "./plan-beta-store"
import { localAccountScopeSnapshot } from "./account/local-account-scope"

export type CatalogCycleDraftContext = {
  readonly version: 1
  readonly sourceFingerprint: string
}

/** Only structured comparison rows enter the key. Private text is never retained. */
export function readCatalogCycleDraftSource(predecessor: PlanBetaStateV3): {
  readonly response: PlanCycleResponse
  readonly context: CatalogCycleDraftContext
} | null {
  const journal = loadEntriesForPlanSafety()
  if (journal.status !== "complete") return null
  const response = derivePlanCycleResponse(journal.entries, predecessor, readArchivedOriginalPlans())
  return { response, context: { version: 1, sourceFingerprint: canonicalJsonFingerprint("catalog-cycle-source-v1", {
    account: localAccountScopeSnapshot(), predecessor,
    rows: [...response.rows].sort((a, b) => a.currentPlannedSessionId.localeCompare(b.currentPlannedSessionId)
      || a.plannedSessionId.localeCompare(b.plannedSessionId)),
    rejectedLinkCount: response.rejectedLinkCount,
    duplicateCount: response.duplicateCount,
    conflictCount: response.conflictCount,
    historyReadIncomplete: response.historyReadIncomplete,
  }) } }
}

export function catalogCycleDraftSourceStillCurrent(predecessor: PlanBetaStateV3,
  context: CatalogCycleDraftContext): boolean {
  try {
    if (Object.keys(context).sort().join() !== "sourceFingerprint,version" || context.version !== 1) return false
    return readCatalogCycleDraftSource(predecessor)?.context.sourceFingerprint === context.sourceFingerprint
  } catch { return false }
}
