import { describe, expect, it, vi } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { collectPlanMethodObservations } from "./plan-method-observations"
import type { PostSessionEntry } from "./journal-schema"
import type { PlanBetaState } from "./plan-beta-schema"
import { draftFor, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"

const plan = stateFixture()
const draft = createPlannedSessionLogDraft(plan, plan.activePlan.sessions[0]!, plan.generatedAt)!
const entry: PostSessionEntry = {
  id: "synthetic-result", kind: "post-session", date: draft.date,
  savedAt: plan.generatedAt, syncState: "local", plannedSessionLink: draft.link,
  activitySlot: "AM", activityOutcome: "COMPLETED", planExecutionRelation: "AS_PLANNED",
  system: "", title: "", memo: "", distanceKm: "5", durationMin: "25", avgPace: "5:00", rpe: 7,
  fieldProvenance: Object.fromEntries(["distanceKm", "durationMin", "avgPace", "rpe"]
    .map(field => [field, { provenance: "EXPLICIT" as const }])),
}
const empty = { distanceKm: null, durationMin: null, secondsPerKm: null, rpe: null, splits: null, recovery: null }
const project = (entries: readonly PostSessionEntry[]) => collectPlanMethodObservations(entries, [plan])

describe("exact plan method observations", () => {
  it("projects only explicitly recorded metrics with immutable occurrence lineage", () => {
    expect(project([entry])).toMatchObject({ rejectedLinkCount: 0, duplicateCount: 0, conflictCount: 0,
      rows: [{ status: "LINKED", occurrence: {
        plannedSessionId: draft.link.plannedSessionId, planVersionId: draft.link.planVersionId,
        sessionContentFingerprint: draft.link.sessionContentFingerprint,
      }, actual: { distanceKm: 5, durationMin: 25, secondsPerKm: 300, rpe: 7, splits: null, recovery: null },
      measuredAdherence: null, selectedDetailedTemplateRef: null }] })
  })

  it("does not create actual metrics from completion progress or a missing result", () => {
    const completed = { ...plan, progress: [{ sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const }] }
    expect(collectPlanMethodObservations([], [completed]).rows[0]).toMatchObject({ status: "MISSING", actual: empty })
    expect(project([{ ...entry, distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }]).rows[0])
      .toMatchObject({ status: "LINKED", actual: empty })
  })

  it.each([undefined, { provenance: "MISSING" as const }, {
    provenance: "DERIVED" as const, derivedFrom: ["import:activity-file"], derivationRuleId: "synthetic-import",
  }])("excludes missing, legacy and unverified metric provenance %j", provenance => {
    const fieldProvenance = provenance === undefined ? undefined
      : Object.fromEntries(["distanceKm", "durationMin", "avgPace", "rpe"].map(field => [field, provenance]))
    expect(project([{ ...entry, fieldProvenance }]).rows[0]?.actual).toEqual(empty)
  })

  it("does not derive pace or turn an RPE band into an explicit RPE", () => {
    expect(project([{ ...entry, avgPace: "", rpeBand: "RPE_7_8" }]).rows[0]?.actual)
      .toEqual({ ...empty, distanceKm: 5, durationMin: 25 })
  })

  it.each(["RESTED", "SKIPPED"] as const)("retains %s without actual zero fill", activityOutcome => {
    expect(project([{ ...entry, activityOutcome }]).rows[0]).toMatchObject({
      actual: empty, results: [{ outcome: activityOutcome }], measuredAdherence: null,
    })
  })

  it.each(["PARTIAL", "LIGHT_ACTIVITY", "COMPLETED"] as const)("retains %s/MODIFIED observations without adherence claims", activityOutcome => {
    expect(project([{ ...entry, activityOutcome, planExecutionRelation: "MODIFIED" }]).rows[0])
      .toMatchObject({ results: [{ outcome: activityOutcome, relation: "MODIFIED" }],
        actual: { distanceKm: 5 }, measuredAdherence: null })
  })

  it.each(["candidateFingerprint", "sessionContentFingerprint", "planVersionId", "plannedSessionId"] as const)
  ("rejects wrong %s", field => {
    expect(project([{ ...entry, plannedSessionLink: { ...draft.link, [field]: `sha256:${"f".repeat(64)}` } }]))
      .toMatchObject({ rejectedLinkCount: 1, rows: [{ status: "MISSING", actual: empty }] })
  })

  it.each([
    { date: "2026-07-25" }, { activitySlot: "PM" as const },
    { plannedSessionLink: { ...draft.link, sessionSlot: "PM" as const } },
    { plannedSessionLink: { ...draft.link, plannedDate: "2026-07-25" } },
  ])("excludes wrong date or slot %j", change => {
    expect(project([{ ...entry, ...change }])).toMatchObject({ rejectedLinkCount: 1,
      rows: [{ status: "MISSING", actual: empty }] })
  })

  it("uses the original version, never today's plan or a date-only match", () => {
    const later = { ...plan, generatedAt: "2026-07-24T01:00:00.000Z" }
    expect(collectPlanMethodObservations([entry], [later]).rejectedLinkCount).toBe(1)
    const result = collectPlanMethodObservations([entry], [later, plan])
    expect(result.rows.filter(row => row.status === "LINKED")).toHaveLength(1)
    expect(result.rows.find(row => row.status === "LINKED")?.occurrence.planVersionId).toBe(draft.link.planVersionId)
    expect(collectPlanMethodObservations([entry], []).rows).toEqual([])
    expect(project([{ ...entry, plannedSessionLink: undefined }]).rows[0]?.status).toBe("MISSING")
  })

  it("rejects a coherently rebuilt link from a changed prescription", () => {
    if (plan.version !== 3) throw new Error("Expected v3 fixture")
    const session = plan.activePlan.sessions[0]!
    if (session.role !== "EASY") throw new Error("Expected EASY fixture")
    const changedSession = { ...session, plannedEnergyIntent: "RECOVERY_INTENT" as const }
    const changedPlan: PlanBetaState = { ...plan, activePlan: { ...plan.activePlan, sessions: [changedSession] } }
    const changedDraft = createPlannedSessionLogDraft(changedPlan, changedSession, plan.generatedAt)!
    expect(project([{ ...entry, plannedSessionLink: changedDraft.link }]).rejectedLinkCount).toBe(1)
  })

  it("links an adopted PACE_TARGET occurrence but never substitutes its dose for actual metrics", () => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    window.localStorage.clear()
    try {
      const selectedRecordId = saveCurrentRecord(5000, 1111)
      const intake = draftFor({ caseId: "synthetic-method-observation", eventDistanceM: 5000,
        eventGroup: "FIVE_K", performanceSeconds: 1111, targetRepSeconds: 222,
        requestedFrameLength: 9, availableDayCount: "EVERY_DAY", withRecentJournal: false,
        secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING" })
      const generated = generatePlanFromDraft(intake, "NO_KNOWN_RISK", { selectedRecordId })
      if (generated.kind !== "generated") throw new Error("Expected generated plan")
      const selected = selectPlanForActivation(generated.generated.candidates[0].candidateId,
        generated.generated, generated.gate, generated.intake, generated.athleteEvidence)
      if (selected.kind !== "selected") throw new Error("Expected selected fixture")
      const session = selected.state.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")!
      if (session?.prescription.kind !== "PACE_TARGET") throw new Error("Expected detailed fixture")
      const linked = createPlannedSessionLogDraft(selected.state, session, TODAY.toISOString())!
      const result = collectPlanMethodObservations([{ ...entry, date: linked.date, activitySlot: session.slot,
        plannedSessionLink: linked.link, distanceKm: "", durationMin: "", avgPace: "", rpe: 0 }], [selected.state])
      expect(result.rows.find(row => row.status === "LINKED")).toMatchObject({
        selectedDetailedTemplateRef: { templateId: session.prescription.templateId,
          version: session.prescription.templateVersion, fingerprint: session.prescription.templateContentFingerprint },
        actual: empty, measuredAdherence: null,
      })
    } finally {
      vi.useRealTimers()
      window.localStorage.clear()
    }
  })

  it("deduplicates identical records and supplied snapshots without doubling metrics", () => {
    const result = collectPlanMethodObservations([entry, { ...entry }], [plan, plan])
    expect(result).toMatchObject({ duplicateCount: 1, conflictCount: 0, rows: [{ status: "DUPLICATE", actual: { distanceKm: 5 } }] })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.results).toHaveLength(1)
  })

  it.each([
    { id: "other-result" }, { distanceKm: "6" }, { durationMin: "30" }, { avgPace: "6:00" },
    { rpe: 8 }, { activityOutcome: "PARTIAL" as const }, { planExecutionRelation: "MODIFIED" as const },
    { plannedSessionLink: undefined }, { activitySlot: "PM" as const },
  ])("marks conflicting results explicitly and suppresses metrics %j", change => {
    const inputs = [entry, { ...entry, ...change }]
    const result = project(inputs)
    expect(result).toMatchObject({ conflictCount: 1, rows: [{ status: "CONFLICTING", actual: empty }] })
    expect(project([...inputs].reverse())).toEqual(result)
  })

  it("never reads memo content, presence, purpose, title, system or their provenance", () => {
    const privateEntry = { ...entry, fieldProvenance: { ...entry.fieldProvenance } }
    for (const field of ["memo", "memoPurpose", "title", "system", "painParts", "intensityAssessment"]) {
      Object.defineProperty(privateEntry, field, { get() { throw new Error("Private field read") } })
      Object.defineProperty(privateEntry.fieldProvenance, field, { enumerable: true, get() { throw new Error("Private provenance read") } })
    }
    expect(project([privateEntry])).toEqual(project([entry]))
    expect(project([entry, privateEntry]).duplicateCount).toBe(1)
  })

  it("does not mutate plan, journal or browser storage", () => {
    const before = JSON.stringify({ plan, entry })
    const stored = window.localStorage.length
    project([entry])
    expect(JSON.stringify({ plan, entry })).toBe(before)
    expect(window.localStorage.length).toBe(stored)
  })
})
