import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { parsePrescriptionSequence, deriveSequenceTotals, deriveSequenceRecoveryDistanceTotals } from "@impl/prescription/sequence"
import type { PrescriptionSequenceNode } from "@impl/prescription/sequence"
import type { AdjustmentReceipt } from "@impl/prescription/prescription-adjustment"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { paceTargetPlanItemSchema } from "./plan-session-schema"
import { resolvePlanMethodPrescription } from "./plan-method-resolution"
import { revalidateSourceAdjustmentApplication } from "./source-adjustment-offer"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"

const unavailable = (code: string) => ({ kind: "unavailable" as const, code })
const same = (a: unknown, b: unknown) => canonicalJsonFingerprint("adjusted-method-equality-v1", a)
  === canonicalJsonFingerprint("adjusted-method-equality-v1", b)

export type AdjustedSegmentTarget = {
  readonly segmentId: string
  readonly kind: "CURRENT_SAME_EVENT_RACE_PACE"
  readonly secondsPerKm: number
  readonly targetRepSeconds: number | null
  readonly fixedWorkSeconds: number | null
  readonly distanceM: number | null
  readonly missing: "DISTANCE_NOT_SPECIFIED" | "DURATION_NOT_SPECIFIED" | null
}

/** Candidate-only projection, not a legacy PACE_TARGET rewrite. Source approval,
 * individual race-pace arithmetic and active-plan acceptance are separate gates.
 */
export function resolveAdjustedMethodPrescription(input: {
  readonly original: unknown
  readonly source: SourceAdjustmentOfferInput
  readonly receipt: AdjustmentReceipt
}) {
  try {
    if (!hasCanonicalJsonTree(input) || Reflect.ownKeys(input).length !== 3
        || !Reflect.ownKeys(input).every(key => ["original", "source", "receipt"].includes(String(key)))) return unavailable("INVALID_ADJUSTED_INPUT")
    const parsed = paceTargetPlanItemSchema.safeParse(input.original)
    if (!parsed.success) return unavailable("INVALID_ORIGINAL_PRESCRIPTION")
    const original = parsed.data
    const binding = resolvePlanMethodPrescription(original)
    if (binding === null || !same(binding.source.configuration, input.source.current)) return unavailable("SOURCE_ORIGINAL_MISMATCH")
    if (input.source.anchor.eventDistanceM !== original.selectedAnchor.eventDistanceM
        || input.source.anchor.sourceRef !== original.selectedAnchor.sourceRef
        || input.source.anchor.contentFingerprint !== binding.resolved.anchorContentFingerprint) return unavailable("ANCHOR_MISMATCH")
    const applied = revalidateSourceAdjustmentApplication(input.source, input.receipt)
    if (applied.kind !== "applied") return applied
    const adjusted = applied.prescription.sequence
    // These registries describe MAIN only. Replacing surrounding components needs
    // their separate component authority, not this source transition alone.
    if (adjusted.warmup.length !== 0 || adjusted.cooldown.length !== 0) return unavailable("COMPONENT_CHANGE_UNSUPPORTED")
    const sequenceResult = parsePrescriptionSequence({
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: adjusted.id, label: adjusted.label,
      warmup: binding.resolved.sequence.warmup, main: adjusted.main,
      cooldown: binding.resolved.sequence.cooldown,
      terminalRecovery: adjusted.terminalRecovery ?? { mode: "NOT_APPLICABLE", seconds: null },
    })
    if (sequenceResult.kind !== "parsed") return unavailable("COMBINED_SEQUENCE_INVALID")
    const targets: AdjustedSegmentTarget[] = []
    const anchor = original.selectedAnchor
    const secondsPerKm = anchor.performanceSeconds * 1000 / anchor.eventDistanceM
    if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return unavailable("INVALID_NUMERIC_TARGET")
    const visit = (node: PrescriptionSequenceNode) => {
      if (node.kind === "group") { node.children.forEach(visit); return }
      if (node.target.kind !== "RACE_PACE") return
      if (node.target.anchorRef !== anchor.sourceRef || node.target.eventDistanceM !== anchor.eventDistanceM) throw Error("ANCHOR_MISMATCH")
      const distanceM = node.work.kind === "distance" ? node.work.distanceM : null
      const targetRepSeconds = distanceM === null ? null : anchor.performanceSeconds * distanceM / anchor.eventDistanceM
      if (targetRepSeconds !== null && (!Number.isFinite(targetRepSeconds) || targetRepSeconds <= 0)) throw Error("INVALID_NUMERIC_TARGET")
      targets.push({ segmentId: node.id, kind: "CURRENT_SAME_EVENT_RACE_PACE", secondsPerKm,
        targetRepSeconds, fixedWorkSeconds: node.work.kind === "duration" ? node.work.durationSeconds : null, distanceM,
        missing: node.work.kind === "distance" ? (distanceM === null ? "DISTANCE_NOT_SPECIFIED" : null)
          : node.work.durationSeconds === null ? "DURATION_NOT_SPECIFIED" : null })
    }
    sequenceResult.sequence.main.forEach(visit)
    const content = {
      kind: "RESOLVED_METHOD_ADJUSTMENT" as const, schemaVersion: 1 as const,
      stage: "CANDIDATE_PROJECTION_ONLY" as const,
      originalBindingFingerprint: binding.bindingFingerprint,
      anchorContentFingerprint: binding.resolved.anchorContentFingerprint,
      source: applied.source, resolutionContextKey: applied.resolutionContextKey,
      sequence: sequenceResult.sequence, segmentTargets: targets,
      structuralTotals: { ...deriveSequenceTotals(sequenceResult.sequence), ...deriveSequenceRecoveryDistanceTotals(sequenceResult.sequence) },
      explanation: { kind: "ADJUSTED_CONFIGURATION_EXPLANATION_REQUIRED" as const, sourceConfiguration: applied.source.to },
      targetModel: "CURRENT_SAME_EVENT_DISTANCE_RATIO_V1" as const,
    }
    return { kind: "resolved" as const, projection: content,
      contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-method-projection.v1", content) }
  } catch { return unavailable("INVALID_ADJUSTED_RESOLUTION") }
}
