import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import type { CatalogSessionBinding } from "@impl/prescription/catalog-session-binding"
import { oracleReadingCyclePeriod, useOracleReadingSources } from "./useOracleReadingSources"
import { ACCOUNT_PLAN_EVENT, type AccountPlanService } from "../domain/account/account-plan-service"
import { markAccountJournalFullListConfirmed, markCurrentConfirmedAccountJournalProjection, putAccountJournalProjection,
  removeAccountJournalProjection, resetAccountJournalProjection, setAccountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { setActiveLocalAccount } from "../domain/account/local-journal-ownership"
import { buildFileObservation } from "../domain/import/file-observation"
import { isProjectedFileObservation } from "../domain/import/file-analysis"
import type { PostSessionEntry } from "../domain/journal-schema"
import type { PlanBetaStateReadResult } from "../domain/plan-beta-store"
import { stateFixture } from "../domain/plan-beta-store.test-fixture"
import { buildOracleContentAdapter } from "../domain/oracle-content-adapter"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"

const runtime = vi.hoisted(() => ({ enabled: true, service: null as AccountPlanService | null,
  guest: { kind: "missing" } as PlanBetaStateReadResult }))
vi.mock("../domain/account/account-plan-service", async original => ({
  ...await original<typeof import("../domain/account/account-plan-service")>(),
  accountPlansEnabled: () => runtime.enabled, accountPlanService: () => runtime.service,
}))
vi.mock("../domain/plan-beta-store", async original => ({
  ...await original<typeof import("../domain/plan-beta-store")>(), readPlanBetaStateFromStorage: () => runtime.guest,
}))
const today = "2026-10-04"
const announce = (name = ACCOUNT_PLAN_EVENT) => window.dispatchEvent(new Event(name))
function file(id = "file1", seconds = 300): PostSessionEntry {
  return { id, kind: "post-session", date: "2026-10-01", savedAt: "2026-10-01T12:00:00Z", syncState: "local",
    title: "PRIVATE_TITLE", memo: "PRIVATE_MEMO", system: "base", distanceKm: "1", durationMin: "5", avgPace: "5:00", rpe: 3,
    fileObservation: buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-observation-1",
      sourceActivityId: "activity1", date: "2026-10-01", startedAt: null, timeZone: null, sport: "UNKNOWN",
      distanceMeters: 1000, durationSeconds: seconds, durationMeaning: "TIMER", confirmation: { durationMeaning: "TIMER", sport: null },
      laps: [{ sourceIndex: 0, distanceMeters: 1000, durationSeconds: seconds, durationMeaning: "TIMER", kind: "UNKNOWN" }] }) }
}
function confirm(entry = file(), revision = 1, owner = "synthetic-a") {
  markCurrentConfirmedAccountJournalProjection(owner, entry, revision)
  markAccountJournalFullListConfirmed(owner)
  setAccountJournalProjectionStatus(owner, "READY")
}
function planFixture() {
  const state = stateFixture()
  if (state.version !== 3) throw Error("fixture version")
  const c = calculateCatalogWorkout("P-LT-B", { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: 7200,
    confirmedRequirements: [], fiveK: null, segmentPaces: [] })!
  const binding: CatalogSessionBinding = { version: 1, catalogId: c.catalogId, inputs: c.inputs, catalogFingerprint: c.catalogFingerprint,
    calculationFingerprint: c.fingerprint, originalEnvelope: { rpe: { minimum: 1, maximum: 10 }, durationMinutes: { minimum: 1, maximum: 120 } } }
  const session = { ...state.activePlan.sessions[0]!, role: "QUALITY" as const, plannedEnergyIntent: "LT_INTENT" as const, prescription: { kind: "RPE_TIME_RANGE" as const,
    rpe: { minimum: 1, maximum: 10 }, durationMinutes: { minimum: 1, maximum: 120 }, catalogWorkout: binding } }
  return { ...state, intake: { ...state.intake, startDate: "2026-10-01" },
    activePlan: { ...state.activePlan, sessions: [session, { ...session, day: 10 }] } }
}
function accountPlan() {
  const state = planFixture()
  const view = { status: "READY", fingerprint: "plan:rev1", currentPlan: { kind: "read_only", planId: "plan1", packet: { state } } }
  runtime.service = { snapshot: () => structuredClone(view) } as unknown as AccountPlanService
  return view
}
beforeEach(() => {
  runtime.enabled = true; runtime.service = null; runtime.guest = { kind: "missing" }
  setActiveLocalAccount("synthetic-a"); resetAccountJournalProjection("synthetic-a")
  vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true"); vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("No network permitted") }))
})
afterEach(() => { cleanup(); runtime.service = null; setActiveLocalAccount(null); resetAccountJournalProjection(null); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("requires explicit choices and passes exact attested observations straight into the adapter", () => {
  confirm(); accountPlan()
  const { result } = renderHook(() => useOracleReadingSources(today))
  expect(result.current.fileOptions).toHaveLength(1); expect(result.current.methodOptions).toHaveLength(2)
  expect(result.current.fileOptions[0]!.label).toContain("종목 미확인 · 1개 구간")
  expect(result.current.methodOptions[0]!.label).toContain("오전")
  expect(result.current.methodOptions[0]!.label).not.toContain("P-LT-B")
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.selectedMethodKey).toBeNull()
  expect(result.current.fileLaps.state).toBe("MISSING"); expect(result.current.catalogMethod.state).toBe("MISSING")
  act(() => { result.current.setSelectedFileKey(result.current.fileOptions[0]!.key); result.current.setSelectedMethodKey(result.current.methodOptions[1]!.key) })
  expect(result.current.fileLaps.state).toBe("READY")
  if (result.current.fileLaps.state !== "READY") throw Error("fixture")
  expect(isProjectedFileObservation(result.current.fileLaps.data)).toBe(true)
  const adapted = buildOracleContentAdapter({ today, journal: { state: "UNAVAILABLE" }, fileLaps: result.current.fileLaps, catalogMethod: result.current.catalogMethod })
  expect(adapted.laps).toMatchObject({ state: "READY", data: { sport: "UNKNOWN" } })
  expect(adapted.method.state).toBe("READY")
  expect(JSON.stringify(result.current)).not.toMatch(/PRIVATE_|memo|title|sourceActivityId/)
  expect(fetch).not.toHaveBeenCalled()
})

it("does not adopt retained cache or single-document readiness as current full-list authority", () => {
  putAccountJournalProjection("synthetic-a", file()); setAccountJournalProjectionStatus("synthetic-a", "READY")
  const { result } = renderHook(() => useOracleReadingSources(today))
  expect(result.current.fileOptions).toEqual([]); expect(result.current.fileLaps.state).toBe("UNAVAILABLE")
  act(() => markCurrentConfirmedAccountJournalProjection("synthetic-a", file(), 1))
  expect(result.current.fileOptions).toEqual([])
  act(() => { markAccountJournalFullListConfirmed("synthetic-a"); announce("trainoracle:account-journals-changed") })
  expect(result.current.fileOptions).toHaveLength(1)
})

it.each([false, true])("invalidates exact revision edits even when content is unchanged (%s)", changed => {
  confirm(); const { result } = renderHook(() => useOracleReadingSources(today))
  const oldKey = result.current.fileOptions[0]!.key
  act(() => result.current.setSelectedFileKey(oldKey))
  act(() => confirm(file("file1", changed ? 320 : 300), 2))
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.fileOptions[0]!.key).not.toBe(oldKey)
  act(() => result.current.setSelectedFileKey(oldKey))
  expect(result.current.fileLaps.state).toBe("MISSING")
})

it("does not resurrect selection after batched failed then recovered reads", () => {
  confirm(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => result.current.setSelectedFileKey(result.current.fileOptions[0]!.key))
  act(() => { setAccountJournalProjectionStatus("synthetic-a", "FAILED"); confirm() })
  expect(result.current.fileOptions).toHaveLength(1); expect(result.current.selectedFileKey).toBeNull()
})

it("invalidates deletion and refuses unknown keys", () => {
  confirm(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => result.current.setSelectedFileKey(result.current.fileOptions[0]!.key))
  act(() => removeAccountJournalProjection("synthetic-a", "file1"))
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.fileLaps.state).toBe("MISSING")
  act(() => result.current.setSelectedFileKey("invented"))
  expect(result.current.selectedFileKey).toBeNull()
})

it("isolates A-B-A and stale setters even when revisions and file identity repeat", () => {
  confirm(); accountPlan(); const { result } = renderHook(() => useOracleReadingSources(today))
  const selectFile = result.current.setSelectedFileKey, selectMethod = result.current.setSelectedMethodKey
  const oldFile = result.current.fileOptions[0]!.key, oldMethod = result.current.methodOptions[0]!.key
  act(() => { selectFile(oldFile); selectMethod(oldMethod) })
  act(() => { setActiveLocalAccount("synthetic-b"); resetAccountJournalProjection("synthetic-b");
    setActiveLocalAccount("synthetic-a"); resetAccountJournalProjection("synthetic-a"); confirm() })
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.selectedMethodKey).toBeNull()
  act(() => { selectFile(result.current.fileOptions[0]!.key); selectMethod(result.current.methodOptions[0]!.key) })
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.selectedMethodKey).toBeNull()
})

it("keeps optional sources independent and does not fall back to guest plans for an account", () => {
  const view = accountPlan(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => result.current.setSelectedMethodKey(result.current.methodOptions[0]!.key))
  expect(result.current.catalogMethod.state).toBe("READY"); expect(result.current.fileLaps.state).toBe("UNAVAILABLE")
  act(() => { confirm(); result.current.setSelectedFileKey(result.current.fileOptions[0]?.key ?? null) })
  act(() => result.current.setSelectedFileKey(result.current.fileOptions[0]!.key))
  act(() => { runtime.guest = { kind: "loaded", state: planFixture() }; view.status = "FAILED"; announce() })
  expect(result.current.fileLaps.state).toBe("READY"); expect(result.current.catalogMethod.state).toBe("UNAVAILABLE")
  expect(result.current.cyclePeriod.state).toBe("UNAVAILABLE"); expect(result.current.methodOptions).toEqual([])
})

it("invalidates method selection on plan revision, pending status and plan replacement", () => {
  const view = accountPlan(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => result.current.setSelectedMethodKey(result.current.methodOptions[0]!.key))
  const key = result.current.selectedMethodKey
  act(() => { view.fingerprint = "plan:rev2"; announce() })
  expect(result.current.selectedMethodKey).toBeNull(); expect(result.current.methodOptions[0]!.key).not.toBe(key)
  act(() => result.current.setSelectedMethodKey(result.current.methodOptions[0]!.key))
  act(() => { view.status = "PENDING"; announce(); view.status = "READY"; announce() })
  expect(result.current.selectedMethodKey).toBeNull()
  act(() => { view.currentPlan.packet.state.activePlan.sessions = []; announce() })
  expect(result.current.methodOptions).toEqual([]); expect(result.current.cyclePeriod.state).toBe("UNAVAILABLE")
})

it("retains conflict exclusion across the full file list and respects format kill switches", () => {
  confirm(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => confirm(file("conflicting-copy", 320)))
  expect(result.current.fileOptions).toEqual([]); expect(result.current.fileLaps.state).toBe("UNAVAILABLE")
  act(() => removeAccountJournalProjection("synthetic-a", "conflicting-copy"))
  act(() => result.current.setSelectedFileKey(result.current.fileOptions[0]!.key))
  act(() => { vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "true"); announce("focus") })
  expect(result.current.selectedFileKey).toBeNull(); expect(result.current.fileLaps.state).toBe("UNAVAILABLE")
})

it("supports guest plan-only choices and unsubscribes every listener", () => {
  setActiveLocalAccount(null); runtime.guest = { kind: "loaded", state: planFixture() }
  const remove = vi.spyOn(window, "removeEventListener")
  const { result, unmount } = renderHook(() => useOracleReadingSources(today))
  expect(result.current.methodOptions).toHaveLength(2); expect(result.current.fileLaps.state).toBe("UNAVAILABLE")
  unmount()
  for (const event of [ACCOUNT_PLAN_EVENT, LOCAL_JOURNALS_CHANGED, "trainoracle:account-journals-changed", "storage", "focus"])
    expect(remove.mock.calls.some(([name]) => name === event)).toBe(true)
})

it("withholds account plans lacking original evidence and disabled account sources", () => {
  const view = accountPlan(); const { result } = renderHook(() => useOracleReadingSources(today))
  act(() => { view.currentPlan.kind = "evidence_required"; announce() })
  expect(result.current.methodOptions).toEqual([]); expect(result.current.cyclePeriod.state).toBe("UNAVAILABLE")
  act(() => { view.currentPlan.kind = "invalid"; announce() })
  expect(result.current.catalogMethod.state).toBe("UNAVAILABLE")
  act(() => { runtime.enabled = false; announce() })
  expect(result.current.catalogMethod.state).toBe("UNAVAILABLE")
})

it("G06 uses every actual session date capped at today, never rounded fractional frame length", () => {
  const plan = { state: "READY" as const, sourceVersion: "plan:1", data: planFixture() }
  expect(oracleReadingCyclePeriod(today, plan)).toMatchObject({ state: "READY", data: { startDate: "2026-10-01", endDate: today } })
  expect(oracleReadingCyclePeriod("2026-10-31", plan)).toMatchObject({ state: "READY", data: { startDate: "2026-10-01", endDate: "2026-10-10" } })
  expect(oracleReadingCyclePeriod("2026-09-30", plan).state).toBe("MISSING")
  expect(oracleReadingCyclePeriod("bad", plan).state).toBe("UNAVAILABLE")
  for (const state of ["MISSING", "UNAVAILABLE", "REVOKED"] as const) expect(oracleReadingCyclePeriod(today, { state })).toEqual({ state })
  plan.data.activePlan.sessions.push(plan.data.activePlan.sessions[0]!)
  expect(oracleReadingCyclePeriod(today, plan).state).toBe("UNAVAILABLE")
})
