import { describe, expect, it } from "vitest"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { replanFixture } from "./execution-replan.test-fixture"
import { prepareCatalogReplacement, catalogProtectedSlots } from "./catalog-replacement"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { replayCatalogReplacement } from "./catalog-replacement-policy"
import { catalogReplacementClockIsCurrent } from "./account/catalog-replacement-journal-guard"
import { replanFingerprint } from "./execution-replan"
import { accountPlanEntry, emptyAccountPlanDocument, validateExecutionReplanTransition, validateAccountPlanDocumentUpdate } from "./account/account-plan-document-schema"

function ready() {
  const f = replanFixture()
  const base = { ...f, address: { day: 4, slot: "AM" as const }, acceptStronger: false, acceptLonger: true,
    inputs: { eventDistanceM: 5000, experience: f.state.intake.experienceBand, availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] } }
  for (const entry of ALL_WORKOUT_CATALOG.filter(e => e.family === "BASE")) {
    const input = { ...base, catalogId: entry.id }
    const result = prepareCatalogReplacement(input)
    if (result.kind === "ready") return { ...f, input, ...result.proposal }
  }
  throw new Error("Expected eligible BASE replacement")
}
describe("future catalog slot replacement", () => {
  it("changes one future slot without touching history, progress, dates, or private text", () => {
    const f = ready(), after = f.after
    expect(planBetaStateV3Schema.safeParse(after).success).toBe(true)
    expect(after.activePlan.candidateId).not.toBe(f.before.activePlan.candidateId)
    expect(after.activePlan.sessions.filter((s, i) => JSON.stringify(s) !== JSON.stringify(f.before.activePlan.sessions[i]))).toHaveLength(1)
    expect(after.progress).toEqual(f.before.progress)
    expect(after.intake).toEqual(f.before.intake)
    expect(JSON.stringify(after.catalogReplacement)).not.toMatch(/SECRET TITLE|SECRET MEMO/)
    expect(replayCatalogReplacement(after.catalogReplacement!)).toEqual(after.activePlan.sessions)
  })
  it.each(["past", "today", "progress", "linked", "unlinked", "unknown-slot"])("protects %s sessions", reason => {
    const f = ready(), input = structuredClone(f.input)
    if (reason === "past") input.today = "2026-10-02"
    if (reason === "today") input.today = "2026-10-01"
    if (reason === "progress") input.state.progress.push({ sessionDay: 4, sessionSlot: "AM", state: "SKIPPED" })
    if (["linked", "unlinked", "unknown-slot"].includes(reason)) {
      const { plannedSessionLink: link, activitySlot: _slot, ...entry } = input.entries[0]!
      input.entries.push({ ...entry, id: "future-record", date: "2026-10-01",
        ...(reason === "unknown-slot" ? {} : { activitySlot: "AM" }),
        ...(reason === "linked" ? { plannedSessionLink: { ...link!, plannedDate: "2026-10-01", sessionDay: 4 } } : {}) })
    }
    expect(prepareCatalogReplacement(input).kind).toBe("blocked")
    expect(catalogProtectedSlots(input.state, input.entries, input.today)).toContainEqual({ day: 4, slot: "AM" })
  })
  it.each(["purpose", "date", "rpe-consent", "duration-consent", "other-slot", "calculation"])("rejects forged %s", field => {
    const r = structuredClone(ready().after.catalogReplacement!)
    if (field === "purpose") r.replacement.plannedEnergyIntent = "GLY_INTENT"
    if (field === "date") r.replacement.day++
    if (field === "rpe-consent") r.acceptedRpeMaximum = 9
    if (field === "duration-consent") r.acceptedLongerDuration = !r.acceptedLongerDuration
    if (field === "other-slot") r.source = { day: 3, slot: "AM" }
    if (field === "calculation" && r.replacement.prescription.kind === "RPE_TIME_RANGE") r.replacement.prescription.durationMinutes.maximum++
    expect(replayCatalogReplacement(r)).toBeNull()
  })
  it("protects the linked planned slot even when the workout was recorded on another date", () => {
    const f = ready(), input = structuredClone(f.input)
    input.entries[0] = { ...input.entries[0]!, plannedSessionLink: createPlannedSessionLogDraft(input.state,
      input.state.activePlan.sessions.find(s => s.day === 4)!, input.now)!.link }
    expect(prepareCatalogReplacement(input).kind).toBe("blocked")
  })
  it("requires archive and journal-guarded collection transition, not the legacy update path", () => {
    const f = ready(), old = accountPlanEntry({ state: f.before, evidence: null }), selected = accountPlanEntry({ state: f.after, evidence: null })
    const previous = emptyAccountPlanDocument(), next = emptyAccountPlanDocument()
    previous.data = { schemaVersion: 1, currentPlanId: old.planId, plans: [old] }
    next.data = { schemaVersion: 1, currentPlanId: selected.planId,
      plans: [{ ...old, archivedAt: f.now }, selected] }
    expect(validateExecutionReplanTransition(previous, next)).toBe(true)
    expect(validateAccountPlanDocumentUpdate(previous, next)).toBe(false)
    if (selected.snapshot.state.version !== 3 || !selected.snapshot.state.catalogReplacement) throw Error("fixture")
    selected.snapshot.state.catalogReplacement.journalGuard = null
    expect(validateExecutionReplanTransition(previous, next)).toBe(false)
  })
  it.each(["COMPLETED", "RESTED", "SKIPPED", "PAIN_CHECKIN"] as const)("server transition cannot trust omitted protection for %s", progressState => {
    const f = ready()
    const progress = { sessionDay: progressState === "PAIN_CHECKIN" ? 1 : 4, sessionSlot: "AM" as const, state: progressState }
    f.before.progress = [progress]
    f.after.progress = [progress]
    f.after.catalogReplacement!.baseStateFingerprint = replanFingerprint(f.before)
    const old = accountPlanEntry({ state: f.before, evidence: null }), selected = accountPlanEntry({ state: f.after, evidence: null })
    const previous = emptyAccountPlanDocument(), next = emptyAccountPlanDocument()
    previous.data = { schemaVersion: 1, currentPlanId: old.planId, plans: [old] }
    next.data = { schemaVersion: 1, currentPlanId: selected.planId, plans: [{ ...old, archivedAt: f.now }, selected] }
    expect(validateExecutionReplanTransition(previous, next)).toBe(false)
  })
  it("uses the selected calendar time zone with a trusted clock, not a client date alone", () => {
    const r = { ...ready().after.catalogReplacement!, timeZone: "Asia/Seoul" }
    expect(catalogReplacementClockIsCurrent(r, new Date("2026-09-29T14:59:59.999Z"))).toBe(true)
    expect(catalogReplacementClockIsCurrent(r, new Date("2026-09-29T15:00:00.000Z"))).toBe(false)
    expect(catalogReplacementClockIsCurrent({ ...r, timeZone: "Not/AZone" }, new Date(r.acceptedAt))).toBe(false)
    expect(catalogReplacementClockIsCurrent(r, new Date(NaN))).toBe(false)
    const west = { ...r, timeZone: "America/Los_Angeles" }
    expect(catalogReplacementClockIsCurrent(west, new Date("2026-09-30T06:59:59.999Z"))).toBe(true)
    expect(catalogReplacementClockIsCurrent(west, new Date("2026-09-30T07:00:00.000Z"))).toBe(false)
  })
})
