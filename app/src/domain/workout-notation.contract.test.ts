import { describe, expect, it } from "vitest"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequence, PrescriptionSequenceSegment } from "@impl/prescription/sequence"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { notationEffort, notationNumber, notationPace, sequenceNotation, sequenceWorkoutName, sessionWorkoutNotation } from "./workout-notation"
import { adjustedPlanSelectionFixture } from "./adjusted-plan-selection.test-fixtures"
import { selectAdjustedPlanForActivation } from "./adjusted-plan-selection"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"

const segment = (overrides: Partial<Extract<SequenceNodeV3, { kind: "segment" }>> = {}): Extract<SequenceNodeV3, { kind: "segment" }> => ({
  kind: "segment", id: "main", label: "SOURCE LABEL MUST NOT CHANGE", role: "WORK", repeatCount: 1,
  work: { kind: "duration", durationSeconds: 1200, distanceM: null },
  target: { kind: "EFFORT_GUIDANCE", cue: "고르게 유지 · RPE 6~7" },
  recoveryBetweenRepeats: [], recoveryAfter: [], ...overrides,
})
const sequence = (main: readonly SequenceNodeV3[]): PrescriptionSequenceV3 => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "SYNTHETIC", label: "20분 연속", warmup: [], main, cooldown: [],
})

describe("display-only workout notation", () => {
  it("names the actual LT method and retains total versus main duration", () => {
    const continuous = sequence([segment()])
    expect(sequenceWorkoutName(continuous, "LT_INTENT")).toBe("템포런 · Tempo Run")
    expect(sequenceNotation(continuous)).toBe("20min @ RPE 6–7")
    const split = sequence([segment({ repeatCount: 2, work: { kind: "duration", durationSeconds: 600, distanceM: null },
      recoveryBetweenRepeats: [{ mode: "JOG", seconds: 60 }] })])
    expect(sequenceWorkoutName(split, "LT_INTENT")).toBe("크루즈 인터벌 · Cruise Intervals")
    expect(sequenceNotation(split)).toBe("2 × 10min @ RPE 6–7 · r60s Jog")
    expect(sessionWorkoutNotation({ role: "EASY", plannedEnergyIntent: "BASE_INTENT", prescription: {
      kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 35, maximum: 35 }, rpe: { minimum: 3, maximum: 4 },
    } })).toBe("전체 35min @ RPE 3–4")
  })
  it("distinguishes repetition rest, set rest and unconditional terminal rest without adding a final r", () => {
    const source = sequence([{ kind: "group", id: "set", label: null, repeatUnit: "SET", repeatCount: 2,
      recoveryBetweenRepeats: [{ mode: "WALK", seconds: 180 }], recoveryAfter: [], children: [segment({ repeatCount: 10,
        work: { kind: "distance", distanceM: 400, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
        recoveryBetweenRepeats: [{ mode: "JOG", seconds: 60 }],
      })] }])
    const before = canonicalJsonFingerprint("display-test", source)
    expect(sequenceNotation(source)).toBe("2 sets × (10 × 400m @ 5K RP · r60s Jog) · R3min Walk")
    expect(canonicalJsonFingerprint("display-test", source)).toBe(before)
    expect(source.main[0]!.label).toBeNull()
    expect(sequenceNotation(sequence([segment({ recoveryAfter: [{ mode: "STAND", seconds: 20 }] })])))
      .toBe("20min @ RPE 6–7 → 종료 뒤 20s Stand")
  })
  it("preserves V1/V2 conditional recovery and V2 terminal recovery", () => {
    const old: PrescriptionSequenceSegment = { kind: "segment", id: "a", label: null, repeatCount: 1,
      work: { kind: "distance", distanceM: 1000, durationSeconds: null }, target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
      recoveryBetweenRepeats: { mode: "NOT_APPLICABLE", seconds: null }, recoveryAfter: { mode: "JOG", seconds: 60 } }
    const source: PrescriptionSequence = { kind: "PRESCRIPTION_SEQUENCE", version: 1, id: "legacy", label: null,
      warmup: [], main: [old, { ...old, id: "b" }], cooldown: [] }
    expect(sequenceNotation(source)).toBe("1km @ 5K RP → 종료 뒤 60s Jog → 1km @ 5K RP")
    expect(sequenceNotation({ ...source, version: 2, main: [old], terminalRecovery: { mode: "WALK", seconds: 180 } }))
      .toBe("1km @ 5K RP → 마지막 본운동 뒤 3min Walk")
  })
  it("does not convert distance recovery, missing duration or mixed work into invented totals", () => {
    const source = sequence([segment({ repeatCount: 3,
      work: { kind: "distance", distanceM: 300, durationSeconds: null },
      recoveryBetweenRepeats: [{ mode: "ACTIVE_ROLL_ON", distanceM: 100, seconds: null }] }),
    segment({ id: "unknown", work: { kind: "duration", durationSeconds: null, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: null } })])
    expect(sequenceNotation(source)).toBe("3 × 300m @ RPE 6–7 · r100m Roll-on → 시간 미지정 @ 강도 미지정")
  })
  it("uses only matching existing numeric targets and marks display rounding", () => {
    const source = sequence([segment({ work: { kind: "distance", distanceM: 200, durationSeconds: null },
      target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: "synthetic" } })])
    const target = { kind: "CURRENT_SAME_EVENT_RACE_PACE" as const, segmentId: "main", secondsPerKm: 171.25,
      targetRepSeconds: 34.25, distanceM: 200, fixedWorkSeconds: null, missing: null }
    expect(sequenceNotation(source, [target])).toBe("200m @ 34.3s/200m · 800m RP")
    expect(sequenceNotation(source, [{ ...target, targetRepSeconds: 59.999999 }])).toBe("200m @ 60s/200m · 800m RP")
    expect(sequenceNotation(source, [{ ...target, segmentId: "elsewhere" }])).toBe("200m @ 800m RP")
    expect(sequenceNotation(source, [{ ...target, distanceM: 400 }])).toBe("200m @ 800m RP")
    expect(notationNumber(34.25123)).toBe("≈34.251")
    expect(notationPace(239.8)).toBe("≈4:00/km")
    expect(target.targetRepSeconds).toBe(34.25)
  })
  it.each(["RPE 12", "RPE 6–12", "RPE 7–6", "RPE 6.5", "RPE 6 / RPE 8", "거리 기준 없음"])("does not simplify ambiguous or invalid effort: %s", cue => {
    expect(notationEffort(cue)).toBe(cue)
  })
  it("keeps the actual legacy adjusted source immutable and produces a reusable summary", () => {
    const { request, policy } = adjustedPlanSelectionFixture()
    const selected = selectAdjustedPlanForActivation(request, [policy], TODAY)
    if (selected.kind !== "selected_adjusted") throw Error(selected.code)
    const source = selected.state.activePlan.sessions.find(item => item.prescription.kind === "ADJUSTED_METHOD")!
    const before = JSON.stringify(source)
    const summary = sessionWorkoutNotation(source)
    expect(summary).toContain("2 × 400m")
    expect(summary).toContain("r17s")
    expect(summary).not.toContain("1000m")
    expect(JSON.stringify(source)).toBe(before)
  })
  it.each(["repeat", "work", "rest", "target"])("changes the displayed prescription when %s changes instead of retaining stale text", field => {
    const original = segment({ repeatCount: 2, recoveryBetweenRepeats: [{ mode: "JOG", seconds: 60 }] })
    const altered = field === "repeat" ? { ...original, repeatCount: 3 }
      : field === "work" ? { ...original, work: { kind: "duration" as const, durationSeconds: 480, distanceM: null } }
        : field === "rest" ? { ...original, recoveryBetweenRepeats: [{ mode: "WALK" as const, seconds: 90 }] }
          : { ...original, target: { kind: "EFFORT_GUIDANCE" as const, cue: "RPE 5" } }
    expect(sequenceNotation(sequence([altered]))).not.toBe(sequenceNotation(sequence([original])))
  })
})
