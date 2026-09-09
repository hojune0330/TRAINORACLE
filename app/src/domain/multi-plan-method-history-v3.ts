import type { MethodHistoryEntry } from "@impl/prescription/method-recommendation"
import { readPlanBetaStateFromStorage } from "./plan-beta-store"
import { readMultiAdjustedOriginalPlansV3 } from "./multi-adjusted-plan-archive-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-v3"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"

/** Account-scoped V6 plan progress only; completion is self-reported, not device verification. */
export function readMultiPlanMethodHistoryV3(eventDistanceM: number, retained: readonly RetainedMultiAdjustedEvidenceV3[]) {
  try {
    const owner = localAccountScopeSnapshot()
    const active = readPlanBetaStateFromStorage([], [], retained)
    const archive = readMultiAdjustedOriginalPlansV3(retained)
    if (active.kind === "invalid" || active.kind === "storage_error" || archive.kind !== "loaded") return { kind: "unavailable" as const }
    const states = [...(active.kind === "multi_adjusted_v3_loaded" ? [active.state] : []), ...archive.entries.map(e => e.state)]
    const seen = new Set<string>(), history: MethodHistoryEntry[] = []
    for (const state of states) {
      if (state.selection.activePlan.eventDistanceM !== eventDistanceM) continue
      for (const session of state.selection.activePlan.sessions) {
        if (session.prescription.kind !== "ADJUSTED_METHOD_V3") continue
        const address = `${state.selection.contentFingerprint}:${session.day}:${session.slot}`
        if (seen.has(address)) continue
        seen.add(address)
        const { familyId, configurationId, version } = session.prescription.snapshot.receipt.after.configuration
        const selected = { familyId, configurationId, version }
        const stateOfSession = state.progress.find(p => p.sessionDay === session.day && p.sessionSlot === session.slot)?.state
        history.push({ selected, performed: stateOfSession === "COMPLETED" ? { status: "PERFORMED", method: selected }
          : { status: stateOfSession === "RESTED" || stateOfSession === "SKIPPED" ? "NOT_PERFORMED" : "MISSING" } })
      }
    }
    if (!localAccountScopeIsCurrent(owner)) return { kind: "unavailable" as const }
    return { kind: "read" as const, scope: "OWNED_V6_SAME_EVENT_SELF_REPORTED_PROGRESS" as const,
      executionAuthority: "NONE" as const, history }
  } catch { return { kind: "unavailable" as const } }
}
