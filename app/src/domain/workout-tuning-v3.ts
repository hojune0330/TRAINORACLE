import type { PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import { compareMainMethodsV3 } from "@impl/prescription/sequence-v3-comparison"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import type { SequenceNodeV3, RecoveryStepV3, PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"

type Dimension = "repetitions" | "repDistance" | "workTime" | "repeatRecovery" | "setRecovery" | "sets"
export type WorkoutTuningStepV3 = {
  readonly dimension: Dimension
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly decrease?: { readonly label: string; readonly target: PrescriptionSnapshotV3; readonly value: number }
  readonly increase?: { readonly label: string; readonly target: PrescriptionSnapshotV3; readonly value: number }
}
const fields: Record<Dimension, { label: string; unit: string; decrease: string; increase: string }> = {
  repetitions: { label: "반복 횟수", unit: "회", decrease: "반복 줄이기", increase: "반복 늘리기" },
  repDistance: { label: "1회 거리", unit: "m", decrease: "1회 거리 줄이기", increase: "1회 거리 늘리기" },
  workTime: { label: "1회 운동 시간", unit: "초", decrease: "1회 운동 시간 줄이기", increase: "1회 운동 시간 늘리기" },
  repeatRecovery: { label: "반복 사이 회복", unit: "초", decrease: "반복 사이 덜 쉬기", increase: "반복 사이 더 쉬기" },
  setRecovery: { label: "세트 사이 회복", unit: "초", decrease: "세트 사이 덜 쉬기", increase: "세트 사이 더 쉬기" },
  sets: { label: "세트 수", unit: "세트", decrease: "세트 줄이기", increase: "세트 늘리기" },
}
function flatten(nodes: readonly SequenceNodeV3[]): readonly SequenceNodeV3[] {
  return nodes.flatMap(n => n.kind === "group" ? [n, ...flatten(n.children)] : [n])
}
function uniform(values: readonly (number | null)[]): number | null {
  return values.length && values[0] !== null && values.every(value => value === values[0]) ? values[0]! : null
}
function recoverySeconds(steps: readonly RecoveryStepV3[]): number | null {
  return steps.length && steps.every(s => !("distanceM" in s) && s.seconds !== null)
    ? steps.reduce((sum, s) => sum + (s.seconds ?? 0), 0) : null
}
function repetitionMeasures(nodes: readonly SequenceNodeV3[], unit: "distance" | "duration"): readonly (number | null)[] {
  const measure = (node: SequenceNodeV3): number | null => {
    if (node.kind === "segment") return node.work.kind === unit
      ? unit === "distance" ? node.work.distanceM : node.work.durationSeconds : null
    const parts = node.children.map(child => {
      const value = measure(child)
      return value === null ? null : value * child.repeatCount
    })
    return parts.every(value => value !== null) ? parts.reduce<number>((sum, value) => sum + value!, 0) : null
  }
  return nodes.flatMap(node => node.kind === "group"
    ? node.repeatUnit === "REPETITION" ? [measure(node)] : repetitionMeasures(node.children, unit)
    : node.role === "WORK" ? [measure(node)] : [])
}
export function workoutTuningValuesV3(snapshot: PrescriptionSnapshotV3): Record<Dimension, number | null> {
  const nodes = flatten(snapshot.sequence.main)
  const sets = nodes.filter(n => n.kind === "group" && n.repeatUnit === "SET")
  return {
    repetitions: deriveSequenceV3Totals(snapshot.sequence).main.repetitionBlocks,
    repDistance: uniform(repetitionMeasures(snapshot.sequence.main, "distance")),
    workTime: uniform(repetitionMeasures(snapshot.sequence.main, "duration")),
    repeatRecovery: uniform(nodes.filter(n => n.repeatCount > 1 && !(n.kind === "group" && n.repeatUnit === "SET"))
      .map(n => recoverySeconds(n.recoveryBetweenRepeats))),
    setRecovery: uniform(sets.filter(n => n.repeatCount > 1).map(n => recoverySeconds(n.recoveryBetweenRepeats))),
    sets: sets.length === 1 ? sets[0]!.repeatCount : null,
  }
}

function countReductionOnly(a: readonly SequenceNodeV3[], b: readonly SequenceNodeV3[]): boolean {
  if (a.length !== b.length) return false
  return a.every((left, i) => {
    const right = b[i]!
    const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
    const between = same(left.recoveryBetweenRepeats, right.recoveryBetweenRepeats)
      || (left.repeatCount === 1 && left.recoveryBetweenRepeats.length === 0 && right.repeatCount > 1)
      || (right.repeatCount === 1 && right.recoveryBetweenRepeats.length === 0 && left.repeatCount > 1)
    if (!between || !same(left.recoveryAfter, right.recoveryAfter)) return false
    if (left.kind === "group" && right.kind === "group") return left.repeatUnit === right.repeatUnit && countReductionOnly(left.children, right.children)
    if (left.kind !== "segment" || right.kind !== "segment") return false
    const target = (node: typeof left) => node.target.kind === "RACE_PACE"
      ? { kind: node.target.kind, eventDistanceM: node.target.eventDistanceM }
      : node.target.kind === "SPRINT_REFERENCE" ? { kind: node.target.kind } : node.target
    return left.role === right.role && same(left.work, right.work) && same(target(left), target(right))
  })
}
export function sameWorkoutMethodV3(a: PrescriptionSequenceV3, b: PrescriptionSequenceV3): boolean {
  return compareMainMethodsV3(a, b).kind === "same" || countReductionOnly(a.main, b.main)
}

/** These are labels over authorized whole snapshots, never a generator of new doses. */
export function buildWorkoutTuningStepsV3(current: PrescriptionSnapshotV3, authorized: readonly PrescriptionSnapshotV3[]): readonly WorkoutTuningStepV3[] {
  const values = workoutTuningValuesV3(current)
  const candidates = authorized.map(target => ({ target, values: workoutTuningValuesV3(target) }))
  const order: readonly Dimension[] = values.repetitions !== null && values.repetitions > 1
    ? ["repetitions", "repeatRecovery", "repDistance", "workTime", "sets", "setRecovery"]
    : ["workTime", "repDistance", "repetitions", "repeatRecovery", "sets", "setRecovery"]
  return order.flatMap(dimension => {
    const value = values[dimension]
    if (value === null || value <= 0) return []
    const lower = candidates.filter(c => c.values[dimension] !== null && c.values[dimension]! < value)
      .sort((a, b) => b.values[dimension]! - a.values[dimension]!)[0]
    const upper = candidates.filter(c => c.values[dimension] !== null && c.values[dimension]! > value)
      .sort((a, b) => a.values[dimension]! - b.values[dimension]!)[0]
    if (!lower && !upper) return []
    const f = fields[dimension]
    return [{ dimension, label: f.label, value, unit: f.unit,
      ...(lower ? { decrease: { label: f.decrease, target: lower.target, value: lower.values[dimension]! } } : {}),
      ...(upper ? { increase: { label: f.increase, target: upper.target, value: upper.values[dimension]! } } : {}),
    }]
  })
}

export function workoutTuningChangesV3(before: PrescriptionSnapshotV3, after: PrescriptionSnapshotV3): readonly string[] {
  const a = workoutTuningValuesV3(before), b = workoutTuningValuesV3(after)
  return (Object.keys(fields) as Dimension[]).flatMap(dimension => {
    if (a[dimension] === b[dimension]) return []
    const f = fields[dimension]
    const value = (n: number | null) => n === null ? "구간별 확인" : `${n}${f.unit}`
    return [`${f.label} ${value(a[dimension])} → ${value(b[dimension])}`]
  })
}

export function distinctWorkoutMethodsV3(snapshots: readonly PrescriptionSnapshotV3[]): readonly PrescriptionSnapshotV3[] {
  // A count-one node has no between-rest. Do not let it collapse two explicit recovery methods.
  const activeLevels = (snapshot: PrescriptionSnapshotV3) => flatten(snapshot.sequence.main).filter(node => node.repeatCount > 1).length
  return [...snapshots].sort((a, b) => activeLevels(b) - activeLevels(a)
    || JSON.stringify(a.configuration).localeCompare(JSON.stringify(b.configuration)))
    .reduce<PrescriptionSnapshotV3[]>((result, candidate) => {
    if (!result.some(existing => sameWorkoutMethodV3(existing.sequence, candidate.sequence))) result.push(candidate)
    return result
  }, [])
}
export function nextWorkoutMethodV3(current: PrescriptionSnapshotV3, snapshots: readonly PrescriptionSnapshotV3[], seen: readonly PrescriptionSnapshotV3[] = [current]): PrescriptionSnapshotV3 | null {
  const methods = distinctWorkoutMethodsV3(snapshots)
  const methodIndex = (snapshot: PrescriptionSnapshotV3) => {
    const exact = methods.findIndex(item => JSON.stringify(item.configuration) === JSON.stringify(snapshot.configuration))
    return exact >= 0 ? exact : methods.findIndex(item => sameWorkoutMethodV3(item.sequence, snapshot.sequence))
  }
  const index = methodIndex(current), seenIndices = new Set(seen.map(methodIndex))
  for (let step = 1; step <= methods.length; step++) {
    const next = methods[(index + step) % methods.length]
    const nextIndex = (index + step) % methods.length
    if (next && nextIndex !== index && !seenIndices.has(nextIndex)) return next
  }
  return null
}
