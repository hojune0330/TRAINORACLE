import { describe, expect, it } from "vitest"
import { compareMainMethods, deriveSequenceTotals, parsePrescriptionSequence, PRESCRIPTION_SEQUENCE_LIMITS } from "./sequence"
import { RECOVERY_MODES } from "./types"
import type {
  PrescriptionSequence, PrescriptionSequenceGroup, PrescriptionSequenceNode, PrescriptionSequenceSegment,
  SequenceParseErrorCode, SequenceRecovery, SequenceTarget, SequenceWork,
} from "./sequence"

// Synthetic serialization fixtures, not candidates, training advice or adopted doses.
const none: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }
const effort: SequenceTarget = { kind: "EFFORT_GUIDANCE", cue: "controlled" }
const distance = (distanceM: number | null): SequenceWork => ({ kind: "distance", distanceM, durationSeconds: null })
const duration = (durationSeconds: number | null): SequenceWork => ({ kind: "duration", distanceM: null, durationSeconds })
const rest = (seconds: number | null, mode: "STAND" | "WALK" | "JOG" = "STAND"): SequenceRecovery => ({ mode, seconds })

function segment(id: string, changes: Partial<PrescriptionSequenceSegment> = {}): PrescriptionSequenceSegment {
  return {
    kind: "segment", id, label: null, repeatCount: 1, work: distance(400), target: effort,
    recoveryBetweenRepeats: none, recoveryAfter: none, ...changes,
  }
}

function group(id: string, children: readonly PrescriptionSequenceNode[], changes: Partial<PrescriptionSequenceGroup> = {}): PrescriptionSequenceGroup {
  return { kind: "group", id, label: null, repeatCount: 1, recoveryBetweenRepeats: none, recoveryAfter: none, children, ...changes }
}

function sequence(main: readonly PrescriptionSequenceNode[] = [segment("work")], changes: Partial<PrescriptionSequence> = {}): PrescriptionSequence {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 1, id: "sequence", label: null, warmup: [], main, cooldown: [], ...changes }
}

function ownerNotation(): PrescriptionSequence {
  return sequence([group("sets", [segment("reps", {
    repeatCount: 10,
    target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
    recoveryBetweenRepeats: rest(60),
    recoveryAfter: rest(999),
  })], { repeatCount: 2, recoveryBetweenRepeats: rest(180), recoveryAfter: rest(888) })])
}

function parsed(input: unknown): PrescriptionSequence {
  const result = parsePrescriptionSequence(input)
  if (result.kind !== "parsed") throw new Error(`Expected parsed sequence: ${result.code} at ${result.path}`)
  return result.sequence
}

function rejected(input: unknown, code: SequenceParseErrorCode = "INVALID_SEQUENCE"): void {
  expect(parsePrescriptionSequence(input)).toMatchObject({ kind: "rejected", code })
}

function changed(input: PrescriptionSequence, path: readonly (string | number)[], value: unknown, remove = false): unknown {
  const copy: unknown = JSON.parse(JSON.stringify(input))
  let parent = copy as Record<string | number, unknown>
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>
  const key = path.at(-1)
  if (key === undefined) throw new Error("Test mutation requires a field")
  if (remove) delete parent[key]
  else parent[key] = value
  return copy
}

describe("PrescriptionSequence parsing", () => {
  it("preserves the exact versioned JSON shape and detaches/freezes all nested values", () => {
    const input = ownerNotation()
    const output = parsed(input)
    expect(output).toStrictEqual(input)
    expect(output).not.toBe(input)
    expect(output.main).not.toBe(input.main)
    function frozen(value: unknown): void {
      if (value !== null && typeof value === "object") {
        expect(Object.isFrozen(value)).toBe(true)
        Object.values(value).forEach(frozen)
      }
    }
    frozen(output)
    expect(Reflect.set(output, "version", 2)).toBe(false)
    expect(Reflect.set(output.main, "0", segment("replacement"))).toBe(false)
  })

  it("roundtrips ordered distance, duration, unknowns and all target kinds without conversion", () => {
    const input = sequence([
      segment("fraction", { work: distance(12.375), target: { kind: "SPRINT_REFERENCE", reference: "explicit-ref" } }),
      group("mixed", [
        segment("time", { work: duration(2.625), target: { kind: "EFFORT_GUIDANCE", cue: null } }),
        segment("unknown-distance", { work: distance(null), target: { kind: "RACE_PACE", eventDistanceM: null, anchorRef: null } }),
        segment("unknown-time", { work: duration(null), target: { kind: "SPRINT_REFERENCE", reference: null } }),
      ]),
    ])
    const first = parsed(input)
    expect(first).toStrictEqual(input)
    expect(parsed(JSON.parse(JSON.stringify(first)))).toStrictEqual(first)
    expect(deriveSequenceTotals(first)).toMatchObject({ qualityDistanceM: null, qualityDurationSeconds: null })
    expect(JSON.stringify(first)).not.toContain("targetRepSeconds")
  })

  it.each(["WALK", "JOG", "STAND", "FULL_RECOVERY", "COACH_DEFINED", "WALK_OR_JOG"] as const)("preserves explicit unknown recovery seconds with mode %s", (mode) => {
    const input = sequence([segment("work", { repeatCount: 2, recoveryBetweenRepeats: { mode, seconds: null } })])
    expect(parsed(input)).toStrictEqual(input)
    expect(deriveSequenceTotals(input)).toMatchObject({ repetitionRecoveryOccurrences: 1, repetitionRecoveryTotalSeconds: null })
  })

  it("accepts WALK_OR_JOG locally for operational warmup and preserves its exact JSON mode", () => {
    const recovery: SequenceRecovery = { mode: "WALK_OR_JOG", seconds: 40 }
    const input = sequence([segment("main", { work: duration(10), repeatCount: 3, recoveryBetweenRepeats: recovery })], {
      warmup: [segment("strides", { work: duration(20), repeatCount: 4, recoveryBetweenRepeats: recovery })],
    })
    expect(parsed(JSON.parse(JSON.stringify(input)))).toStrictEqual(input)
    expect(deriveSequenceTotals(input)).toMatchObject({
      totalRepetitions: 3, qualityDurationSeconds: 30, repetitionRecoveryOccurrences: 2,
      repetitionRecoveryTotalSeconds: 80, mainSessionTotalExcludingWarmupCooldown: 110,
    })
    expect(RECOVERY_MODES).not.toContain("WALK_OR_JOG")
    rejected(changed(input, ["warmup", 0, "recoveryBetweenRepeats", "mode"], "WALK/JOG"))
  })

  it.each([
    ["undefined", undefined], ["null", null], ["boolean", true], ["number", 1],
    ["JSON text", "{}"], ["array", []], ["date", new Date(0)], ["map", new Map()],
  ])("rejects non-record roots: %s", (_name, input) => rejected(input))

  it.each([
    ["version", ["version"], 2],
    ["string version", ["version"], "1"],
    ["active kind", ["kind"], "STRUCTURED_PRESCRIPTION"],
    ["empty MAIN", ["main"], []],
    ["empty group", ["main", 0, "children"], []],
    ["null phase", ["warmup"], null],
    ["blank ID", ["id"], " "],
    ["blank label", ["label"], ""],
    ["unknown target", ["main", 0, "children", 0, "target", "kind"], "FAST"],
    ["unknown node", ["main", 0, "kind"], "recovery"],
    ["unknown work", ["main", 0, "children", 0, "work", "kind"], "laps"],
    ["ambiguous work", ["main", 0, "children", 0, "work", "durationSeconds"], 30],
    ["wrong work dimension", ["main", 0, "children", 0, "work", "kind"], "duration"],
    ["unknown recovery mode", ["main", 0, "recoveryBetweenRepeats", "mode"], "FLOAT"],
    ["seconds without mode", ["main", 0, "recoveryBetweenRepeats", "mode"], "NOT_APPLICABLE"],
    ["missing mode value", ["main", 0, "recoveryBetweenRepeats", "mode"], null],
    ["invalid cue", ["main", 0, "children", 0, "target"], { kind: "EFFORT_GUIDANCE", cue: 7 }],
    ["invalid reference", ["main", 0, "children", 0, "target"], { kind: "SPRINT_REFERENCE", reference: false }],
  ] as const)("rejects invalid shape: %s", (_name, path, value) => rejected(changed(ownerNotation(), path, value)))

  it.each([
    ["root", []], ["group", ["main", 0]], ["segment", ["main", 0, "children", 0]],
    ["work", ["main", 0, "children", 0, "work"]],
    ["target", ["main", 0, "children", 0, "target"]],
    ["recovery", ["main", 0, "recoveryBetweenRepeats"]],
  ] as const)("rejects unknown keys at %s, including activation attempts", (_name, path) => {
    rejected(changed(ownerNotation(), [...path, "active"], true), "UNKNOWN_KEY")
  })

  it.each([
    ["warmup", ["warmup"]], ["label", ["main", 0, "label"]],
    ["duration", ["main", 0, "children", 0, "work", "durationSeconds"]],
    ["anchor", ["main", 0, "children", 0, "target", "anchorRef"]],
    ["recoveryAfter", ["main", 0, "recoveryAfter"]],
    ["recoverySeconds", ["main", 0, "recoveryBetweenRepeats", "seconds"]],
  ] as const)("does not invent missing required fields: %s", (_name, path) => {
    rejected(changed(ownerNotation(), path, undefined, true))
  })

  it.each([0, -0, -1, NaN, Infinity, -Infinity, "2", true, null, undefined, 1n])("rejects invalid positive numbers without coercion: %s", (value) => {
    for (const path of [
      ["main", 0, "repeatCount"], ["main", 0, "children", 0, "work", "distanceM"],
      ["main", 0, "recoveryBetweenRepeats", "seconds"], ["main", 0, "children", 0, "target", "eventDistanceM"],
    ]) {
      if (value === null && path.at(-1) !== "repeatCount") continue
      rejected(changed(ownerNotation(), path, value))
    }
    if (value !== null) rejected(changed(sequence([segment("t", { work: duration(3) })]), ["main", 0, "work", "durationSeconds"], value))
  })

  it("accepts positive fractional values but requires integral counts", () => {
    const input = sequence([segment("fraction", { work: duration(0.125), repeatCount: 3, recoveryBetweenRepeats: rest(0.25) })])
    expect(deriveSequenceTotals(parsed(input))).toMatchObject({ qualityDurationSeconds: 0.375, plannedRecoverySeconds: 0.5 })
    rejected(changed(input, ["main", 0, "repeatCount"], 1.5))
  })

  it("rejects duplicate IDs globally, including across phases and ancestor IDs", () => {
    rejected(sequence([segment("same"), group("g", [segment("same")])]), "DUPLICATE_ID")
    rejected(sequence([segment("same")], { warmup: [segment("same")] }), "DUPLICATE_ID")
    rejected(sequence([segment("sequence")]), "DUPLICATE_ID")
    rejected(sequence([group("ancestor", [segment("ancestor")])]), "DUPLICATE_ID")
  })

  it("rejects sparse, decorated and inherited array entries", () => {
    rejected(sequence(new Array<PrescriptionSequenceNode>(2)))
    const disguised = [segment("first"), segment("last")]
    delete disguised[1]
    Object.assign(disguised, { extra: segment("fake") })
    rejected(sequence(disguised))
    rejected(sequence(Object.assign([segment("one")], { extra: 1 })))
    rejected(sequence(Object.assign([segment("one")], { [Symbol("hidden")]: 1 })))
    const inherited: PrescriptionSequenceNode[] = []
    inherited.length = 1
    Object.setPrototypeOf(inherited, { 0: segment("inherited") })
    rejected(sequence(inherited))
  })

  it("rejects accessors, symbols and custom prototypes without executing accessors/toJSON", () => {
    let calls = 0
    const getter = { ...sequence() }
    Object.defineProperty(getter, "main", { enumerable: true, get() { calls += 1; return [segment("getter")] } })
    rejected(getter)
    const array = [segment("one")]
    Object.defineProperty(array, "0", { enumerable: true, get() { calls += 1; return segment("getter") } })
    rejected(sequence(array))
    rejected({ ...sequence(), toJSON() { calls += 1; return sequence() } }, "UNKNOWN_KEY")
    rejected({ ...sequence(), [Symbol("unknown")]: true }, "UNKNOWN_KEY")
    rejected(Object.create(sequence()))
    const hidden = { ...sequence() }
    Object.defineProperty(hidden, "main", { enumerable: false })
    rejected(hidden)
    expect(calls).toBe(0)
    expect(parsed(Object.assign(Object.create(null) as object, sequence()))).toStrictEqual(sequence())
  })

  it("rejects cyclic data without overflowing the stack and contains thrown inspection errors", () => {
    const children: PrescriptionSequenceNode[] = []
    const cycle = group("cycle", children)
    children.push(cycle)
    rejected(sequence([cycle]), "DUPLICATE_ID")
    rejected(new Proxy({}, { ownKeys() { throw new Error("private input must not escape") } }))
    expect(JSON.stringify(parsePrescriptionSequence(new Proxy({}, { getPrototypeOf() { throw new Error("private") } })))).not.toContain("private")
  })
})

describe("technical serialization bounds", () => {
  it.each([Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE, 1e100])("rejects huge finite scalar/count values: %s", (value) => {
    rejected(changed(ownerNotation(), ["main", 0, "repeatCount"], value), "SERIALIZATION_LIMIT")
    rejected(changed(ownerNotation(), ["main", 0, "children", 0, "work", "distanceM"], value), "SERIALIZATION_LIMIT")
    rejected(changed(ownerNotation(), ["main", 0, "recoveryBetweenRepeats", "seconds"], value), "SERIALIZATION_LIMIT")
    rejected(changed(ownerNotation(), ["main", 0, "children", 0, "target", "eventDistanceM"], value), "SERIALIZATION_LIMIT")
  })

  it("accepts exactly the depth/width/node bounds and rejects one beyond", () => {
    const { maxDepth, maxChildren, maxNodes } = PRESCRIPTION_SEQUENCE_LIMITS
    let nested: PrescriptionSequenceNode = segment("leaf")
    for (let depth = 1; depth < maxDepth; depth += 1) nested = group(`depth-${depth}`, [nested])
    expect(parsed(sequence([nested]))).toStrictEqual(sequence([nested]))
    rejected(sequence([group("too-deep", [nested])]), "SERIALIZATION_LIMIT")
    const wide = Array.from({ length: maxChildren }, (_, i) => segment(`wide-${i}`))
    expect(parsed(sequence(wide)).main).toHaveLength(maxChildren)
    rejected(sequence([...wide, segment("too-wide")]), "SERIALIZATION_LIMIT")
    // Four groups + their children = 1024 nodes, independently of the width bound.
    const branches = Array.from({ length: 4 }, (_, g) => group(`group-${g}`,
      Array.from({ length: maxNodes / 4 - 1 }, (_, i) => segment(`node-${g}-${i}`))))
    expect(parsed(sequence(branches)).main).toHaveLength(4)
    rejected(sequence([...branches, segment("one-too-many")]), "SERIALIZATION_LIMIT")
  })

  it("bounds total nodes across phases, text lengths, and huge sparse arrays", () => {
    const max = PRESCRIPTION_SEQUENCE_LIMITS.maxStringLength
    expect(parsed(sequence(undefined, { id: "x".repeat(max) })).id).toHaveLength(max)
    rejected(sequence(undefined, { label: "x".repeat(max + 1) }), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("target", { target: { kind: "EFFORT_GUIDANCE", cue: "x".repeat(max + 1) } })]), "SERIALIZATION_LIMIT")
    rejected(sequence(new Array<PrescriptionSequenceNode>(2 ** 32 - 1)), "SERIALIZATION_LIMIT")
    const phase = (prefix: string) => Array.from({ length: 256 }, (_, i) => segment(`${prefix}-${i}`))
    const input = sequence([group("main-group", phase("m")), ...phase("m2").slice(1)], { warmup: phase("w"), cooldown: phase("c") })
    expect(parsed(input)).toStrictEqual(input)
    rejected({ ...input, main: [group("main-group", phase("m")), group("extra-group", [segment("extra")]), ...phase("m2").slice(2)] }, "SERIALIZATION_LIMIT")
  })

  it("does not expand repetitions even at the safe-integer boundary", () => {
    const count = Number.MAX_SAFE_INTEGER
    const input = sequence([segment("many", { work: distance(1), repeatCount: count })])
    expect(deriveSequenceTotals(parsed(input))).toMatchObject({ totalRepetitions: count, qualityDistanceM: count, plannedRecoverySeconds: 0 })
    expect(JSON.stringify(parsed(input)).length).toBeLessThan(1000)
    rejected(sequence([group("outer", [segment("many", { work: distance(null), repeatCount: count })], { repeatCount: 2 })]), "SERIALIZATION_LIMIT")
  })

  it("rejects aggregate overflow, including overflow hidden by unknown work or recovery", () => {
    const max = Number.MAX_SAFE_INTEGER
    rejected(sequence([segment("overflow", { work: distance(max), repeatCount: 2 })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("a", { work: distance(max) }), segment("b", { work: distance(max) })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("unknown", { work: distance(null) }), segment("a", { work: distance(max) }), segment("b", { work: distance(max) })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("time", { work: duration(max), repeatCount: 2 })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("rest", { work: duration(null), repeatCount: 3, recoveryBetweenRepeats: rest(max) })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("unknown", { work: duration(null), repeatCount: 2, recoveryBetweenRepeats: rest(null) }),
      segment("rest", { work: duration(null), repeatCount: 3, recoveryBetweenRepeats: rest(max) })]), "SERIALIZATION_LIMIT")
    rejected(sequence([segment("a", { work: duration(max), recoveryAfter: rest(1) }), segment("b", { work: duration(null) })]), "SERIALIZATION_LIMIT")
    rejected(sequence(undefined, { warmup: [segment("warm-overflow", { repeatCount: 2, work: duration(max) })] }), "SERIALIZATION_LIMIT")
  })
})

describe("deriveSequenceTotals", () => {
  it("matches OWNER-NOTATION-001 and replaces final rep rest with set rest", () => {
    expect(deriveSequenceTotals(parsed(ownerNotation()))).toStrictEqual({
      totalRepetitions: 20, qualityDistanceM: 8000, qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 18, repetitionRecoveryTotalSeconds: 1080,
      setRecoveryOccurrences: 1, setRecoveryTotalSeconds: 180,
      transitionRecoveryOccurrences: 0, transitionRecoveryTotalSeconds: 0,
      plannedRecoverySeconds: 1260, mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["WORK_DURATION_UNAVAILABLE"],
    })
  })

  it("sums time work and all recovery layers without an extra final rest", () => {
    const input = sequence([group("sets", [
      segment("a", { work: duration(10), repeatCount: 3, recoveryBetweenRepeats: rest(2), recoveryAfter: rest(5) }),
      segment("b", { work: duration(20), repeatCount: 2, recoveryBetweenRepeats: rest(3), recoveryAfter: rest(999) }),
    ], { repeatCount: 2, recoveryBetweenRepeats: rest(7), recoveryAfter: rest(888) })])
    expect(deriveSequenceTotals(input)).toStrictEqual({
      totalRepetitions: 10, qualityDistanceM: null, qualityDurationSeconds: 140,
      repetitionRecoveryOccurrences: 6, repetitionRecoveryTotalSeconds: 14,
      setRecoveryOccurrences: 1, setRecoveryTotalSeconds: 7,
      transitionRecoveryOccurrences: 2, transitionRecoveryTotalSeconds: 10,
      plannedRecoverySeconds: 31, mainSessionTotalExcludingWarmupCooldown: 171,
      uncomputableReasonCodes: ["QUALITY_DISTANCE_UNAVAILABLE"],
    })
  })

  it("multiplies nested ordered groups and counts each boundary at its own level", () => {
    const input = sequence([
      group("outer", [
        segment("distance", { work: distance(100), repeatCount: 2, recoveryBetweenRepeats: rest(3), recoveryAfter: rest(5) }),
        group("inner", [
          segment("time", { work: duration(10), recoveryAfter: rest(2) }),
          segment("sprint", { work: distance(20), recoveryAfter: rest(999), target: { kind: "SPRINT_REFERENCE", reference: null } }),
        ], { repeatCount: 3, recoveryBetweenRepeats: rest(7), recoveryAfter: rest(888) }),
      ], { repeatCount: 2, recoveryBetweenRepeats: rest(11), recoveryAfter: rest(13) }),
      segment("tail", { work: duration(4), recoveryAfter: rest(777) }),
    ])
    expect(deriveSequenceTotals(input)).toStrictEqual({
      totalRepetitions: 17, qualityDistanceM: null, qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 2, repetitionRecoveryTotalSeconds: 6,
      setRecoveryOccurrences: 5, setRecoveryTotalSeconds: 39,
      transitionRecoveryOccurrences: 9, transitionRecoveryTotalSeconds: 35,
      plannedRecoverySeconds: 80, mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["QUALITY_DISTANCE_UNAVAILABLE", "WORK_DURATION_UNAVAILABLE"],
    })
    expect(parsed(JSON.parse(JSON.stringify(input)))).toStrictEqual(input)
  })

  it("does not contaminate MAIN with warmup, cooldown or their phase-boundary recovery", () => {
    const main = sequence([segment("work", { work: duration(10) })])
    const decorated = { ...main,
      warmup: [segment("warm", { work: distance(null), repeatCount: 5, recoveryBetweenRepeats: rest(null), recoveryAfter: rest(100) })],
      cooldown: [segment("cool", { work: duration(null), repeatCount: 2, recoveryBetweenRepeats: rest(null) })],
    }
    expect(deriveSequenceTotals(decorated)).toStrictEqual(deriveSequenceTotals(main))
    expect(deriveSequenceTotals(decorated).mainSessionTotalExcludingWarmupCooldown).toBe(10)
  })

  it("does not treat unused unknown recovery as missing, including single sets/reps", () => {
    const input = sequence([group("one-set", [segment("one-rep", {
      work: duration(10), recoveryBetweenRepeats: rest(null), recoveryAfter: rest(null),
    })], { recoveryBetweenRepeats: rest(null), recoveryAfter: rest(null) })])
    expect(deriveSequenceTotals(input)).toMatchObject({
      repetitionRecoveryOccurrences: 0, repetitionRecoveryTotalSeconds: 0,
      setRecoveryOccurrences: 0, setRecoveryTotalSeconds: 0,
      transitionRecoveryOccurrences: 0, transitionRecoveryTotalSeconds: 0,
      plannedRecoverySeconds: 0, mainSessionTotalExcludingWarmupCooldown: 10,
      uncomputableReasonCodes: ["QUALITY_DISTANCE_UNAVAILABLE"],
    })
  })

  it("distinguishes no recovery from unknown recovery, propagating only used unknowns", () => {
    const input = sequence([group("sets", [
      segment("a", { work: duration(10), repeatCount: 2, recoveryBetweenRepeats: rest(null), recoveryAfter: rest(null) }),
      segment("b", { work: duration(20), repeatCount: 2 }),
    ], { repeatCount: 2, recoveryBetweenRepeats: rest(null) })])
    expect(deriveSequenceTotals(input)).toMatchObject({
      totalRepetitions: 8, qualityDurationSeconds: 120,
      repetitionRecoveryOccurrences: 2, repetitionRecoveryTotalSeconds: null,
      setRecoveryOccurrences: 1, setRecoveryTotalSeconds: null,
      transitionRecoveryOccurrences: 2, transitionRecoveryTotalSeconds: null,
      plannedRecoverySeconds: null, mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["QUALITY_DISTANCE_UNAVAILABLE", "REPETITION_RECOVERY_UNAVAILABLE", "SET_RECOVERY_UNAVAILABLE", "TRANSITION_RECOVERY_UNAVAILABLE"],
    })
    expect(deriveSequenceTotals(sequence([segment("continuous", { repeatCount: 3, work: duration(10) })]))).toMatchObject({
      plannedRecoverySeconds: 0, mainSessionTotalExcludingWarmupCooldown: 30, repetitionRecoveryOccurrences: 0,
    })
  })

  it("validates typed-but-forged inputs before arithmetic or comparison", () => {
    const forged = changed(ownerNotation(), ["main", 0, "repeatCount"], Infinity) as PrescriptionSequence
    expect(() => deriveSequenceTotals(forged)).toThrow(TypeError)
    expect(() => compareMainMethods(forged, sequence())).toThrow(TypeError)
    expect(() => compareMainMethods(sequence(), forged)).toThrow(TypeError)
  })
})

describe("compareMainMethods", () => {
  const same = { kind: "same", requiresReview: false }
  const different = { kind: "different", requiresReview: true }

  it("ignores sequence/node labels and IDs without treating them as a new method", () => {
    const original = ownerNotation()
    const renamed = parsed(changed(original, ["main", 0, "children", 0, "id"], "new-rep-id"))
    const relabeled = parsed(changed(renamed, ["main", 0, "label"], "other display label"))
    expect(compareMainMethods(original, { ...relabeled, id: "another", label: "presentation only" })).toEqual(same)
  })

  it("ignores count-only variants at every nesting level, including count one", () => {
    const original = ownerNotation()
    for (const count of [1, 3, 17]) {
      const variant = parsed(changed(parsed(changed(original, ["main", 0, "repeatCount"], count)), ["main", 0, "children", 0, "repeatCount"], count))
      expect(compareMainMethods(original, variant)).toEqual(same)
      expect(deriveSequenceTotals(original).totalRepetitions).not.toBe(deriveSequenceTotals(variant).totalRepetitions)
    }
  })

  it("ignores unnecessary unary wrappers across count-only variants without rewriting the sequence", () => {
    const base = segment("work", { repeatCount: 5, recoveryBetweenRepeats: rest(60) })
    const original = sequence([base])
    const wrapped = sequence([group("outer", [group("inner", [{ ...base, repeatCount: 3 }])])])
    const before = JSON.stringify(wrapped)
    expect(compareMainMethods(original, wrapped)).toEqual(same)
    expect(compareMainMethods(wrapped, original)).toEqual(same)
    expect(deriveSequenceTotals(original).totalRepetitions).toBe(5)
    expect(deriveSequenceTotals(wrapped).totalRepetitions).toBe(3)
    expect(parsed(JSON.parse(before))).toStrictEqual(wrapped)
    expect(JSON.stringify(wrapped)).toBe(before)
  })

  it("treats duplicated unary recovery layers as counts, but retains distinct set recovery", () => {
    const leaf = segment("work", { repeatCount: 3, recoveryBetweenRepeats: rest(60) })
    const flat = sequence([{ ...leaf, repeatCount: 10 }])
    const wrapped = sequence([group("sets", [leaf], { repeatCount: 2, recoveryBetweenRepeats: rest(60) })])
    expect(compareMainMethods(flat, wrapped)).toEqual(same)
    const nested = sequence([group("outer", [group("transparent", [group("inner", [leaf], {
      repeatCount: 2, recoveryBetweenRepeats: rest(60),
    })])], { repeatCount: 3, recoveryBetweenRepeats: rest(60) })])
    expect(compareMainMethods(flat, nested)).toEqual(same)
    expect(compareMainMethods(wrapped, nested)).toEqual(same)
    expect(compareMainMethods(flat, parsed(changed(wrapped, ["main", 0, "repeatCount"], 1)))).toEqual(same)
    expect(compareMainMethods(flat, parsed(changed(wrapped, ["main", 0, "recoveryBetweenRepeats"], rest(180))))).toEqual(different)
    expect(compareMainMethods(flat, parsed(changed(wrapped, ["main", 0, "recoveryBetweenRepeats"], rest(null))))).toEqual(different)
    expect(compareMainMethods(flat, parsed(changed(wrapped, ["main", 0, "recoveryBetweenRepeats"], rest(60, "JOG"))))).toEqual(different)
  })

  it("preserves the outer recovery boundary when removing a unary wrapper", () => {
    const first = segment("first", { work: duration(10), recoveryAfter: rest(7) })
    const tail = segment("tail", { work: duration(20) })
    const flat = sequence([first, tail])
    const wrapped = sequence([group("wrapper", [{ ...first, recoveryAfter: rest(999) }], { recoveryAfter: rest(7) }), tail])
    expect(deriveSequenceTotals(flat)).toEqual(deriveSequenceTotals(wrapped))
    expect(compareMainMethods(flat, wrapped)).toEqual(same)
    expect(compareMainMethods(flat, parsed(changed(wrapped, ["main", 0, "recoveryAfter"], rest(8))))).toEqual(different)
  })

  it("normalizes wrappers around and inside ordered mixed groups without flattening the repeat unit", () => {
    const first = segment("a", { work: distance(100), recoveryAfter: rest(5) })
    const last = segment("b", { work: duration(20), recoveryAfter: rest(999) })
    const mixed = group("mixed", [first, last], { repeatCount: 3, recoveryBetweenRepeats: rest(7) })
    const base = sequence([mixed])
    const wrapped = sequence([group("outer", [{ ...mixed, repeatCount: 2, children: [
      group("first-wrapper", [{ ...first, recoveryAfter: none }], { recoveryAfter: rest(5) }),
      group("last-wrapper", [last], { recoveryAfter: rest(888) }),
    ] }])])
    expect(compareMainMethods(base, wrapped)).toEqual(same)
    expect(compareMainMethods(base, sequence([first, last]))).toEqual(different)
    expect(compareMainMethods(base, sequence([{ ...mixed, children: [last, first] }]))).toEqual(different)
  })

  it("keeps WALK_OR_JOG distinct in MAIN, while warmup-only recovery changes remain the same", () => {
    const original = sequence([segment("work", { repeatCount: 2, recoveryBetweenRepeats: rest(40, "JOG") })])
    const variant = parsed(changed(original, ["main", 0, "recoveryBetweenRepeats", "mode"], "WALK_OR_JOG"))
    expect(compareMainMethods(original, variant)).toEqual(different)
    expect(compareMainMethods(original, { ...original, warmup: [segment("warmup", {
      repeatCount: 4, recoveryBetweenRepeats: { mode: "WALK_OR_JOG", seconds: 40 },
    })] })).toEqual(same)
  })

  it("ignores warmup/cooldown-only changes and dormant trailing recovery", () => {
    const original = ownerNotation()
    const changedTrailing = parsed(changed(original, ["main", 0, "children", 0, "recoveryAfter"], rest(123)))
    const variant = { ...changedTrailing, warmup: [segment("warm", { work: duration(30) })], cooldown: [segment("cool")] }
    expect(compareMainMethods(original, variant)).toEqual(same)
    expect(deriveSequenceTotals(original)).toEqual(deriveSequenceTotals(variant))
  })

  it("ignores selected anchor/reference ID-only changes but preserves them in JSON", () => {
    const original = ownerNotation()
    const variant = parsed(changed(original, ["main", 0, "children", 0, "target", "anchorRef"], "selected-record"))
    expect(compareMainMethods(original, variant)).toEqual(same)
    expect(JSON.stringify(variant)).toContain("selected-record")
    expect(compareMainMethods(
      sequence([segment("s", { target: { kind: "SPRINT_REFERENCE", reference: "ref-a" } })]),
      sequence([segment("s", { target: { kind: "SPRINT_REFERENCE", reference: "ref-b" } })]),
    )).toEqual(same)
  })

  it.each([
    ["repeat distance", ["main", 0, "children", 0, "work", "distanceM"], 200],
    ["unknown repeat distance", ["main", 0, "children", 0, "work", "distanceM"], null],
    ["repeat unit", ["main", 0, "children", 0, "work"], duration(30)],
    ["race event", ["main", 0, "children", 0, "target", "eventDistanceM"], 3000],
    ["target type", ["main", 0, "children", 0, "target"], effort],
    ["repetition recovery", ["main", 0, "children", 0, "recoveryBetweenRepeats", "seconds"], 61],
    ["recovery mode", ["main", 0, "children", 0, "recoveryBetweenRepeats", "mode"], "JOG"],
    ["set recovery", ["main", 0, "recoveryBetweenRepeats", "seconds"], 181],
  ] as const)("requires review for a changed %s, never authorizing another method", (_name, path, value) => {
    const original = ownerNotation()
    const variant = parsed(changed(original, path, value))
    expect(compareMainMethods(original, variant)).toEqual(different)
    expect(compareMainMethods(variant, original)).toEqual(different)
  })

  it("distinguishes target cues, nesting, ordering and recovery placement even at equal totals", () => {
    expect(compareMainMethods(sequence(), sequence([segment("work", { target: { kind: "EFFORT_GUIDANCE", cue: "easy" } })]))).toEqual(different)
    expect(compareMainMethods(sequence(), sequence([group("sets", [segment("work")], { repeatCount: 2, recoveryBetweenRepeats: rest(5) })]))).toEqual(different)
    const a = segment("a", { work: duration(10), recoveryAfter: rest(5) })
    const b = segment("b", { work: duration(20), recoveryAfter: rest(5) })
    const c = segment("c", { work: duration(30) })
    expect(compareMainMethods(sequence([a, b]), sequence([b, a]))).toEqual(different)
    const left = sequence([a, { ...b, recoveryAfter: none }, c])
    const right = sequence([{ ...a, recoveryAfter: none }, b, c])
    expect(deriveSequenceTotals(left)).toEqual(deriveSequenceTotals(right))
    expect(compareMainMethods(left, right)).toEqual(different)
  })

  it("keeps unknown distance and unknown duration distinct and ignores object-key order", () => {
    expect(compareMainMethods(sequence([segment("work", { work: distance(null) })]), sequence([segment("work", { work: duration(null) })]))).toEqual(different)
    const original = sequence()
    const reordered = { ...original, main: [segment("work", { work: { durationSeconds: null, distanceM: 400, kind: "distance" }, target: { cue: "controlled", kind: "EFFORT_GUIDANCE" } })] }
    expect(compareMainMethods(original, reordered)).toEqual(same)
    expect(compareMainMethods(original, parsed(JSON.parse(JSON.stringify(original))))).toEqual(same)
  })

  it("is deterministic, symmetric and leaves its caller's values unchanged", () => {
    const a = ownerNotation()
    const b = sequence()
    const before = JSON.stringify({ a, b })
    expect(compareMainMethods(a, a)).toEqual(same)
    expect(compareMainMethods(a, b)).toEqual(compareMainMethods(b, a))
    expect(deriveSequenceTotals(a)).toStrictEqual(deriveSequenceTotals(a))
    expect(JSON.stringify({ a, b })).toBe(before)
  })
})
