import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { accountScopedStorageKey, localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./account/local-account-scope"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME, type PlanMutationLockManager } from "./plan-mutation-lock"
import { selectMultiAdjustedPlanSuccessorV3, type MultiAdjustedPlanSelectionRequestV3 } from "./selected-multi-adjusted-plan-v3"
import { encodeStoredMultiAdjustedPlanV6, readStoredMultiAdjustedPlanV6, type MultiAdjustedLiveReviewV3 } from "./adjusted-plan-storage-v6"
import { MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY, prepareMultiAdjustedOriginalArchiveV3 } from "./multi-adjusted-plan-archive-v3"
import { planAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { checkMultiAdjustedPlanReviewV3 } from "./adjusted-plan-multi-review-v3"

const reject = (code: string) => ({ kind: "rejected" as const, code })
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-successor-save.v3", value)
const reviewIdentity = (review: MultiAdjustedLiveReviewV3) => hash({ ...review,
  preparations: review.preparations.map(p => ({ ...p, source: { ...p.source, nowMs: 0 } })) })

export async function saveSelectedMultiAdjustedSuccessorV3(input: {
  readonly request: MultiAdjustedPlanSelectionRequestV3; readonly expectedPredecessorFingerprint: string;
  readonly readReview: () => MultiAdjustedLiveReviewV3; readonly isCurrentDraft: () => boolean;
  readonly locks?: PlanMutationLockManager | null;
}) {
  try {
    if (!input.isCurrentDraft() || !hasCanonicalJsonTree(input.request)) return reject("STALE_CANDIDATE_SELECTION")
    const openingHash = hash(input.request), request = structuredClone(input.request)
    const expected = input.expectedPredecessorFingerprint, account = localAccountScopeSnapshot()
    const activeKey = activePlanBetaStorageKey(), archiveKey = accountScopedStorageKey(MULTI_ADJUSTED_PLAN_ARCHIVE_V3_KEY)
    const locks = input.locks === undefined ? getPlanMutationLockManager() : input.locks
    if (locks === null) return reject("MUTATION_LOCK_UNAVAILABLE")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, lock => {
      if (lock === null) return reject("MUTATION_LOCK_UNAVAILABLE")
      const current = () => input.isCurrentDraft() && localAccountScopeIsCurrent(account)
        && input.expectedPredecessorFingerprint === expected && hasCanonicalJsonTree(input.request) && hash(input.request) === openingHash
      if (!current()) return reject("STALE_CANDIDATE_SELECTION")
      const writes: { key: string; before: string | null; after: string }[] = []
      let beforeActive: string | null | undefined, beforeArchive: string | null | undefined
      try {
        const storage = window.localStorage
        beforeActive = storage.getItem(activeKey); beforeArchive = storage.getItem(archiveKey)
        const live = input.readReview(), at = new Date()
        if (!hasCanonicalJsonTree(live)) return reject("INVALID_ADJUSTED_REVIEW")
        const previous = readStoredMultiAdjustedPlanV6(beforeActive === null ? null : JSON.parse(beforeActive), live.retained, at)
        if (previous.kind !== "loaded") return reject("INVALID_STORED_PLAN")
        if (previous.state.contentFingerprint !== expected) return reject("STALE_BASE")
        const selected = selectMultiAdjustedPlanSuccessorV3({ ...request, preparations: live.preparations }, previous.state,
          expected, live.retained, live.rpeBindings, live.policies, at)
        if (selected.kind !== "selected_multi_adjusted") return selected
        const originalReview = reviewIdentity(live)
        const authorized = () => {
          if (!current()) return false
          const fresh = input.readReview(), checkedAt = new Date()
          if (!hasCanonicalJsonTree(fresh) || reviewIdentity(fresh) !== originalReview
            || !fresh.preparations.every(p => planAnchorsStillCurrent(p.candidate, checkedAt))
            || evaluatePlanSafety(request.currentCheck, checkedAt).kind !== "passed") return false
          const inputs = fresh.preparations.map(p => {
            if ("experienceBand" in p) return { ...p, source: { ...p.source, nowMs: checkedAt.getTime() } }
            return { ...p, source: { ...p.source, nowMs: checkedAt.getTime() } }
          })
          const review = checkMultiAdjustedPlanReviewV3(inputs, selected.state.intake.experienceBand, fresh.rpeBindings, fresh.policies)
          return review.kind === "reviewed_scope" && hash(review.policy) === hash(selected.state.adjustments.reviewPolicy)
            && review.candidate.contentFingerprint === selected.state.adjustments.selectedCandidateFingerprint
        }
        const encoded = encodeStoredMultiAdjustedPlanV6(selected.state, [], at.toISOString(), live.retained, at)
        if (encoded.kind !== "encoded") return reject("ADJUSTED_PLAN_STORAGE_VALIDATION_FAILED")
        const archive = prepareMultiAdjustedOriginalArchiveV3(beforeArchive, previous.state, live.retained, at)
        if (archive.kind !== "prepared") return reject(archive.kind === "full" ? "ARCHIVE_CAPACITY_REACHED" : "INVALID_STORED_ARCHIVE")
        if (!authorized() || storage.getItem(activeKey) !== beforeActive || storage.getItem(archiveKey) !== beforeArchive) return reject("STALE_BASE")
        for (const write of [{ key: archiveKey, before: beforeArchive, after: archive.raw },
          { key: activeKey, before: beforeActive, after: encoded.raw }]) {
          if (!authorized() || storage.getItem(write.key) !== write.before
            || writes.some(saved => storage.getItem(saved.key) !== saved.after)) throw Error("Changed successor transaction")
          writes.push(write); storage.setItem(write.key, write.after)
          if (!authorized() || storage.getItem(write.key) !== write.after) throw Error("Unconfirmed successor write")
        }
        if (!authorized() || writes.some(write => storage.getItem(write.key) !== write.after)) throw Error("Changed successor transaction")
        return { kind: "saved" as const, state: encoded.state, predecessorFingerprint: expected }
      } catch {
        try {
          const storage = window.localStorage
          let restored = true
          for (const write of [...writes].reverse()) {
            if (storage.getItem(write.key) === write.after) {
              if (write.before === null) storage.removeItem(write.key); else storage.setItem(write.key, write.before)
            }
            if (storage.getItem(write.key) !== write.before) restored = false
          }
          if (beforeActive !== undefined && storage.getItem(activeKey) !== beforeActive) restored = false
          if (beforeArchive !== undefined && storage.getItem(archiveKey) !== beforeArchive) restored = false
          return reject(restored ? "SUCCESSOR_STORAGE_WRITE_FAILED" : "PLAN_STORAGE_STATE_UNCERTAIN")
        } catch { return reject("PLAN_STORAGE_STATE_UNCERTAIN") }
      }
    })
  } catch { return reject("ADJUSTED_SUCCESSOR_SAVE_UNAVAILABLE") }
}
