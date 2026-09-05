import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { RUNTIME_CASES, draftFor, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PlanBetaIntake } from "./plan-beta-schema"
import * as mutationLock from "./plan-mutation-lock"
import { saveSelectedPlanCandidate } from "../screens/plan-beta/plan-selection"
import { archiveAndClearActivePlan, loadPlanMethodHistory, readPlanBetaStateFromStorage } from "./plan-beta-store"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { loadEntries, saveEntry } from "./journal-store"
import { collectPlanMethodObservations } from "./plan-method-observations"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
    request: async (_name, _options, callback) => callback({}),
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

const detailedCases = RUNTIME_CASES.slice(0, 4).map(fixture => ({
  event: fixture.eventDistanceM, detailed: true, fixture,
  intake: { ...draftFor(fixture), competitionDivision: fixture.eventDistanceM <= 3000 ? "HIGH_SCHOOL" : "OPEN" } as PlanBetaIntake,
}))
const distanceCases = ([10000, 21097, 42195] as const).map(event => ({
  event, detailed: false, fixture: null,
  intake: { eventDistanceM: event, eventGroup: event === 10000 ? "TEN_K" : "GENERAL_ENDURANCE",
    competitionDivision: "OPEN", experienceBand: "NEW_TO_RUNNING", availableDayCount: 3,
    requestedFrameLength: 9, trainingFocus: "BASE_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null } as PlanBetaIntake,
}))

it.each([...detailedCases, ...distanceCases])("$event: selection, save, actual journal and bounded archive preserve distinct facts", async ({ intake, fixture, detailed }) => {
  const anchor = fixture === null ? undefined : { selectedRecordId: saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds) }
  const generated = generatePlanFromDraft(intake, "NO_KNOWN_RISK", anchor)
  expect(generated.kind).toBe("generated")
  if (generated.kind !== "generated") throw new Error("Expected generated journey")
  const candidate = generated.generated.candidates[0]
  expect(candidate.sessions.filter(session => session.prescription.kind === "PACE_TARGET")).toHaveLength(detailed ? 1 : 0)
  const saved = await saveSelectedPlanCandidate({ candidateId: candidate.candidateId, startDate: "2026-08-17" },
    generated.generated, generated.gate, generated.intake, generated.athleteEvidence)
  expect(saved.kind).toBe("saved")
  if (saved.kind !== "saved") throw new Error("Expected saved journey")
  const reloaded = readPlanBetaStateFromStorage()
  expect(reloaded).toEqual({ kind: "loaded", state: saved.state })
  const session = saved.state.activePlan.sessions.find(item => detailed ? item.prescription.kind === "PACE_TARGET" : item.role !== "REST")!
  const draft = createPlannedSessionLogDraft(saved.state, session, TODAY.toISOString())!
  const beforePlan = localStorage.getItem("trainoracle.plan-beta.v1")
  expect(saveEntry({ id: `journey-${intake.eventDistanceM}`, kind: "post-session", date: draft.date,
    savedAt: TODAY.toISOString(), syncState: "local", system: "", title: "", memo: "",
    plannedSessionLink: draft.link, activitySlot: draft.link.sessionSlot, activityOutcome: "PARTIAL",
    planExecutionRelation: "MODIFIED", distanceKm: "3.2", durationMin: "18", avgPace: "", rpe: 4,
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" },
      activityOutcome: { provenance: "EXPLICIT" }, activitySlot: { provenance: "EXPLICIT" }, plannedSessionLink: { provenance: "EXPLICIT" },
      planExecutionRelation: { provenance: "DERIVED", derivedFrom: ["activityOutcome", "activitySlot", "plannedSessionLink"], derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2" } },
  }).ok).toBe(true)
  expect(localStorage.getItem("trainoracle.plan-beta.v1")).toBe(beforePlan)
  const observed = collectPlanMethodObservations(loadEntries(), [saved.state]).rows
    .find(row => row.occurrence.plannedSessionId === draft.link.plannedSessionId)!
  expect(observed).toMatchObject({ status: "LINKED", actual: { distanceKm: 3.2, durationMin: 18,
    secondsPerKm: null, rpe: 4, splits: null, recovery: null }, measuredAdherence: null,
    results: [{ outcome: "PARTIAL", relation: "MODIFIED" }] })
  expect(observed.selectedDetailedTemplateRef !== null).toBe(detailed)
  expect(archiveAndClearActivePlan(saved.state).ok).toBe(true)
  expect(readPlanBetaStateFromStorage()).toEqual({ kind: "missing" })
  const history = loadPlanMethodHistory(intake.eventDistanceM)
  expect(history).toHaveLength(detailed ? 1 : 0)
  // Linking a journal never fabricates the separate plan-completion mark.
  if (detailed) expect(history[0]?.performed.status).toBe("MISSING")
  expect(loadEntries()).toHaveLength(1)
})
