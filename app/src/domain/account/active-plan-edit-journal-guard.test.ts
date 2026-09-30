import { describe, expect, it } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { activePlanEditEvidenceFingerprint } from "../active-plan-edit"
import type { ActivePlanEditReceipt } from "../active-plan-edit-policy"
import { MEMO_PURPOSE } from "../journal-schema"
import { parseAccountJournalRecord } from "./account-journal-record-schema"
import { activePlanEditClockIsCurrent, projectActivePlanEditJournal, validateActivePlanEditJournalFacts }
  from "./active-plan-edit-journal-guard"

const receipt = {
  startDate: "2026-10-05", source: { day: 1, slot: "AM" }, target: { day: 2, slot: "PM" },
} as ActivePlanEditReceipt

function postSession(date: string, activitySlot: "AM" | "PM" | "SINGLE" | "UNSPECIFIED" = "AM") {
  return parseAccountJournalRecord({ version: 2, state: "FINALIZED", kind: "JOURNAL", entry: {
    id: `entry-${date}-${activitySlot}`, kind: "post-session", date, savedAt: `${date}T01:00:00.000Z`,
    syncState: "local", captureDepth: "QUICK", activityOutcome: "COMPLETED", activitySlot,
    objectiveDataState: "WAITING", planExecutionRelation: "NOT_APPLICABLE", painCheckStatus: "NO_SIGNAL_REPORTED",
    system: "", title: "일지 제목", memo: "PRIVATE-MEMO-NOT-EXPOSED", memoPurpose: MEMO_PURPOSE.privateSelfOnly,
    distanceKm: "", durationMin: "", avgPace: "", rpe: 6,
    fieldProvenance: {
      activityOutcome: { provenance: "EXPLICIT" }, activitySlot: { provenance: "EXPLICIT" },
      plannedSessionLink: { provenance: "MISSING" },
      planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "plannedSessionLink"],
        derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" },
      painCheckStatus: { provenance: "EXPLICIT" }, painParts: { provenance: "MISSING" }, rpe: { provenance: "EXPLICIT" },
    },
  } })
}

describe("active-plan-edit account journal guard", () => {
  it("protects actual-date source/target slots and returns no raw journal text", () => {
    const sourceRecord = postSession("2026-10-05", "AM")!
    const targetRecord = postSession("2026-10-06", "PM")!
    const source = projectActivePlanEditJournal(sourceRecord, receipt)!
    const target = projectActivePlanEditJournal(targetRecord, receipt)!
    expect(source.protectsSource).toBe(true)
    expect(target.protectsTarget).toBe(true)
    expect(JSON.stringify([source, target])).not.toContain("PRIVATE-MEMO-NOT-EXPOSED")
    expect(JSON.stringify([source, target])).not.toContain("일지 제목")
  })

  it("treats an unknown actual slot as protecting every workout slot on that date", () => {
    const record = postSession("2026-10-05", "UNSPECIFIED")!
    const alternate = { ...receipt, source: { day: 1, slot: "PM" as const }, target: null }
    expect(projectActivePlanEditJournal(record, alternate)?.protectsSource).toBe(true)
  })

  it("fails closed when any guarded journal semantically protects a slot or evidence is omitted", () => {
    const record = postSession("2026-10-05", "AM")!
    const fact = projectActivePlanEditJournal(record, receipt)!
    expect(validateActivePlanEditJournalFacts(receipt, [fact])).toBe(false)
    const clear = projectActivePlanEditJournal(postSession("2026-10-04", "AM")!, receipt)!
    const clearReceipt = { ...receipt, evidenceFingerprint: activePlanEditEvidenceFingerprint([
      postSession("2026-10-04", "AM")!.entry,
    ]) }
    expect(validateActivePlanEditJournalFacts(clearReceipt, [clear])).toBe(true)
    expect(validateActivePlanEditJournalFacts(clearReceipt, [])).toBe(false)
  })

  it("treats a linked planned date as protected even when the performed date differs", () => {
    const record = postSession("2026-10-04", "PM")!
    const entry = record.entry
    if (entry.kind !== "post-session") throw new Error("Expected post-session record")
    const identity = {
      planVersionId: "sha256:" + "b".repeat(64), candidateFingerprint: "sha256:" + "c".repeat(64),
      sessionContentFingerprint: "sha256:" + "d".repeat(64), plannedDate: "2026-10-06", sessionDay: 2,
      sessionSlot: "PM", plannedRole: "QUALITY", plannedEnergyIntent: "BASE_INTENT",
    } as const
    const linked = parseAccountJournalRecord({ ...record, entry: { ...entry,
      planExecutionRelation: "AS_PLANNED",
      plannedSessionLink: { schemaVersion: 1,
        plannedSessionId: canonicalJsonFingerprint("trainoracle.planned-session.v1", identity),
        ...identity, linkSource: "ATHLETE_SELECTED_FROM_PLAN", linkedAt: "2026-10-04T01:00:00.000Z",
      },
      fieldProvenance: { ...entry.fieldProvenance, plannedSessionLink: { provenance: "EXPLICIT" },
        planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" } },
    } })
    expect(linked).not.toBeNull()
    expect(projectActivePlanEditJournal(linked, receipt)?.protectsTarget).toBe(true)
  })

  it("rejects a stale timezone date before journal reads or commit", () => {
    const dated = { ...receipt, today: "2026-10-01", timeZone: "Asia/Seoul",
      acceptedAt: "2026-10-01T03:00:00.000Z" } as ActivePlanEditReceipt
    expect(activePlanEditClockIsCurrent(dated, new Date("2026-10-01T03:00:00.000Z"))).toBe(true)
    expect(activePlanEditClockIsCurrent(dated, new Date("2026-10-01T16:00:00.000Z"))).toBe(false)
  })
})
