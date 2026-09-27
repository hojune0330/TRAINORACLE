import { describe, expect, it } from "vitest"
import { configurationReferenceV3, type PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { buildWorkoutTuningStepsV3, distinctWorkoutMethodsV3, nextWorkoutMethodV3, workoutTuningValuesV3, workoutTuningChangesV3 } from "./workout-tuning-v3"

// Synthetic configurations test representation and direction, not operating approval.
function snapshot(id: string, repetitions: number, duration: number, recovery: number | null = 60): PrescriptionSnapshotV3 {
  const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id, label: id, warmup: [], cooldown: [],
    main: [{ id: `${id}-main`, label: id, kind: "segment", role: "WORK", repeatCount: repetitions,
      work: { kind: "duration", durationSeconds: duration, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: "TEST ONLY" },
      recoveryBetweenRepeats: repetitions > 1 ? [{ mode: "WALK", seconds: recovery }] : [], recoveryAfter: [] }] }
  return { sequence, configuration: configurationReferenceV3({ familyId: "TEST", configurationId: id, version: "1" }, sequence) }
}
describe("workout tuning over complete reviewed choices", () => {
  it("uses numeric direction even when the catalog order is reversed", () => {
    const start = snapshot("A", 6, 20), lower = snapshot("B", 4, 20), upper = snapshot("C", 8, 20)
    const steps = buildWorkoutTuningStepsV3(start, [upper, lower])
    expect(steps[0]!.decrease).toMatchObject({ label: "반복 줄이기", target: lower, value: 4 })
    expect(steps[0]!.increase).toMatchObject({ label: "반복 늘리기", target: upper, value: 8 })
    expect(steps).toHaveLength(1)
  })
  it("does not turn unknown recovery or absent speed targets into numeric controls", () => {
    const start = snapshot("A", 6, 20, null)
    expect(workoutTuningValuesV3(start).repeatRecovery).toBeNull()
    const steps = buildWorkoutTuningStepsV3(start, [snapshot("B", 6, 20, 120)])
    expect(steps).toEqual([])
  })
  it("does not count renamed or rep-only changes as a different method", () => {
    const a = snapshot("A", 6, 20), countOnly = snapshot("B", 4, 20), different = snapshot("C", 5, 40)
    expect(distinctWorkoutMethodsV3([a, countOnly, different])).toEqual([a, different])
    expect(nextWorkoutMethodV3(a, [a, countOnly])).toBeNull()
    expect(nextWorkoutMethodV3(a, [a, countOnly, different])).toBe(different)
    expect(nextWorkoutMethodV3(different, [a, countOnly, different])).toBe(a)
  })
  it("exposes coupled changes without inventing intermediate numbers", () => {
    const start = snapshot("A", 6, 20, 60), coupled = snapshot("B", 4, 40, 120)
    const steps = buildWorkoutTuningStepsV3(start, [coupled])
    expect(steps.map(s => s.dimension)).toEqual(["repetitions", "repeatRecovery", "workTime"])
    expect(steps.every(s => (s.increase ?? s.decrease)!.target === coupled)).toBe(true)
    expect(start.sequence.main[0]!.repeatCount).toBe(6)
    expect(workoutTuningChangesV3(start, coupled)).toEqual([
      "반복 횟수 6회 → 4회", "1회 운동 시간 20초 → 40초", "반복 사이 회복 60초 → 120초",
    ])
  })
  it("keeps method traversal stable when recommendation order changes", () => {
    const a = snapshot("A", 6, 20), b = snapshot("B", 4, 40), c = snapshot("C", 3, 90)
    expect(nextWorkoutMethodV3(a, [c, a, b])).toBe(b)
    expect(nextWorkoutMethodV3(a, [b, c, a])).toBe(b)
    expect(nextWorkoutMethodV3(b, [c, b, a])).toBe(c)
    expect(nextWorkoutMethodV3(c, [c, b, a], [a, b, c])).toBeNull()
  })
  it("measures the entire compound repetition, not its first child", () => {
    const start = snapshot("A", 4, 20), leaf = start.sequence.main[0]!
    const compound = { ...start, sequence: { ...start.sequence, main: [{
      kind: "group" as const, repeatUnit: "REPETITION" as const, id: "compound", label: null,
      repeatCount: 4, recoveryBetweenRepeats: [{ mode: "WALK" as const, seconds: 60 }], recoveryAfter: [],
      children: [{ ...leaf, repeatCount: 1, recoveryBetweenRepeats: [], recoveryAfter: [] },
        { ...leaf, id: "second", repeatCount: 1, recoveryBetweenRepeats: [], recoveryAfter: [] }],
    }] } }
    expect(workoutTuningValuesV3(compound).workTime).toBe(40)
    const steps = buildWorkoutTuningStepsV3(compound, [snapshot("B", 4, 30)])
    expect(steps.find(s => s.dimension === "workTime")).toMatchObject({ value: 40, decrease: { value: 30 } })
    expect(steps.find(s => s.dimension === "workTime")?.increase).toBeUndefined()
    const distanceCompound: PrescriptionSnapshotV3 = { ...compound, sequence: { ...compound.sequence,
      main: compound.sequence.main.map(group => ({ ...group, children: group.children.map(child => ({
        ...child, work: { kind: "distance" as const, distanceM: 200, durationSeconds: null },
      })) })),
    } }
    const targetBase = snapshot("D", 4, 30)
    const distanceTarget: PrescriptionSnapshotV3 = { ...targetBase, sequence: { ...targetBase.sequence,
      main: targetBase.sequence.main.map(node => node.kind === "segment"
        ? { ...node, work: { kind: "distance", distanceM: 300, durationSeconds: null } } : node),
    } }
    expect(workoutTuningValuesV3(distanceCompound).repDistance).toBe(400)
    const distanceStep = buildWorkoutTuningStepsV3(distanceCompound, [distanceTarget]).find(s => s.dimension === "repDistance")
    expect(distanceStep).toMatchObject({ value: 400, decrease: { value: 300 } })
    expect(distanceStep?.increase).toBeUndefined()
  })
  it("does not call one repetition with no between-rest a new method, or merge two real recovery methods through it", () => {
    const repeated = snapshot("A", 6, 20, 60), single = snapshot("0", 1, 20), otherRest = snapshot("B", 6, 20, 120)
    expect(distinctWorkoutMethodsV3([single, repeated])).toHaveLength(1)
    expect(nextWorkoutMethodV3(repeated, [single, repeated])).toBeNull()
    expect(distinctWorkoutMethodsV3([single, repeated, otherRest])).toHaveLength(2)
  })
  it("distinguishes per-rep distance from total distance", () => {
    const a = snapshot("A", 6, 20), b = snapshot("B", 4, 40)
    const distance = (s: PrescriptionSnapshotV3, meters: number): PrescriptionSnapshotV3 => ({ ...s,
      sequence: { ...s.sequence, main: s.sequence.main.map(n => n.kind === "segment" ? { ...n, work: { kind: "distance", distanceM: meters, durationSeconds: null } } : n) } })
    const steps = buildWorkoutTuningStepsV3(distance(a, 200), [distance(b, 400)])
    expect(steps.find(s => s.dimension === "repDistance")).toMatchObject({ label: "1회 거리", value: 200,
      increase: { label: "1회 거리 늘리기", value: 400 } })
  })
  it("does not merge different set recoveries through a single-set reduction", () => {
    const set = (id: string, count: number, rest: number): PrescriptionSnapshotV3 => {
      const base = snapshot(id, 6, 20)
      return { ...base, sequence: { ...base.sequence, main: [{
        kind: "group", repeatUnit: "SET", id: `${id}-set`, label: null, repeatCount: count,
        recoveryBetweenRepeats: count > 1 ? [{ mode: "WALK", seconds: rest }] : [],
        recoveryAfter: [], children: base.sequence.main,
      }] } }
    }
    const single = set("0", 1, 0), a = set("A", 2, 60), b = set("B", 2, 120)
    expect(distinctWorkoutMethodsV3([single, a, b])).toEqual([a, b])
    expect(nextWorkoutMethodV3(a, [single, a, b])).toBe(b)
  })
})
