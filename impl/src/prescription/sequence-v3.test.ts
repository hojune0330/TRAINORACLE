import { describe, expect, it } from "vitest"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "./sequence-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "./sequence-v3"
import { parsePrescriptionSequence } from "./sequence"

const roll: RecoveryStepV3 = { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 }
const rest: RecoveryStepV3 = { mode: "WALK_OR_STAND", seconds: 120 }
const segment = (id: string, meters: number, role: "WORK" | "BUILDUP" = "WORK"): SequenceNodeV3 => ({
  kind: "segment", id, label: null, role, repeatCount: 1,
  work: { kind: "distance", distanceM: meters, durationSeconds: null },
  target: { kind: "EFFORT_GUIDANCE", cue: "TEST_NOT_ADOPTED" }, recoveryBetweenRepeats: [], recoveryAfter: [],
})
const group = (id: string, repeatCount: number, children: readonly SequenceNodeV3[],
  repeatUnit: "SET" | "REPETITION" = "REPETITION", between: readonly RecoveryStepV3[] = [], after: readonly RecoveryStepV3[] = []): SequenceNodeV3 => ({
  kind: "group", id, label: null, repeatUnit, repeatCount, children,
  recoveryBetweenRepeats: between, recoveryAfter: after,
})
const sequence = (main: readonly SequenceNodeV3[]): PrescriptionSequenceV3 => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "test-v3", label: null, warmup: [], main, cooldown: [],
})
describe("versioned ordered recovery and role-specific sequence", () => {
  it("retains 600m roll-on and 240s extra set recovery for 3x2x300", () => {
    const s = sequence([group("sets", 3,
      [group("reps", 2, [segment("work", 300)], "REPETITION", [roll], [roll])], "SET", [rest])])
    expect(deriveSequenceV3Totals(s).main).toMatchObject({ repetitionBlocks: 6, workSegments: 6,
      workDistanceM: 1800, knownRecoveryDistanceM: 600, knownRecoverySeconds: 240,
      recoverySeconds: null, recoveryDistanceM: null, recoverySteps: 8, totalSeconds: null })
    const parsed = parsePrescriptionSequenceV3(JSON.parse(JSON.stringify(s)))
    expect(parsed).toMatchObject({ kind: "parsed", sequence: s })
  })
  it("ordered compound steps stay ordered and are not merged into simultaneous targets", () => {
    const s = sequence([group("sets", 2, [segment("work", 400)], "SET", [roll, rest], [roll])])
    const p = parsePrescriptionSequenceV3(s)
    expect(p.kind).toBe("parsed")
    if (p.kind !== "parsed") return
    expect(p.sequence.main[0]?.recoveryBetweenRepeats).toEqual([roll, rest])
    expect(Object.isFrozen(p.sequence.main[0]?.recoveryBetweenRepeats)).toBe(true)
    expect(deriveSequenceV3Totals(s).main).toMatchObject({ knownRecoveryDistanceM: 200, knownRecoverySeconds: 120 })
  })
  it("four flying blocks retain 80m buildup and 40m target work", () => {
    const s = sequence([group("flying", 4, [segment("build", 20, "BUILDUP"), segment("fast", 10)],
      "REPETITION", [{ mode: "WALK_OR_STAND", seconds: 240 }])])
    expect(deriveSequenceV3Totals(s).main).toMatchObject({ repetitionBlocks: 4, workSegments: 4,
      workDistanceM: 40, buildupDistanceM: 80, recoverySeconds: 720, totalSeconds: null })
  })
  it("owner notation keeps twenty repeats, eighteen rep rests and one set rest", () => {
    const s = sequence([group("sets", 2,
      [group("reps", 10, [segment("work", 400)], "REPETITION", [{ mode: "WALK", seconds: 60 }])],
      "SET", [{ mode: "STAND", seconds: 180 }])])
    expect(deriveSequenceV3Totals(s).main).toMatchObject({ repetitionBlocks: 20, workDistanceM: 8000,
      recoverySteps: 19, recoverySeconds: 1260 })
  })
  it("phase-ending recovery is explicit and included only in its own phase", () => {
    const timed: SequenceNodeV3 = { ...segment("time", 1), kind: "segment", role: "WORK",
      work: { kind: "duration", durationSeconds: 120, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "test" }, recoveryAfter: [{ mode: "JOG", seconds: 60 }] }
    const s = { ...sequence([timed]), warmup: [{ ...timed, id: "prep", role: "PREPARATION" as const }] }
    const t = deriveSequenceV3Totals(s)
    expect(t.main.totalSeconds).toBe(180)
    expect(t.warmup.totalSeconds).toBe(180)
    expect(t.warmup.workSeconds).toBe(0)
    expect(t.warmup.preparationSeconds).toBe(120)
  })
  it("rejects mixed-unit recovery, invalid roles, duplicates and unknown keys", () => {
    const s = sequence([segment("work", 300)])
    for (const node of [
      { ...s.main[0], role: "RECOVERY" }, { ...s.main[0], extra: 1 },
      { ...s.main[0], recoveryAfter: [{ mode: "ACTIVE_ROLL_ON", seconds: 120, distanceM: 100 }] },
      { ...s.main[0], recoveryAfter: [{ mode: "NOT_APPLICABLE", seconds: null }] },
      { ...s.main[0], repeatCount: 0 },
    ]) expect(parsePrescriptionSequenceV3({ ...s, main: [node] }).kind).toBe("rejected")
    expect(parsePrescriptionSequenceV3({ ...s, main: [s.main[0], s.main[0]] }).kind).toBe("rejected")
  })
  it("never executes input accessors", () => {
    let calls = 0
    const s = sequence([segment("work", 300)])
    Object.defineProperty(s, "main", { enumerable: true, get() { calls++; throw Error("secret") } })
    expect(parsePrescriptionSequenceV3(s).kind).toBe("rejected")
    expect(calls).toBe(0)
  })
  it("unknown duration does not hide overflow in later known amounts", () => {
    const big: SequenceNodeV3 = { ...segment("big", 1), kind: "segment", role: "WORK",
      work: { kind: "duration", durationSeconds: Number.MAX_SAFE_INTEGER / 4, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: null }, repeatCount: 8 }
    expect(parsePrescriptionSequenceV3(sequence([segment("unknown", 100), big])).kind).toBe("rejected")
  })
  it("legacy parser never silently accepts v3 and v3 never upgrades a legacy object", () => {
    const s = sequence([segment("work", 100)])
    expect(parsePrescriptionSequence(s).kind).toBe("rejected")
    expect(parsePrescriptionSequenceV3({ ...s, version: 2 }).kind).toBe("rejected")
  })
  it("rejects nested repetition ownership rather than double counting", () => {
    const s = sequence([group("outer", 2, [group("inner", 2, [segment("work", 100)])])])
    expect(parsePrescriptionSequenceV3(s).kind).toBe("rejected")
  })
  it("does not manufacture a target repetition from buildup alone", () => {
    expect(parsePrescriptionSequenceV3(sequence([group("only-build", 4,
      [segment("build", 20, "BUILDUP")])])).kind).toBe("rejected")
  })
  it("does not halve the established representation limit while reusing validation", () => {
    const s = sequence([segment("large", Number.MAX_SAFE_INTEGER)])
    expect(parsePrescriptionSequenceV3(s).kind).toBe("parsed")
    expect(deriveSequenceV3Totals(s).main.workDistanceM).toBe(Number.MAX_SAFE_INTEGER)
  })
})
