import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { prepareSourceAdjustmentOffer, revalidateSourceAdjustmentApplication } from "./source-adjustment-offer"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"
import type { AdjustmentCommitAdapter, AdjustmentCommitEnvironment, AdjustmentExplanationBinding } from "./prescription-adjustment-commit"

export type SourceAdjustmentCommitOwner = Pick<AdjustmentCommitAdapter, "readState" | "compareAndSwap" | "now"> & {
  /** Re-evaluate the live account, safety and candidate eligibility on every call. */
  readonly isAllowed: () => boolean
  readonly readSource: () => SourceAdjustmentOfferInput
  readonly readSourceExplanations: () => readonly AdjustmentExplanationBinding[]
}

const same = (a: unknown, b: unknown) => hasCanonicalJsonTree(a) && hasCanonicalJsonTree(b)
  && canonicalJsonFingerprint("source-adjustment-adapter-v1", a) === canonicalJsonFingerprint("source-adjustment-adapter-v1", b)
const unavailable = (): AdjustmentCommitEnvironment => ({ allowed: false, contextKey: "SOURCE_UNAVAILABLE",
  authority: { catalog: [], policies: [] }, explanations: [] })

/** Connects the existing commit host to live source authority. The owner still
 * provides the real candidate-scoped CAS/lock; this is not a storage implementation.
 */
export function createSourceAdjustmentCommitAdapter(owner: SourceAdjustmentCommitOwner): AdjustmentCommitAdapter {
  function readSource() {
    const source = owner.readSource()
    if (!hasCanonicalJsonTree(source)) throw new Error("INVALID_SOURCE_AUTHORITY")
    return { ...source, nowMs: owner.now() }
  }

  return {
    readState: () => owner.readState(),
    now: () => owner.now(),
    readEnvironment: () => {
      try {
        if (owner.isAllowed() !== true) return unavailable()
        const offer = prepareSourceAdjustmentOffer(readSource())
        if (offer.kind !== "available") return unavailable()
        const sourceExplanations = owner.readSourceExplanations()
        if (!hasCanonicalJsonTree(sourceExplanations)) return unavailable()
        const explanations: AdjustmentExplanationBinding[] = []
        for (const binding of offer.bindings) {
          const matches = sourceExplanations.filter(item => same(item.configuration, binding.source))
          if (matches.length !== 1) return unavailable()
          const explanation = matches[0]!
          const keys = Reflect.ownKeys(explanation)
          if (keys.length !== 3 || !keys.every(key => ["configuration", "explanationVersion", "evidenceRefs"].includes(String(key)))) return unavailable()
          explanations.push({ configuration: binding.resolved.configuration,
            explanationVersion: explanation.explanationVersion, evidenceRefs: [...explanation.evidenceRefs] })
        }
        return { allowed: true, contextKey: offer.contextKey, authority: offer.authority, explanations }
      } catch { return unavailable() }
    },
    compareAndSwap: (expected, next, validateBeforeWrite) => owner.compareAndSwap(expected, next, () => {
      try {
        if (owner.isAllowed() !== true || !validateBeforeWrite() || next.lastCommit === null) return false
        const application = revalidateSourceAdjustmentApplication(readSource(), next.lastCommit.receipt)
        return application.kind === "applied" && application.resolutionContextKey === next.contextKey
          && same(application.prescription, next.prescription)
      } catch { return false }
    }),
  }
}
