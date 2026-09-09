import { validateAccountPlanPacket, type AccountPlanPacket } from "./account-plan-document-schema"
import { readStoredAdjustedPlanState } from "../adjusted-plan-storage-schema"
import { readStoredAdjustedPlanStateV5 } from "../adjusted-plan-storage-v5-schema"
import { readStoredMultiAdjustedPlanV6 } from "../adjusted-plan-storage-v6-schema"
import type { RetainedAdjustedPlanEvidence } from "../selected-adjusted-plan-content"
import type { RetainedAdjustedPlanEvidenceV3 } from "../selected-adjusted-plan-content-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "../selected-multi-adjusted-plan-content-v3"

/** Transport validation for historical DISPLAY only. Never pass this evidence into a live gate. */
export function readAccountPlanHistorical(packet: AccountPlanPacket) {
  if (!validateAccountPlanPacket(packet)) return null
  const state = packet.state
  if (state.version === 3) return { kind: "v3" as const, state, executionAuthority: "NONE" as const }
  if (state.version === 4) {
    const read = readStoredAdjustedPlanState(state, [packet.evidence as RetainedAdjustedPlanEvidence])
    return read.kind === "loaded" ? { ...read, kind: "v4" as const } : null
  }
  if (state.version === 5) {
    const read = readStoredAdjustedPlanStateV5(state, [packet.evidence as RetainedAdjustedPlanEvidenceV3])
    return read.kind === "loaded" ? { ...read, kind: "v5" as const } : null
  }
  const read = readStoredMultiAdjustedPlanV6(state, [packet.evidence as RetainedMultiAdjustedEvidenceV3])
  return read.kind === "loaded" ? { ...read, kind: "v6" as const } : null
}
