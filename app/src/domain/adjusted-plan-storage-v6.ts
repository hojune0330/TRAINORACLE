import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree, progressSchema } from "./plan-beta-schema"
import { selectMultiAdjustedPlanV3, readSelectedMultiAdjustedPlanV3, type SelectedMultiAdjustedPlanV3,
  type RetainedMultiAdjustedEvidenceV3, type MultiAdjustedPlanSelectionRequestV3 } from "./selected-multi-adjusted-plan-v3"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-storage.v6", value)
const invalid = () => ({ kind: "invalid" as const })
const reject = (code: string) => ({ kind: "rejected" as const, code })
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

export type MultiAdjustedLiveReviewV3 = { readonly preparations: MultiAdjustedPlanSelectionRequestV3["preparations"];
  readonly rpeBindings: RetainedMultiAdjustedEvidenceV3["rpeBindings"]; readonly policies: RetainedMultiAdjustedEvidenceV3["policies"];
  readonly retained: readonly RetainedMultiAdjustedEvidenceV3[] }
const reviewIdentity = (review: MultiAdjustedLiveReviewV3) => hash({ ...review,
  preparations: review.preparations.map(p => ({ ...p, source: { ...p.source, nowMs: 0 } })) })
function sameChoice(state: SelectedMultiAdjustedPlanV3) {
  const { generatedAt, periodization, contentFingerprint, adjustments, ...base } = state
  const { acceptedAt, ...origin } = adjustments
  return hash({ ...base, adjustments: origin })
}

export async function saveSelectedMultiAdjustedPlanV6(input: { readonly request: MultiAdjustedPlanSelectionRequestV3;
  readonly readReview: () => MultiAdjustedLiveReviewV3; readonly isCurrentDraft: () => boolean; readonly locks?: PlanMutationLockManager | null }) {
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
        const storage = window.localStorage, live = input.readReview(), at = new Date()
        previous = storage.getItem(key)
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const selected = selectMultiAdjustedPlanV3({ ...request, preparations: live.preparations }, live.rpeBindings, live.policies, at)
        if (selected.kind !== "selected_multi_adjusted") return selected
        const expectedReview = reviewIdentity(live)
        const authorized = () => {
          if (!current()) return false
          const fresh = input.readReview()
          if (!hasCanonicalJsonTree(fresh) || reviewIdentity(fresh) !== expectedReview) return false
          const checked = selectMultiAdjustedPlanV3({ ...request, preparations: fresh.preparations }, fresh.rpeBindings, fresh.policies, new Date())
          return checked.kind === "selected_multi_adjusted" && sameChoice(checked.state) === sameChoice(selected.state)
        }
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        if (previous !== null) {
          const old = readStoredMultiAdjustedPlanV6(JSON.parse(previous), live.retained, at)
          if (old.kind !== "loaded" || old.state.progress.length || sameChoice(old.state.selection) !== sameChoice(selected.state)
            || !authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
          return { kind: "saved" as const, state: old.state, replayed: true }
        }
        const output = encodeStoredMultiAdjustedPlanV6(selected.state, [], at.toISOString(), live.retained, at)
        if (output.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        if (!authorized() || storage.getItem(key) !== previous) return reject("STALE_BASE")
        written = output.raw; storage.setItem(key, written)
        if (!authorized() || storage.getItem(key) !== written) throw Error("Unconfirmed multi-plan write")
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
