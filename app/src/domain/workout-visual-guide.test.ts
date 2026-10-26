import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"
import { createGoalTrainingProgramPreview } from "./goal-training-program"
import { memoSessionFixture } from "./workout-memo.test-fixtures"
import { buildWorkoutVisualGuide } from "./workout-visual-guide"
import type { WorkoutMemoSession } from "./workout-memo"
import type { AdjustedSegmentTarget } from "./adjusted-method-resolution"

beforeEach(async () => { await initializeCanonicalJournalFixture() })
afterEach(() => localStorage.clear())

function catalogSession() {
  const result = createGoalTrainingProgramPreview({ goalMinutes: 60, dateChoice: { kind: "START", startDate: "2026-10-26" },
    today: "2026-10-26", generatedAt: "2026-10-26T00:00:00.000Z", experienceBand: "NEW_TO_RUNNING",
    availableDayCount: 3, trainingTimePreference: "VARIES", goalPaceConfirmed: false })
  if (result.kind !== "preview") throw Error(result.kind)
  return result.preview.days.find(day => day.session.role !== "REST")!.session
}

const v3: PrescriptionSequenceV3 = {
  kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "visual-test", label: null,
  warmup: [{ kind: "segment", id: "prepare", label: "준비", role: "PREPARATION", repeatCount: 1,
    work: { kind: "duration", durationSeconds: 600, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: "RPE 3" }, recoveryBetweenRepeats: [], recoveryAfter: [] }],
  main: [{ kind: "group", id: "sets", label: null, repeatUnit: "SET", repeatCount: 2,
    recoveryBetweenRepeats: [{ mode: "STAND", seconds: 90 }, { mode: "WALK", seconds: 60 }], recoveryAfter: [{ mode: "STAND", seconds: 120 }],
    children: [{ kind: "segment", id: "work", label: null, role: "WORK", repeatCount: 2,
      work: { kind: "distance", distanceM: 100, durationSeconds: null }, target: { kind: "EFFORT_GUIDANCE", cue: "RPE 7 · 자세가 무너지면 중단" },
      recoveryBetweenRepeats: [{ mode: "JOG", seconds: 30 }], recoveryAfter: [{ mode: "WALK", seconds: null, distanceM: 200 }] }] }],
  cooldown: [{ kind: "segment", id: "cool", label: "정리", role: "PREPARATION", repeatCount: 1,
    work: { kind: "duration", durationSeconds: 300, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: "RPE 2" }, recoveryBetweenRepeats: [], recoveryAfter: [] }],
}
function adjusted(sequence = v3, segmentTargets: readonly AdjustedSegmentTarget[] = []): WorkoutMemoSession {
  return { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "VO2_INTENT", prescription: {
    kind: "ADJUSTED_METHOD_V3", projection: { sequence, segmentTargets },
  } }
}

describe("read-only workout visual guide", () => {
  it("uses the real catalog occurrence order without inventing support, duration or a pace", () => {
    const session = catalogSession(), before = JSON.stringify(session)
    const guide = buildWorkoutVisualGuide(session, { date: "2026-10-26", state: "PREVIEW" })!
    expect(guide.steps.map(step => [step.label, step.amount])).toEqual([
      ["달리기", "10분"], ["걷기", "1분"], ["달리기", "10분"], ["걷기", "1분"], ["달리기", "10분"],
    ])
    expect(guide.contextLabel).toContain("적용 전 계획안")
    expect(guide.steps.every(step => step.phase === "main")).toBe(true)
    expect(JSON.stringify(guide)).not.toContain("목표 기록 기준")
    expect(JSON.stringify(session)).toBe(before)
    expect(buildWorkoutVisualGuide(session, { date: "2026-10-27" })!.id).not.toBe(guide.id)
  })

  it("keeps N-1 repetition recovery and replaces it with set recovery at boundaries for pace plans", () => {
    const session = memoSessionFixture()
    if (session.prescription.kind !== "PACE_TARGET") throw Error("pace fixture")
    const p = session.prescription
    const source = { ...session, prescription: { ...p, sequence: undefined, setCount: 2, repetitionsPerSet: 3,
      repetitionDistanceM: 200, targetRepSeconds: 30.375, repetitionRecoverySeconds: 60, repetitionRecoveryMode: "JOG" as const,
      setRecoverySeconds: 180, setRecoveryMode: "WALK" as const } }
    const before = JSON.stringify(source), guide = buildWorkoutVisualGuide(source)!
    expect(guide.steps.map(step => step.amount)).toEqual(["200m", "1분", "200m", "1분", "200m", "3분", "200m", "1분", "200m", "1분", "200m"])
    expect(guide.steps.filter(step => step.kind === "work")).toHaveLength(6)
    expect(guide.steps[0]!.details).toContain("1회 목표 30.4초")
    expect(JSON.stringify(guide)).not.toContain(p.selectedAnchor.sourceRef)
    const detailed = buildWorkoutVisualGuide(source, {}, { detail: true })!
    expect(detailed.steps.some(step => step.phase === "warmup")).toBe(true)
    expect(detailed.steps.some(step => step.phase === "cooldown")).toBe(true)
    expect(detailed.steps.filter(step => step.phase === "main")).toEqual(guide.steps)
    expect(buildWorkoutVisualGuide({ ...source, prescription: { ...source.prescription, targetRepSeconds: 30.376 } })!.id).not.toBe(guide.id)
    expect(new Set(guide.steps.map(step => step.group)).size).toBe(2)
    expect(JSON.stringify(source)).toBe(before)
  })

  it("preserves multi-step set recovery, distance recovery and unconditional V3 terminal recovery", () => {
    const source = adjusted(), before = JSON.stringify(source)
    const guide = buildWorkoutVisualGuide(source)!
    expect(guide.steps.map(step => step.amount)).toEqual(["100m", "30초", "100m", "200m", "1분 30초", "1분", "100m", "30초", "100m", "200m", "2분"])
    expect(guide.steps.filter(step => step.label === "걷기").map(step => step.amount)).toEqual(["200m", "1분", "200m"])
    expect(guide.steps[0]!.instruction).toContain("자세가 무너지면 중단")
    expect(buildWorkoutVisualGuide(source, {}, { wording: "COACH" })!.steps[0]!.instruction).toContain("자세가 무너지면 중단")
    expect(guide.notes).toContain("연결된 설명을 확인하지 못했어요. 저장된 훈련 내용은 그대로 표시해요.")
    expect(buildWorkoutVisualGuide(source, {}, { detail: true })!.steps).toHaveLength(13)
    expect(JSON.stringify(source)).toBe(before)
  })

  it("does not turn legacy conditional last-node recovery into V3 unconditional recovery", () => {
    const sequence: PrescriptionSequence = { kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "legacy", label: null, warmup: [], cooldown: [],
      main: [{ kind: "segment", id: "work", label: null, repeatCount: 2, work: { kind: "duration", durationSeconds: 60, distanceM: null },
        target: { kind: "EFFORT_GUIDANCE", cue: "RPE 6" }, recoveryBetweenRepeats: { mode: "JOG", seconds: 30 }, recoveryAfter: { mode: "STAND", seconds: 99 } }],
      terminalRecovery: { mode: "WALK", seconds: 45 } }
    const source: WorkoutMemoSession = { day: 1, slot: "AM", role: "QUALITY", plannedEnergyIntent: "LT_INTENT", prescription: { kind: "ADJUSTED_METHOD", snapshot: { projection: { sequence, segmentTargets: [] } } } }
    expect(buildWorkoutVisualGuide(source)!.steps.map(step => step.amount)).toEqual(["1분", "30초", "1분", "45초"])
    const { terminalRecovery: _terminal, ...legacy } = sequence
    expect(buildWorkoutVisualGuide({ ...source, prescription: { kind: "ADJUSTED_METHOD", snapshot: { projection: { sequence: { ...legacy, version: 1 }, segmentTargets: [] } } } })!.steps.map(step => step.amount)).toEqual(["1분", "30초", "1분"])
  })

  it("preserves an explicit sprint reference without replacing it with a derived pace", () => {
    const reference = "최대 속도의 95% 이내 · 동작이 무너지면 중단"
    const sequence = { ...v3, main: [{ ...v3.warmup[0]!, id: "sprint", role: "WORK" as const,
      target: { kind: "SPRINT_REFERENCE" as const, reference } }] } as PrescriptionSequenceV3
    expect(buildWorkoutVisualGuide(adjusted(sequence))!.steps[0]!.details).toEqual([`단거리 수행 기준 · ${reference}`])
  })

  it("refuses stale catalog and pace structure mismatches without partial or fabricated diagrams", () => {
    const session = catalogSession()
    if (session.prescription.kind !== "RPE_TIME_RANGE" || !session.prescription.catalogWorkout) throw Error("catalog fixture")
    expect(buildWorkoutVisualGuide({ ...session, prescription: { ...session.prescription, catalogWorkout: { ...session.prescription.catalogWorkout, calculationFingerprint: "WRONG" } } })).toBeNull()
    expect(buildWorkoutVisualGuide({ ...session, prescription: { ...session.prescription, catalogWorkout: undefined } })).toBeNull()
    const pace = memoSessionFixture()
    if (pace.prescription.kind !== "PACE_TARGET") throw Error("pace fixture")
    expect(buildWorkoutVisualGuide({ ...pace, prescription: { ...pace.prescription, repetitionsPerSet: pace.prescription.repetitionsPerSet + 1 } })).toBeNull()
  })

  it("binds saved adjusted targets to exact segment amounts and rejects missing, duplicate and mismatched targets", () => {
    const sequence = { ...v3, main: [{ ...v3.warmup[0]!, id: "paced", role: "WORK" as const, work: { kind: "distance" as const, distanceM: 100, durationSeconds: null },
      target: { kind: "RACE_PACE" as const, eventDistanceM: 5000, anchorRef: "PRIVATE_RECORD_REFERENCE" } }] } as PrescriptionSequenceV3
    const target: AdjustedSegmentTarget = { segmentId: "paced", kind: "CURRENT_SAME_EVENT_RACE_PACE", secondsPerKm: 240, targetRepSeconds: 24, distanceM: 100, fixedWorkSeconds: null, missing: null }
    const guide = buildWorkoutVisualGuide(adjusted(sequence, [target]))!
    expect(guide.steps[0]!.details).toContain("1회 목표 24초")
    expect(JSON.stringify(guide)).not.toContain("PRIVATE_RECORD_REFERENCE")
    for (const targets of [[], [target, target], [{ ...target, distanceM: 200 }], [{ ...target, fixedWorkSeconds: 60 }], [{ ...target, segmentId: "other" }], [{ ...target, targetRepSeconds: Number.NaN }]]) {
      expect(buildWorkoutVisualGuide(adjusted(sequence, targets))).toBeNull()
    }
  })

  it("falls back atomically for an excessively expanded display rather than cutting a prescription", () => {
    const sequence = { ...v3, main: [{ ...v3.main[0]!, repeatCount: 2000 }] }
    expect(buildWorkoutVisualGuide(adjusted(sequence))).toBeNull()
  })
})
