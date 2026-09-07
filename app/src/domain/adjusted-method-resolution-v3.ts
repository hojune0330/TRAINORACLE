import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { configurationReferenceV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequence, PrescriptionSequenceNode } from "@impl/prescription/sequence"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import { paceTargetPlanItemSchema } from "./plan-session-schema"
import { readPlanMethodDefinition } from "./plan-method-definition"
import { resolvePlanMethodPrescription } from "./plan-method-resolution"
import { revalidateSourceAdjustmentApplicationV3 } from "./source-adjustment-offer"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"
import type { AdjustedSegmentTarget } from "./adjusted-method-resolution"

const same = (a: unknown, b: unknown) => canonicalJsonFingerprint("v3-projection-equality", a)
  === canonicalJsonFingerprint("v3-projection-equality", b)
const unavailable = (code: string) => ({ kind: "unavailable" as const, code })

/** Restricted representation bridge for a schema-validated, independently mapped
 * legacy PACE_TARGET. Never reinterpret legacy conditional recoveryAfter as V3's
 * unconditional recovery. No arbitrary catalog migration or new dose authority.
 */
function liftKnownPaceSequence(sequence: PrescriptionSequence): PrescriptionSequenceV3 | null {
  if (sequence.terminalRecovery !== undefined && sequence.terminalRecovery.mode !== "NOT_APPLICABLE") return null
  const visit = (node: PrescriptionSequenceNode, phase: "warmup" | "main" | "cooldown"): SequenceNodeV3 => {
    if (node.recoveryAfter.mode !== "NOT_APPLICABLE") throw Error("LEGACY_RECOVERY_SEMANTICS_UNSUPPORTED")
    const base = { id: node.id, label: node.label, repeatCount: node.repeatCount,
      recoveryBetweenRepeats: node.recoveryBetweenRepeats.mode === "NOT_APPLICABLE" ? [] : [node.recoveryBetweenRepeats],
      recoveryAfter: [] }
    return node.kind === "group"
      ? { ...base, kind: "group", repeatUnit: phase === "main" ? "SET" : "SEQUENCE", children: node.children.map(n => visit(n, phase)) }
      : { ...base, kind: "segment", role: phase === "main" ? "WORK" : "PREPARATION", work: node.work, target: node.target }
  }
  const result = parsePrescriptionSequenceV3({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
    id: sequence.id, label: sequence.label, warmup: sequence.warmup.map(n => visit(n, "warmup")),
    main: sequence.main.map(n => visit(n, "main")), cooldown: sequence.cooldown.map(n => visit(n, "cooldown")) })
  return result.kind === "parsed" ? result.sequence : null
}

export function projectLegacyPaceSourceV3(input: unknown) {
  try {
    if (!hasCanonicalJsonTree(input)) return unavailable("INVALID_ORIGINAL_PRESCRIPTION")
    const parsed = paceTargetPlanItemSchema.safeParse(input)
    if (!parsed.success) return unavailable("INVALID_ORIGINAL_PRESCRIPTION")
    const original = parsed.data, binding = resolvePlanMethodPrescription(original)
    if (binding === null) return unavailable("ORIGINAL_SOURCE_UNAVAILABLE")
    const definition = readPlanMethodDefinition(binding.source.template)
    if (definition === null || !same(definition.reference, binding.source.configuration)) return unavailable("ORIGINAL_SOURCE_UNAVAILABLE")
    const sourceSequence = liftKnownPaceSequence(definition.configuration.sequence)
    const resolvedSequence = liftKnownPaceSequence(binding.resolved.sequence)
    if (sourceSequence === null || resolvedSequence === null) return unavailable("LEGACY_REPRESENTATION_UNSUPPORTED")
    return { kind: "projected" as const, executionAuthority: "NONE" as const,
      bridgeVersion: "LEGACY_PACE_TARGET_TO_V3@1" as const, original, binding,
      source: { configuration: configurationReferenceV3(definition.reference, sourceSequence), sequence: sourceSequence },
      support: { warmup: resolvedSequence.warmup, cooldown: resolvedSequence.cooldown } }
  } catch { return unavailable("LEGACY_REPRESENTATION_UNSUPPORTED") }
}

export function resolveAdjustedMethodPrescriptionV3(input: {
  readonly original: unknown
  readonly source: SourceAdjustmentOfferInput<PrescriptionSequenceV3>
  readonly receipt: AdjustmentReceiptV3
}) {
  try {
    if (!hasCanonicalJsonTree(input) || Reflect.ownKeys(input).length !== 3
      || !Reflect.ownKeys(input).every(k => typeof k === "string" && ["original", "source", "receipt"].includes(k))) {
      return unavailable("INVALID_ADJUSTED_INPUT")
    }
    const bridge = projectLegacyPaceSourceV3(input.original)
    if (bridge.kind !== "projected") return bridge
    if (!same(bridge.source.configuration, input.source.current)) return unavailable("SOURCE_ORIGINAL_MISMATCH")
    const anchor = bridge.original.selectedAnchor
    if (input.source.anchor.eventDistanceM !== anchor.eventDistanceM || input.source.anchor.sourceRef !== anchor.sourceRef
      || input.source.anchor.contentFingerprint !== bridge.binding.resolved.anchorContentFingerprint) return unavailable("ANCHOR_MISMATCH")
    const applied = revalidateSourceAdjustmentApplicationV3(input.source, input.receipt)
    if (applied.kind !== "applied") return applied
    const adjusted = applied.prescription.sequence
    if (adjusted.warmup.length || adjusted.cooldown.length) return unavailable("COMPONENT_CHANGE_UNSUPPORTED")
    const parsed = parsePrescriptionSequenceV3({ ...adjusted, ...bridge.support })
    if (parsed.kind !== "parsed") return unavailable("COMBINED_SEQUENCE_INVALID")
    const secondsPerKm = anchor.performanceSeconds * 1000 / anchor.eventDistanceM
    if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return unavailable("INVALID_NUMERIC_TARGET")
    const targets: (AdjustedSegmentTarget & { readonly role: "WORK" | "BUILDUP" | "PREPARATION" })[] = []
    const visit = (node: SequenceNodeV3) => {
      if (node.kind === "group") { node.children.forEach(visit); return }
      if (node.target.kind !== "RACE_PACE") return
      if (node.target.anchorRef !== anchor.sourceRef || node.target.eventDistanceM !== anchor.eventDistanceM) throw Error("ANCHOR_MISMATCH")
      const distanceM = node.work.kind === "distance" ? node.work.distanceM : null
      const targetRepSeconds = distanceM === null ? null : anchor.performanceSeconds * distanceM / anchor.eventDistanceM
      if (targetRepSeconds !== null && (!Number.isFinite(targetRepSeconds) || targetRepSeconds <= 0)) throw Error("INVALID_NUMERIC_TARGET")
      targets.push({ segmentId: node.id, role: node.role, kind: "CURRENT_SAME_EVENT_RACE_PACE", secondsPerKm,
        targetRepSeconds, fixedWorkSeconds: node.work.kind === "duration" ? node.work.durationSeconds : null, distanceM,
        missing: node.work.kind === "distance" ? distanceM === null ? "DISTANCE_NOT_SPECIFIED" : null
          : node.work.durationSeconds === null ? "DURATION_NOT_SPECIFIED" : null })
    }
    parsed.sequence.main.forEach(visit)
    const projection = { kind: "RESOLVED_METHOD_ADJUSTMENT" as const, schemaVersion: 3 as const,
      stage: "CANDIDATE_PROJECTION_ONLY" as const, bridgeVersion: bridge.bridgeVersion,
      originalBindingFingerprint: bridge.binding.bindingFingerprint,
      anchorContentFingerprint: bridge.binding.resolved.anchorContentFingerprint,
      source: applied.source, resolutionContextKey: applied.resolutionContextKey,
      sequence: parsed.sequence, segmentTargets: targets, structuralTotals: deriveSequenceV3Totals(parsed.sequence),
      explanation: { kind: "ADJUSTED_CONFIGURATION_EXPLANATION_REQUIRED" as const, sourceConfiguration: applied.source.to },
      targetModel: "CURRENT_SAME_EVENT_DISTANCE_RATIO_V1" as const }
    return { kind: "resolved" as const, executionAuthority: "NONE" as const, projection,
      contentFingerprint: canonicalJsonFingerprint("trainoracle.adjusted-method-projection.v3", projection) }
  } catch { return unavailable("INVALID_ADJUSTED_RESOLUTION") }
}
