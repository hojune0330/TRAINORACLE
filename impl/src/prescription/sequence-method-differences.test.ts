import { describe, expect, it } from "vitest"
import {
  compareMainMethods, describeMainMethodDifferences, deriveSequenceTotals, deriveSequenceRecoveryDistanceTotals,
  type PrescriptionSequence, type PrescriptionSequenceSegment, type SequenceRecovery,
} from "./sequence"

const none: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }
const rollOn: SequenceRecovery = { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 }
const segment = (changes: Partial<PrescriptionSequenceSegment> = {}): PrescriptionSequenceSegment => ({
  kind: "segment", id: "work", label: null, repeatCount: 5,
  work: { kind: "distance", distanceM: 1000, durationSeconds: null },
  target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
  recoveryBetweenRepeats: { mode: "JOG", seconds: 150 }, recoveryAfter: none, ...changes,
})
const sequence = (changes: Partial<PrescriptionSequence> = {}): PrescriptionSequence => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "method", label: null,
  warmup: [], main: [segment()], cooldown: [], terminalRecovery: none, ...changes,
})

describe("inspectable MAIN method differences", () => {
  it("names all structural differences in the unadopted 12x400 source example", () => {
    const current = sequence()
    // Public source transcription only, never an activated template or athlete plan.
    const source = sequence({ main: [segment({ repeatCount: 12,
      work: { kind: "distance", distanceM: 400, durationSeconds: null }, recoveryBetweenRepeats: rollOn,
    })], terminalRecovery: rollOn })
    expect(describeMainMethodDifferences(current, source)).toEqual(["WORK_UNIT", "RECOVERY", "TERMINAL_RECOVERY"])
    expect(compareMainMethods(current, source)).toEqual({ kind: "different", requiresReview: true })
    expect(deriveSequenceTotals(current)).toMatchObject({ qualityDistanceM: 5000, plannedRecoverySeconds: 600 })
    expect(deriveSequenceTotals(source)).toMatchObject({ totalRepetitions: 12, qualityDistanceM: 4800,
      repetitionRecoveryOccurrences: 11, terminalRecoveryOccurrences: 1, plannedRecoverySeconds: null })
    expect(deriveSequenceRecoveryDistanceTotals(source)).toMatchObject({
      repetitionRecoveryTotalDistanceM: 1100, terminalRecoveryDistanceM: 100, plannedRecoveryDistanceM: 1200,
    })
    expect(deriveSequenceRecoveryDistanceTotals(current).plannedRecoveryDistanceM).toBeNull()
  })

  it.each([
    ["repeat count", segment({ repeatCount: 6 })],
    ["label", segment({ label: "a different name" })],
    ["private anchor", segment({ target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: "private-record-id" } })],
    ["unused last recovery", segment({ recoveryAfter: rollOn })],
  ] as const)("does not manufacture method differences from %s", (_name, changed) => {
    expect(describeMainMethodDifferences(sequence(), sequence({ main: [changed] }))).toEqual([])
  })

  it.each([
    ["distance", segment({ work: { kind: "distance", distanceM: 400, durationSeconds: null } }), "WORK_UNIT"],
    ["time-based work", segment({ work: { kind: "duration", distanceM: null, durationSeconds: 90 } }), "WORK_UNIT"],
    ["target", segment({ target: { kind: "RACE_PACE", eventDistanceM: 3000, anchorRef: null } }), "TARGET"],
    ["recovery mode", segment({ recoveryBetweenRepeats: { mode: "STAND", seconds: 150 } }), "RECOVERY"],
    ["recovery time", segment({ recoveryBetweenRepeats: { mode: "JOG", seconds: 90 } }), "RECOVERY"],
    ["recovery distance", segment({ recoveryBetweenRepeats: rollOn }), "RECOVERY"],
  ] as const)("identifies %s, symmetrically and consistently with equality", (_name, changed, code) => {
    const a = sequence()
    const b = sequence({ main: [changed] })
    expect(describeMainMethodDifferences(a, b)).toEqual([code])
    expect(describeMainMethodDifferences(b, a)).toEqual([code])
    expect(compareMainMethods(a, b).kind).toBe("different")
  })

  it("ignores phase labels and normalizes one-child wrappers before inspecting", () => {
    const changed = sequence({ label: "new", warmup: [segment({ id: "warmup" })], cooldown: [segment({ id: "cooldown" })], main: [{
      kind: "group", id: "outer", label: null, repeatCount: 2,
      recoveryBetweenRepeats: none, recoveryAfter: none, children: [segment()],
    }] })
    expect(describeMainMethodDifferences(sequence(), changed)).toEqual([])
  })

  it("distinguishes set grouping with its own recovery from a repetition-only wrapper", () => {
    const changed = sequence({ main: [{ kind: "group", id: "sets", label: null, repeatCount: 2,
      recoveryBetweenRepeats: { mode: "JOG", seconds: 180 }, recoveryAfter: none, children: [segment()],
    }] })
    expect(describeMainMethodDifferences(sequence(), changed)).toEqual(["WORK_STRUCTURE", "RECOVERY"])
  })

  it("checks sequence order and inter-block transitions without exposing labels or IDs", () => {
    const first = segment({ id: "PRIVATE_A", label: "PRIVATE_LABEL", recoveryAfter: rollOn })
    const second = segment({ id: "PRIVATE_B", work: { kind: "duration", distanceM: null, durationSeconds: 60 } })
    const a = sequence({ main: [first, second] })
    const b = sequence({ main: [second, first] })
    expect(describeMainMethodDifferences(a, b)).toEqual(["WORK_UNIT", "RECOVERY"])
    expect(JSON.stringify(describeMainMethodDifferences(a, b))).not.toMatch(/PRIVATE/)
    expect(describeMainMethodDifferences(sequence(), a)).toEqual(["WORK_STRUCTURE", "RECOVERY"])
  })

  it("includes terminal recovery independently and preserves v1 no-terminal equivalence", () => {
    const { terminalRecovery: _terminal, ...legacy } = sequence()
    expect(describeMainMethodDifferences({ ...legacy, version: 1 }, sequence())).toEqual([])
    expect(describeMainMethodDifferences(sequence(), sequence({ terminalRecovery: rollOn }))).toEqual(["TERMINAL_RECOVERY"])
  })

  it("rejects unreadable data without reading an accessor or changing the source", () => {
    const original = sequence()
    const before = JSON.stringify(original)
    let reads = 0
    const bad = Object.defineProperty({ ...original }, "main", { enumerable: true, get() { reads++; return original.main } })
    expect(() => describeMainMethodDifferences(original, bad)).toThrow()
    expect(reads).toBe(0)
    expect(JSON.stringify(original)).toBe(before)
    expect(Object.isFrozen(describeMainMethodDifferences(original, original))).toBe(true)
  })

  it("agrees with the established comparator across mixed structures and both orders", () => {
    const alternatives: PrescriptionSequence[] = [
      sequence(), sequence({ main: [segment({ repeatCount: 1 })] }),
      sequence({ main: [segment({ work: { kind: "duration", distanceM: null, durationSeconds: 90 } })] }),
      sequence({ main: [segment({ work: { kind: "distance", distanceM: null, durationSeconds: null } })] }),
      sequence({ main: [segment({ recoveryBetweenRepeats: rollOn })] }),
      sequence({ terminalRecovery: rollOn }),
      sequence({ main: [segment(), segment({ id: "second", target: { kind: "EFFORT_GUIDANCE", cue: "CONTROLLED" } })] }),
      sequence({ main: [{ kind: "group", id: "set", label: null, repeatCount: 2,
        recoveryBetweenRepeats: { mode: "JOG", seconds: 180 }, recoveryAfter: none,
        children: [segment(), segment({ id: "second", target: { kind: "SPRINT_REFERENCE", reference: null } })],
      }] }),
    ]
    for (const a of alternatives) for (const b of alternatives) {
      const difference = describeMainMethodDifferences(a, b)
      expect(difference.length === 0).toBe(compareMainMethods(a, b).kind === "same")
      expect(difference).toEqual(describeMainMethodDifferences(b, a))
    }
  })
})
