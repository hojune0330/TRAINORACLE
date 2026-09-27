import { compareMainMethods } from "@impl/prescription/sequence"
import type { PrescriptionSequence, PrescriptionSequenceNode } from "@impl/prescription/sequence"

export function activeWorkoutRepeatLevels(nodes: readonly PrescriptionSequenceNode[]): number {
  return nodes.reduce((sum, node) => sum + Number(node.repeatCount > 1)
    + (node.kind === "group" ? activeWorkoutRepeatLevels(node.children) : 0), 0)
}

// Only comparison copies are normalized. Stored prescriptions and recovery are never edited.
export function sameWorkoutMethod(a: PrescriptionSequence, b: PrescriptionSequence): boolean {
  if (compareMainMethods(a, b).kind === "same") return true
  function align(nodes: readonly PrescriptionSequenceNode[], other: readonly PrescriptionSequenceNode[]): readonly PrescriptionSequenceNode[] {
    return nodes.map((node, i) => {
      const next = other[i]
      if (!next || node.kind !== next.kind) return node
      const recoveryBetweenRepeats = node.repeatCount === 1 && next.repeatCount > 1
        && node.recoveryBetweenRepeats.mode === "NOT_APPLICABLE" ? next.recoveryBetweenRepeats : node.recoveryBetweenRepeats
      return node.kind === "group" && next.kind === "group"
        ? { ...node, recoveryBetweenRepeats, children: align(node.children, next.children) }
        : { ...node, recoveryBetweenRepeats }
    })
  }
  return compareMainMethods({ ...a, main: align(a.main, b.main) }, { ...b, main: align(b.main, a.main) }).kind === "same"
}
