import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { AdjustmentReceipt, ConfigurationReference } from "@impl/prescription/prescription-adjustment"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"

export type ResolvedAdjustedExplanation = {
  readonly configuration: ConfigurationReference
  readonly resolutionContextKey: string
  readonly version: string
  readonly reviewRef: string
  readonly purpose: string
  readonly energySupply: string
  readonly workRationale: string
  readonly recoveryRationale: string
  readonly cycleRole: string
  readonly expectedAdaptation: string
  readonly limitations: string
  readonly observation: string
  readonly evidenceRefs: readonly string[]
}
type Projection = Extract<ReturnType<typeof resolveAdjustedMethodPrescription>, { kind: "resolved" }> extends { projection: infer P } ? P : never
type SourceContext = Omit<SourceAdjustmentOfferInput, "authority" | "nowMs">
type SnapshotContent = {
  readonly kind: "ADJUSTED_METHOD_SNAPSHOT"
  readonly schemaVersion: 1
  readonly capturedAtMs: number
  readonly scope: { readonly candidateLineageId: string; readonly mainSlotId: string }
  readonly original: unknown
  readonly sourceContext: SourceContext
  readonly receipt: AdjustmentReceipt
  readonly projection: Omit<Projection, "explanation">
  readonly explanation: {
    readonly kind: "EXACT_CONFIGURATION_EXPLANATION_BOUND"
    readonly configuration: ConfigurationReference
    readonly resolutionContextKey: string
    readonly version: string
    readonly reviewRef: string
    readonly contentFingerprint: string
    readonly evidenceRefs: readonly string[]
  }
}
export type AdjustedMethodSnapshot = SnapshotContent & { readonly contentFingerprint: string }
type SnapshotInput = {
  readonly original: unknown
  readonly source: SourceAdjustmentOfferInput
  readonly receipt: AdjustmentReceipt
  readonly scope: SnapshotContent["scope"]
  /** Independently trusted explanation provider, not text recovered from saved JSON. */
  readonly explanation: ResolvedAdjustedExplanation
}
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-method-snapshot.v1", value)
const same = (a: unknown, b: unknown) => hasCanonicalJsonTree(a) && hasCanonicalJsonTree(b) && fingerprint(a) === fingerprint(b)
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
const keys = (value: object, expected: readonly string[]) => Reflect.ownKeys(value).length === expected.length
  && Reflect.ownKeys(value).every(key => typeof key === "string" && expected.includes(key))
const EXPLANATION_KEYS = ["configuration", "resolutionContextKey", "version", "reviewRef", "purpose", "energySupply", "workRationale",
  "recoveryRationale", "cycleRole", "expectedAdaptation", "limitations", "observation", "evidenceRefs"] as const

function explanationBinding(explanation: ResolvedAdjustedExplanation, projection: Projection) {
  if (!keys(explanation, EXPLANATION_KEYS)
      || !same(explanation.configuration, projection.source.to)
      || explanation.resolutionContextKey !== projection.resolutionContextKey
      || !EXPLANATION_KEYS.filter(key => key !== "configuration" && key !== "evidenceRefs").every(key => text(explanation[key]))
      || !Array.isArray(explanation.evidenceRefs) || explanation.evidenceRefs.length === 0
      || !explanation.evidenceRefs.every(ref => text(ref) && !/\s/u.test(ref))
      || new Set(explanation.evidenceRefs).size !== explanation.evidenceRefs.length) return null
  return { kind: "EXACT_CONFIGURATION_EXPLANATION_BOUND" as const,
    configuration: explanation.configuration, resolutionContextKey: explanation.resolutionContextKey,
    version: explanation.version, reviewRef: explanation.reviewRef,
    contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-method-explanation.v1", explanation),
    evidenceRefs: [...explanation.evidenceRefs] }
}

/** Private per-session DTO only; adding this to an accepted plan requires the
 * owning plan schema, full-plan safety/authority validation and explicit selection.
 */
export function createAdjustedMethodSnapshot(input: SnapshotInput) {
  try {
    if (!hasCanonicalJsonTree(input) || !keys(input, ["original", "source", "receipt", "scope", "explanation"])
        || !keys(input.scope, ["candidateLineageId", "mainSlotId"])
        || !text(input.scope.candidateLineageId) || !text(input.scope.mainSlotId)) return unavailable("INVALID_SNAPSHOT_INPUT")
    const resolved = resolveAdjustedMethodPrescription({ original: input.original, source: input.source, receipt: input.receipt })
    if (resolved.kind !== "resolved") return resolved
    const explanation = explanationBinding(input.explanation, resolved.projection)
    if (explanation === null) return unavailable("ADJUSTED_EXPLANATION_UNAVAILABLE")
    const { authority: _authority, nowMs, ...sourceContext } = input.source
    const { explanation: _pendingExplanation, ...projection } = resolved.projection
    const content: SnapshotContent = { kind: "ADJUSTED_METHOD_SNAPSHOT", schemaVersion: 1,
      capturedAtMs: nowMs, scope: input.scope, original: input.original,
      sourceContext, receipt: input.receipt, projection, explanation }
    return { kind: "prepared" as const, snapshot: structuredClone({ ...content, contentFingerprint: fingerprint(content) }) }
  } catch { return unavailable("INVALID_SNAPSHOT_INPUT") }
}

/** A historical read still requires trusted retained source and explanation versions.
 * Saved policy/ref strings are not an authority registry or an activation receipt.
 */
export function readAdjustedMethodSnapshot(raw: string, input: {
  readonly source: SourceAdjustmentOfferInput
  readonly scope: SnapshotContent["scope"]
  readonly explanation: ResolvedAdjustedExplanation
}) {
  try {
    if (!hasCanonicalJsonTree(input) || !keys(input, ["source", "scope", "explanation"])) return unavailable("INVALID_SNAPSHOT_CONTEXT")
    const value: unknown = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value === null || typeof value !== "object" || Array.isArray(value)
        || !keys(value, ["kind", "schemaVersion", "capturedAtMs", "scope", "original", "sourceContext", "receipt", "projection", "explanation", "contentFingerprint"])) return unavailable("INVALID_SNAPSHOT")
    const snapshot = value as AdjustedMethodSnapshot
    const { authority: _authority, nowMs, ...sourceContext } = input.source
    if (snapshot.kind !== "ADJUSTED_METHOD_SNAPSHOT" || snapshot.schemaVersion !== 1
        || !Number.isFinite(snapshot.capturedAtMs) || !Number.isFinite(nowMs) || snapshot.capturedAtMs > nowMs
        || !same(snapshot.scope, input.scope) || !same(snapshot.sourceContext, sourceContext)) return unavailable("SNAPSHOT_CONTEXT_MISMATCH")
    const prepared = createAdjustedMethodSnapshot({ original: snapshot.original,
      source: { ...input.source, nowMs: snapshot.capturedAtMs }, receipt: snapshot.receipt,
      scope: input.scope, explanation: input.explanation })
    if (prepared.kind !== "prepared" || !same(prepared.snapshot, snapshot)) return unavailable("SNAPSHOT_CONTENT_MISMATCH")
    return { kind: "read_only" as const, executionAuthority: "NONE" as const, snapshot: prepared.snapshot }
  } catch { return unavailable("INVALID_SNAPSHOT") }
}

/** Current candidate use is a separate check; historical readability cannot bypass expiry. */
export function revalidateAdjustedMethodSnapshot(raw: string, input: Parameters<typeof readAdjustedMethodSnapshot>[1]) {
  const read = readAdjustedMethodSnapshot(raw, input)
  if (read.kind !== "read_only") return read
  const fresh = createAdjustedMethodSnapshot({ original: read.snapshot.original, source: input.source,
    receipt: read.snapshot.receipt, scope: input.scope, explanation: input.explanation })
  return fresh.kind === "prepared" ? { kind: "candidate_ready" as const, snapshot: read.snapshot }
    : unavailable("CURRENT_ADJUSTMENT_AUTHORITY_UNAVAILABLE")
}
