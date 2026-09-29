import { describe, expect, it, vi } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import type { PostSessionEntry } from "./journal-schema"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { collectExecutionReviews, reviewPlanExecution, type OriginalPlanLookup } from "./plan-execution-review"

const session: PlanSession = { day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
  prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 3, maximum: 4 }, durationMinutes: { minimum: 30, maximum: 40 } } }
const state = { intake: { startDate: "2026-09-28" }, generatedAt: "2026-09-28T00:00:00Z", activePlan: { candidateId: "test", sessions: [session] } }
const link = createPlannedSessionLogDraft(state, session, "2026-09-28T00:00:00Z")!.link
const entry: PostSessionEntry = { id: "one", kind: "post-session", date: "2026-09-28", savedAt: "2026-09-28T02:00:00Z", syncState: "local",
  system: "base", title: "", memo: "PRIVATE-MARKER", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
  activityOutcome: "COMPLETED", planExecutionRelation: "AS_PLANNED", activitySlot: "AM", plannedSessionLink: link }
// The resolver is tested separately; this suite isolates the read-only interpretation.
const original = { kind: "matched", session, source: "ACTIVE", state } as unknown as OriginalPlanLookup

describe("execution review factual boundaries", () => {
  it("does not turn completion into measured compliance or zero RPE", () => {
    const report = reviewPlanExecution({ ...entry, planExecutionRelation: "AS_PLANNED" }, original)
    expect(report.status).toBe("REPORTED")
    expect(report.unknowns.join(" ")).toContain("빈 값을 0으로 보지")
    expect(report.unknowns.join(" ")).toContain("완료 표시와 시간대만으로")
    expect(report.facts.join(" ")).not.toMatch(/본인 표시|직접 표시|계획대로/)
    expect(JSON.stringify(report)).not.toContain("PRIVATE-MARKER")
  })
  it.each([1, 2, 3, 4, 5, 8, 10])("juxtaposes explicit RPE %s without inferring same-session adherence", rpe => {
    const report = reviewPlanExecution({ ...entry, rpe, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }, original)
    expect(report.status).toBe("REPORTED")
    expect(report.facts.join(" ")).not.toMatch(/범위 밖|범위 안|준수했/)
    expect(report.metrics).toContainEqual({ label: "힘든 정도 · RPE", actual: String(rpe), planned: "3~4" })
    expect(report.unknowns.join(" ")).toContain("RPE 준수 여부를 판정하지 않아요")
  })
  it.each([undefined, { provenance: "MISSING" } as const, { provenance: "DERIVED", derivedFrom: ["rpeBand"], derivationRuleId: "test" } as const])("excludes absent or derived RPE provenance", provenance => {
    expect(reviewPlanExecution({ ...entry, rpe: 9, fieldProvenance: provenance ? { rpe: provenance } : undefined }, original).status).toBe("REPORTED")
  })
  it.each(["RESTED", "SKIPPED", "PARTIAL", "LIGHT_ACTIVITY"] as const)("explains %s without inventing catch-up", activityOutcome => {
    expect(reviewPlanExecution({ ...entry, activityOutcome }, original).status).toBe("CHANGED")
  })
  it("does not reopen RPE adherence for modified or partial exercise", () => {
    const report = reviewPlanExecution({ ...entry, activityOutcome: "PARTIAL", planExecutionRelation: "MODIFIED", rpe: 9, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } }, original)
    expect(report.facts.join(" ")).not.toContain("범위 밖")
    expect(report.unknowns.join(" ")).toContain("RPE 준수 여부를 판정하지 않아요")
    expect(report.facts.join(" ")).not.toContain("직접 표시")
  })
  it("does not trust derived MODIFIED as an explicit structural change", () => {
    const report = reviewPlanExecution({ ...entry, planExecutionRelation: "MODIFIED", fieldProvenance: {
      planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"], derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" },
    } }, original)
    expect(report.status).toBe("REPORTED")
    expect(report.facts.join(" ")).not.toMatch(/직접 표시|본인 표시/)
  })
  it("shows explicit whole-record values without deriving missing pace or planned-volume percentages", () => {
    const report = reviewPlanExecution({ ...entry, distanceKm: "8", durationMin: "40", avgPace: "5:00",
      fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" } } }, original)
    expect(report.facts).toContain("직접 기록한 거리: 8km.")
    expect(report.facts).toContain("직접 기록한 시간: 40분.")
    expect(report.facts.join(" ")).not.toMatch(/페이스|%/)
  })
  it("preserves pain priority even when the source is missing or conflicting", () => {
    for (const conflict of [false, true]) expect(reviewPlanExecution({ ...entry, painCheckStatus: "SIGNAL_REPORTED" }, { kind: "missing" }, conflict).status).toBe("SAFETY_REVIEW")
  })
  it("rejects a wrong date, tampered planned slot/link and unverified source", () => {
    for (const patch of [{ date: "2026-09-27" }, { plannedSessionLink: { ...link, sessionSlot: "PM" as const } }, { plannedSessionLink: { ...link, sessionDay: 2 } }]) {
      expect(reviewPlanExecution({ ...entry, ...patch }, original).status).toBe("SOURCE_UNAVAILABLE")
    }
    expect(reviewPlanExecution(entry, { ...original, sourceVerificationPending: true } as OriginalPlanLookup).status).toBe("SOURCE_UNAVAILABLE")
  })
  it("preserves the original when only the actual AM/PM changes and exposes waiting data", () => {
    const report = reviewPlanExecution({ ...entry, activitySlot: "PM", planExecutionRelation: "MODIFIED", objectiveDataState: "WAITING",
      durationMin: "30", fieldProvenance: { durationMin: { provenance: "EXPLICIT" } } }, original)
    expect(report.status).toBe("REPORTED")
    expect(report.timingChange).toBe("계획은 오전, 실제 운동은 오후에 했다고 기록했어요.")
    expect(report.awaitingDeviceData).toBe(true)
    expect(report.metrics).toContainEqual({ label: "기록한 시간", actual: "30분" })
  })
  it("shows mixed structured activities without reading free text or matching total distance to quality distance", () => {
    const report = reviewPlanExecution({ ...entry, exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
      { id: "run", kind: "INTERVALS", name: "SECRET-NAME", rows: [{ id: "r", distanceM: 400, repetitions: 10, sets: 2, recovery: { kind: "TIMED", seconds: 60 }, setRecovery: { kind: "TIMED", seconds: 180 } }] },
      { id: "strength", kind: "STRENGTH", name: "SECRET-OTHER", rows: [{ id: "s", loadKg: 40, repetitions: 5, sets: 3 }] },
    ] } }, original)
    expect(report.actualExercises).toHaveLength(2)
    expect(report.actualExercises[0]!.rows[0]).toContain("400")
    expect(report.unknowns.join(" ")).toContain("대응이 확인되지 않아")
    expect(JSON.stringify(report)).not.toMatch(/SECRET|PRIVATE-MARKER/)
  })
  it("never resolves incomplete reads or future entries; catches duplicate occurrence across journal IDs", () => {
    const resolve = vi.fn(() => original)
    expect(collectExecutionReviews({ status: "uncertain" }, resolve, entry.date)).toEqual([])
    expect(collectExecutionReviews({ status: "complete", entries: [entry] }, resolve, "2026-09-27")).toEqual([])
    expect(resolve).not.toHaveBeenCalled()
    const reports = collectExecutionReviews({ status: "complete", entries: [entry, { ...entry, id: "two" }] }, resolve, entry.date)
    expect(reports.map(report => report.status)).toEqual(["CONFLICT", "CONFLICT"])
    expect(reports.map(report => report.recordLabel)).toEqual(["겹친 기록 1/2", "겹친 기록 2/2"])
    resolve.mockClear()
    const limited = collectExecutionReviews({ status: "complete", entries: [entry, { ...entry, id: "two" }] }, resolve, entry.date, { limit: 1 })
    expect(limited.map(report => report.status)).toEqual(["CONFLICT"])
    expect(resolve).toHaveBeenCalledTimes(1)
  })
  it("turns resolver errors into an unavailable state without changing the entry", () => {
    const before = JSON.stringify(entry)
    expect(collectExecutionReviews({ status: "complete", entries: [entry] }, () => { throw Error("read") }, entry.date)[0]!.status).toBe("SOURCE_UNAVAILABLE")
    expect(JSON.stringify(entry)).toBe(before)
  })
  it("keeps results and same-day ordering stable after private memo-only edits", () => {
    const read = (entries: PostSessionEntry[]) => collectExecutionReviews({ status: "complete", entries }, () => original, entry.date)
    const second = { ...entry, id: "two", savedAt: "2026-09-28T03:00:00Z" }
    expect(read([{ ...entry, savedAt: "2026-09-28T23:00:00Z", memoPurpose: "PRIVATE_SELF_ONLY", memo: "NEW-PRIVATE-TEXT" }, second]))
      .toEqual(read([entry, second]))
    expect(reviewPlanExecution({ ...entry, title: "FREE-TITLE", memo: "NEW-PRIVATE-TEXT", memoPurpose: "PRIVATE_SELF_ONLY" }, original))
      .toEqual(reviewPlanExecution(entry, original))
  })
})
