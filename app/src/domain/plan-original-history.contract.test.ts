import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { archiveAndClearActivePlan, readArchivedOriginalPlans, savePlanBetaState } from "./plan-beta-store"
import { planHistorySchema } from "./plan-beta-schema"
import { planHistorySnapshotContent } from "./plan-history-snapshot-content"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { collectPlanMethodObservations } from "./plan-method-observations"
import type { PostSessionEntry } from "./journal-schema"

const historyKey = "trainoracle.plan-beta.history.v1"
const at = "2026-09-06T03:00:00Z"
function original() {
  const state = stateFixture()
  if (state.version !== 3) throw new Error("Expected V3 fixture")
  return state
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { vi.restoreAllMocks(); setActiveLocalAccount(null) })

it("archives a full original and reads it without changing its dates, prescription or identity", () => {
  const state = original()
  expect(savePlanBetaState(state).ok).toBe(true)
  expect(archiveAndClearActivePlan(state).ok).toBe(true)
  expect(readArchivedOriginalPlans()).toEqual({ kind: "loaded", retainedPlans: 1, missingOriginals: 0, plans: [state] })
  const raw = JSON.parse(localStorage.getItem(historyKey)!)[0]
  expect(raw.version).toBe(5)
  expect(raw.archiveReason).toBe("MANUAL")
  expect(raw.originalPlanFingerprint).toBe(canonicalJsonFingerprint("trainoracle.archived-original-plan.v1", state))
  expect(planHistorySchema.safeParse(raw).success).toBe(true)
})

it("keeps old summaries unchanged and explicitly reports absent originals", () => {
  const summary = { candidateId: "old", candidateKind: "BALANCED", frameLengthDays: 9.5, progress: [], archivedAt: at }
  const before = JSON.stringify([summary])
  localStorage.setItem(historyKey, before)
  expect(readArchivedOriginalPlans()).toEqual({ kind: "loaded", retainedPlans: 1, missingOriginals: 1, plans: [] })
  expect(localStorage.getItem(historyKey)).toBe(before)
  expect(archiveAndClearActivePlan(original()).ok).toBe(true)
  expect(JSON.parse(localStorage.getItem(historyKey)!)[1]).toEqual(summary)
  expect(readArchivedOriginalPlans()).toMatchObject({ retainedPlans: 2, missingOriginals: 1 })
})

it.each(["{broken", JSON.stringify([{ version: 900 }])])("never replaces unreadable or unknown history %s", raw => {
  const state = original()
  expect(savePlanBetaState(state).ok).toBe(true)
  localStorage.setItem(historyKey, raw)
  const before = Object.entries(localStorage)
  expect(readArchivedOriginalPlans()).toEqual({ kind: "unavailable" })
  expect(archiveAndClearActivePlan(state)).toMatchObject({ ok: false, rollbackComplete: true })
  expect(Object.entries(localStorage)).toEqual(before)
})

it.each(["summary", "hash", "source", "extra-private-field", "source-and-rehash"] as const)("rejects %s archive tampering", kind => {
  const entry = structuredClone(planHistorySnapshotContent(original(), at, "MANUAL"))
  if (kind === "summary") entry.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
  if (kind === "hash") entry.originalPlanFingerprint = `sha256:${"0".repeat(64)}`
  if (kind === "extra-private-field") Object.assign(entry.originalPlan, { memo: "PRIVATE-TEST-MUST-NOT-BE-STORED" })
  if (kind === "source" || kind === "source-and-rehash") {
    const prescription = entry.originalPlan.activePlan.sessions[0]!.prescription
    if (prescription.kind !== "RPE_TIME_RANGE") throw new Error("Expected RPE fixture")
    Object.assign(prescription, { durationMinutes: { minimum: 23, maximum: 31 } })
    if (kind === "source-and-rehash") entry.originalPlanFingerprint = canonicalJsonFingerprint("trainoracle.archived-original-plan.v1", entry.originalPlan)
  }
  expect(planHistorySchema.safeParse(entry).success).toBe(false)
})

it("does not expose one account's original plans to another account", () => {
  setActiveLocalAccount("account-A")
  expect(archiveAndClearActivePlan(original()).ok).toBe(true)
  expect(readArchivedOriginalPlans()).toMatchObject({ retainedPlans: 1 })
  setActiveLocalAccount("account-B")
  expect(readArchivedOriginalPlans()).toEqual({ kind: "loaded", retainedPlans: 0, missingOriginals: 0, plans: [] })
  setActiveLocalAccount("account-A")
  expect(readArchivedOriginalPlans()).toMatchObject({ retainedPlans: 1 })
})

it("retains exactly the newest 18 archives without claiming a continuous observation period", () => {
  for (let i = 0; i < 19; i++) {
    const state = { ...original(), generatedAt: new Date(Date.UTC(2026, 6, i + 1)).toISOString() }
    expect(archiveAndClearActivePlan(state).ok).toBe(true)
  }
  const read = readArchivedOriginalPlans()
  if (read.kind !== "loaded") throw new Error("Expected originals")
  expect(read.retainedPlans).toBe(18)
  expect(read.plans).toHaveLength(18)
  expect(read.plans[0]?.generatedAt).toBe("2026-07-19T00:00:00.000Z")
  expect(read.plans.at(-1)?.generatedAt).toBe("2026-07-02T00:00:00.000Z")
})

it("links an archived occurrence to its journal, not to a later frame with the same candidate", () => {
  const state = original()
  const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, state.generatedAt)!
  const journal: PostSessionEntry = { id: "old-linked-result", kind: "post-session", date: draft.date,
    savedAt: state.generatedAt, syncState: "local", system: "", title: "", memo: "DO-NOT-PROJECT",
    distanceKm: "3.2", durationMin: "", avgPace: "", rpe: 0, plannedSessionLink: draft.link,
    activitySlot: draft.link.sessionSlot, activityOutcome: "PARTIAL", planExecutionRelation: "MODIFIED",
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" } } }
  expect(archiveAndClearActivePlan(state).ok).toBe(true)
  const read = readArchivedOriginalPlans()
  if (read.kind !== "loaded") throw new Error("Expected originals")
  const newer = { ...original(), generatedAt: "2026-08-01T00:00:00Z" }
  const observation = collectPlanMethodObservations([journal], [...read.plans, newer])
  expect(observation.rows.find(row => row.occurrence.plannedSessionId === draft.link.plannedSessionId))
    .toMatchObject({ status: "LINKED", actual: { distanceKm: 3.2, durationMin: null, rpe: null } })
  expect(observation.rows.filter(row => row.status === "MISSING")).toHaveLength(1)
  expect(JSON.stringify(observation)).not.toContain("DO-NOT-PROJECT")
})
