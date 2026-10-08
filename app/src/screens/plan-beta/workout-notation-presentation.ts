import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceTarget } from "@impl/prescription/sequence"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import type { AdjustedSegmentTarget } from "../../domain/adjusted-method-resolution"
import { notationEffort, sequenceNotation } from "../../domain/workout-notation"

// These two reviewed LT cues say the same thing. Match the whole cue, not just
// an RPE number: unknown instructions and stop conditions must stay in sight.
const detailedLtCues = new Set([
  "힘들지만 정해진 구간 동안 고르게 유지하는 노력 · 본운동 체감 제안 RPE 6~7",
  "힘들지만 정해진 구간 동안 고르게 유지하는 노력 본운동 체감 노력 제안 RPE 6~7",
])

/** Read-only UI projection. Never pass this shortened sequence to saving or calculation. */
export function presentWorkoutNotation(
  sequence: PrescriptionSequence | PrescriptionSequenceV3,
  targets: readonly AdjustedSegmentTarget[] = [],
) {
  const explanations = new Set<string>()
  const compactTarget = (target: SequenceTarget): SequenceTarget => {
    if (target.kind !== "EFFORT_GUIDANCE" || target.cue === null || !detailedLtCues.has(target.cue)) return target
    explanations.add(notationEffort(target.cue, "PLAIN"))
    return { ...target, cue: "RPE 6~7 (제안)" }
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
