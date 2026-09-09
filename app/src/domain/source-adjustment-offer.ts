import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { adjustmentPolicyReference, configurationReference, createAdjustmentDraft, revalidateAdjustmentReceipt } from "@impl/prescription/prescription-adjustment"
import type { AdjustmentPolicyReference, AdjustmentReceipt, ConfigurationReference, ReviewedAdjustmentPolicy } from "@impl/prescription/prescription-adjustment"
import { configurationReferenceV3, createAdjustmentDraftV3, revalidateAdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import { parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { parsePrescriptionSequence } from "@impl/prescription/sequence"
import type { PrescriptionSequence, PrescriptionSequenceNode } from "@impl/prescription/sequence"
import type { MethodFamily } from "@impl/prescription/method-recommendation"
import { hasCanonicalJsonTree } from "./plan-beta-schema"

export type SourceAdjustmentOfferInput<S = PrescriptionSequence> = {
  readonly authority: { readonly catalog: readonly MethodFamily<S>[]; readonly policies: readonly ReviewedAdjustmentPolicy[] }
  readonly policy: AdjustmentPolicyReference
  readonly current: ConfigurationReference
  readonly contextKey: string
  readonly resolutionRevision: string
  readonly anchor: { readonly eventDistanceM: number; readonly sourceRef: string; readonly contentFingerprint: string }
  readonly nowMs: number
}

const fingerprint = (domain: string, value: unknown) => canonicalJsonFingerprint(domain, value)
const same = (a: unknown, b: unknown) => fingerprint("source-adjustment-equality-v1", a) === fingerprint("source-adjustment-equality-v1", b)
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const exact = (value: object, keys: readonly string[]) => Reflect.ownKeys(value).length === keys.length
  && Reflect.ownKeys(value).every(key => typeof key === "string" && keys.includes(key))
const referenceKeys = ["familyId", "configurationId", "version", "contentIdentity"] as const

function exactInputShape<S>(input: SourceAdjustmentOfferInput<S>): boolean {
  return exact(input, ["authority", "policy", "current", "contextKey", "resolutionRevision", "anchor", "nowMs"])
    && exact(input.anchor, ["eventDistanceM", "sourceRef", "contentFingerprint"])
    && hasExactSourceAdjustmentShape(input)
}

export function hasExactSourceAdjustmentShape<S>(input: Pick<SourceAdjustmentOfferInput<S>, "policy" | "current" | "authority">): boolean {
  return exact(input.policy, ["policyId", "version", "contentIdentity"])
    && exact(input.current, referenceKeys)
    && exact(input.authority, ["catalog", "policies"])
    && input.authority.policies.every(policy => exact(policy, ["policyId", "version", "reviewRef", "contextKey", "validFromMs", "expiresAtMs", "allowedEdges"])
      && policy.allowedEdges.every(edge => exact(edge, ["from", "to"]) && exact(edge.from, referenceKeys) && exact(edge.to, referenceKeys)))
    && input.authority.catalog.every(family => exact(family, ["familyId", "reviewRef", "configurations"])
      && family.configurations.every(configuration => exact(configuration, ["configurationId", "version", "sequence"])))
}

type SourceSnapshot<S> = { readonly configuration: ConfigurationReference; readonly sequence: S }
type SourceCodec<S> = {
  readonly namespace: "v1" | "v3"
  readonly bind: (sequence: S, anchor: SourceAdjustmentOfferInput["anchor"]) => S | null
  readonly reference: (ref: ConfigurationReference, sequence: S) => ConfigurationReference
  readonly draft: (input: { authority: SourceAdjustmentOfferInput<S>["authority"]; policy: AdjustmentPolicyReference;
    current: SourceSnapshot<S>; target: ConfigurationReference; contextKey: string; nowMs: number }) =>
    { kind: "draft"; draft: { after: SourceSnapshot<S> } } | { kind: "rejected"; code: string }
}

function withAnchorV3(sequence: PrescriptionSequenceV3, anchor: SourceAdjustmentOfferInput["anchor"]): PrescriptionSequenceV3 | null {
  const visit = (node: SequenceNodeV3): SequenceNodeV3 => {
    if (node.kind === "group") return { ...node, children: node.children.map(visit) }
    if (node.target.kind !== "RACE_PACE") return node
    if (node.target.anchorRef !== null || node.target.eventDistanceM !== anchor.eventDistanceM) throw new Error("SOURCE_ANCHOR_MISMATCH")
    return { ...node, target: { ...node.target, anchorRef: anchor.sourceRef } }
  }
  const parsed = parsePrescriptionSequenceV3({ ...sequence,
    warmup: sequence.warmup.map(visit), main: sequence.main.map(visit), cooldown: sequence.cooldown.map(visit) })
  return parsed.kind === "parsed" ? parsed.sequence : null
}

/** Only bind an approved placeholder. No duration, distance, target intensity or
 * recovery value is changed here, and an existing private anchor is not reusable.
 */
function withAnchor(sequence: PrescriptionSequence, anchor: SourceAdjustmentOfferInput["anchor"]): PrescriptionSequence | null {
  const visit = (node: PrescriptionSequenceNode): PrescriptionSequenceNode => {
    if (node.kind === "group") return { ...node, children: node.children.map(visit) }
    if (node.target.kind !== "RACE_PACE") return node
    if (node.target.anchorRef !== null || node.target.eventDistanceM !== anchor.eventDistanceM) throw new Error("SOURCE_ANCHOR_MISMATCH")
    return { ...node, target: { ...node.target, anchorRef: anchor.sourceRef } }
  }
  const parsed = parsePrescriptionSequence({ ...sequence,
    warmup: sequence.warmup.map(visit), main: sequence.main.map(visit), cooldown: sequence.cooldown.map(visit) })
  return parsed.kind === "parsed" ? parsed.sequence : null
}

/** Caller supplies independently trusted source authority and a current scoped
 * revision. This function does not register a policy or authorize an athlete.
 */
export function prepareSourceAdjustmentOffer(input: SourceAdjustmentOfferInput) {
  return prepareSourceOffer(input, { namespace: "v1", bind: withAnchor, reference: configurationReference, draft: createAdjustmentDraft })
}

export function prepareSourceAdjustmentOfferV3(input: SourceAdjustmentOfferInput<PrescriptionSequenceV3>) {
  return prepareSourceOffer(input, { namespace: "v3", bind: withAnchorV3, reference: configurationReferenceV3, draft: createAdjustmentDraftV3 })
}

function prepareSourceOffer<S>(input: SourceAdjustmentOfferInput<S>, codec: SourceCodec<S>) {
  try {
    if (!hasCanonicalJsonTree(input) || !exactInputShape(input) || !text(input.contextKey) || !text(input.resolutionRevision)
      || !text(input.anchor.sourceRef) || !/^sha256:[a-f0-9]{64}$/.test(input.anchor.contentFingerprint)
      || !Number.isFinite(input.anchor.eventDistanceM) || input.anchor.eventDistanceM <= 0
      || !Number.isFinite(input.nowMs)) return unavailable("INVALID_RESOLUTION_CONTEXT")
    const sourcePolicy = input.authority.policies.find(item => item.policyId === input.policy.policyId && item.version === input.policy.version)
    if (sourcePolicy === undefined || !same(adjustmentPolicyReference(sourcePolicy), input.policy)) return unavailable("POLICY_MISMATCH")
    const family = input.authority.catalog.find(item => item.familyId === input.current.familyId)
    const configuration = family?.configurations.find(item => item.configurationId === input.current.configurationId && item.version === input.current.version)
    if (configuration === undefined) return unavailable("CONFIGURATION_MISMATCH")
    const sourceCurrent: SourceSnapshot<S> = { configuration: input.current, sequence: configuration.sequence }
    const edges = sourcePolicy.allowedEdges.filter(edge => same(edge.from, input.current))
    if (edges.length === 0) return unavailable("NO_ELIGIBLE_TRANSITION")
    const sources: SourceSnapshot<S>[] = [sourceCurrent]
    for (const edge of edges) {
      if (sources.some(item => same(item.configuration, edge.to))) return unavailable("DUPLICATE_OR_SELF_EDGE")
      const draft = codec.draft({ authority: input.authority, policy: input.policy,
        current: sourceCurrent, target: edge.to, contextKey: input.contextKey, nowMs: input.nowMs })
      if (draft.kind !== "draft") return unavailable(draft.code)
      sources.push(draft.draft.after)
    }
    const contextKey = fingerprint(`trainoracle.resolved-adjustment-context.${codec.namespace}`, {
      sourceContextKey: input.contextKey, revision: input.resolutionRevision, anchor: input.anchor,
    })
    const bindings = sources.map(source => {
      const sequence = codec.bind(source.sequence, input.anchor)
      if (sequence === null) throw new Error("INVALID_RESOLVED_SEQUENCE")
      return { source: source.configuration,
        resolved: { configuration: codec.reference(source.configuration, sequence), sequence } }
    })
    const current = bindings[0]!.resolved
    const targets = bindings.slice(1).map(item => item.resolved.configuration)
    const catalog: MethodFamily<S>[] = []
    for (const { resolved } of bindings) {
      const familyId = resolved.configuration.familyId
      const existing = catalog.find(item => item.familyId === familyId)
      const item = { configurationId: resolved.configuration.configurationId, version: resolved.configuration.version, sequence: resolved.sequence }
      if (existing === undefined) catalog.push({ familyId, reviewRef: input.authority.catalog.find(source => source.familyId === familyId)!.reviewRef, configurations: [item] })
      else catalog[catalog.indexOf(existing)] = { ...existing, configurations: [...existing.configurations, item] }
    }
    const policy = { policyId: `resolved:${sourcePolicy.policyId}`, version: sourcePolicy.version,
      reviewRef: sourcePolicy.reviewRef, validFromMs: sourcePolicy.validFromMs, expiresAtMs: sourcePolicy.expiresAtMs, contextKey,
      allowedEdges: targets.map(to => ({ from: current.configuration, to })) }
    const authority: SourceAdjustmentOfferInput<S>["authority"] = { catalog, policies: [policy] }
    const policyRef = adjustmentPolicyReference(policy)
    for (const target of targets) {
      if (codec.draft({ authority, policy: policyRef, current, target, contextKey, nowMs: input.nowMs }).kind !== "draft") {
        return unavailable("INVALID_RESOLVED_AUTHORITY")
      }
    }
    return { kind: "available" as const, contextKey, current, targets, authority, policy: policyRef,
      sourcePolicy: structuredClone(input.policy), bindings,
      sourceAuthorityFingerprint: fingerprint(`trainoracle.source-adjustment-authority.${codec.namespace}`, input.authority) }
  } catch { return unavailable("INVALID_SOURCE_RESOLUTION") }
}

export type SourceAdjustmentOffer = Extract<ReturnType<typeof prepareSourceAdjustmentOffer>, { kind: "available" }>
export type SourceAdjustmentOfferV3 = Extract<ReturnType<typeof prepareSourceAdjustmentOfferV3>, { kind: "available" }>

/** Rebuild from current authority; an old derived policy alone cannot be replayed. */
export function revalidateSourceAdjustmentApplication(input: SourceAdjustmentOfferInput, receipt: AdjustmentReceipt) {
  const offer = prepareSourceAdjustmentOffer(input)
  if (offer.kind !== "available") return offer
  const checked = revalidateAdjustmentReceipt({ authority: offer.authority, receipt, current: offer.current,
    contextKey: offer.contextKey, nowMs: input.nowMs })
  if (checked.kind !== "applied") return unavailable(checked.code)
  const target = offer.bindings.find(item => same(item.resolved.configuration, checked.prescription.configuration))
  if (target === undefined || same(target.source, input.current)) return unavailable("SOURCE_EDGE_MISMATCH")
  return { kind: "applied" as const, prescription: checked.prescription, receipt: checked.receipt,
    source: { policy: offer.sourcePolicy, from: input.current, to: target.source,
      authorityFingerprint: offer.sourceAuthorityFingerprint }, resolutionContextKey: offer.contextKey }
}

export function revalidateSourceAdjustmentApplicationV3(input: SourceAdjustmentOfferInput<PrescriptionSequenceV3>, receipt: AdjustmentReceiptV3) {
  const offer = prepareSourceAdjustmentOfferV3(input)
  if (offer.kind !== "available") return offer
  const checked = revalidateAdjustmentReceiptV3({ authority: offer.authority, receipt, current: offer.current,
    contextKey: offer.contextKey, nowMs: input.nowMs })
  if (checked.kind !== "applied") return unavailable(checked.code)
  const target = offer.bindings.find(item => same(item.resolved.configuration, checked.prescription.configuration))
  if (target === undefined || same(target.source, input.current)) return unavailable("SOURCE_EDGE_MISMATCH")
  return { kind: "applied" as const, prescription: checked.prescription, receipt: checked.receipt,
    source: { policy: offer.sourcePolicy, from: input.current, to: target.source,
      authorityFingerprint: offer.sourceAuthorityFingerprint }, resolutionContextKey: offer.contextKey }
}
