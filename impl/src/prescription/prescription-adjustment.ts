import { canonicalJsonFingerprint } from "../plan-generator/candidate-identity"
import {
  deriveSequenceRecoveryDistanceTotals,
  deriveSequenceTotals,
  describeMainMethodDifferences,
  parsePrescriptionSequence,
} from "./sequence"
import type { MainMethodDifferenceCode, PrescriptionSequence, SequenceDerivedTotals, SequenceRecoveryDistanceTotals } from "./sequence"
import type { MethodFamily, MethodReference } from "./method-recommendation"

export type ConfigurationReference = MethodReference & { readonly contentIdentity: string }
export type PrescriptionSnapshot = { readonly configuration: ConfigurationReference; readonly sequence: PrescriptionSequence }
export type AdjustmentPolicyReference = { readonly policyId: string; readonly version: string; readonly contentIdentity: string }

/** Authority must come from an independently trusted reviewed registry, not saved drafts.
 * Context binds the athlete/session, purpose, anchor and eligibility/safety revision via
 * an opaque application key. This module does not issue safety or scientific approval.
 */
export type ReviewedAdjustmentPolicy = {
  readonly policyId: string
  readonly version: string
  readonly reviewRef: string
  readonly contextKey: string
  readonly validFromMs: number
  readonly expiresAtMs: number
  readonly allowedEdges: readonly {
    readonly from: ConfigurationReference
    readonly to: ConfigurationReference
  }[]
}

export type AdjustmentAuthority = {
  readonly catalog: readonly MethodFamily[]
  readonly policies: readonly ReviewedAdjustmentPolicy[]
}

export type AdjustmentDraft = {
  readonly kind: "PRESCRIPTION_ADJUSTMENT_DRAFT"
  readonly policy: AdjustmentPolicyReference
  readonly contextKey: string
  readonly before: PrescriptionSnapshot
  readonly after: PrescriptionSnapshot
}

export type AdjustmentErrorCode =
  | "INVALID_AUTHORITY" | "POLICY_MISMATCH" | "POLICY_EXPIRED" | "CONTEXT_MISMATCH"
  | "CONFIGURATION_MISMATCH" | "EDGE_NOT_ALLOWED" | "DRAFT_MISMATCH"
  | "CURRENT_MISMATCH" | "EXPLICIT_ACTION_REQUIRED"

type Rejected = { readonly kind: "rejected"; readonly code: AdjustmentErrorCode }
export type AdjustmentDraftResult = Rejected | { readonly kind: "draft"; readonly draft: AdjustmentDraft }

export type AdjustmentMeasures = Omit<SequenceDerivedTotals, "uncomputableReasonCodes"> & SequenceRecoveryDistanceTotals
export type AdjustmentDelta = { readonly [K in keyof AdjustmentMeasures]: number | null }
export type AdjustmentReceipt = {
  readonly action: "USER_EXPLICIT"
  readonly appliedAtMs: number
  readonly contextKey: string
  readonly policy: AdjustmentPolicyReference
  readonly before: PrescriptionSnapshot
  readonly after: PrescriptionSnapshot
  readonly beforeTotals: SequenceDerivedTotals & SequenceRecoveryDistanceTotals
  readonly afterTotals: SequenceDerivedTotals & SequenceRecoveryDistanceTotals
  readonly delta: AdjustmentDelta
  readonly methodDifferences: readonly MainMethodDifferenceCode[]
}
export type AdjustmentApplyResult = Rejected | {
  readonly kind: "applied"
  readonly prescription: PrescriptionSnapshot
  readonly draft: null
  readonly receipt: AdjustmentReceipt
}

const reject = (code: AdjustmentErrorCode): Rejected => Object.freeze({ kind: "rejected", code })
const text = (value: string): boolean => typeof value === "string" && value.trim().length > 0

// Validate descriptors before reading values. Bounds are serialization limits, not dose rules.
function canonical(value: unknown): string {
  const ancestors = new Set<object>()
  let nodes = 0
  function visit(item: unknown, depth: number): string {
    if (++nodes > 100_000 || depth > 128) throw new TypeError("Adjustment serialization limit")
    if (item === null || typeof item === "boolean") return JSON.stringify(item)
    if (typeof item === "string") {
      if (item.length > 1_000_000) throw new TypeError("Adjustment serialization limit")
      return JSON.stringify(item)
    }
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item)
    if (typeof item !== "object" || ancestors.has(item)) throw new TypeError("Non-JSON adjustment input")
    ancestors.add(item)
    const array = Array.isArray(item)
    const prototype: unknown = Object.getPrototypeOf(item)
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new TypeError("Non-JSON adjustment input")
    const keys = Reflect.ownKeys(item)
    if (keys.length > 100_000) throw new TypeError("Adjustment serialization limit")
    const read = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(item, key)
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError("Non-JSON adjustment input")
      return descriptor.value as unknown
    }
    let result: string
    if (array) {
      if (keys.length !== item.length + 1) throw new TypeError("Non-JSON adjustment input")
      const entries: string[] = []
      for (let index = 0; index < item.length; index += 1) entries.push(visit(read(String(index)), depth + 1))
      result = `[${entries.join(",")}]`
    } else {
      const names = keys.map(key => {
        if (typeof key !== "string") throw new TypeError("Non-JSON adjustment input")
        return key
      }).sort()
      result = `{${names.map(key => `${JSON.stringify(key)}:${visit(read(key), depth + 1)}`).join(",")}}`
    }
    ancestors.delete(item)
    return result
  }
  return visit(value, 0)
}

// Opaque content hashes are not signatures/approval and remain private audit references.
function fingerprint(domain: string, value: unknown): string {
  return canonicalJsonFingerprint(domain, JSON.parse(canonical(value)) as unknown)
}

function same(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b) }
const referenceKey = (ref: MethodReference): string => canonical([ref.familyId, ref.configurationId, ref.version])

/** Helpers bind content only. They cannot make caller-authored content reviewed. */
export function configurationReference(ref: MethodReference, sequence: PrescriptionSequence): ConfigurationReference {
  canonical(ref)
  const parsed = parsePrescriptionSequence(sequence)
  if (parsed.kind === "rejected" || ![ref.familyId, ref.configurationId, ref.version].every(text)) throw new TypeError("Invalid configuration")
  return Object.freeze({ familyId: ref.familyId, configurationId: ref.configurationId, version: ref.version,
    contentIdentity: fingerprint("trainoracle.method-configuration.v1", parsed.sequence) })
}

export function adjustmentPolicyReference(policy: ReviewedAdjustmentPolicy): AdjustmentPolicyReference {
  const contentIdentity = fingerprint("trainoracle.adjustment-policy.v1", policy)
  return Object.freeze({ policyId: policy.policyId, version: policy.version, contentIdentity })
}

function registry(authority: AdjustmentAuthority): Map<string, PrescriptionSnapshot> | null {
  const families = new Set<string>()
  const result = new Map<string, PrescriptionSnapshot>()
  for (const family of authority.catalog) {
    if (!text(family.familyId) || !text(family.reviewRef) || families.has(family.familyId) || family.configurations.length === 0) return null
    families.add(family.familyId)
    for (const config of family.configurations) {
      const ref = { familyId: family.familyId, configurationId: config.configurationId, version: config.version }
      const parsed = parsePrescriptionSequence(config.sequence)
      if (parsed.kind === "rejected" || result.has(referenceKey(ref))) return null
      result.set(referenceKey(ref), Object.freeze({ configuration: configurationReference(ref, parsed.sequence), sequence: parsed.sequence }))
    }
  }
  const policies = new Set<string>()
  for (const policy of authority.policies) {
    const key = canonical([policy.policyId, policy.version])
    if (policies.has(key) || ![policy.policyId, policy.version, policy.reviewRef, policy.contextKey].every(text)
      || !Number.isFinite(policy.validFromMs) || !Number.isFinite(policy.expiresAtMs) || policy.expiresAtMs <= policy.validFromMs) return null
    policies.add(key)
    for (const edge of policy.allowedEdges) {
      const from = result.get(referenceKey(edge.from))
      const to = result.get(referenceKey(edge.to))
      if (from === undefined || to === undefined || same(edge.from, edge.to)
        || !same(from.configuration, edge.from) || !same(to.configuration, edge.to)) return null
    }
  }
  return result
}

export function createAdjustmentDraft(input: {
  readonly authority: AdjustmentAuthority
  readonly policy: AdjustmentPolicyReference
  readonly contextKey: string
  readonly current: PrescriptionSnapshot
  readonly target: ConfigurationReference
  readonly nowMs: number
}): AdjustmentDraftResult {
  try {
    canonical(input)
    const configurations = registry(input.authority)
    if (configurations === null) return reject("INVALID_AUTHORITY")
    const policy = input.authority.policies.find(item => item.policyId === input.policy.policyId && item.version === input.policy.version)
    if (policy === undefined || !same(adjustmentPolicyReference(policy), input.policy)) return reject("POLICY_MISMATCH")
    if (!Number.isFinite(input.nowMs) || input.nowMs < policy.validFromMs || input.nowMs >= policy.expiresAtMs) return reject("POLICY_EXPIRED")
    if (input.contextKey !== policy.contextKey) return reject("CONTEXT_MISMATCH")
    const before = configurations.get(referenceKey(input.current.configuration))
    const after = configurations.get(referenceKey(input.target))
    if (before === undefined || after === undefined || !same(before, input.current) || !same(after.configuration, input.target)) {
      return reject("CONFIGURATION_MISMATCH")
    }
    if (!policy.allowedEdges.some(edge => same(edge.from, before.configuration) && same(edge.to, after.configuration))) return reject("EDGE_NOT_ALLOWED")
    return Object.freeze({ kind: "draft", draft: Object.freeze({
      kind: "PRESCRIPTION_ADJUSTMENT_DRAFT", policy: adjustmentPolicyReference(policy),
      contextKey: input.contextKey, before, after,
    }) })
  } catch {
    return reject("INVALID_AUTHORITY")
  }
}

/** Discards only pending intent. Reset never applies an inverse edge or changes a plan. */
export function resetAdjustmentDraft(_draft: AdjustmentDraft): null { return null }

export function applyAdjustmentDraft(input: {
  readonly authority: AdjustmentAuthority
  readonly draft: AdjustmentDraft
  readonly current: PrescriptionSnapshot
  readonly contextKey: string
  readonly nowMs: number
  readonly action: "USER_EXPLICIT"
}): AdjustmentApplyResult {
  try {
    canonical(input)
    if (input.action !== "USER_EXPLICIT") return reject("EXPLICIT_ACTION_REQUIRED")
    if (input.draft.contextKey !== input.contextKey) return reject("CONTEXT_MISMATCH")
    const checked = createAdjustmentDraft({
      authority: input.authority, policy: input.draft.policy, contextKey: input.contextKey,
      current: input.draft.before, target: input.draft.after.configuration, nowMs: input.nowMs,
    })
    if (checked.kind === "rejected") return checked
    if (!same(checked.draft, input.draft)) return reject("DRAFT_MISMATCH")
    if (!same(checked.draft.before, input.current)) return reject("CURRENT_MISMATCH")
    const { before, after, policy, contextKey } = checked.draft
    const beforeTotals = Object.freeze({ ...deriveSequenceTotals(before.sequence), ...deriveSequenceRecoveryDistanceTotals(before.sequence) })
    const afterTotals = Object.freeze({ ...deriveSequenceTotals(after.sequence), ...deriveSequenceRecoveryDistanceTotals(after.sequence) })
    const delta: Record<string, number | null> = {}
    const keys = new Set([...Object.keys(beforeTotals), ...Object.keys(afterTotals)])
    for (const key of keys) {
      if (key === "uncomputableReasonCodes") continue
      const a = beforeTotals[key as keyof typeof beforeTotals]
      const b = afterTotals[key as keyof typeof afterTotals]
      delta[key] = typeof a === "number" && typeof b === "number" ? b - a : null
    }
    const receipt: AdjustmentReceipt = Object.freeze({
      action: "USER_EXPLICIT", appliedAtMs: input.nowMs, contextKey, policy, before, after,
      beforeTotals, afterTotals, delta: Object.freeze(delta) as AdjustmentDelta,
      methodDifferences: describeMainMethodDifferences(before.sequence, after.sequence),
    })
    return Object.freeze({ kind: "applied", prescription: after, draft: null, receipt })
  } catch {
    return reject("DRAFT_MISMATCH")
  }
}
