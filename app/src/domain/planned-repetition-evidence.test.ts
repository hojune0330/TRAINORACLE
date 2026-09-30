import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { comparePlannedRepetitions, plannedRepetitionEvidenceSchema, plannedRepeatRecovery } from "./planned-repetition-evidence"
import { REPETITION_TEST_NOW, repetitionFixture } from "./planned-repetition.test-fixture"
import { reviewPlanExecution } from "./plan-execution-review"
import { exerciseLogSchema } from "./exercise-log"
import { executionReplanEvidence, replanFingerprint } from "./execution-replan"
import { parseJournalEntryForWrite } from "./journal-schema"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(REPETITION_TEST_NOW) })
afterEach(() => vi.useRealTimers())

describe("original prescription to explicit repetition evidence", () => {
  it("compares fractional targets, never all-session pace, and does not turn missing repetitions into failures", () => {
    const f = repetitionFixture()
    const report = comparePlannedRepetitions(f.evidence, f.link, f.session)
    expect(f.prescription.targetRepSeconds).toBeCloseTo(222.3, 10)
    expect(report).toMatchObject({ kind: "compared", completeDistanceCount: 1, timedCount: 1 })
    expect(report.facts.join(" ")).toContain("1/5회")
    expect(report.unknowns.join(" ")).toContain("자동으로 실패 처리하지")
    const reviewed = reviewPlanExecution({ ...f.entry, distanceKm: "10", durationMin: "60", avgPace: "6:00" }, f.original)
    expect(reviewed.repetitionComparison).toEqual(report)
    expect(JSON.stringify(reviewed)).not.toMatch(/PRIVATE-MEMO|PRIVATE-TITLE|6:00/)
  })
  it("does not substitute a changed distance or a missing distance into target-time comparison", () => {
    const f = repetitionFixture()
    const report = comparePlannedRepetitions({ ...f.evidence, results: [
      { set: 1, repetition: 1, distanceM: 400, seconds: 88 }, { set: 1, repetition: 2, seconds: 222 },
    ] }, f.link, f.session)
    expect(report.timedCount).toBe(0)
    expect(report.facts.join(" ")).toContain("목표 초와 비교하지")
  })
  it("preserves zero reported rest, requires next-work evidence and compares recovery mode separately", () => {
    const f = repetitionFixture()
    const report = comparePlannedRepetitions({ ...f.evidence, results: [
      { set: 1, repetition: 1, distanceM: 1000, seconds: 222, recoverySeconds: 0, recoveryMode: "STAND" },
      { set: 1, repetition: 2, distanceM: 1000, seconds: 225, recoverySeconds: 300, recoveryMode: "WALK" },
    ] }, f.link, f.session)
    expect(report.facts.join(" ")).toContain("실제 0초 서서 쉬기")
    expect(report.facts.join(" ")).not.toContain("실제 300초")
    expect(report.unknowns.join(" ")).toContain("다음 반복의 거리 기록이 없어")
    expect(report.changed).toBe(true)
    expect(report.interpretation).toContain("회복 조건이 계획과 달랐어요")
  })
  it("uses set recovery instead of adding both recoveries, and no final extra rest", () => {
    const f = repetitionFixture()
    const p = { ...f.prescription, setCount: 2, repetitionsPerSet: 3, setRecoverySeconds: 240, setRecoveryMode: "JOG" as const }
    expect(plannedRepeatRecovery(p, 1, 3)).toEqual({ seconds: 240, mode: "JOG" })
    expect(plannedRepeatRecovery(p, 2, 3)).toBeNull()
  })
  it("shows full-record first/last differences without diagnosing a metabolic capability", () => {
    const f = repetitionFixture()
    const report = comparePlannedRepetitions({ ...f.evidence, results: [220, 222, 224, 228, 232].map((seconds, i) => ({
      set: 1, repetition: i + 1, distanceM: 1000, seconds,
    })) }, f.link, f.session)
    expect(report.facts.join(" ")).toContain("앞 2회 평균 221초 · 뒤 2회 평균 230초")
    expect(report.interpretation).toContain("다음 훈련을 늘리지는 않아요")
    expect(report.interpretation).toContain("앞 구간은 목표보다 빨랐고")
    expect(report.interpretation).toContain("회복 기록이 일부 없어")
  })
  it.each(["duplicate", "out-of-range", "wrong-occurrence", "wrong-fingerprint", "zero-work", "infinite", "extra-text"])("rejects %s evidence", mutation => {
    const f = repetitionFixture(), value = structuredClone(f.evidence)
    if (mutation === "duplicate") value.results.push({ ...value.results[0]! })
    if (mutation === "out-of-range") value.results[0]!.repetition = 6
    if (mutation === "wrong-occurrence") value.plannedSessionId = `sha256:${"a".repeat(64)}`
    if (mutation === "wrong-fingerprint") value.sessionContentFingerprint = `sha256:${"a".repeat(64)}`
    if (mutation === "zero-work") value.results[0]!.seconds = 0
    if (mutation === "infinite") value.results[0]!.seconds = Infinity
    if (mutation === "extra-text") Object.assign(value, { memo: "PRIVATE" })
    expect(comparePlannedRepetitions(value, f.link, f.session).kind).toBe("unavailable")
  })
  it("rejects a posthoc prescription even with the original occurrence identifier", () => {
    const f = repetitionFixture()
    expect(comparePlannedRepetitions(f.evidence, f.link, { ...f.session, prescription: { ...f.prescription, targetRepSeconds: 1 } }).kind).toBe("unavailable")
  })
  it("keeps pain, conflict and non-performance ahead of ability interpretation", () => {
    const f = repetitionFixture()
    expect(reviewPlanExecution({ ...f.entry, painCheckStatus: "SIGNAL_REPORTED" }, f.original)).toMatchObject({ status: "SAFETY_REVIEW" })
    expect(reviewPlanExecution({ ...f.entry, painCheckStatus: "SIGNAL_REPORTED" }, f.original).repetitionComparison).toBeUndefined()
    expect(reviewPlanExecution(f.entry, f.original, true).repetitionComparison).toBeUndefined()
    expect(reviewPlanExecution({ ...f.entry, activityOutcome: "RESTED" }, f.original).repetitionComparison).toBeUndefined()
  })
  it("keeps evidence in the existing exercise-log envelope without inventing empty results", () => {
    const f = repetitionFixture()
    expect(exerciseLogSchema.parse(f.entry.exerciseLog).plannedRepetitions).toEqual(f.evidence)
    expect(plannedRepetitionEvidenceSchema.safeParse({ ...f.evidence, results: [] }).success).toBe(false)
    expect(exerciseLogSchema.parse({ version: 1, source: "SELF_REPORTED", components: [] }).plannedRepetitions).toBeUndefined()
  })
  it("includes changed repetition numbers in the replan guard, but never private text", () => {
    const f = repetitionFixture(), changed = structuredClone(f.entry)
    changed.exerciseLog!.plannedRepetitions!.results[0]!.seconds = 240
    expect(replanFingerprint(executionReplanEvidence([changed]))).not.toBe(replanFingerprint(executionReplanEvidence([f.entry])))
    expect(JSON.stringify(executionReplanEvidence([changed]))).not.toMatch(/PRIVATE-MEMO|PRIVATE-TITLE/)
    const privateEdit = { ...f.entry, memo: "OTHER PRIVATE MEMO", title: "OTHER PRIVATE TITLE" }
    expect(executionReplanEvidence([privateEdit])).toEqual(executionReplanEvidence([f.entry]))
  })
  it("rejects non-performance and orphaned repetition evidence at the write boundary", () => {
    const f = repetitionFixture()
    expect(parseJournalEntryForWrite({ ...f.entry, plannedSessionLink: undefined })).toBeNull()
    expect(parseJournalEntryForWrite({ ...f.entry, activityOutcome: "RESTED", objectiveDataState: "NONE", activitySlot: undefined })).toBeNull()
  })
})
