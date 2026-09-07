import { canonicalJsonFingerprint } from "../plan-generator/candidate-identity"
import { canonicalAdjustmentValue, adjustmentPolicyReference } from "./prescription-adjustment"
import type { ConfigurationReference, ReviewedAdjustmentPolicy, AdjustmentPolicyReference } from "./prescription-adjustment"
import type { MethodFamily, MethodReference } from "./method-recommendation"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "./sequence-v3"
import type { PrescriptionSequenceV3 } from "./sequence-v3"
import { compareMainMethodsV3 } from "./sequence-v3-comparison"

export type AdjustmentAuthorityV3 = { readonly catalog: readonly MethodFamily<PrescriptionSequenceV3>[]; readonly policies: readonly ReviewedAdjustmentPolicy[] }
export type PrescriptionSnapshotV3 = { readonly configuration: ConfigurationReference; readonly sequence: PrescriptionSequenceV3 }
export type AdjustmentDraftV3 = { readonly kind: "PRESCRIPTION_ADJUSTMENT_DRAFT"; readonly schemaVersion: 3;
  readonly policy: AdjustmentPolicyReference; readonly contextKey: string;
  readonly before: PrescriptionSnapshotV3; readonly after: PrescriptionSnapshotV3 }
type Totals = ReturnType<typeof deriveSequenceV3Totals>
type Delta = { readonly [P in keyof Totals]: { readonly [K in keyof Totals[P]]: number | null } }
export type AdjustmentReceiptV3 = { readonly schemaVersion: 3; readonly action: "USER_EXPLICIT";
  readonly appliedAtMs: number; readonly contextKey: string; readonly policy: AdjustmentPolicyReference;
  readonly before: PrescriptionSnapshotV3; readonly after: PrescriptionSnapshotV3;
  readonly beforeTotals: Totals; readonly afterTotals: Totals; readonly delta: Delta;
  readonly methodDifferences: ReturnType<typeof compareMainMethodsV3>["differences"] }
const same = (a: unknown, b: unknown) => canonicalAdjustmentValue(a) === canonicalAdjustmentValue(b)
const key = (r: MethodReference) => canonicalAdjustmentValue([r.familyId, r.configurationId, r.version])
const text = (s: unknown): s is string => typeof s === "string" && !!s.trim()
const reject = (code: string) => ({ kind: "rejected" as const, code })
export function configurationReferenceV3(ref: MethodReference, sequence: unknown): ConfigurationReference {
  canonicalAdjustmentValue(ref)
  const p = parsePrescriptionSequenceV3(sequence)
  if (p.kind !== "parsed" || ![ref.familyId, ref.configurationId, ref.version].every(text)) throw new TypeError("INVALID_CONFIGURATION_V3")
  return Object.freeze({ familyId: ref.familyId, configurationId: ref.configurationId, version: ref.version,
    contentIdentity: canonicalJsonFingerprint("trainoracle.method-configuration.v3", p.sequence) })
}
type DraftInput = { readonly authority: AdjustmentAuthorityV3; readonly policy: AdjustmentPolicyReference;
  readonly contextKey: string; readonly current: PrescriptionSnapshotV3; readonly target: ConfigurationReference; readonly nowMs: number }

export function createAdjustmentDraftV3(input: DraftInput) {
  try {
    canonicalAdjustmentValue(input)
    const entries = new Map<string, PrescriptionSnapshotV3>(), families = new Set<string>(), policies = new Set<string>()
    for (const family of input.authority.catalog) {
      if (!text(family.familyId) || !text(family.reviewRef) || families.has(family.familyId) || !family.configurations.length) return reject("INVALID_AUTHORITY")
      families.add(family.familyId)
      for (const c of family.configurations) {
        const p = parsePrescriptionSequenceV3(c.sequence)
        if (p.kind !== "parsed") return reject("INVALID_AUTHORITY")
        const ref = configurationReferenceV3({ familyId: family.familyId, configurationId: c.configurationId, version: c.version }, p.sequence)
        if (entries.has(key(ref))) return reject("INVALID_AUTHORITY")
        entries.set(key(ref), Object.freeze({ configuration: ref, sequence: p.sequence }))
      }
    }
    for (const p of input.authority.policies) {
      const id = canonicalAdjustmentValue([p.policyId, p.version])
      if (policies.has(id) || ![p.policyId, p.version, p.contextKey, p.reviewRef].every(text)
        || !Number.isFinite(p.validFromMs) || !Number.isFinite(p.expiresAtMs) || p.validFromMs >= p.expiresAtMs) return reject("INVALID_AUTHORITY")
      policies.add(id)
      for (const edge of p.allowedEdges) {
        if (!same(entries.get(key(edge.from))?.configuration ?? null, edge.from)
          || !same(entries.get(key(edge.to))?.configuration ?? null, edge.to) || same(edge.from, edge.to)) return reject("INVALID_AUTHORITY")
      }
    }
    const p = input.authority.policies.find(p => p.policyId === input.policy.policyId && p.version === input.policy.version)
    if (!p || !same(adjustmentPolicyReference(p), input.policy)) return reject("POLICY_MISMATCH")
    if (!Number.isFinite(input.nowMs) || input.nowMs < p.validFromMs || input.nowMs >= p.expiresAtMs) return reject("POLICY_EXPIRED")
    if (p.contextKey !== input.contextKey) return reject("CONTEXT_MISMATCH")
    const before = entries.get(key(input.current.configuration)), after = entries.get(key(input.target))
    if (!before || !after || !same(before, input.current) || !same(after.configuration, input.target)) return reject("CONFIGURATION_MISMATCH")
    if (!p.allowedEdges.some(edge => same(edge.from, before.configuration) && same(edge.to, after.configuration))) return reject("EDGE_NOT_ALLOWED")
    return { kind: "draft" as const, draft: Object.freeze({ kind: "PRESCRIPTION_ADJUSTMENT_DRAFT" as const,
      schemaVersion: 3 as const, policy: adjustmentPolicyReference(p), contextKey: input.contextKey, before, after }) }
  } catch { return reject("INVALID_AUTHORITY") }
}

export function resetAdjustmentDraftV3(_draft: AdjustmentDraftV3): null { return null }

export function applyAdjustmentDraftV3(input: { readonly authority: AdjustmentAuthorityV3; readonly draft: AdjustmentDraftV3;
  readonly current: PrescriptionSnapshotV3; readonly contextKey: string; readonly nowMs: number; readonly action: "USER_EXPLICIT" }) {
  try {
    canonicalAdjustmentValue(input)
    if (input.action !== "USER_EXPLICIT") return reject("EXPLICIT_ACTION_REQUIRED")
    if (input.draft.schemaVersion !== 3 || input.draft.contextKey !== input.contextKey) return reject("CONTEXT_MISMATCH")
    const checked = createAdjustmentDraftV3({ authority: input.authority, policy: input.draft.policy, contextKey: input.contextKey,
      current: input.draft.before, target: input.draft.after.configuration, nowMs: input.nowMs })
    if (checked.kind === "rejected") return checked
    if (!same(input.draft, checked.draft)) return reject("DRAFT_MISMATCH")
    if (!same(input.current, checked.draft.before)) return reject("CURRENT_MISMATCH")
    const { before, after, policy, contextKey } = checked.draft
    const beforeTotals = deriveSequenceV3Totals(before.sequence), afterTotals = deriveSequenceV3Totals(after.sequence)
    const delta = Object.fromEntries((["warmup", "main", "cooldown"] as const).map(phase => [phase,
      Object.freeze(Object.fromEntries(Object.keys(beforeTotals[phase]).map(k => {
        const name = k as keyof Totals[typeof phase], a = beforeTotals[phase][name], b = afterTotals[phase][name]
        return [k, typeof a === "number" && typeof b === "number" ? b - a : null]
      }))) ])) as Delta
    const receipt: AdjustmentReceiptV3 = Object.freeze({ schemaVersion: 3, action: "USER_EXPLICIT", appliedAtMs: input.nowMs,
      contextKey, policy, before, after, beforeTotals, afterTotals, delta: Object.freeze(delta),
      methodDifferences: compareMainMethodsV3(before.sequence, after.sequence).differences })
    return { kind: "applied" as const, prescription: after, draft: null, receipt }
  } catch { return reject("DRAFT_MISMATCH") }
}

export function revalidateAdjustmentReceiptV3(input: { readonly authority: AdjustmentAuthorityV3; readonly receipt: AdjustmentReceiptV3;
  readonly current: PrescriptionSnapshotV3; readonly contextKey: string; readonly nowMs: number }) {
  try {
    canonicalAdjustmentValue(input)
    const r = input.receipt
    if (r.schemaVersion !== 3 || !Number.isFinite(r.appliedAtMs) || r.appliedAtMs > input.nowMs) return reject("DRAFT_MISMATCH")
    const draft: AdjustmentDraftV3 = { kind: "PRESCRIPTION_ADJUSTMENT_DRAFT", schemaVersion: 3,
      policy: r.policy, contextKey: r.contextKey, before: r.before, after: r.after }
    const previous = applyAdjustmentDraftV3({ ...input, draft, nowMs: r.appliedAtMs, action: r.action })
    if (previous.kind === "rejected") return previous
    if (!same(previous.receipt, r)) return reject("DRAFT_MISMATCH")
    const current = applyAdjustmentDraftV3({ ...input, draft, action: "USER_EXPLICIT" })
    return current.kind === "rejected" ? current : previous
  } catch { return reject("DRAFT_MISMATCH") }
}
