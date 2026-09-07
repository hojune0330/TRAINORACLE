import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "./plan-beta-schema"
import { readSelectedAdjustedPlan } from "./selected-adjusted-plan-content"
import type { SelectedAdjustedPlanState, RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"

// Retain adopted source/explanation/review versions here when the exact owner
// packet is approved. Saved references are never a substitute for this registry.
export const RETAINED_ADJUSTED_PLAN_EVIDENCE: readonly RetainedAdjustedPlanEvidence[] = Object.freeze([])
type Progress = z.infer<typeof progressSchema>
export type StoredAdjustedPlanState = {
  readonly version: 4
  readonly selection: SelectedAdjustedPlanState
  readonly progress: readonly Progress[]
  readonly updatedAt: string
  readonly contentFingerprint: string
}
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v4", value)
const invalid = () => ({ kind: "invalid" as const })

export function readStoredAdjustedPlanState(
  value: unknown,
  evidence: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  readAt = new Date(),
) {
  try {
    if (!hasCanonicalJsonTree(value) || !hasCanonicalJsonTree(evidence)
        || !Array.isArray(evidence) || value === null || typeof value !== "object" || Array.isArray(value)
        || Reflect.ownKeys(value).length !== 5 || !Reflect.ownKeys(value).every(key => typeof key === "string"
          && ["version", "selection", "progress", "updatedAt", "contentFingerprint"].includes(key))) return invalid()
    const stored = value as StoredAdjustedPlanState
    if (stored.version !== 4) return invalid()
    const matches = evidence.map(retained => readSelectedAdjustedPlan(stored.selection, retained, readAt))
      .filter(result => result.kind === "read_only")
    if (matches.length !== 1) return invalid()
    const selected = matches[0]!
    if (selected.kind !== "read_only") return invalid()
    const updated = new Date(stored.updatedAt)
    if (!Number.isFinite(updated.getTime()) || updated.toISOString() !== stored.updatedAt
        || updated > readAt || updated < new Date(selected.state.generatedAt)) return invalid()
    const progress = z.array(progressSchema).parse(stored.progress)
    const keys = new Set<string>()
    for (const item of progress) {
      const key = `${item.sessionDay}:${item.sessionSlot}`
      if (keys.has(key) || selected.state.activePlan.sessions.filter(session =>
        session.day === item.sessionDay && session.slot === item.sessionSlot).length !== 1) return invalid()
      keys.add(key)
    }
    const content = { version: 4 as const, selection: selected.state, progress, updatedAt: stored.updatedAt }
    const state: StoredAdjustedPlanState = { ...content, contentFingerprint: hash(content) }
    if (hash(state) !== hash(stored)) return invalid()
    return { kind: "loaded" as const, state, explanation: selected.explanation, executionAuthority: "NONE" as const }
  } catch { return invalid() }
}

/** Constructs bytes for the owning store; this is not selection or a write. */
export function encodeStoredAdjustedPlanState(
  selection: SelectedAdjustedPlanState,
  progress: readonly Progress[],
  updatedAt: string,
  evidence: readonly RetainedAdjustedPlanEvidence[],
  readAt = new Date(),
) {
  try {
    const content = { version: 4 as const, selection, progress, updatedAt }
    const checked = readStoredAdjustedPlanState({ ...content, contentFingerprint: hash(content) }, evidence, readAt)
    return checked.kind === "loaded" ? { kind: "encoded" as const, state: checked.state, raw: JSON.stringify(checked.state) } : invalid()
  } catch { return invalid() }
}
