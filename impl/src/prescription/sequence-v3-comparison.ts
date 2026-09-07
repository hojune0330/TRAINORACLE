import { canonicalJsonFingerprint } from "../plan-generator/candidate-identity"
import { parsePrescriptionSequenceV3 } from "./sequence-v3"
import type { SequenceNodeV3, RecoveryStepV3, PrescriptionSequenceV3 } from "./sequence-v3"
import type { SequenceTarget, SequenceWork } from "./sequence"

type MethodTarget = { readonly kind: "RACE_PACE"; readonly eventDistanceM: number | null }
  | { readonly kind: "SPRINT_REFERENCE" }
  | Extract<SequenceTarget, { kind: "EFFORT_GUIDANCE" }>
type MethodNode = {
  readonly recoveryBetweenRepeats: readonly RecoveryStepV3[]
  readonly recoveryAfter: readonly RecoveryStepV3[]
} & ({ readonly kind: "segment"; readonly role: string; readonly work: SequenceWork; readonly target: MethodTarget }
  | { readonly kind: "group"; readonly repeatUnit: string; readonly children: readonly MethodNode[] })

function validated(input: unknown): PrescriptionSequenceV3 {
  const result = parsePrescriptionSequenceV3(input)
  if (result.kind !== "parsed") throw new TypeError("INVALID_SEQUENCE_V3")
  return result.sequence
}
function project(node: SequenceNodeV3): MethodNode {
  const recovery = { recoveryBetweenRepeats: node.recoveryBetweenRepeats, recoveryAfter: node.recoveryAfter }
  if (node.kind === "segment") {
    const target = node.target.kind === "RACE_PACE"
      ? { kind: node.target.kind, eventDistanceM: node.target.eventDistanceM }
      : node.target.kind === "SPRINT_REFERENCE" ? { kind: node.target.kind } : node.target
    return { kind: "segment", ...recovery, role: node.role, work: node.work, target }
  }
  const children = node.children.map(project)
  // A unary wrapper without any recovery adds no method. Counts are intentionally absent.
  if (children.length === 1 && !node.recoveryBetweenRepeats.length && !node.recoveryAfter.length) return children[0]!
  return { kind: "group", ...recovery, repeatUnit: node.repeatUnit, children }
}

export type SequenceV3Difference = "STRUCTURE" | "SEGMENT_ROLE" | "WORK" | "TARGET" | "RECOVERY_ORDER_OR_VALUE"
export function compareMainMethodsV3(left: unknown, right: unknown) {
  const a = validated(left).main.map(project), b = validated(right).main.map(project)
  const differences = new Set<SequenceV3Difference>()
  const equal = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  function inspect(xs: readonly MethodNode[], ys: readonly MethodNode[]) {
    if (xs.length !== ys.length) differences.add("STRUCTURE")
    xs.forEach((x, i) => {
      const y = ys[i]
      if (!y) return
      if (!equal(x.recoveryBetweenRepeats, y.recoveryBetweenRepeats) || !equal(x.recoveryAfter, y.recoveryAfter)) differences.add("RECOVERY_ORDER_OR_VALUE")
      if (x.kind === "segment" && y.kind === "segment") {
        if (x.role !== y.role) differences.add("SEGMENT_ROLE")
        if (!equal(x.work, y.work)) differences.add("WORK")
        if (!equal(x.target, y.target)) differences.add("TARGET")
      } else if (x.kind === "group" && y.kind === "group") {
        if (x.repeatUnit !== y.repeatUnit) differences.add("STRUCTURE")
        inspect(x.children, y.children)
      } else differences.add("STRUCTURE")
    })
  }
  inspect(a, b)
  return Object.freeze({ kind: differences.size ? "different" as const : "same" as const,
    requiresReview: differences.size > 0, differences: Object.freeze([...differences]),
    executionAuthority: "NONE" as const })
}

/** Full content identity is deliberately stricter than count-insensitive method comparison. */
export function sequenceV3ContentIdentity(input: unknown): string {
  return canonicalJsonFingerprint("trainoracle.prescription-sequence.v3", validated(input))
}
