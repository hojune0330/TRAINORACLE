import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { revalidateAdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentAuthorityV3, AdjustmentReceiptV3, PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import type { SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import type { ResolvedAdjustedExplanation } from "./adjusted-method-snapshot"

export type ReviewedAdjustedExplanationV3 = ResolvedAdjustedExplanation & {
  readonly sequenceContentIdentity: string
  readonly nodeIds: readonly string[]
}
type Scope = { readonly candidateLineageId: string; readonly mainSlotId: string }
type Input = {
  readonly authority: AdjustmentAuthorityV3
  readonly receipt: AdjustmentReceiptV3
  readonly current: PrescriptionSnapshotV3
  readonly contextKey: string
  readonly nowMs: number
  readonly scope: Scope
  /** Independently supplied exact-version content, never taken from a saved file. */
  readonly explanation: ReviewedAdjustedExplanationV3
}
const hash = (namespace: string, value: unknown) => canonicalJsonFingerprint(namespace, value)
const same = (a: unknown, b: unknown) => hash("v3-snapshot-equality", a) === hash("v3-snapshot-equality", b)
const nonempty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0
const exact = (o: object, keys: readonly string[]) => Reflect.ownKeys(o).length === keys.length
  && Reflect.ownKeys(o).every(k => typeof k === "string" && keys.includes(k))
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const explanationKeys = ["configuration", "resolutionContextKey", "version", "reviewRef", "purpose", "energySupply",
  "workRationale", "recoveryRationale", "cycleRole", "expectedAdaptation", "limitations", "observation", "evidenceRefs",
  "sequenceContentIdentity", "nodeIds"] as const

export function createAdjustedMethodSnapshotV3(input: Input) {
  try {
    if (!hasCanonicalJsonTree(input) || !exact(input, ["authority", "receipt", "current", "contextKey", "nowMs", "scope", "explanation"])
      || !exact(input.scope, ["candidateLineageId", "mainSlotId"])
      || !nonempty(input.scope.candidateLineageId) || !nonempty(input.scope.mainSlotId)) return unavailable("INVALID_V3_SNAPSHOT_INPUT")
    const applied = revalidateAdjustmentReceiptV3(input)
    if (applied.kind !== "applied") return unavailable(applied.code)
    const e = input.explanation
    const ids: string[] = []
    const visit = (nodes: readonly SequenceNodeV3[]) => nodes.forEach(n => { ids.push(n.id); if (n.kind === "group") visit(n.children) })
    const s = applied.prescription.sequence
    visit(s.warmup); visit(s.main); visit(s.cooldown)
    if (!exact(e, explanationKeys) || !same(e.configuration, applied.prescription.configuration)
      || e.resolutionContextKey !== input.contextKey || e.sequenceContentIdentity !== sequenceV3ContentIdentity(s)
      || !explanationKeys.filter(k => !["configuration", "nodeIds", "evidenceRefs"].includes(k)).every(k => nonempty(e[k]))
      || !Array.isArray(e.evidenceRefs) || !e.evidenceRefs.length || !e.evidenceRefs.every(r => nonempty(r) && !/\s/u.test(r))
      || new Set(e.evidenceRefs).size !== e.evidenceRefs.length
      || !Array.isArray(e.nodeIds) || new Set(e.nodeIds).size !== e.nodeIds.length
      || !same([...ids].sort(), [...e.nodeIds].sort())) return unavailable("V3_EXPLANATION_MISMATCH")
    const content = {
      kind: "ADJUSTED_METHOD_SNAPSHOT" as const, schemaVersion: 3 as const, capturedAtMs: input.nowMs,
      scope: input.scope, original: input.current, contextKey: input.contextKey, receipt: applied.receipt,
      explanation: { version: e.version, reviewRef: e.reviewRef, configuration: e.configuration,
        sequenceContentIdentity: e.sequenceContentIdentity, nodeIds: e.nodeIds, evidenceRefs: e.evidenceRefs,
        contentFingerprint: hash("trainoracle.adjusted-method-explanation.v3", e) },
    }
    return { kind: "prepared" as const, executionAuthority: "NONE" as const,
      snapshot: structuredClone({ ...content, contentFingerprint: hash("trainoracle.adjusted-method-snapshot.v3", content) }) }
  } catch { return unavailable("INVALID_V3_SNAPSHOT_INPUT") }
}

/** Historical read requires independently retained policy/explanation versions; no reactivation. */
export function readAdjustedMethodSnapshotV3(raw: string, retained: Omit<Input, "receipt" | "current">) {
  try {
    if (!hasCanonicalJsonTree(retained) || !exact(retained, ["authority", "contextKey", "nowMs", "scope", "explanation"])) return unavailable("INVALID_V3_READ_CONTEXT")
    const value: unknown = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value === null || typeof value !== "object" || Array.isArray(value)
      || !exact(value, ["kind", "schemaVersion", "capturedAtMs", "scope", "original", "contextKey", "receipt", "explanation", "contentFingerprint"])) return unavailable("INVALID_V3_SNAPSHOT")
    const snapshot = value as Extract<ReturnType<typeof createAdjustedMethodSnapshotV3>, { kind: "prepared" }>["snapshot"]
    if (snapshot.kind !== "ADJUSTED_METHOD_SNAPSHOT" || snapshot.schemaVersion !== 3
      || !Number.isFinite(snapshot.capturedAtMs) || !Number.isFinite(retained.nowMs) || snapshot.capturedAtMs > retained.nowMs
      || !same(snapshot.scope, retained.scope) || snapshot.contextKey !== retained.contextKey) return unavailable("V3_SNAPSHOT_CONTEXT_MISMATCH")
    const prepared = createAdjustedMethodSnapshotV3({ ...retained, receipt: snapshot.receipt, current: snapshot.original, nowMs: snapshot.capturedAtMs })
    if (prepared.kind !== "prepared" || !same(prepared.snapshot, snapshot)) return unavailable("V3_SNAPSHOT_EVIDENCE_MISMATCH")
    return { kind: "historical" as const, executionAuthority: "NONE" as const, snapshot: prepared.snapshot }
  } catch { return unavailable("INVALID_V3_SNAPSHOT") }
}
