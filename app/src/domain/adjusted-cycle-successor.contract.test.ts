import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { adjustedSuccessorFixture } from "./adjusted-plan-successor.test-fixtures"
import { adjustedCycleV5Fixture, adjustedCycleV6Fixture } from "./adjusted-cycle-successor.test-fixtures"
import { adjustedCycleSelectionMaintainsDetail, deriveAdjustedCycleResponse, prepareAdjustedCycleSuccessor,
  readAdjustedCyclePredecessor, type AdjustedCycleEvidence, type AdjustedCycleSession } from "./adjusted-cycle-successor"
import { rebindAdjustedCycleRequest, rebindAdjustedCycleRequestV3, rebindMultiAdjustedCycleRequestV3 } from "./adjusted-cycle-rebind"
import { readCatalogCycleDraftSource, catalogCycleDraftSourceStillCurrent, type CatalogCycleDraftContext } from "./catalog-cycle-draft"
import { saveSelectedAdjustedSuccessor } from "./adjusted-plan-store"
import { saveSelectedAdjustedSuccessorV3 } from "./adjusted-plan-successor-v3"
import { saveSelectedMultiAdjustedSuccessorV3 } from "./multi-adjusted-plan-successor-v3"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { readJournalOriginalPlan } from "./journal-original-plan"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { saveEntry, loadEntries, replaceAllEntries } from "./journal-store"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"
import type { PostSessionEntry } from "./journal-schema"
import type { PlanMutationLockManager } from "./plan-mutation-lock"
import { configurationReference } from "@impl/prescription/prescription-adjustment"
import { configurationReferenceV3 } from "@impl/prescription/prescription-adjustment-v3"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
type Overrides = { cycleDraft?: CatalogCycleDraftContext; futureEnvironmentConfirmed?: boolean; locks?: PlanMutationLockManager | null }
const preparedOnly = (result: ReturnType<typeof prepareAdjustedCycleSuccessor>) => {
  if (result.kind !== "prepared") throw Error(result.code)
  return result
}

async function setup(version: 4 | 5 | 6) {
  if (version === 4) {
    const f = await adjustedSuccessorFixture(at => vi.setSystemTime(at))
    const evidence: AdjustedCycleEvidence = { version, retained: f.retained }
    const rebind = () => rebindAdjustedCycleRequest(preparedOnly(f.generated.detailedContinuity[0]!), f.input.request, () => f.input.readReview(), f.now)
    return { ...f, evidence,
      rebind,
      saveRebound: (override: Overrides = {}) => {
        const rebound = rebind()
        if (rebound.kind !== "rebound") throw Error(rebound.code)
        return saveSelectedAdjustedSuccessor({ ...f.input, request: rebound.request, ...override })
      },
      currentTargetRebind: () => {
        const p = f.input.request.preparation, raw = p.source.authority.catalog[0]!.configurations[1]!
        const current = configurationReference({ familyId: p.source.current.familyId, configurationId: raw.configurationId, version: raw.version }, raw.sequence)
        return rebindAdjustedCycleRequest(preparedOnly(f.generated.detailedContinuity[0]!), { ...f.input.request,
          preparation: { ...p, source: { ...p.source, current } } }, () => f.input.readReview(), f.now)
      },
      save: (override: Overrides = {}) => saveSelectedAdjustedSuccessor({ ...f.input, ...override }),
      original: (entry: PostSessionEntry) => readJournalOriginalPlan(entry, f.retained) }
  }
  if (version === 5) {
    const f = adjustedCycleV5Fixture(at => vi.setSystemTime(at))
    const evidence: AdjustedCycleEvidence = { version, retained: f.retained }
    const rebind = () => rebindAdjustedCycleRequestV3(preparedOnly(f.generated.detailedContinuity[0]!), f.input.request, () => f.input.readReview(), f.now)
    return { ...f, evidence,
      rebind,
      saveRebound: (override: Overrides = {}) => {
        const rebound = rebind()
        if (rebound.kind !== "rebound") throw Error(rebound.code)
        return saveSelectedAdjustedSuccessorV3({ ...f.input, request: rebound.request, ...override })
      },
      currentTargetRebind: () => {
        const p = f.input.request.preparation, raw = p.source.authority.catalog[0]!.configurations[1]!
        const current = configurationReferenceV3({ familyId: p.source.current.familyId, configurationId: raw.configurationId, version: raw.version }, raw.sequence)
        return rebindAdjustedCycleRequestV3(preparedOnly(f.generated.detailedContinuity[0]!), { ...f.input.request,
          preparation: { ...p, source: { ...p.source, current } } }, () => f.input.readReview(), f.now)
      },
      save: (override: Overrides = {}) => saveSelectedAdjustedSuccessorV3({ ...f.input, ...override }),
      original: (entry: PostSessionEntry) => readJournalOriginalPlan(entry, [], f.retained) }
  }
  const f = adjustedCycleV6Fixture(at => vi.setSystemTime(at))
  const evidence: AdjustedCycleEvidence = { version, retained: f.retained }
  const rebind = () => rebindMultiAdjustedCycleRequestV3(preparedOnly(f.generated.detailedContinuity[0]!), f.input.request, () => f.input.readReview(), f.now)
  return { ...f, evidence,
    rebind,
    saveRebound: (override: Overrides = {}) => {
      const rebound = rebind()
      if (rebound.kind !== "rebound") throw Error(rebound.code)
      return saveSelectedMultiAdjustedSuccessorV3({ ...f.input, request: rebound.request, ...override })
    },
    currentTargetRebind: () => rebindMultiAdjustedCycleRequestV3(preparedOnly(f.generated.detailedContinuity[0]!), { ...f.input.request,
      preparations: f.input.request.preparations.map(p => {
        const raw = p.source.authority.catalog[0]!.configurations[1]!
        const current = configurationReferenceV3({ familyId: p.source.current.familyId, configurationId: raw.configurationId, version: raw.version }, raw.sequence)
        return { ...p, source: { ...p.source, current } }
      }) }, () => f.input.readReview(), f.now),
    save: (override: Overrides = {}) => saveSelectedMultiAdjustedSuccessorV3({ ...f.input, ...override }),
    original: (entry: PostSessionEntry) => readJournalOriginalPlan(entry, [], [], f.retained) }
}

function linkedEntry(f: Awaited<ReturnType<typeof setup>>): PostSessionEntry {
  const state = f.old.state.selection, session = state.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD"
    || s.prescription.kind === "ADJUSTED_METHOD_V3")!
  const link = createPlannedSessionLogDraft<AdjustedCycleSession>(state, session, f.now.toISOString())!.link
  return { id: `adjusted-${f.evidence.version}`, kind: "post-session", date: link.plannedDate,
    savedAt: f.now.toISOString(), syncState: "local", plannedSessionLink: link,
    memoPurpose: "PRIVATE_SELF_ONLY", system: "", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "",
    rpe: 10, fieldProvenance: { rpe: { provenance: "EXPLICIT" } }, activityOutcome: "COMPLETED" }
}

for (const version of [4, 5, 6] as const) {
  it(`V${version} rebinds the exact current AFTER detail and preserves real original journal links after saving`, async () => {
    const f = await setup(version), entry = linkedEntry(f), before = JSON.stringify(f.old.state)
    expect(f.rebind()).toMatchObject({ kind: "rebound" })
    expect(preparedOnly(f.generated.detailedContinuity[0]!).rows.every(r => r.sourceNotation === r.targetNotation && r.sourceNotation.length > 0)).toBe(true)
    expect(f.generated.cycleResponse).toMatchObject({ recommendation: "MAINTAIN", comparableRpeCount: 0 })
    expect(saveEntry(entry).ok).toBe(true)
    const context = readCatalogCycleDraftSource(f.old.state, f.evidence)!.context
    const saved = await f.saveRebound({ cycleDraft: context })
    if (saved.kind !== "saved") throw Error(saved.code)
    expect(adjustedCycleSelectionMaintainsDetail(f.old.state, saved.state.selection)).toBe(true)
    expect(readAdjustedCyclePredecessor(saved.state, f.evidence, f.now)).not.toBeNull()
    expect(saved.state.selection.periodization.frameOrdinal).toBe(2)
    expect(f.original(entry)).toMatchObject({ source: "ARCHIVED", state: f.old.state })
    expect(loadEntries()).toContainEqual(entry)
    expect(JSON.stringify(f.old.state)).toBe(before)
  }, 20000)

  it(`V${version} does not invent a self-edge when the exact AFTER is now the offer baseline`, async () => {
    const f = await setup(version)
    expect(f.currentTargetRebind().kind).toBe("rejected")
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(f.old.raw)
  }, 20000)

  it(`V${version} refuses missing cycle evidence and missing future environment confirmation without writes`, async () => {
    const f = await setup(version)
    expect(await f.save({ cycleDraft: undefined })).toMatchObject({ code: "CYCLE_EVIDENCE_CHANGED" })
    expect(await f.save({ futureEnvironmentConfirmed: false })).toMatchObject({ code: "FUTURE_ENVIRONMENT_CONFIRMATION_REQUIRED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(f.old.raw)
  }, 20000)

  it(`V${version} captures sub-display numeric detail, excludes private text, and detects structured conflicts`, async () => {
    const f = await setup(version), base = linkedEntry(f), link = base.plannedSessionLink!
    const entry: PostSessionEntry = { ...base, exerciseLog: { version: 1, source: "SELF_REPORTED", components: [], plannedRepetitions: {
      version: 1, source: "SELF_REPORTED", plannedSessionId: link.plannedSessionId, sessionContentFingerprint: link.sessionContentFingerprint,
      results: [{ set: 1, repetition: 1, distanceM: 400, seconds: 60.001, recoverySeconds: 30 }] } } }
    expect(saveEntry(entry).ok).toBe(true)
    const source = readCatalogCycleDraftSource(f.old.state, f.evidence)!
    const changed = structuredClone(entry)
    changed.exerciseLog!.plannedRepetitions!.results[0]!.seconds = 60.002
    expect(replaceAllEntries([changed]).ok).toBe(true)
    expect(catalogCycleDraftSourceStillCurrent(f.old.state, source.context, f.evidence)).toBe(false)
    const current = deriveAdjustedCycleResponse([changed], f.old.state)
    expect(current.rows[0]).toMatchObject({ comparison: "CHANGED_SESSION", executionComparison: { kind: "unavailable" } })
    expect(current.rows[0]!.executionFingerprint).not.toBe(source.response.rows[0]!.executionFingerprint)
    expect(deriveAdjustedCycleResponse([entry, changed], f.old.state)).toMatchObject({ conflictCount: 1, comparableRpeCount: 0 })
    Object.defineProperty(changed, "memo", { get() { throw Error("private memo read") } })
    Object.defineProperty(changed, "title", { get() { throw Error("title read") } })
    Object.defineProperty(changed.exerciseLog!, "components", { get() { throw Error("exercise names read") } })
    expect(deriveAdjustedCycleResponse([changed, changed], f.old.state)).toMatchObject({ duplicateCount: 1, recommendation: "MAINTAIN" })
  }, 20000)

  it(`V${version} rereads journal evidence after waiting for the lock`, async () => {
    const f = await setup(version), entry = linkedEntry(f)
    const locks: PlanMutationLockManager = { request: async (_n, _o, callback) => { expect(saveEntry(entry).ok).toBe(true); return callback({}) } }
    expect(await f.save({ locks })).toMatchObject({ code: "CYCLE_EVIDENCE_CHANGED" })
    expect(localStorage.getItem(activePlanBetaStorageKey())).toBe(f.old.raw)
  }, 20000)

  it(`V${version} rolls back only its archive when journal evidence changes between writes`, async () => {
    const f = await setup(version), entry = linkedEntry(f), original = Storage.prototype.setItem
    const archiveBefore = Object.fromEntries(Object.entries(localStorage)), active = activePlanBetaStorageKey()
    let injected = false
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      original.call(this, key, value)
      if (!injected && key !== active && key.includes("plan-originals")) { injected = true; expect(saveEntry(entry).ok).toBe(true) }
    })
    expect(await f.save()).toMatchObject({ code: "SUCCESSOR_STORAGE_WRITE_FAILED" })
    expect(injected).toBe(true)
    expect(localStorage.getItem(active)).toBe(f.old.raw)
    for (const key of Object.keys(localStorage).filter(k => k.includes("plan-originals"))) expect(localStorage.getItem(key)).toBe(archiveBefore[key] ?? null)
    expect(loadEntries()).toContainEqual(entry)
  }, 20000)

  it(`V${version} mutation guard rejects changed AFTER detail and keeps prepared sources detached`, async () => {
    const f = await setup(version), previous = JSON.stringify(f.old.state)
    const changed = structuredClone(f.old.state.selection)
    const adjusted = changed.activePlan.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD" || s.prescription.kind === "ADJUSTED_METHOD_V3")!
    if (adjusted.prescription.kind === "ADJUSTED_METHOD" || adjusted.prescription.kind === "ADJUSTED_METHOD_V3") {
      Reflect.set(adjusted.prescription.snapshot.receipt.after.configuration, "configurationId", "CHANGED")
    }
    expect(adjustedCycleSelectionMaintainsDetail(f.old.state, changed)).toBe(false)
    const prepared = preparedOnly(f.generated.detailedContinuity[0]!)
    Reflect.set(prepared.rows[0]!.source, "day", 100)
    expect(JSON.stringify(f.old.state)).toBe(previous)
    const emptyEvidence: AdjustedCycleEvidence = { version, retained: [] }
    expect(prepareAdjustedCycleSuccessor({ previous: f.old.state, evidence: emptyEvidence,
      expectedPredecessorFingerprint: f.old.state.contentFingerprint, candidate: f.generated.draft.generated.candidates[0],
      nextStartDate: f.generated.draft.intake.startDate!, currentCheck: "NO_KNOWN_RISK", entries: [], evaluatedAt: f.now }))
      .toMatchObject({ kind: "rejected", code: "INVALID_STORED_PLAN" })
  }, 20000)
}
