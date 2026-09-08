import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "./plan-beta-schema"
import { readSelectedMultiAdjustedPlanV3, type SelectedMultiAdjustedPlanV3, type RetainedMultiAdjustedEvidenceV3 } from "./selected-multi-adjusted-plan-content-v3"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v6", value)
const invalid = () => ({ kind: "invalid" as const })
export const RETAINED_MULTI_ADJUSTED_EVIDENCE_V3: readonly RetainedMultiAdjustedEvidenceV3[] = Object.freeze([])
export type StoredMultiAdjustedPlanStateV6 = { readonly version: 6; readonly selection: SelectedMultiAdjustedPlanV3;
  readonly progress: readonly z.infer<typeof progressSchema>[]; readonly updatedAt: string; readonly contentFingerprint: string }

export function readStoredMultiAdjustedPlanV6(value: unknown,
  retained: readonly RetainedMultiAdjustedEvidenceV3[] = RETAINED_MULTI_ADJUSTED_EVIDENCE_V3, at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(retained) || !Array.isArray(retained)
      || value === null || typeof value !== "object" || Array.isArray(value)
      || Reflect.ownKeys(value).length !== 5 || Reflect.ownKeys(value).some(k => typeof k !== "string"
        || !["version", "selection", "progress", "updatedAt", "contentFingerprint"].includes(k))) return invalid()
    const stored = value as StoredMultiAdjustedPlanStateV6
    if (stored.version !== 6) return invalid()
    const matches = retained.map(e => readSelectedMultiAdjustedPlanV3(stored.selection, e, at)).filter(r => r.kind === "read_only")
    if (matches.length !== 1 || matches[0]!.kind !== "read_only") return invalid()
    const selected = matches[0]!, updated = new Date(stored.updatedAt)
    if (!Number.isFinite(updated.getTime()) || updated.toISOString() !== stored.updatedAt
      || updated > at || updated < new Date(selected.state.generatedAt)) return invalid()
    const progress = z.array(progressSchema).parse(stored.progress), seen = new Set<string>()
    for (const item of progress) {
      const key = `${item.sessionDay}:${item.sessionSlot}`
      if (seen.has(key) || selected.state.activePlan.sessions.filter(s => s.day === item.sessionDay && s.slot === item.sessionSlot).length !== 1) return invalid()
      seen.add(key)
    }
    const content = { version: 6 as const, selection: selected.state, progress, updatedAt: stored.updatedAt }
    const state = { ...content, contentFingerprint: hash(content) }
    if (hash(state) !== hash(stored)) return invalid()
    return { kind: "loaded" as const, executionAuthority: "NONE" as const, state, explanations: selected.explanations }
  } catch { return invalid() }
}

export function encodeStoredMultiAdjustedPlanV6(selection: SelectedMultiAdjustedPlanV3, progress: StoredMultiAdjustedPlanStateV6["progress"],
  updatedAt: string, retained: readonly RetainedMultiAdjustedEvidenceV3[], at = new Date()) {
  const content = { version: 6 as const, selection, progress, updatedAt }
  const read = readStoredMultiAdjustedPlanV6({ ...content, contentFingerprint: hash(content) }, retained, at)
  return read.kind === "loaded" ? { kind: "encoded" as const, state: read.state, raw: JSON.stringify(read.state) } : invalid()
}
