import { afterEach, describe, expect, it } from "vitest"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { bindDefaultCatalogSessions } from "@impl/prescription/catalog-session-binding"
import { buildWorkoutMemo, workoutMemoText, type WorkoutMemoSession } from "./workout-memo"
import { wrapMemoText, memoFileName } from "./workout-memo-export"
import { memoSessionFixture } from "./workout-memo.test-fixtures"
import { memoDisplayLines, memoLineEmphasis, presentWorkoutMemo, workoutMemoPresentationText } from "./workout-memo-presentation"
import { notationEffort, sequencePhaseNotation } from "./workout-notation"

afterEach(() => localStorage.clear())
const rpe: WorkoutMemoSession = { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT", prescription: {
  kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 35, maximum: 35 }, rpe: { minimum: 3, maximum: 4 },
} }

describe("workout memo snapshot contract", () => {
  it("exports exact repeats, set and repeat recovery modes, support and stop rules without mutating the prescription", () => {
    const session = memoSessionFixture()
    if (session.prescription.kind !== "PACE_TARGET") throw Error("Expected detailed fixture")
    const p = session.prescription
    const source = { ...session, prescription: { ...p, setCount: 2, repetitionsPerSet: 3, repetitionDistanceM: 200,
      targetRepSeconds: 30.375, repetitionRecoverySeconds: 60, repetitionRecoveryMode: "JOG" as const,
      setRecoverySeconds: 180, setRecoveryMode: "WALK" as const } }
    const before = JSON.stringify(source)
    const memo = buildWorkoutMemo(source, { date: "2026-09-20", state: "PLAN" })!
    const text = workoutMemoText(memo)
    expect(text).toContain("2026.09.20 (일) · 오후")
    expect(text).toContain("2 세트 × (3 × 200m)")
    expect(text).toContain("@ 30.4s/200m")
    expect(text).toContain("반복 사이: 60초 조깅")
    expect(text).toContain("세트 사이: 3분 걷기")
    expect(text).toContain("준비:"); expect(text).toContain("정리:")
    expect(text).toContain("새 통증이나 심해지는 통증이 생기면 중단")
    expect(text).not.toContain(p.selectedAnchor.sourceRef)
    expect(text).not.toContain(p.selectedAnchor.achievedAt)
    expect(text).not.toContain("실제 6회 완료")
    expect(JSON.stringify(source)).toBe(before)
  })
  it("does not reload latest records or confuse planned with achieved targets", () => {
    const session = memoSessionFixture()
    const before = buildWorkoutMemo(session, { state: "HISTORICAL" })!
    localStorage.setItem("some-new-record", JSON.stringify({ seconds: 60, memo: "PRIVATE_RAW_NOTE" }))
    expect(buildWorkoutMemo(session, { state: "HISTORICAL" })).toEqual(before)
    expect(workoutMemoText(before)).toContain("당시 계획 · 실제 수행 기록 아님")
    expect(workoutMemoText(before)).not.toContain("PRIVATE_RAW_NOTE")
  })
  it("keeps unknown dates and stale catalog bindings explicit without inventing a pace", () => {
    const bound = bindDefaultCatalogSessions([rpe as Parameters<typeof bindDefaultCatalogSessions>[0][number]], 5000, "EXPERIENCED", 0)[0]!
    if (bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) throw Error("Expected catalog fixture")
    const source = { ...bound, prescription: { ...bound.prescription, catalogWorkout: { ...bound.prescription.catalogWorkout, calculationFingerprint: "wrong" } } }
    const memo = buildWorkoutMemo(source, { date: "2026-02-30" })!
    expect(memo.date).toBeNull()
    expect(memo.dateLabel).toContain("날짜 미지정")
    expect(memo.title).toBe("저장된 훈련")
    expect(memo.warnings.some(text => text.includes("세부 구성"))).toBe(true)
    expect(workoutMemoText(memo)).not.toContain("/km")
  })
  it("retains compact exact duration versus a range and does not add support not in the source", () => {
    expect(workoutMemoText(buildWorkoutMemo(rpe)!)).toContain("35분 · 힘든 정도 3–4/10")
    expect(buildWorkoutMemo(rpe)!.lines).toHaveLength(1)
    const source = { ...rpe, prescription: { kind: "RPE_TIME_RANGE" as const, durationMinutes: { minimum: 20, maximum: 30 }, rpe: { minimum: 2, maximum: 3 } } }
    expect(workoutMemoText(buildWorkoutMemo(source)!)).toContain("20–30분 · 힘든 정도 2–3/10")
  })
  it("keeps mixed per-segment targets and unconditional terminal recovery in V3", () => {
    const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "synthetic", label: null, warmup: [], cooldown: [], main: [
      { kind: "segment", role: "WORK", id: "a", label: null, repeatCount: 1, work: { kind: "distance", distanceM: 200, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: null }, recoveryBetweenRepeats: [], recoveryAfter: [{ mode: "STAND", seconds: 17 }] },
      { kind: "segment", role: "WORK", id: "b", label: null, repeatCount: 1, work: { kind: "duration", durationSeconds: 120, distanceM: null },
        target: { kind: "RACE_PACE", eventDistanceM: 10000, anchorRef: null }, recoveryBetweenRepeats: [], recoveryAfter: [{ mode: "JOG", seconds: 31 }] },
    ] }
    const source: WorkoutMemoSession = { day: 2, slot: "AM", role: "QUALITY", plannedEnergyIntent: "MIXED_INTENT", prescription: {
      kind: "ADJUSTED_METHOD_V3", projection: { sequence, segmentTargets: [
        { segmentId: "a", kind: "CURRENT_SAME_EVENT_RACE_PACE", secondsPerKm: 160, targetRepSeconds: 32, fixedWorkSeconds: null, distanceM: 200, missing: null },
        { segmentId: "b", kind: "CURRENT_SAME_EVENT_RACE_PACE", secondsPerKm: 240, targetRepSeconds: null, fixedWorkSeconds: 120, distanceM: null, missing: null },
      ] } } }
    const text = workoutMemoText(buildWorkoutMemo(source)!)
    expect(text).toContain("32초/200m · 800m 경기 평균 페이스")
    expect(text).toContain("2분 @ 4:00/km · 10K 경기 평균 페이스")
    expect(text).toContain("종료 뒤 17초 서서 쉬기")
    expect(text).toContain("종료 뒤 31초 조깅")
    expect(text).not.toContain("500m")
  })
  it("uses current catalog bindings without manufacturing targets and preserves preparation", () => {
    const source = bindDefaultCatalogSessions([rpe as Parameters<typeof bindDefaultCatalogSessions>[0][number]], 5000, "EXPERIENCED", 0)[0]!
    const memo = buildWorkoutMemo(source)!
    expect(memo.lines.find(line => line.label === "본운동")).toBeDefined()
    expect(memo.basis).toBe("구간에 적힌 힘든 정도")
  })
  it("marks unapplied changes and does not guess today's date", () => {
    const memo = buildWorkoutMemo(rpe, { state: "PREVIEW" })!
    expect(memo.stateLabel).toBe("계획안 · 아직 적용 전")
    expect(memoFileName(memo)).toBe("trainoracle-workout-undated-am.png")
  })
  it("handles corrupt or absent prescriptions without crashing the reader", () => {
    expect(buildWorkoutMemo({ ...rpe, prescription: undefined })).toBeNull()
    const source = memoSessionFixture()
    expect(buildWorkoutMemo({ ...source, prescription: { ...source.prescription, kind: "PACE_TARGET", targetRepSeconds: NaN } } as unknown as WorkoutMemoSession)).toBeNull()
  })
  it("rejects fractional repeats, invalid recovery and malformed support instead of exporting plausible training", () => {
    const source = memoSessionFixture()
    if (source.prescription.kind !== "PACE_TARGET") throw Error("Expected detailed fixture")
    for (const patch of [{ setCount: 0.5 }, { repetitionsPerSet: 2.5 }, { repetitionRecoverySeconds: NaN },
      { setRecoverySeconds: -1 }, { targetEventDistanceM: Infinity }]) {
      expect(buildWorkoutMemo({ ...source, prescription: { ...source.prescription, ...patch } })).toBeNull()
    }
    expect(buildWorkoutMemo({ ...source, prescription: { ...source.prescription, operationalComponents: {
      ...source.prescription.operationalComponents, cooldown: { ...source.prescription.operationalComponents.cooldown, easyDurationMinutes: NaN },
    } } } as unknown as WorkoutMemoSession)).toBeNull()
  })
  it("does not add strides when the stored preparation has no strides", () => {
    const source = memoSessionFixture()
    if (source.prescription.kind !== "PACE_TARGET") throw Error("Expected detailed fixture")
    const text = workoutMemoText(buildWorkoutMemo({ ...source, prescription: { ...source.prescription, operationalComponents: {
      ...source.prescription.operationalComponents, warmup: { ...source.prescription.operationalComponents.warmup,
        strides: { ...source.prescription.operationalComponents.warmup.strides, repetitions: 0 } },
    } } } as unknown as WorkoutMemoSession)!)
    expect(text).toContain("준비:")
    expect(text).not.toContain("가속 달리기")
  })
  it("uses the actual rest prescription rather than an inconsistent session-role title", () => {
    const source: WorkoutMemoSession = { ...rpe, role: "QUALITY", prescription: { kind: "REST" } }
    expect(buildWorkoutMemo(source)!.title).toBe("휴식")
  })
  it("makes compact a layout only; every step, basis, state and safety rule survive copy/export presentation", () => {
    const memo = buildWorkoutMemo(memoSessionFixture(), { date: "2026-09-20", state: "HISTORICAL" })!
    const before = JSON.stringify(memo)
    const full = presentWorkoutMemo(memo, "full"), compact = presentWorkoutMemo(memo, "compact")
    for (const line of memo.lines) {
      expect(workoutMemoPresentationText(compact)).toContain(line.text)
      expect(workoutMemoPresentationText(full)).toContain(line.text)
    }
    expect(compact.lines).toEqual(full.lines)
    expect(compact.warnings).toEqual(full.warnings)
    expect(compact.basis).toBe(full.basis)
    expect(compact.stateLabel).toBe(full.stateLabel)
    expect(memoLineEmphasis(full, 1)).toBe(true)
    expect(memoLineEmphasis(compact, 1)).toBe(false)
    expect(JSON.stringify(memo)).toBe(before)
  })
  it("keeps a safety qualifier while replacing RPE with plain language", () => {
    expect(notationEffort("RPE 3–4 · 통증이 생기면 중단", "PLAIN")).toBe("힘든 정도 3–4/10 · 통증이 생기면 중단")
    expect(notationEffort("PROGRESSIVE_NOT_ALL_OUT", "PLAIN")).toBe("가속 달리기 (전력질주 아님)")
  })
  it("does not change legacy coach notation when the plain-language style is not requested", () => {
    const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "style", label: null, warmup: [], cooldown: [], main: [
      { kind: "segment", role: "WORK", id: "a", label: null, repeatCount: 2, work: { kind: "duration", durationSeconds: 120, distanceM: null },
        target: { kind: "EFFORT_GUIDANCE", cue: "RPE 3–4" }, recoveryBetweenRepeats: [{ mode: "WALK", seconds: 60 }], recoveryAfter: [] },
    ] }
    expect(sequencePhaseNotation(sequence, "main")).toBe("2 × 2min @ RPE 3–4 · r60s Walk")
    expect(sequencePhaseNotation(sequence, "main", [], "PLAIN")).toBe("2 × 2분 @ 힘든 정도 3–4/10 · 반복 사이 60초 걷기")
  })
  it("validates adjusted sequences and computed targets using the established parsers before presentation", () => {
    const sequence: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "validated", label: null, warmup: [], cooldown: [], main: [
      { kind: "segment", role: "WORK", id: "a", label: null, repeatCount: 2, work: { kind: "distance", distanceM: 200, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: null }, recoveryBetweenRepeats: [{ mode: "WALK", seconds: 60 }], recoveryAfter: [] },
    ] }
    const projection = { sequence, segmentTargets: [{ segmentId: "a", kind: "CURRENT_SAME_EVENT_RACE_PACE" as const,
      secondsPerKm: 160, targetRepSeconds: 32, fixedWorkSeconds: null, distanceM: 200, missing: null }] }
    const source: WorkoutMemoSession = { ...rpe, prescription: { kind: "ADJUSTED_METHOD_V3", projection } }
    expect(buildWorkoutMemo(source)).not.toBeNull()
    expect(buildWorkoutMemo({ ...source, prescription: { kind: "ADJUSTED_METHOD_V3", projection: {
      ...projection, sequence: { ...sequence, main: [{ ...sequence.main[0]!, repeatCount: 1.5 }] },
    } } })).toBeNull()
    expect(buildWorkoutMemo({ ...source, prescription: { kind: "ADJUSTED_METHOD_V3", projection: {
      ...projection, segmentTargets: [{ ...projection.segmentTargets[0]!, targetRepSeconds: NaN }],
    } } })).toBeNull()
  })
  it("wraps long text without dropping symbols, Korean or the final recovery", () => {
    const text = "2sets×(3×200m)→회복31sJog"
    const lines = wrapMemoText(text, 5, value => Array.from(value).length)
    expect(lines.every(line => Array.from(line).length <= 5)).toBe(true)
    expect(lines.join("")).toBe(text)
  })
  it("preserves every prescription value and stop rule in all four depth views", () => {
    const memo = buildWorkoutMemo(memoSessionFixture())!
    for (const view of ["core", "standard", "method", "explained"] as const) {
      const presentation = presentWorkoutMemo(memo, view), text = workoutMemoPresentationText(presentation)
      for (const line of memo.lines) expect(text).toContain(line.text)
      for (const warning of memo.warnings) expect(text).toContain(warning)
      expect(text).toContain(memo.stateLabel)
      expect(text).toContain(memo.basis!)
    }
    expect(memoDisplayLines(presentWorkoutMemo(memo, "core")).length).toBeLessThan(memo.lines.length)
    expect(memoDisplayLines(presentWorkoutMemo(memo, "method"))[0]!.label).toBe("준비")
    expect(workoutMemoPresentationText(presentWorkoutMemo(memo, "standard"))).not.toContain("에너지 공급:")
    expect(workoutMemoPresentationText(presentWorkoutMemo(memo, "explained"))).toContain("에너지 공급:")
  })
  it("keeps actual numbers unchanged when switching plain and coach wording", () => {
    const session = memoSessionFixture()
    const plain = buildWorkoutMemo(session)!, coach = buildWorkoutMemo(session, {}, "COACH")!
    const numbers = (memo: typeof plain) => memo.lines.flatMap(line => line.text.match(/\d+(?:\.\d+)?/gu) ?? [])
    // Plain RPE includes /10; this is a scale label, not a prescription change.
    expect(coach.lines.find(line => line.label === "준비")!.text).toContain("RPE 2–3")
    expect(plain.lines.find(line => line.label === "준비")!.text).toContain("힘든 정도 2–3/10")
    expect(numbers(coach)).toEqual(numbers({ ...plain, lines: plain.lines.map(line => ({ ...line, text: line.text.replaceAll("/10", "") })) }))
  })
})
