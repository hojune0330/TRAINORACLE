import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "./plan-beta-schema"
import { readSelectedAdjustedPlanV3, type SelectedAdjustedPlanStateV3, type RetainedAdjustedPlanEvidenceV3 } from "./selected-adjusted-plan-content-v3"

type Progress = z.infer<typeof progressSchema>
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v5", value)
const invalid = () => ({ kind: "invalid" as const })
export const RETAINED_ADJUSTED_PLAN_EVIDENCE_V3: readonly RetainedAdjustedPlanEvidenceV3[] = Object.freeze([])
export type StoredAdjustedPlanStateV5 = { readonly version: 5; readonly selection: SelectedAdjustedPlanStateV3;
  readonly progress: readonly Progress[]; readonly updatedAt: string; readonly contentFingerprint: string }

export function readStoredAdjustedPlanStateV5(value: unknown,
  retained: readonly RetainedAdjustedPlanEvidenceV3[] = RETAINED_ADJUSTED_PLAN_EVIDENCE_V3, at = new Date()) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(retained) || !Array.isArray(retained)
      || value === null || typeof value !== "object" || Array.isArray(value)
      || Reflect.ownKeys(value).length !== 5 || Reflect.ownKeys(value).some(k => typeof k !== "string"
        || !["version", "selection", "progress", "updatedAt", "contentFingerprint"].includes(k))) return invalid()
    const stored = value as StoredAdjustedPlanStateV5
    if (stored.version !== 5) return invalid()
    const matches = retained.map(e => readSelectedAdjustedPlanV3(stored.selection, e, at)).filter(r => r.kind === "read_only")
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
    const content = { version: 5 as const, selection: selected.state, progress, updatedAt: stored.updatedAt }
    const state = { ...content, contentFingerprint: hash(content) }
    if (hash(state) !== hash(stored)) return invalid()
    return { kind: "loaded" as const, state, explanation: selected.explanation, executionAuthority: "NONE" as const }
  } catch { return invalid() }
}

export function encodeStoredAdjustedPlanStateV5(selection: SelectedAdjustedPlanStateV3, progress: readonly Progress[],
  updatedAt: string, retained: readonly RetainedAdjustedPlanEvidenceV3[], at = new Date()) {
  const content = { version: 5 as const, selection, progress, updatedAt }
  const read = readStoredAdjustedPlanStateV5({ ...content, contentFingerprint: hash(content) }, retained, at)
  return read.kind === "loaded" ? { kind: "encoded" as const, state: read.state, raw: JSON.stringify(read.state) } : invalid()
}
