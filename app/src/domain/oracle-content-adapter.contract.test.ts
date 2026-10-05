import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildOracleContentAdapter, oracleContentCalendarPeriods, type OracleContentAdapterInput } from "./oracle-content-adapter"
import { buildOracleContentReading, type OracleReaderSource } from "./oracle-content-reader"
import type { PostSessionEntry } from "./journal-schema"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { REPETITION_TEST_NOW, repetitionFixture } from "./planned-repetition.test-fixture"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { linkedCatalogWorkout } from "./planned-segment-evidence"
import { prepareExecutionReplan } from "./execution-replan"
import { replanFixture } from "./execution-replan.test-fixture"
import { buildFileObservation, completeLapTotal, type FileObservationInput } from "./import/file-observation"
import { buildFileAnalysisReport, type ProjectedFileObservation } from "./import/file-analysis"
import { prepareDeviceActivity } from "./import/prepared-device-activity"
import { calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding, type CatalogSessionBinding } from "@impl/prescription/catalog-session-binding"

const today = "2026-10-04"
const ready = <T>(data: T, sourceVersion = "source:1"): OracleReaderSource<T> => ({ state: "READY", sourceVersion, data })
function entry(patch: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return { id: "session1", kind: "post-session", date: "2026-09-03", savedAt: "2026-09-03T12:00:00Z", syncState: "local",
    system: "base", title: "PRIVATE-TITLE", memo: "PRIVATE-MEMO", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4,
    activitySlot: "AM", activityOutcome: "COMPLETED",
    fieldProvenance: { system: { provenance: "EXPLICIT" }, distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" },
      rpe: { provenance: "EXPLICIT" }, activitySlot: { provenance: "EXPLICIT" }, activityOutcome: { provenance: "EXPLICIT" }, objectiveComponents: { provenance: "EXPLICIT" } },
    exerciseLog: { version: 1, source: "SELF_REPORTED", components: [{ id: "run1", kind: "RUNNING", name: "PRIVATE-EXERCISE-NAME", rows: [] }] },
    ...patch }
}
function input(entries: readonly PostSessionEntry[] = [entry()], patch: Partial<OracleContentAdapterInput> = {}): OracleContentAdapterInput {
  return { today, journal: ready({ entries, period: { startDate: "2026-09-01", endDate: "2026-09-30" }, coverage: "COMPLETE" }), ...patch }
}
function training(source: ReturnType<typeof buildOracleContentAdapter>["training"]) {
  expect(source.state).toBe("READY")
  if (source.state !== "READY") throw Error("expected READY")
  return source.data
}

describe("Oracle journal adapter: bounded structured evidence", () => {
  it("passes accepted explicit values with their source version and feeds the reader", () => {
    const result = buildOracleContentAdapter(input())
    expect(result.training).toMatchObject({ state: "READY", sourceVersion: "source:1", data: { coverage: "COMPLETE", sessions: [{
      id: "session1", date: "2026-09-03", activity: "RUN", form: "CONTINUOUS", distanceKm: 5, durationMinutes: 30, rpe: 4, purpose: "BASE", slot: "AM", provenance: "EXPLICIT",
    }] } })
    const reading = buildOracleContentReading("G01", { today, ...result })
    expect(reading.facts.find(f => f.id === "2026-09:training:km")?.value).toBe(5)
    expect(reading.sourceVersions.training).toBe("source:1")
  })
  it("never reads private strings or uses their presence or edit timestamp for conflict detection", () => {
    const e = entry()
    const baseline = buildOracleContentAdapter(input([e, { ...e, savedAt: "2026-09-04T12:00:00Z", memo: "CHANGED" }]))
    for (const key of ["memo", "title", "memoPurpose", "privateMemo"] as const) Object.defineProperty(e, key, { get() { throw Error(`read ${key}`) } })
    Object.defineProperty(e.exerciseLog!.components[0]!, "name", { get() { throw Error("exercise name read") } })
    const result = buildOracleContentAdapter(input([e, e]))
    expect(result).toEqual(baseline)
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|CHANGED|memoPurpose|painParts/u)
  })
  it.each(["MISSING", "UNAVAILABLE", "REVOKED"] as const)("preserves journal %s and never reads stale data", state => {
    const source = { state }
    Object.defineProperty(source, "data", { get() { throw Error("stale data read") } })
    const result = buildOracleContentAdapter(input([], { journal: source }))
    expect(result.training).toEqual({ state })
    expect(result.planActual).toEqual({ state })
  })
  it("does not confuse a READY empty journal with failure", () => {
    expect(buildOracleContentAdapter(input([])).training).toMatchObject({ state: "READY", data: { sessions: [], coverage: "COMPLETE" } })
    expect(buildOracleContentReading("G01", { today, ...buildOracleContentAdapter(input([])) }).status).toBe("MISSING")
  })
  it("does not infer RUN from an energy purpose or numeric distance", () => {
    const result = training(buildOracleContentAdapter(input([entry({ exerciseLog: undefined })])).training)
    expect(result.sessions[0]).toMatchObject({ activity: "UNKNOWN", purpose: "BASE", durationMinutes: 30, rpe: 4 })
    expect(result.sessions[0]?.distanceKm).toBeUndefined()
    expect(result.sessions[0]?.form).toBeUndefined()
  })
  it("preserves every source purpose including GLY, REC and MIX distinctly", () => {
    const systems = ["rest", "base", "lt", "vo2", "gly", "atp", "mixed"]
    const result = training(buildOracleContentAdapter(input(systems.map((system, i) => entry({ id: `s${i}`, system })))).training)
    expect(result.sessions.map(s => s.purpose)).toEqual(["REC", "BASE", "LT", "VO2", "GLY", "ATP_PC", "MIX"])
  })
  it("keeps mixed exercises inside one session and cross training unspecified", () => {
    const e = entry({ exerciseLog: { version: 1, source: "SELF_REPORTED", components: [
      { id: "a", kind: "STRENGTH", name: "FREE", rows: [{ id: "r1", sets: 3, repetitions: 5, loadKg: 20 }] },
      { id: "b", kind: "PLYOMETRIC", name: "FREE", rows: [{ id: "r2", contacts: 12 }] },
      { id: "c", kind: "CROSS_TRAINING", name: "FREE", rows: [{ id: "r3", durationSeconds: 900, recovery: { kind: "NONE" }, setRecovery: { kind: "TIMED", seconds: 60 } }] },
    ] } })
    const result = buildOracleContentAdapter(input([e]))
    const data = training(result.training)
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0]?.activity).toBe("MIXED")
    expect(data.sessions[0]?.distanceKm).toBeUndefined()
    expect(data.sessions[0]?.components?.map(c => c.activity)).toEqual(["WEIGHTS", "JUMPS", "CROSS_TRAINING"])
    const facts = buildOracleContentReading("C06", { today, ...result }).facts
    expect(facts.find(f => f.id.endsWith(":loadKg"))).toMatchObject({ value: 20, unit: "kg" })
    expect(facts.find(f => f.id.endsWith(":contacts"))).toMatchObject({ value: 12, unit: "count" })
    expect(facts.find(f => f.id.endsWith(":recoverySeconds"))).toMatchObject({ value: 0, unit: "s" })
    expect(facts.find(f => f.id.endsWith(":setRecoverySeconds"))).toMatchObject({ value: 60, unit: "s" })
  })
  it("requires explicit component provenance and keeps missing recovery absent", () => {
    const e = entry(); const result = training(buildOracleContentAdapter(input([{ ...e, fieldProvenance: { system: { provenance: "EXPLICIT" } } }])).training)
    expect(result.sessions[0]?.activity).toBe("UNKNOWN")
    expect(result.sessions[0]?.components).toBeUndefined()
    expect(result.sessions[0]?.rpe).toBeUndefined()
  })
  it("retains component-only explicit records without inventing totals from repetitions", () => {
    const e = entry({ system: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0,
      fieldProvenance: { objectiveComponents: { provenance: "EXPLICIT" } },
      exerciseLog: { version: 1, source: "SELF_REPORTED", components: [{ id: "i", kind: "INTERVALS", name: "", rows: [{ id: "r", distanceM: 400, repetitions: 6, sets: 2 }] }] } })
    const result = training(buildOracleContentAdapter(input([e])).training)
    expect(result.sessions[0]).toMatchObject({ activity: "RUN", form: "INTERVAL" })
    expect(result.sessions[0]?.distanceKm).toBeUndefined()
    expect(result.sessions[0]?.durationMinutes).toBeUndefined()
    expect(result.sessions[0]?.segments).toBeUndefined()
  })
  it("excludes rest/skip, legacy and imported values; no file confirmation storage reads", () => {
    const storage = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("storage read") })
    const e = entry()
    const imported = { ...e, id: "import", fieldProvenance: { ...e.fieldProvenance, distanceKm: { provenance: "DERIVED" as const, derivedFrom: ["import:activity-file"], derivationRuleId: "IMPORT" } } }
    const result = buildOracleContentAdapter(input([entry({ id: "rest", activityOutcome: "RESTED" }), entry({ id: "skip", activityOutcome: "SKIPPED" }),
      entry({ id: "legacy", fieldProvenance: undefined }), imported]))
    expect(training(result.training).sessions).toEqual([])
    expect(result.diagnostics.excludedSessions).toBe(2)
    expect(storage).not.toHaveBeenCalled()
    storage.mockRestore()
  })
  it("does not promote representative band RPE or derived duration", () => {
    const e = entry({ rpeBand: "RPE_3_4" })
    const result = training(buildOracleContentAdapter(input([{ ...e, fieldProvenance: { ...e.fieldProvenance, durationMin: { provenance: "DERIVED", derivedFrom: ["distanceKm"], derivationRuleId: "UNKNOWN_RULE" } } }])).training)
    expect(result.sessions[0]?.rpe).toBeUndefined()
    expect(result.sessions[0]?.durationMinutes).toBeUndefined()
    expect(result.sessions[0]?.distanceKm).toBe(5)
  })
  it("groups conflicts before eligibility and deduplicates without inflating dates", () => {
    const a = entry(); const b = entry({ distanceKm: "9", fieldProvenance: undefined })
    for (const rows of [[a, b], [b, a]]) {
      const result = buildOracleContentAdapter(input(rows))
      expect(training(result.training)).toMatchObject({ coverage: "PARTIAL", sessions: [] })
      expect(result.diagnostics.conflictingSessions).toBe(1)
    }
    const result = buildOracleContentAdapter(input([a, a]))
    expect(training(result.training).sessions).toHaveLength(1)
    expect(result.diagnostics.duplicateSessions).toBe(1)
  })
  it("preserves partial receipt, validates dates, and reports rejected inputs", () => {
    const source = input().journal
    if (source.state !== "READY") throw Error("fixture")
    expect(training(buildOracleContentAdapter(input([], { journal: ready({ ...source.data, coverage: "PARTIAL" }) })).training).coverage).toBe("PARTIAL")
    expect(buildOracleContentAdapter(input([], { today: "2026-02-30" })).training.state).toBe("UNAVAILABLE")
    expect(buildOracleContentAdapter(input([entry({ date: "2026-02-30" })])).diagnostics.excludedSessions).toBe(1)
    expect(training(buildOracleContentAdapter(input([entry({ date: "2026-08-01" })])).training).sessions).toEqual([])
  })
})

describe("Oracle plan adapter: demonstrable original source only", () => {
  function planFixture() {
    const plan = stateFixture(); const session = plan.activePlan.sessions[0]!
    const draft = createPlannedSessionLogDraft(plan, session, "2026-07-24T01:00:00Z")!
    const e = entry({ date: draft.date, savedAt: "2026-07-24T02:00:00Z", plannedSessionLink: draft.link,
      fieldProvenance: { ...entry().fieldProvenance, plannedSessionLink: { provenance: "EXPLICIT" } } })
    const args = input([e], { journal: ready({ entries: [e], period: { startDate: "2026-07-01", endDate: "2026-07-31" }, coverage: "COMPLETE" }), plan: ready(plan) })
    return { plan, e, args }
  }
  it("reuses exact source resolution and preserves original RPE/time ranges without midpoint targets", () => {
    const { args, e } = planFixture()
    const result = buildOracleContentAdapter(args)
    expect(result.planActual).toMatchObject({ state: "READY", data: [{ sessionId: e.id, completion: "COMPLETED",
      originalPlanVersion: e.plannedSessionLink!.sessionContentFingerprint,
      plannedRpe: { min: 2, max: 4 }, plannedDurationMinutesRange: { min: 20, max: 30 } }] })
    const reading = buildOracleContentReading("G03", { today, ...result })
    expect(reading.status).toBe("PARTIAL")
    expect(reading.facts.find(f => f.id.endsWith(":rpe-comparison"))?.value).toBe("범위 안")
    expect(reading.facts.some(f => f.id.endsWith(":duration-comparison"))).toBe(false)
    expect(reading.facts.some(f => f.id.endsWith(":plannedDurationMinutes"))).toBe(false)
  })
  it("rejects changed dates, content, missing provenance, and duplicate occurrence claims", () => {
    const { args, e, plan } = planFixture()
    if (args.journal.state !== "READY") throw Error("fixture")
    for (const entries of [[{ ...e, date: "2026-07-25" }], [e, { ...e, id: "other" }],
      [{ ...e, plannedSessionLink: { ...e.plannedSessionLink!, sessionContentFingerprint: `sha256:${"0".repeat(64)}` } }]]) {
      const result = buildOracleContentAdapter({ ...args, journal: ready({ ...args.journal.data, entries }) })
      expect(result.planActual).toMatchObject({ state: "READY", data: [], coverage: "PARTIAL" })
      expect(result.diagnostics.rejectedPlanLinks).toBeGreaterThan(0)
    }
    const result = buildOracleContentAdapter({ ...args, plan: ready({ ...plan, generatedAt: "2026-07-23T00:00:00Z" }) })
    expect(result.planActual.state === "UNAVAILABLE" || result.planActual.state === "READY" && result.planActual.data.length === 0).toBe(true)
    const noProvenance = { ...e, fieldProvenance: { ...e.fieldProvenance, plannedSessionLink: { provenance: "MISSING" as const } } }
    expect(buildOracleContentAdapter({ ...args, journal: ready({ ...args.journal.data, entries: [noProvenance] }) }).planActual).toMatchObject({ state: "READY", data: [] })
  })
  it.each(["MISSING", "UNAVAILABLE", "REVOKED"] as const)("keeps plan %s separate from valid training", state => {
    const { args } = planFixture()
    const result = buildOracleContentAdapter({ ...args, plan: { state } })
    expect(result.training.state).toBe("READY")
    expect(result.planActual.state).toBe(state)
  })
  it("adapts original repetition point targets without inventing a success range or RUN activity", () => {
    localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(REPETITION_TEST_NOW)
    try {
      const f = repetitionFixture()
      const selected = selectPlanForActivation(f.result.generated.candidates[0].candidateId, f.result.generated, f.result.gate,
        { ...f.result.intake, startDate: "2026-09-30" }, f.result.athleteEvidence, REPETITION_TEST_NOW)
      if (selected.kind !== "selected") throw Error("fixture activation")
      const activeSession = selected.state.activePlan.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
      const linked = createPlannedSessionLogDraft(selected.state, activeSession, REPETITION_TEST_NOW.toISOString())!
      const e = { ...f.entry, date: linked.date, plannedSessionLink: linked.link,
        exerciseLog: { ...f.entry.exerciseLog!, plannedRepetitions: { ...f.evidence, plannedSessionId: linked.link.plannedSessionId, sessionContentFingerprint: linked.link.sessionContentFingerprint } },
        fieldProvenance: { plannedSessionLink: { provenance: "EXPLICIT" as const } } }
      const asOf = e.date > today ? e.date : today
      const args = input([e], { today: asOf, plan: ready(selected.state), journal: ready({ entries: [e], period: { startDate: "2026-09-01", endDate: asOf }, coverage: "COMPLETE" }) })
      const result = buildOracleContentAdapter(args)
      for (const state of ["MISSING", "UNAVAILABLE", "REVOKED"] as const) {
        const withheld = buildOracleContentAdapter({ ...args, plan: { state } })
        expect(training(withheld.training)).toMatchObject({ coverage: "PARTIAL", sessions: [] })
        expect(withheld.planActual).toEqual({ state })
        expect(withheld.diagnostics.excludedSessions).toBe(1)
      }
      const s = training(result.training).sessions[0]!
      expect(s).toMatchObject({ activity: "UNKNOWN", segmentsComplete: false, segments: [{ id: "set1:rep1", distanceM: 1000, seconds: 222.3 }] })
      expect(s.distanceKm).toBeUndefined()
      expect(s.includesFinalRecovery).toBeUndefined()
      const reading = buildOracleContentReading("G03", { today: asOf, ...result })
      expect(reading.facts.find(f => f.id.endsWith(":set1:rep1:delta"))?.value).toBeCloseTo(0)
      expect(reading.facts.some(f => f.metric === "M09")).toBe(false)
      expect(reading.status).toBe("PARTIAL")
      const tampered = structuredClone(e)
      tampered.exerciseLog!.plannedRepetitions!.sessionContentFingerprint = `sha256:${"0".repeat(64)}`
      if (args.journal.state !== "READY") throw Error("fixture")
      expect(training(buildOracleContentAdapter({ ...args, journal: ready({ ...args.journal.data, entries: [tampered] }) }).training)).toMatchObject({ coverage: "PARTIAL", sessions: [] })
    } finally { vi.useRealTimers(); localStorage.clear(); sessionStorage.clear() }
  })
  it("preserves catalog time-only work and recovery via the existing calculation fingerprint", () => {
    localStorage.clear(); sessionStorage.clear()
    const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: 5,
      requestedFrameLength: 10, trainingFocus: "LT_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null }, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw Error("fixture generation")
    const main = result.generated.candidates[0].sessions.find(s => s.role === "QUALITY")!
    const generated = replaceCandidateCatalogWorkout(result.generated, main, "P-LT-B", { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
      confirmedRequirements: [], fiveK: null, segmentPaces: [] }, true)
    if (!generated) throw Error("fixture binding")
    const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, result.gate, { ...result.intake, startDate: "2026-09-01" }, result.athleteEvidence, new Date("2026-09-01T00:00:00Z"))
    if (selected.kind !== "selected") throw Error("fixture activation")
    const session = selected.state.activePlan.sessions.find(s => s.role === "QUALITY")!
    const linked = createPlannedSessionLogDraft(selected.state, session, selected.state.generatedAt)!
    const calculation = linkedCatalogWorkout(linked.link, session)!
    const work = calculation.steps.find(s => s.phase === "main" && s.kind === "WORK")!
    const recovery = calculation.steps.find(s => s.kind === "RECOVERY")!
    const e = entry({ date: linked.date, rpe: 0, system: "", distanceKm: "", durationMin: "", avgPace: "", plannedSessionLink: linked.link,
      fieldProvenance: { plannedSessionLink: { provenance: "EXPLICIT" } }, exerciseLog: { version: 1, source: "SELF_REPORTED", components: [],
        plannedSegments: { version: 1, source: "SELF_REPORTED", plannedSessionId: linked.link.plannedSessionId, sessionContentFingerprint: linked.link.sessionContentFingerprint,
          calculationFingerprint: calculation.fingerprint, results: [{ key: work.key, seconds: work.seconds!.maximum }, { key: recovery.key, seconds: 0 }] } } })
    const adapted = buildOracleContentAdapter(input([e], { plan: ready(selected.state) }))
    expect(training(adapted.training).sessions[0]?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: work.key, seconds: work.seconds!.maximum, kind: "WORK" }),
      expect.objectContaining({ id: recovery.key, seconds: 0, kind: "RECOVERY" }),
    ]))
    expect(training(adapted.training).sessions[0]?.distanceKm).toBeUndefined()
    const reading = buildOracleContentReading("G03", { today, ...adapted })
    expect(reading.facts.find(f => f.id.endsWith(`:${work.key}:range`))?.value).toBe("범위 안")
    expect(reading.facts.find(f => f.id.endsWith(`:${recovery.key}:actual`))?.value).toBe(0)
    const forged = structuredClone(e)
    forged.exerciseLog!.plannedSegments!.calculationFingerprint = `sha256:${"0".repeat(64)}`
    expect(training(buildOracleContentAdapter(input([forged], { plan: ready(selected.state) })).training).sessions).toEqual([])
  })
  it("distinguishes unavailable/revoked original history from an empty plan and follows verified lineage", () => {
    const f = replanFixture()
    const change = prepareExecutionReplan(f)
    if (change.kind !== "ready") throw Error("fixture change")
    const current = change.proposals.find(p => p.action === "REDUCE")!.after
    const e = { ...f.entries[0]!, rpe: 3, fieldProvenance: { rpe: { provenance: "EXPLICIT" as const }, plannedSessionLink: { provenance: "EXPLICIT" as const } } }
    const args = input([e], { plan: ready(current) })
    const absent = buildOracleContentAdapter({ ...args, planHistory: { state: "UNAVAILABLE" } })
    expect(absent.planActual.state).toBe("UNAVAILABLE")
    expect(buildOracleContentAdapter({ ...args, planHistory: { state: "REVOKED" } }).planActual.state).toBe("REVOKED")
    const resolved = buildOracleContentAdapter({ ...args, planHistory: ready([f.state]) })
    expect(resolved.planActual).toMatchObject({ state: "READY", data: [{ originalPlanVersion: e.plannedSessionLink!.sessionContentFingerprint, plannedRpe: { min: 3, max: 4 } }] })
  })
})

describe("Oracle existing source adapters", () => {
  beforeEach(() => { vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true"); vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false") })
  afterEach(() => { vi.unstubAllEnvs() })
  const lapRows: FileObservationInput["laps"] = [
    { sourceIndex: 0, distanceMeters: 1000, durationSeconds: 300, durationMeaning: "TIMER", kind: "UNKNOWN" },
    { sourceIndex: 1, distanceMeters: 1000, durationSeconds: 290, durationMeaning: "TIMER", kind: "UNKNOWN" },
  ]
  function fileEntry(laps = lapRows, patch: Partial<FileObservationInput> = {}) {
    return { id: "file1", kind: "post-session", date: "2026-09-03", fileObservation: buildFileObservation({
      format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-observation-1", sourceActivityId: "activity1",
      date: "2026-09-03", startedAt: null, timeZone: null, sport: "RUNNING", laps,
      distanceMeters: completeLapTotal(laps, "distanceMeters"), durationSeconds: completeLapTotal(laps, "durationSeconds"),
      durationMeaning: "SOURCE_DEFINED", confirmation: { durationMeaning: "TIMER", sport: "RUNNING" }, ...patch,
    }) }
  }
  function project(laps = lapRows, patch: Partial<FileObservationInput> = {}): ProjectedFileObservation {
    const report = buildFileAnalysisReport([fileEntry(laps, patch)], { startDate: "2026-09-01", endDate: "2026-09-30", sourceContext: "ACCOUNT_CONFIRMED" })
    expect(report.observations).toHaveLength(1)
    return report.observations[0]!
  }
  function binding(id = "P-LT-B", requirements: readonly string[] = []): CatalogSessionBinding {
    const calculation = calculateCatalogWorkout(id, { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: 7200,
      confirmedRequirements: requirements, fiveK: null, segmentPaces: [] })
    if (!calculation) throw Error("catalog fixture")
    return { version: 1, catalogId: id, inputs: calculation.inputs, catalogFingerprint: calculation.catalogFingerprint,
      calculationFingerprint: calculation.fingerprint, originalEnvelope: { rpe: { minimum: 1, maximum: 10 }, durationMinutes: { minimum: 1, maximum: 120 } } }
  }
  it("exposes selected accepted file laps with native source identity, not fabricated race identity", () => {
    const observation = project()
    const result = buildOracleContentAdapter(input([], { fileLaps: ready(observation, "journal:rev7") }))
    expect(result.laps).toMatchObject({ state: "READY", sourceVersion: "journal:rev7", data: {
      kind: "FILE_ACTIVITY", journalEntryId: "file1", sourceObservationKey: observation.sourceObservationKey,
      contentRevisionFingerprint: observation.contentRevisionFingerprint, laps: lapRows,
    } })
    const reading = buildOracleContentReading("B04", { today, ...result })
    expect(reading.status).toBe("SUFFICIENT")
    expect(reading.facts.find(f => f.id === "laps:pace-delta")?.value).toBe(-10)
    expect(reading.facts.find(f => f.id === "file-lap:0:pace")).toMatchObject({ value: 300, unit: "s/km" })
    expect(reading.facts.every(f => f.sourceRefs.every(ref => ref.provenance === "CONFIRMED_FILE"))).toBe(true)
    expect(reading.sourceVersions["laps.observation"]).toBe(observation.contentRevisionFingerprint)
    expect(reading.facts.some(f => f.sourceRefs.some(ref => ref.itemId === "activity1"))).toBe(false)
    expect(JSON.stringify(result.laps)).not.toContain("recordId")
  })
  it.each(["F02", "F08"])("%s does not promote activity laps into a same-date race", topicId => {
    const adapted = buildOracleContentAdapter(input([], { fileLaps: ready(project()) }))
    const reading = buildOracleContentReading(topicId, { today, ...adapted,
      answers: ready({ raceGoals: ["RECORD"] }), conditions: ready({ races: [{ recordId: "file1", course: "TRACK" }] }) })
    expect(reading.status).toBe("PARTIAL")
    expect(reading.facts.some(f => f.id.startsWith("file-lap:") || f.id.startsWith("race:") || f.metric === "M10")).toBe(false)
    expect(reading.missingInputs).toContain("laps:explicit-race-link")
  })
  it("does not use activity confirmation to rewrite SOURCE_DEFINED lap semantics", () => {
    const observation = project(lapRows.map(lap => ({ ...lap, durationMeaning: "SOURCE_DEFINED" })))
    expect(observation.durationMeaning).toBe("TIMER")
    const result = buildOracleContentReading("B04", { today, ...buildOracleContentAdapter(input([], { fileLaps: ready(observation) })) })
    expect(result.status).toBe("PARTIAL")
    expect(result.facts.find(f => f.id === "file-lap:0:time")).toMatchObject({ value: 300, label: expect.stringContaining("의미 미확정") })
    expect(result.facts.some(f => f.metric === "M03" || f.metric === "M10")).toBe(false)
  })
  it("keeps unknown, zero and absent measurements distinct and does not renumber gaps", () => {
    const laps: FileObservationInput["laps"] = [
      { ...lapRows[0]!, distanceMeters: null }, { ...lapRows[1]!, durationSeconds: null },
      { ...lapRows[0]!, sourceIndex: 2, distanceMeters: 0, durationSeconds: 0 },
      { ...lapRows[0]!, sourceIndex: 3, distanceMeters: 50, durationSeconds: 7 },
    ]
    const result = buildOracleContentReading("B04", { today, ...buildOracleContentAdapter(input([], { fileLaps: ready(project(laps)) })) })
    expect(result.status).toBe("PARTIAL")
    expect(result.facts.find(f => f.id === "file-lap:0:distance")).toBeUndefined()
    expect(result.facts.find(f => f.id === "file-lap:1:time")).toBeUndefined()
    expect(result.facts.find(f => f.id === "file-lap:2:time")?.value).toBe(0)
    expect(result.facts.find(f => f.id === "file-lap:3:time")?.value).toBe(7)
    expect(result.facts.some(f => f.metric === "M03" || f.metric === "M10")).toBe(false)
  })
  it("does not combine TIMER and ELAPSED into a split comparison", () => {
    const observation = project([lapRows[0]!, { ...lapRows[1]!, durationMeaning: "ELAPSED" }])
    const result = buildOracleContentReading("B04", { today, ...buildOracleContentAdapter(input([], { fileLaps: ready(observation) })) })
    expect(result.facts.filter(f => f.metric === "M03")).toHaveLength(2)
    expect(result.facts.some(f => f.metric === "M10")).toBe(false)
    expect(result.status).toBe("PARTIAL")
  })
  it.each(["UNKNOWN", "CYCLING"] as const)("keeps %s activity unclassified as running", sport => {
    const observation = project(lapRows, { sport, confirmation: { sport: null, durationMeaning: "TIMER" } })
    const result = buildOracleContentReading("B04", { today, ...buildOracleContentAdapter(input([], { fileLaps: ready(observation) })) })
    expect(result.facts.find(f => f.id === "file-lap:0:distance")?.value).toBe(1000)
    expect(result.facts.some(f => f.metric === "M03" || f.metric === "M10")).toBe(false)
  })
  it("rejects plain restored payloads, unconfirmed preview data and disabled formats", () => {
    const observation = project()
    expect(buildOracleContentAdapter(input([], { fileLaps: ready(structuredClone(observation)) })).laps.state).toBe("UNAVAILABLE")
    const preview = buildFileAnalysisReport([fileEntry()], { startDate: "2026-09-01", endDate: "2026-09-30", sourceContext: "DEVICE_PREVIEW" })
    expect(preview.observations).toEqual([])
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "true")
    expect(buildOracleContentAdapter(input([], { fileLaps: ready(observation) })).laps.state).toBe("UNAVAILABLE")
  })
  it("uses the existing source-conflict filter without choosing a newer observation", () => {
    const older = fileEntry(); const changed = fileEntry([{ ...lapRows[0]!, durationSeconds: 350 }, lapRows[1]!])
    const report = buildFileAnalysisReport([older, changed], { startDate: "2026-09-01", endDate: "2026-09-30", sourceContext: "ACCOUNT_CONFIRMED" })
    expect(report.conflictingSourceCount).toBe(1)
    expect(report.observations).toEqual([])
  })
  it.each(["MISSING", "UNAVAILABLE", "REVOKED"] as const)("preserves %s for independent optional sources without reading stale payloads", state => {
    const source = { state }
    Object.defineProperty(source, "data", { get() { throw Error("stale optional source read") } })
    const result = buildOracleContentAdapter(input([], { fileLaps: source, catalogMethod: source }))
    expect(result.laps).toEqual({ state }); expect(result.method).toEqual({ state })
  })
  it("keeps optional sources independent of journal availability and never copies private fields", () => {
    const source = ready(project())
    Object.defineProperty(source, "memo", { get() { throw Error("private source text read") } })
    const result = buildOracleContentAdapter(input([], { journal: { state: "UNAVAILABLE" }, fileLaps: source, catalogMethod: ready(binding()) }))
    expect(result.training.state).toBe("UNAVAILABLE")
    expect(result.laps.state).toBe("READY"); expect(result.method.state).toBe("READY")
    expect(JSON.stringify(result)).not.toMatch(/memo|instruction|sourceActivityId|sourceRef.*https/u)
  })
  it("does not invent a device estimate from a prepared activity or actual lap total", () => {
    const prepared = prepareDeviceActivity({ provider: "COROS", sourceId: "activity1", sourceVersion: "v1", sport: "RUNNING", startedAt: "2026-09-03T00:00:00Z",
      timeZone: "Asia/Seoul", distanceMeters: 5000, durationSeconds: 1500, durationMeaning: "TIMER", laps: [] })!
    expect(prepared.analysisEligible).toBe(false)
    const result = buildOracleContentAdapter(input([], { fileLaps: ready(prepared as unknown as ProjectedFileObservation) }))
    expect(result.laps.state).toBe("UNAVAILABLE")
    expect("device" in result).toBe(false)
    expect(buildOracleContentReading("B07", { today, ...result }).facts).toEqual([])
  })
  it("replays the existing catalog binding and retains whole-session time and exact versions", () => {
    const selected = binding()
    const result = buildOracleContentAdapter(input([], { catalogMethod: ready(selected, "plan:rev2") }))
    expect(result.method).toMatchObject({ state: "READY", sourceVersion: "plan:rev2", data: { id: "P-LT-B", purpose: "LT", form: "INTERVAL",
      requiredMinutesRange: { min: 3020 / 60, max: 3020 / 60 }, catalog: { fingerprint: selected.catalogFingerprint, calculationFingerprint: selected.calculationFingerprint, terrains: ["FLAT"] } } })
    if (result.method.state !== "READY") throw Error("method fixture")
    expect(result.method.data.places).toBeUndefined()
    expect(result.method.data.requiredMinutes).toBeUndefined()
    const reading = buildOracleContentReading("D06", { today, ...result, conditions: ready({ availableMinutes: 60, places: ["TRACK"] }) })
    expect(reading.facts.find(f => f.id === "method:minutes-gap-to-max")?.value).toBeCloseTo(60 - 3020 / 60)
    expect(reading.facts.find(f => f.id === "method:places")).toBeUndefined()
    expect(reading.sourceVersions["method.calculation"]).toBe(selected.calculationFingerprint)
    expect(reading.facts.every(f => f.sourceRefs.some(ref => ref.provenance === "REVIEWED_CATALOG"))).toBe(true)
  })
  it("uses main structure for form instead of warmup buildup recoveries", () => {
    const selected = binding("P-LT-C")
    const calculated = resolveCatalogBinding(selected)!
    expect(calculated.steps.some(step => step.phase === "warmup" && step.kind === "RECOVERY")).toBe(true)
    expect(buildOracleContentAdapter(input([], { catalogMethod: ready(selected) })).method).toMatchObject({ state: "READY", data: { form: "CONTINUOUS" } })
  })
  it("preserves non-running modality and actual catalog equipment requirements", () => {
    const result = buildOracleContentAdapter(input([], { catalogMethod: ready(binding("X-REC-03", ["BIKE_AVAILABLE"])) }))
    expect(result.method).toMatchObject({ state: "READY", data: { purpose: "REC", equipment: ["BIKE"], catalog: { modalities: ["BIKE"], requirements: ["BIKE_AVAILABLE"] } } })
    if (result.method.state !== "READY") throw Error("method fixture")
    expect(result.method.data.form).toBeUndefined()
    const reading = buildOracleContentReading("D01", { today, ...result, answers: ready({ movementForm: "CONTINUOUS", todayGoals: ["LEARN"] }), conditions: ready({ availableMinutes: 60, equipment: ["BIKE"] }) })
    expect(reading.facts.some(f => f.id === "method:form-match")).toBe(false)
    expect(reading.facts.find(f => f.id === "method:equipment")?.value).toBe("자전거")
    expect(reading.status).toBe("PARTIAL")
  })
  it("fails closed on stale fingerprints, unavailable requirements or unsupported method sources", () => {
    const selected = binding()
    for (const candidate of [{ ...selected, calculationFingerprint: `sha256:${"0".repeat(64)}` },
      { ...selected, catalogFingerprint: `sha256:${"0".repeat(64)}` },
      { ...selected, inputs: { ...selected.inputs, eventDistanceM: 600 } }, binding("X-REC-03")]) {
      expect(buildOracleContentAdapter(input([], { catalogMethod: ready(candidate) })).method.state).toBe("UNAVAILABLE")
    }
    expect(buildOracleContentAdapter(input()).method).toEqual({ state: "MISSING" })
  })
  it("carries partial source coverage instead of declaring the selected method complete", () => {
    const result = buildOracleContentAdapter(input([], { catalogMethod: { state: "READY", sourceVersion: "plan:partial", data: binding(), coverage: "PARTIAL" } }))
    expect(buildOracleContentReading("D06", { today, ...result, conditions: ready({ availableMinutes: 60 }) }).status).toBe("PARTIAL")
  })
  it("compares a selected running method with explicit preferences without profile answers", () => {
    const result = buildOracleContentAdapter(input([], { catalogMethod: ready(binding()) }))
    const reading = buildOracleContentReading("D01", { today, ...result, answers: ready({ movementForm: "INTERVAL", todayGoals: ["LEARN"] }), conditions: ready({ availableMinutes: 60 }) })
    expect(reading.status).toBe("SUFFICIENT")
    expect(reading.facts.find(f => f.id === "method:form-match")?.value).toBe("형태 선택에 포함")
  })
})

describe("Oracle calendar windows", () => {
  it.each([
    ["2026-10-04", "2026-10-01", "2026-09-01", "2026-09-30"],
    ["2026-01-01", "2026-01-01", "2025-12-01", "2025-12-31"],
    ["2024-03-01", "2024-03-01", "2024-02-01", "2024-02-29"],
    ["2025-03-01", "2025-03-01", "2025-02-01", "2025-02-28"],
  ])("%s exposes month-to-date and the previous complete calendar month", (asOf, currentStart, previousStart, previousEnd) => {
    expect(oracleContentCalendarPeriods(asOf)).toEqual({ currentMonth: { startDate: currentStart, endDate: asOf }, previousMonth: { startDate: previousStart, endDate: previousEnd } })
  })
  it("rejects invalid dates instead of normalizing an impossible month boundary", () => {
    expect(() => oracleContentCalendarPeriods("2026-02-30")).toThrow(RangeError)
  })
})
