import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceTarget } from "@impl/prescription/sequence"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import type { AdjustedSegmentTarget } from "../../domain/adjusted-method-resolution"
import { calculatedWorkoutSequence, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import { notationEffort, sequenceNotation, sessionWorkoutNotation, type WorkoutDisplaySession } from "../../domain/workout-notation"

// Match only reviewed whole cues, never just an RPE number. Unknown instructions
// and stop conditions must stay in sight; their intensity is not inferred here.
const reviewedEffortCues = new Map([
  ["힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 RPE 6~7", "RPE 6~7 (제안)"],
  ["힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 RPE 6~7", "RPE 6~7 (제안)"],
  ["문장으로 대화할 수 있는 노력 본운동 체감 노력 제안 RPE 3~4", "RPE 3~4 (제안)"],
])

export function conciseReviewedEffortCue(cue: string | null): string | null {
  return cue === null ? null : reviewedEffortCues.get(cue) ?? null
}

/** Read-only UI projection. Never pass this shortened sequence to saving or calculation. */
export function presentWorkoutNotation(
  sequence: PrescriptionSequence | PrescriptionSequenceV3,
  targets: readonly AdjustedSegmentTarget[] = [],
) {
  const explanations = new Set<string>()
  const compactTarget = (target: SequenceTarget): SequenceTarget => {
    if (target.kind !== "EFFORT_GUIDANCE" || target.cue === null) return target
    const conciseCue = conciseReviewedEffortCue(target.cue)
    if (!conciseCue) return target
    explanations.add(notationEffort(target.cue, "PLAIN"))
    return { ...target, cue: conciseCue }
  }
  const legacyNodes = (nodes: readonly PrescriptionSequenceNode[]): readonly PrescriptionSequenceNode[] => nodes.map(node =>
    node.kind === "group" ? { ...node, children: legacyNodes(node.children) } : { ...node, target: compactTarget(node.target) })
  const v3Nodes = (nodes: readonly SequenceNodeV3[]): readonly SequenceNodeV3[] => nodes.map(node =>
    node.kind === "group" ? { ...node, children: v3Nodes(node.children) } : { ...node, target: compactTarget(node.target) })
  const displaySequence = sequence.version === 3
    ? { ...sequence, main: v3Nodes(sequence.main) }
    : { ...sequence, main: legacyNodes(sequence.main) }
  return {
    notation: sequenceNotation(displaySequence, targets, "PLAIN"),
    explanations: [...explanations],
  }
}

/** Same verified calculation boundary as sessionWorkoutNotation, with optional UI-only detail. */
export function presentSessionWorkoutNotation(session: WorkoutDisplaySession) {
  const prescription = session.prescription
  if (prescription?.kind === "ADJUSTED_METHOD_V3") {
    return presentWorkoutNotation(prescription.projection.sequence, prescription.projection.segmentTargets)
  }
  if (prescription?.kind === "ADJUSTED_METHOD") {
    return presentWorkoutNotation(prescription.snapshot.projection.sequence, prescription.snapshot.projection.segmentTargets)
  }
  if (prescription?.kind === "RPE_TIME_RANGE" && prescription.catalogWorkout) {
    const binding = prescription.catalogWorkout
    const calculated = calculateCatalogWorkout(binding.catalogId, binding.inputs)
    const sequence = calculated && calculated.fingerprint === binding.calculationFingerprint
      ? calculatedWorkoutSequence(calculated) : null
    if (sequence) return presentWorkoutNotation(sequence)
  }
  return { notation: sessionWorkoutNotation(session, "PLAIN"), explanations: [] as string[] }
}
