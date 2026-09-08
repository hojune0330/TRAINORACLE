import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { createAdjustmentDraftV3, revalidateAdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { hasExactSourceAdjustmentShape, type SourceAdjustmentOfferInput } from "./source-adjustment-offer"

export type UnanchoredAdjustmentOfferInputV3 = Omit<SourceAdjustmentOfferInput<PrescriptionSequenceV3>, "anchor"> & {
  readonly kind: "UNANCHORED_SOURCE_V3"
}
const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.unanchored-source.v3", value)
const same = (a: unknown, b: unknown) => hash(a) === hash(b)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0
function needsRecord(nodes: readonly SequenceNodeV3[]): boolean {
  return nodes.some(node => node.kind === "group" ? needsRecord(node.children)
    : node.target.kind === "RACE_PACE" || node.target.kind === "SPRINT_REFERENCE" && node.target.reference !== null)
}

/** No record placeholder and no pace calculation. Sources still require exact reviewed edges. */
export function prepareUnanchoredAdjustmentOfferV3(input: UnanchoredAdjustmentOfferInputV3) {
  try {
    const keys = ["kind", "authority", "policy", "current", "contextKey", "resolutionRevision", "nowMs"]
    if (!hasCanonicalJsonTree(input) || input === null || typeof input !== "object"
      || Reflect.ownKeys(input).length !== keys.length
      || Reflect.ownKeys(input).some(k => typeof k !== "string" || !keys.includes(k))
      || input.kind !== "UNANCHORED_SOURCE_V3" || !hasExactSourceAdjustmentShape(input)
      || !text(input.contextKey) || !text(input.resolutionRevision) || !Number.isFinite(input.nowMs)) {
      return unavailable("INVALID_UNANCHORED_SOURCE")
    }
    const sourcePolicy = input.authority.policies.find(p => p.policyId === input.policy.policyId && p.version === input.policy.version)
    if (!sourcePolicy || !same(adjustmentPolicyReference(sourcePolicy), input.policy)) return unavailable("POLICY_MISMATCH")
    const family = input.authority.catalog.find(f => f.familyId === input.current.familyId)
    const original = family?.configurations.find(c => c.configurationId === input.current.configurationId && c.version === input.current.version)
    if (!original) return unavailable("CONFIGURATION_MISMATCH")
    const current = { configuration: input.current, sequence: original.sequence }
    const edges = sourcePolicy.allowedEdges.filter(e => same(e.from, input.current))
    if (!edges.length) return unavailable("NO_ELIGIBLE_TRANSITION")
    const snapshots = [current]
    for (const edge of edges) {
      if (snapshots.some(s => same(s.configuration, edge.to))) return unavailable("DUPLICATE_OR_SELF_EDGE")
      const draft = createAdjustmentDraftV3({ authority: input.authority, current, policy: input.policy,
        contextKey: input.contextKey, target: edge.to, nowMs: input.nowMs })
      if (draft.kind !== "draft") return unavailable(draft.code)
      snapshots.push(draft.draft.after)
    }
    if (snapshots.some(s => needsRecord([...s.sequence.warmup, ...s.sequence.main, ...s.sequence.cooldown]))) {
      return unavailable("RECORD_BASED_TARGET_REQUIRES_ANCHOR")
    }
    const contextKey = hash({ kind: input.kind, contextKey: input.contextKey, revision: input.resolutionRevision })
    const policy = { ...sourcePolicy, policyId: `unanchored:${sourcePolicy.policyId}`, contextKey,
      allowedEdges: edges }
    const authority = { catalog: input.authority.catalog, policies: [policy] }
    const policyRef = adjustmentPolicyReference(policy)
    for (const target of snapshots.slice(1)) {
      const checked = createAdjustmentDraftV3({ authority, current, policy: policyRef, contextKey,
        target: target.configuration, nowMs: input.nowMs })
      if (checked.kind !== "draft") return unavailable(checked.code)
    }
    return { kind: "available" as const, executionAuthority: "NONE" as const, recordBasis: "NOT_USED" as const,
      contextKey, current: structuredClone(current), targets: snapshots.slice(1).map(s => s.configuration),
      authority: structuredClone(authority), policy: policyRef, sourcePolicy: structuredClone(input.policy),
      sourceAuthorityFingerprint: hash(input.authority) }
  } catch { return unavailable("INVALID_UNANCHORED_SOURCE") }
}

export function revalidateUnanchoredAdjustmentApplicationV3(input: UnanchoredAdjustmentOfferInputV3, receipt: AdjustmentReceiptV3) {
  const offer = prepareUnanchoredAdjustmentOfferV3(input)
  if (offer.kind !== "available") return offer
  const applied = revalidateAdjustmentReceiptV3({ authority: offer.authority, current: offer.current,
    receipt, contextKey: offer.contextKey, nowMs: input.nowMs })
  if (applied.kind !== "applied") return unavailable(applied.code)
  if (!offer.targets.some(target => same(target, applied.prescription.configuration))) return unavailable("SOURCE_EDGE_MISMATCH")
  return { kind: "applied" as const, executionAuthority: "NONE" as const, recordBasis: "NOT_USED" as const,
    prescription: applied.prescription, receipt: applied.receipt, resolutionContextKey: offer.contextKey,
    source: { from: input.current, to: applied.prescription.configuration, policy: offer.sourcePolicy,
      authorityFingerprint: offer.sourceAuthorityFingerprint } }
}
