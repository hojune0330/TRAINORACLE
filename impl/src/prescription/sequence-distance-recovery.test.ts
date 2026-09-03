import { describe, expect, it } from "vitest"
import {
  compareMainMethods,
  deriveSequenceRecoveryDistanceTotals,
  deriveSequenceTotals,
  parsePrescriptionSequence,
} from "./sequence"
import type {
  PrescriptionSequence,
  PrescriptionSequenceGroup,
  PrescriptionSequenceNode,
  PrescriptionSequenceSegment,
  SequenceRecovery,
  SequenceRecoveryMode,
  SequenceTarget,
  SequenceWork,
} from "./sequence"

// Synthetic source-transcription fixtures only, never athlete prescriptions or activation inputs.
const none: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }
const pace: SequenceTarget = { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null }
const distance = (distanceM: number | null): SequenceWork => ({ kind: "distance", distanceM, durationSeconds: null })
const timeRecovery = (seconds: number | null, mode: Exclude<SequenceRecoveryMode, "NOT_APPLICABLE"> = "JOG"): SequenceRecovery => ({ mode, seconds })
const distanceRecovery = (distanceM: number, mode: "WALK" | "JOG" | "WALK_OR_JOG" | "ACTIVE_ROLL_ON" = "ACTIVE_ROLL_ON"): SequenceRecovery => ({ mode, seconds: null, distanceM })

function segment(id: string, changes: Partial<PrescriptionSequenceSegment> = {}): PrescriptionSequenceSegment {
  return {
    kind: "segment", id, label: null, repeatCount: 1, work: distance(400), target: pace,
    recoveryBetweenRepeats: none, recoveryAfter: none, ...changes,
  }
}

function group(id: string, children: readonly PrescriptionSequenceNode[], changes: Partial<PrescriptionSequenceGroup> = {}): PrescriptionSequenceGroup {
  return { kind: "group", id, label: null, repeatCount: 1, recoveryBetweenRepeats: none, recoveryAfter: none, children, ...changes }
}

function v1(main: readonly PrescriptionSequenceNode[] = [segment("work")]): PrescriptionSequence {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 1, id: "v1-sequence", label: null, warmup: [], main, cooldown: [] }
}

function v2(main: readonly PrescriptionSequenceNode[] = [segment("work")]): PrescriptionSequence {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "v2-sequence", label: null, warmup: [], main, cooldown: [], terminalRecovery: none }
}

function parsed(input: unknown): PrescriptionSequence {
  const result = parsePrescriptionSequence(input)
  if (result.kind !== "parsed") throw new Error(`Expected parsed sequence: ${result.code} at ${result.path}`)
  return result.sequence
}

function rawRecoverySequence(version: number, recoveryBetweenRepeats: unknown): unknown {
  return {
    kind: "PRESCRIPTION_SEQUENCE", version, id: "raw", label: null, warmup: [], cooldown: [],
    ...(version === 2 ? { terminalRecovery: none } : {}), main: [{
      kind: "segment", id: "reps", label: null, repeatCount: 2,
      recoveryBetweenRepeats, recoveryAfter: none,
      work: distance(400), target: pace,
    }],
  }
}

function rejected(input: unknown): void {
  expect(parsePrescriptionSequence(input)).toMatchObject({ kind: "rejected" })
}

describe("distance-based sequence recovery v2", () => {
  it("represents a 15 x 400m 5000 RP source fixture with 100m ACTIVE_ROLL_ON recovery without creating time", () => {
    const sourceFixture = parsed(v2([segment("5000-rp-reps", {
      repeatCount: 15,
      target: pace,
      recoveryBetweenRepeats: distanceRecovery(100),
    })]))

    expect(JSON.parse(JSON.stringify(sourceFixture))).toStrictEqual({
      kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "v2-sequence", label: null, warmup: [], cooldown: [], terminalRecovery: none, main: [{
        kind: "segment", id: "5000-rp-reps", label: null, repeatCount: 15,
        work: distance(400), target: pace,
        recoveryBetweenRepeats: { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 }, recoveryAfter: none,
      }],
    })
    expect(deriveSequenceTotals(sourceFixture)).toMatchObject({
      totalRepetitions: 15,
      qualityDistanceM: 6000,
      qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 14,
      repetitionRecoveryTotalSeconds: null,
      plannedRecoverySeconds: null,
      mainSessionTotalExcludingWarmupCooldown: null,
    })
    expect(deriveSequenceRecoveryDistanceTotals(sourceFixture)).toStrictEqual({
      repetitionRecoveryTotalDistanceM: 1400,
      setRecoveryTotalDistanceM: 0,
      transitionRecoveryTotalDistanceM: 0,
      terminalRecoveryDistanceM: 0,
      plannedRecoveryDistanceM: 1400,
    })
  })

  it("represents the 12 x 400m source example with 11 between-rep and one terminal roll-on recovery", () => {
    const sourceFixture = parsed({
      ...v2([segment("5000-rp-reps", { repeatCount: 12, target: pace, recoveryBetweenRepeats: distanceRecovery(100) })]),
      terminalRecovery: distanceRecovery(100),
    })

    expect(deriveSequenceTotals(sourceFixture)).toMatchObject({
      totalRepetitions: 12,
      qualityDistanceM: 4800,
      repetitionRecoveryOccurrences: 11,
      repetitionRecoveryTotalSeconds: null,
      terminalRecoveryOccurrences: 1,
      terminalRecoveryTotalSeconds: null,
      plannedRecoverySeconds: null,
    })
    expect(deriveSequenceRecoveryDistanceTotals(sourceFixture)).toStrictEqual({
      repetitionRecoveryTotalDistanceM: 1100,
      setRecoveryTotalDistanceM: 0,
      transitionRecoveryTotalDistanceM: 0,
      terminalRecoveryDistanceM: 100,
      plannedRecoveryDistanceM: 1200,
    })
  })

  it("keeps nested repetition, set and transition recovery distances separate", () => {
    const nested = parsed(v2([
      group("sets", [
        segment("reps", { repeatCount: 2, work: distance(200), recoveryBetweenRepeats: distanceRecovery(100), recoveryAfter: distanceRecovery(25, "WALK") }),
        segment("tail-in-set", { work: distance(100) }),
      ], { repeatCount: 2, recoveryBetweenRepeats: distanceRecovery(300, "JOG"), recoveryAfter: distanceRecovery(7, "WALK_OR_JOG") }),
      segment("after-sets", { work: distance(100) }),
    ]))

    expect(deriveSequenceRecoveryDistanceTotals(nested)).toStrictEqual({
      repetitionRecoveryTotalDistanceM: 200,
      setRecoveryTotalDistanceM: 300,
      transitionRecoveryTotalDistanceM: 57,
      terminalRecoveryDistanceM: 0,
      plannedRecoveryDistanceM: 557,
    })
    expect(deriveSequenceTotals(nested)).toMatchObject({
      repetitionRecoveryOccurrences: 2,
      setRecoveryOccurrences: 1,
      transitionRecoveryOccurrences: 3,
      repetitionRecoveryTotalSeconds: null,
      setRecoveryTotalSeconds: null,
      transitionRecoveryTotalSeconds: null,
      plannedRecoverySeconds: null,
    })
  })

  it("keeps time-only or unknown moving recovery distance unavailable, while no recovery remains zero", () => {
    const timeOnly = parsed(v2([segment("time-only", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(60, "JOG") })]))
    const unknownMoving = parsed(v2([segment("unknown-moving", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(null, "ACTIVE_ROLL_ON") })]))
    const continuous = parsed(v2([segment("continuous", { repeatCount: 3 })]))

    expect(deriveSequenceTotals(timeOnly)).toMatchObject({ repetitionRecoveryTotalSeconds: 60 })
    expect(deriveSequenceRecoveryDistanceTotals(timeOnly)).toMatchObject({ repetitionRecoveryTotalDistanceM: null, plannedRecoveryDistanceM: null })
    expect(deriveSequenceTotals(unknownMoving)).toMatchObject({ repetitionRecoveryTotalSeconds: null })
    expect(deriveSequenceRecoveryDistanceTotals(unknownMoving)).toMatchObject({ repetitionRecoveryTotalDistanceM: null, plannedRecoveryDistanceM: null })
    expect(deriveSequenceRecoveryDistanceTotals(continuous)).toStrictEqual({
      repetitionRecoveryTotalDistanceM: 0,
      setRecoveryTotalDistanceM: 0,
      transitionRecoveryTotalDistanceM: 0,
      terminalRecoveryDistanceM: 0,
      plannedRecoveryDistanceM: 0,
    })
  })

  it("roundtrips v1 unchanged and accepts v2 time/no-recovery shapes without a distance field", () => {
    const legacy = v1([segment("legacy", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(60, "JOG") })])
    const versionTwoTimeOnly = v2([segment("v2-time", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(60, "JOG") })])
    const versionTwoTerminalTime = parsed({ ...versionTwoTimeOnly, terminalRecovery: timeRecovery(30, "JOG") })

    expect(parsed(JSON.parse(JSON.stringify(legacy)))).toStrictEqual(legacy)
    expect(deriveSequenceTotals(parsed(legacy))).not.toHaveProperty("terminalRecoveryOccurrences")
    expect(parsed(JSON.parse(JSON.stringify(versionTwoTimeOnly)))).toStrictEqual(versionTwoTimeOnly)
    expect(deriveSequenceTotals(versionTwoTerminalTime)).toMatchObject({
      repetitionRecoveryTotalSeconds: 60,
      terminalRecoveryOccurrences: 1,
      terminalRecoveryTotalSeconds: 30,
      plannedRecoverySeconds: 90,
    })
    expect(deriveSequenceRecoveryDistanceTotals(versionTwoTerminalTime)).toMatchObject({
      repetitionRecoveryTotalDistanceM: null,
      terminalRecoveryDistanceM: null,
      plannedRecoveryDistanceM: null,
    })
    expect(parsed(v2([segment("no-recovery", { repeatCount: 2 })]))).toMatchObject({ version: 2 })
    expect(parsed(v2()).terminalRecovery).toStrictEqual(none)
    const missingTerminal: Record<string, unknown> = { ...v2() }
    delete missingTerminal["terminalRecovery"]
    rejected(missingTerminal)
    rejected({ ...legacy, terminalRecovery: none })
  })

  it("rejects v1 distance or ACTIVE_ROLL_ON and v2 distance/time or non-moving distance modes", () => {
    rejected(rawRecoverySequence(1, { mode: "JOG", seconds: null, distanceM: 100 }))
    rejected(rawRecoverySequence(1, { mode: "ACTIVE_ROLL_ON", seconds: null }))
    rejected(rawRecoverySequence(2, { mode: "JOG", seconds: 60, distanceM: 100 }))
    rejected(rawRecoverySequence(2, { mode: "STAND", seconds: null, distanceM: 100 }))
    rejected(rawRecoverySequence(2, { mode: "FULL_RECOVERY", seconds: null, distanceM: 100 }))
    rejected(rawRecoverySequence(2, { mode: "COACH_DEFINED", seconds: null, distanceM: 100 }))
    rejected(rawRecoverySequence(2, { mode: "NOT_APPLICABLE", seconds: null, distanceM: 100 }))
  })

  it.each([0, -1, NaN, Infinity, -Infinity])("rejects non-positive or non-finite distance recovery: %s", (distanceM) => {
    rejected(rawRecoverySequence(2, { mode: "WALK", seconds: null, distanceM }))
  })

  it("retains known distance overflow validation when an earlier moving recovery is unknown", () => {
    const max = Number.MAX_SAFE_INTEGER
    rejected(v2([
      segment("unknown", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(null, "JOG") }),
      segment("first-known", { repeatCount: 2, recoveryBetweenRepeats: distanceRecovery(max) }),
      segment("second-known", { repeatCount: 2, recoveryBetweenRepeats: distanceRecovery(max) }),
    ]))
    rejected({
      ...v2([
        segment("unknown", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(null, "JOG") }),
        segment("known", { repeatCount: 2, recoveryBetweenRepeats: distanceRecovery(max) }),
      ]),
      terminalRecovery: distanceRecovery(max),
    })
  })

  it("distinguishes recovery distance and unit changes after unary wrapper normalization", () => {
    const leaf = segment("reps", { repeatCount: 2, recoveryBetweenRepeats: distanceRecovery(100) })
    const base = parsed(v2([leaf]))
    const sameWrapper = parsed(v2([group("same-wrapper", [{ ...leaf, repeatCount: 7 }], {
      repeatCount: 3, recoveryBetweenRepeats: distanceRecovery(100),
    })]))
    const changedWrapper = parsed(v2([group("changed-wrapper", [{ ...leaf, repeatCount: 7 }], {
      repeatCount: 3, recoveryBetweenRepeats: distanceRecovery(200),
    })]))
    const before = JSON.stringify(base)
    const distanceChanged = JSON.parse(before) as { main: Array<{ recoveryBetweenRepeats: { distanceM: number } }> }
    distanceChanged.main[0]!.recoveryBetweenRepeats.distanceM = 200
    const timeUnit = parsed(v2([segment("time-unit", { repeatCount: 2, recoveryBetweenRepeats: timeRecovery(100, "ACTIVE_ROLL_ON") })]))

    expect(compareMainMethods(base, sameWrapper)).toEqual({ kind: "same", requiresReview: false })
    expect(compareMainMethods(base, changedWrapper)).toEqual({ kind: "different", requiresReview: true })
    expect(compareMainMethods(base, parsed(distanceChanged))).toEqual({ kind: "different", requiresReview: true })
    expect(compareMainMethods(base, timeUnit)).toEqual({ kind: "different", requiresReview: true })
    const v1WithoutTerminal = parsed(v1([segment("same-main")]))
    const v2WithoutTerminal = parsed(v2([segment("same-main")]))
    const v2WithTerminal = parsed({ ...v2([segment("same-main")]), terminalRecovery: distanceRecovery(100) })
    expect(compareMainMethods(v1WithoutTerminal, v2WithoutTerminal)).toEqual({ kind: "same", requiresReview: false })
    expect(compareMainMethods(v1WithoutTerminal, v2WithTerminal)).toEqual({ kind: "different", requiresReview: true })
    expect(JSON.stringify(base)).toBe(before)
  })
})
