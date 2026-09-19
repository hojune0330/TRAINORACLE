import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { accountPlanPacketFixture } from "../account/account-plan.test-fixtures"
import { accountPlanEntry } from "../account/account-plan-document-schema"
import {
  markCurrentConfirmedAccountJournalProjection, putAccountJournalProjection, resetAccountJournalProjection,
  setAccountJournalProjectionStatus,
} from "../account/account-journal-projection"
import { setActiveLocalAccount } from "../account/local-journal-ownership"
import type { PostSessionEntry } from "../journal-schema"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { buildFileObservation, completeLapTotal } from "./file-observation"
import { projectFileObservation } from "./file-analysis"
import type { ComparisonRelationV1 } from "./comparison-relation"
import { readPersistedComparisonReadContext, type PersistedComparisonReadContext } from "./comparison-relation-read"
import {
  compareFileToPlan, comparePreviousFilePerformance, comparisonObservationInterpretationFingerprint,
  prepareComparisonRelation, resolveComparisonOriginal, resolveComparisonPlanSessions, validateComparisonRelationOriginalMapping,
} from "./file-plan-comparison"

const owner = "synthetic-restore-owner-a"
const at = TODAY.toISOString()

function fixture(id = "restored-journal") {
  // The shared generator fixture seeds device records before account hydration.
  setActiveLocalAccount(null)
  localStorage.clear()
  const snapshot = accountPlanEntry(accountPlanPacketFixture(4), at).snapshot
  setActiveLocalAccount(owner)
  const sessions = resolveComparisonPlanSessions(snapshot)
  if (sessions.status !== "ORIGINAL_SESSIONS") throw Error("Original sessions missing")
  const original = sessions.originals.find(value => value.segments.length > 0)!
  const laps = original.segments.map((segment, sourceIndex) => ({ sourceIndex, distanceMeters: segment.distanceMeters ?? 100,
    durationSeconds: segment.durationSeconds ?? 40, durationMeaning: "TIMER" as const, kind: "UNKNOWN" as const }))
  const file = buildFileObservation({
    format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "v1", sourceActivityId: id,
    date: "2026-08-17", startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: laps.reduce((sum, lap) => sum + lap.distanceMeters, 0),
    durationSeconds: laps.reduce((sum, lap) => sum + lap.durationSeconds, 0),
    durationMeaning: "TIMER", confirmation: { sport: null, durationMeaning: null }, laps,
  })
  const entry: PostSessionEntry = { id, kind: "post-session", date: file.date, savedAt: at, syncState: "synced",
    system: "", title: "", memo: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, fileObservation: file }
  const projection = projectFileObservation(entry, { sourceContext: "ACCOUNT_CONFIRMED" })
  if (projection.status !== "ACCEPTED") throw Error(projection.reasonCode)
  const observation = projection.observation
  const relation: ComparisonRelationV1 = { schemaVersion: 1, relationId: "10000000-0000-4000-8000-000000000001",
    journalId: id, journalRevisionAtConfirmation: 4, contentRevisionFingerprint: observation.contentRevisionFingerprint,
    observationInterpretationFingerprint: comparisonObservationInterpretationFingerprint(observation), original: original.original,
    mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED", createdAt: at, releasedAt: null,
    segmentMappings: original.segments.map((segment, sourceLapIndex) => ({ planSegmentId: segment.id, sourceLapIndex,
      confirmedKind: segment.kind, confirmedTargetUnit: segment.targetUnit, confirmedDurationMeaning: "TIMER",
      confirmedRecoveryMode: segment.recoveryMode as ComparisonRelationV1["segmentMappings"][number]["confirmedRecoveryMode"] })),
  }
  return { snapshot, original, observation, relation, entry: { ...entry, comparisonRelations: [relation] } }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  localStorage.clear()
  sessionStorage.clear()
  vi.stubEnv("VITE_FEATURE_FILE_ANALYSIS_TCX", "true")
  vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "false")
  setActiveLocalAccount(owner)
  resetAccountJournalProjection(owner)
})
afterEach(() => {
  setActiveLocalAccount(null)
  resetAccountJournalProjection(null)
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("current acknowledged persisted comparison read", () => {
  it("keeps stale restored history nonquantitative until exact content and interpretation revert, not permanently invalid", () => {
    const f = fixture(), file = f.entry.fileObservation!
    const laps = file.laps.map((lap, index) => index === 0 ? { ...lap, distanceMeters: lap.distanceMeters! + 10 } : lap)
    const differentContent = buildFileObservation({
      format: file.format, sourceProfile: file.sourceProfile, parserVersion: file.parserVersion,
      sourceActivityId: file.sourceActivityId, sourceIdentityFingerprint: file.sourceIdentityFingerprint,
      date: file.date, startedAt: file.startedAt, timeZone: file.timeZone, sport: file.sport,
      distanceMeters: completeLapTotal(laps, "distanceMeters"), durationSeconds: file.durationSeconds,
      durationMeaning: file.durationMeaning, confirmation: file.confirmation, laps,
    })
    const differentInterpretation = { ...file, confirmation: { sport: "WALKING" as const, durationMeaning: null } }
    expect(differentContent.contentRevisionFingerprint).not.toBe(file.contentRevisionFingerprint)
    expect(differentInterpretation.contentRevisionFingerprint).toBe(file.contentRevisionFingerprint)
    const released = { ...f.relation, relationId: "10000000-0000-4000-8000-000000000002", releasedAt: at }
    const history = [released, f.relation], before = JSON.stringify(history)
    const restored = { ...f.entry, comparisonRelations: history }
    for (const value of history) expect(validateComparisonRelationOriginalMapping(value, f.original).status).toBe("VALID_ORIGINAL_MAPPING")
    for (const changedFile of [differentContent, differentInterpretation]) {
      resetAccountJournalProjection(owner)
      const changedEntry = { ...restored, fileObservation: changedFile }
      markCurrentConfirmedAccountJournalProjection(owner, changedEntry, 1)
      const changed = projectFileObservation(changedEntry, { sourceContext: "ACCOUNT_CONFIRMED" })
      if (changed.status !== "ACCEPTED") throw Error("Changed observation missing")
      const staleContext = readPersistedComparisonReadContext(restored.id, f.relation.relationId)
      const stale = compareFileToPlan(f.original, changed.observation, f.relation, 1, staleContext)
      expect(stale.status).toBe("INVALID_COMPARISON")
      expect(stale).not.toHaveProperty("rows")
      expect(compareFileToPlan(f.original, changed.observation, f.relation, 5))
        .toMatchObject({ status: "INVALID_COMPARISON", reason: "OBSERVATION_CHANGED" })

      markCurrentConfirmedAccountJournalProjection(owner, restored, 2)
      const currentContext = readPersistedComparisonReadContext(restored.id, f.relation.relationId)
      expect(currentContext).not.toBeNull()
      expect(compareFileToPlan(f.original, f.observation, f.relation, 2, currentContext).status).toBe("QUANTITATIVE_COMPARISON")
      expect(compareFileToPlan(f.original, f.observation, f.relation, 5).status).toBe("QUANTITATIVE_COMPARISON")
      expect(compareFileToPlan(f.original, f.observation, released, 2)).toMatchObject({ reason: "RELATION_RELEASED" })
      expect(f.relation.journalRevisionAtConfirmation).toBe(4)
      expect(JSON.stringify(history)).toBe(before)
    }
  })

  it("reads a validated restored relation at revision one without rewriting historical revision four or weakening CAS", () => {
    const f = fixture(), before = JSON.stringify(f.entry)
    markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
    const context = readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)
    expect(context).not.toBeNull()
    const write = vi.spyOn(Storage.prototype, "setItem")
    expect(compareFileToPlan(f.original, f.observation, f.relation, 1)).toMatchObject({ reason: "REVISION_BEFORE_CONFIRMATION" })
    expect(compareFileToPlan(f.original, f.observation, f.relation, 1, context!)).toMatchObject({ status: "QUANTITATIVE_COMPARISON", executionAuthority: "NONE" })
    const reopened = resolveComparisonOriginal(f.snapshot, { ...f.relation.original,
      session: { ...f.relation.original.session, linkedAt: "2026-09-19T10:00:00.000Z" } })
    expect(compareFileToPlan(reopened, f.observation, f.relation, 1, context!).status).toBe("QUANTITATIVE_COMPARISON")
    const request = { action: "confirmComparisonRelation", documentId: "20000000-0000-4000-8000-000000000001",
      operationId: "30000000-0000-4000-8000-000000000001", expectedRevision: 1, relation: f.relation }
    expect(prepareComparisonRelation(request, f.original, f.observation, 1)).toMatchObject({ reason: "CAS_OR_REQUEST_INVALID" })
    expect(prepareComparisonRelation({ ...request, expectedRevision: 4 }, f.original, f.observation, 1))
      .toMatchObject({ reason: "CAS_OR_REQUEST_INVALID" })
    expect(JSON.stringify(f.entry)).toBe(before)
    expect(f.relation.journalRevisionAtConfirmation).toBe(4)
    expect(write).not.toHaveBeenCalled()
  })

  it("does not mint from an offline ACK cache, invalid relation, released relation or disabled file format", () => {
    const f = fixture()
    putAccountJournalProjection(owner, f.entry, true)
    expect(readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)).toBeNull()
    for (const relation of [
      { ...f.relation, journalId: "other" }, { ...f.relation, releasedAt: at },
      { ...f.relation, contentRevisionFingerprint: `sha256:${"f".repeat(64)}` },
      { ...f.relation, persistedAuthority: true },
    ]) {
      markCurrentConfirmedAccountJournalProjection(owner, { ...f.entry, comparisonRelations: [relation] }, 1)
      expect(readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)).toBeNull()
    }
    markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
    vi.stubEnv("VITE_KILL_FILE_ANALYSIS_TCX", "true")
    expect(readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)).toBeNull()
  })

  it("rejects copied tokens and exact relation, file, revision or mapping substitutions", () => {
    const f = fixture()
    markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
    const context = readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)!
    for (const forged of [{}, { ...context }, structuredClone(context), JSON.parse(JSON.stringify(context))]) {
      expect(compareFileToPlan(f.original, f.observation, f.relation, 1, forged as PersistedComparisonReadContext)).toMatchObject({ status: "INVALID_COMPARISON" })
    }
    const changedMapping = structuredClone(f.relation)
    changedMapping.segmentMappings[0]!.sourceLapIndex += 1
    for (const changed of [changedMapping, { ...f.relation, journalRevisionAtConfirmation: 3 },
      { ...f.relation, releasedAt: at }, { ...f.relation, createdAt: "2026-08-17T11:00:00.000Z" }]) {
      expect(compareFileToPlan(f.original, f.observation, changed, 1, context)).toMatchObject({ status: "INVALID_COMPARISON" })
    }
    expect(compareFileToPlan(f.original, f.observation, f.relation, 2, context)).toMatchObject({ status: "INVALID_COMPARISON" })
    const changedEntry = { ...f.entry, fileObservation: { ...f.entry.fileObservation!, confirmation: { sport: "WALKING" as const, durationMeaning: null } } }
    const changed = projectFileObservation(changedEntry, { sourceContext: "ACCOUNT_CONFIRMED" })
    if (changed.status !== "ACCEPTED") throw Error("Changed observation missing")
    expect(compareFileToPlan(f.original, changed.observation, f.relation, 1, context)).toMatchObject({ status: "INVALID_COMPARISON" })
  })

  it("invalidates on hydration failure, acknowledgement replacement and owner ABA even with identical data", () => {
    const f = fixture()
    for (const invalidate of [
      () => setAccountJournalProjectionStatus(owner, "FAILED"),
      () => markCurrentConfirmedAccountJournalProjection(owner, f.entry, 2),
      () => { setActiveLocalAccount("synthetic-restore-owner-b"); setActiveLocalAccount(owner) },
      () => resetAccountJournalProjection(owner),
    ]) {
      resetAccountJournalProjection(owner)
      markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
      const context = readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)!
      invalidate()
      expect(compareFileToPlan(f.original, f.observation, f.relation, 1, context)).toMatchObject({ status: "INVALID_COMPARISON" })
      resetAccountJournalProjection(owner)
      markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
      expect(compareFileToPlan(f.original, f.observation, f.relation, 1, context)).toMatchObject({ status: "INVALID_COMPARISON" })
    }
  })

  it("still requires the exact original and current mapping semantics after a server acknowledgement", () => {
    const f = fixture()
    markCurrentConfirmedAccountJournalProjection(owner, f.entry, 1)
    const context = readPersistedComparisonReadContext(f.entry.id, f.relation.relationId)!
    expect(compareFileToPlan(resolveComparisonOriginal(null, f.relation.original), f.observation, f.relation, 1, context))
      .toMatchObject({ status: "TEMPORARY_COMPARISON" })
    const bad = structuredClone(f.relation)
    bad.segmentMappings[0]!.planSegmentId = "missing-segment"
    markCurrentConfirmedAccountJournalProjection(owner, { ...f.entry, comparisonRelations: [bad] }, 1)
    const badContext = readPersistedComparisonReadContext(f.entry.id, bad.relationId)!
    expect(compareFileToPlan(f.original, f.observation, bad, 1, badContext)).toMatchObject({ reason: "MAPPING_ADDRESS_OR_ORDER" })
    const interpretation = { ...f.relation, observationInterpretationFingerprint: `sha256:${"f".repeat(64)}` }
    markCurrentConfirmedAccountJournalProjection(owner, { ...f.entry, comparisonRelations: [interpretation] }, 1)
    expect(compareFileToPlan(f.original, f.observation, interpretation, 1,
      readPersistedComparisonReadContext(f.entry.id, interpretation.relationId)!)).toMatchObject({ reason: "OBSERVATION_CHANGED" })
  })

  it("threads separate read contexts through previous-performance comparison without inventing compatibility", () => {
    const a = fixture("current-journal"), b = fixture("previous-journal")
    markCurrentConfirmedAccountJournalProjection(owner, a.entry, 1)
    markCurrentConfirmedAccountJournalProjection(owner, b.entry, 1)
    const current = { original: a.original, observation: a.observation, relation: a.relation, journalRevision: 1,
      persistedReadContext: readPersistedComparisonReadContext(a.entry.id, a.relation.relationId)! }
    const previous = { original: b.original, observation: b.observation, relation: b.relation, journalRevision: 1,
      persistedReadContext: readPersistedComparisonReadContext(b.entry.id, b.relation.relationId)! }
    const ordinary = comparePreviousFilePerformance({ ...current, journalRevision: 5, persistedReadContext: undefined },
      { ...previous, journalRevision: 5, persistedReadContext: undefined })
    expect(ordinary.status).toBe("PREVIOUS_QUANTITATIVE_COMPARISON")
    expect(comparePreviousFilePerformance(current, previous)).toEqual(ordinary)
    expect(comparePreviousFilePerformance(current, { ...previous, persistedReadContext: current.persistedReadContext }))
      .toMatchObject({ status: "PREVIOUS_COMPARISON_UNAVAILABLE", reason: "CONFIRMED_MAPPING_REQUIRED" })
  })
})
