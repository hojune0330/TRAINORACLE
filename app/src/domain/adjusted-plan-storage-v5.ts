import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "./plan-beta-schema"
import { readSelectedAdjustedPlanV3, selectAdjustedPlanForActivationV3 } from "./selected-adjusted-plan-v3"
import type { SelectedAdjustedPlanStateV3, RetainedAdjustedPlanEvidenceV3, AdjustedPlanSelectionRequestV3 } from "./selected-adjusted-plan-v3"
import type { ReviewedAdjustedPlanPolicyV3 } from "./adjusted-plan-review-v3"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import type { PlanMutationLockManager } from "./plan-mutation-lock"

type Progress = z.infer<typeof progressSchema>
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v5", value)
const invalid = () => ({ kind: "invalid" as const })
const reject = (code: string) => ({ kind: "rejected" as const, code })
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

export type AdjustedPlanLiveReviewV3 = { readonly source: AdjustedPlanSelectionRequestV3["preparation"]["source"];
  readonly explanation: AdjustedPlanSelectionRequestV3["preparation"]["explanation"];
  readonly policies: readonly ReviewedAdjustedPlanPolicyV3[]; readonly retained: readonly RetainedAdjustedPlanEvidenceV3[] }
function sameChoice(state: SelectedAdjustedPlanStateV3) {
  const { generatedAt, periodization, contentFingerprint, adjustment, ...content } = state
  const { acceptedAt, ...origin } = adjustment
  return hash({ ...content, adjustment: origin })
}

/** Version-aware active-plan writer. No UI entry until its read/progress consumers are connected. */
export async function saveSelectedAdjustedPlanV3(input: { readonly request: AdjustedPlanSelectionRequestV3;
  readonly readReview: () => AdjustedPlanLiveReviewV3; readonly isCurrentDraft: () => boolean; readonly locks?: PlanMutationLockManager | null }) {
  try {
    if (!input.isCurrentDraft() || !hasCanonicalJsonTree(input.request)) return reject("STALE_CANDIDATE_SELECTION")
    const opening = hash(input.request), request = structuredClone(input.request), account = localAccountScopeSnapshot()
    const key = activePlanBetaStorageKey(), locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (lock === null) return reject("MUTATION_LOCK_UNAVAILABLE")
      const current = () => input.isCurrentDraft() && localAccountScopeIsCurrent(account)
        && hasCanonicalJsonTree(input.request) && hash(input.request) === opening
      if (!current()) return reject("STALE_CANDIDATE_SELECTION")
      let previous: string | null | undefined, written: string | null = null
      try {
        const storage = window.localStorage
        previous = storage.getItem(key)
        const live = input.readReview(), at = new Date()
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const selected = selectAdjustedPlanForActivationV3({ ...request, preparation: { ...request.preparation,
          source: live.source, explanation: live.explanation } }, live.policies, at)
        if (selected.kind !== "selected_adjusted") return selected
        if (!current() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        if (previous !== null) {
          const old = readStoredAdjustedPlanStateV5(JSON.parse(previous), live.retained, at)
          if (old.kind !== "loaded" || old.state.progress.length || sameChoice(old.state.selection) !== sameChoice(selected.state)) return reject("STALE_BASE")
          return { kind: "saved" as const, state: old.state, replayed: true }
        }
        const output = encodeStoredAdjustedPlanStateV5(selected.state, [], at.toISOString(), live.retained, at)
        if (output.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        if (!current() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        written = output.raw
        storage.setItem(key, written)
        if (storage.getItem(key) !== written || !current()) throw Error("Unconfirmed V3 plan write")
        return { kind: "saved" as const, state: output.state, replayed: false }
      } catch {
        try {
          const storage = window.localStorage
          if (written !== null && storage.getItem(key) === written) storage.removeItem(key)
          return reject(storage.getItem(key) === previous ? "PLAN_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("ADJUSTED_PLAN_SAVE_UNAVAILABLE") }
}
