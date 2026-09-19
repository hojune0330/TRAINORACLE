import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createActiveSnapshot } from "@impl/plan-generator/selection"
import { accountPlanPacketFixture } from "../account/account-plan.test-fixtures"
import { accountPlanEntry, accountPlanFingerprint, emptyAccountPlanDocument, validateAccountPlanPacket } from "../account/account-plan-document-schema"
import { splitAccountPlanCollection } from "../account/account-plan-collection-schema"
import { createPlannedSessionLogDraft } from "../planned-session-link"
import { TODAY } from "../prescription-quality-matrix.test-fixtures"
import { buildFileObservation, type FileObservationInput } from "./file-observation"
import { projectFileObservation, type ProjectedFileObservation } from "./file-analysis"
import type { ComparisonRelationV1, ComparisonSegmentMapping } from "./comparison-relation"
import { compareFileToPlan, comparePreviousFilePerformance, comparisonObservationInterpretationFingerprint, prepareComparisonRelation,
  resolveComparisonOriginal, resolveComparisonOriginalFromPlanDocument, resolveComparisonOriginalFromPlanCollection,
  sameComparisonOriginalIdentity, validateComparisonRelationBinding, validateComparisonRelationOriginalMapping, type VerifiedComparisonOriginal } from "./file-plan-comparison"

const relationId = "10000000-0000-4000-8000-000000000001"
const at = TODAY.toISOString()
function fixture(version: 2 | 3 | 4 | 5 | 6 = 4, pace = false) {
  localStorage.clear()
  let packet = accountPlanPacketFixture(version)
  if (pace) {
    if (packet.state.version !== 4) throw Error("pace fixture needs v4 origin")
    const state = packet.state.selection
    packet = { evidence: null, state: { version: 3, intake: state.intake, athleteEvidence: state.athleteEvidence,
      activePlan: createActiveSnapshot(state.adjustment.originalCandidate, "SELF"), generatedAt: state.generatedAt, progress: [] } }
  }
  const entry = accountPlanEntry(packet, at), snapshot = entry.snapshot
  const state = snapshot.state.version === 2 || snapshot.state.version === 3 ? snapshot.state : snapshot.state.selection
  const session = state.activePlan.sessions.find(s => pace ? s.prescription.kind === "PACE_TARGET" : s.prescription.kind.startsWith("ADJUSTED_METHOD")) ?? state.activePlan.sessions[0]!
  const reference = { planFingerprint: entry.planId, session: createPlannedSessionLogDraft(state, session, at)!.link }
  const original = resolveComparisonOriginal(snapshot, reference)
  if (original.status !== "ORIGINAL_VERIFIED") throw Error("Original fixture did not validate")
  return { entry, snapshot, state, session, reference, original }
}
function observation(laps: FileObservationInput["laps"], patch: Partial<FileObservationInput> = {}, id = "journal-synthetic"): ProjectedFileObservation {
  const sum = (field: "distanceMeters" | "durationSeconds") => laps.length === 0 || laps.some(lap => lap[field] === null) ? null : laps.reduce((sum, lap) => sum + lap[field]!, 0)
  const fileObservation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-observation-1",
    sourceActivityId: id, date: "2026-08-17", startedAt: null, timeZone: null, sport: "RUNNING",
    distanceMeters: sum("distanceMeters"), durationSeconds: sum("durationSeconds"), durationMeaning: "SOURCE_DEFINED", laps,
    confirmation: { durationMeaning: "TIMER", sport: "RUNNING" }, ...patch })
  const result = projectFileObservation({ id, kind: "post-session", date: fileObservation.date, fileObservation }, { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED" })
  if (result.status !== "ACCEPTED") throw Error(result.reasonCode)
  return result.observation
}
function lapsFor(original: VerifiedComparisonOriginal): FileObservationInput["laps"] {
  return original.segments.map((segment, sourceIndex) => ({ sourceIndex, distanceMeters: segment.distanceMeters ?? 100,
    durationSeconds: segment.durationSeconds ?? 40, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }))
}
function relation(original: VerifiedComparisonOriginal, actual: ProjectedFileObservation): ComparisonRelationV1 {
  return { schemaVersion: 1, relationId, journalId: actual.journalEntryId, journalRevisionAtConfirmation: 7,
    contentRevisionFingerprint: actual.contentRevisionFingerprint, observationInterpretationFingerprint: comparisonObservationInterpretationFingerprint(actual),
    original: original.original, mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED", createdAt: at, releasedAt: null,
    segmentMappings: original.segments.map((segment, sourceLapIndex) => ({ planSegmentId: segment.id, sourceLapIndex,
      confirmedKind: segment.kind, confirmedTargetUnit: segment.targetUnit, confirmedDurationMeaning: "TIMER",
      confirmedRecoveryMode: segment.recoveryMode as ComparisonSegmentMapping["confirmedRecoveryMode"] })) }
}
const request = (value: ComparisonRelationV1) => ({ action: "confirmComparisonRelation", documentId: "20000000-0000-4000-8000-000000000001",
  operationId: "30000000-0000-4000-8000-000000000001", expectedRevision: 7, relation: value })
function input(original: VerifiedComparisonOriginal, actual: ProjectedFileObservation, value = relation(original, actual)) {
  return { original, observation: actual, relation: value, journalRevision: 8 }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(TODAY); localStorage.clear(); sessionStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe("exact selected immutable comparison original", () => {
  it.each([2, 3, 4, 5, 6] as const)("reads V%s through existing historical evidence validators without writes", version => {
    const f = fixture(version), before = JSON.stringify(f.snapshot)
    const write = vi.spyOn(Storage.prototype, "setItem")
    const value = resolveComparisonOriginal(f.snapshot, f.reference)
    expect(value).toMatchObject({ status: "ORIGINAL_VERIFIED", executionAuthority: "NONE", original: f.reference })
    expect(JSON.stringify(f.snapshot)).toBe(before)
    expect(write).not.toHaveBeenCalled()
    expect(Object.isFrozen(f.reference.session)).toBe(false)
    expect(value.status === "ORIGINAL_VERIFIED" && value.original.session).not.toBe(f.reference.session)
    if (version < 4) expect(value).toMatchObject({ segments: [], limitation: "NO_EXPLICIT_SEGMENTS" })
    else expect(f.original.segments.filter(s => s.phase === "main" && s.kind === "WORK").length).toBeGreaterThan(0)
  })

  it("looks up the selected archived plan, never the current plan or a summary", () => {
    const f = fixture(), doc = emptyAccountPlanDocument()
    doc.data.plans = [{ ...f.entry, archivedAt: at }, accountPlanEntry(accountPlanPacketFixture(3), at)]
    doc.data.currentPlanId = doc.data.plans[1]!.planId
    expect(resolveComparisonOriginalFromPlanDocument(doc, f.reference).status).toBe("ORIGINAL_VERIFIED")
    expect(resolveComparisonOriginalFromPlanDocument({ ...doc, data: { ...doc.data, plans: [doc.data.plans[1]] } }, f.reference).status).toBe("TEMPORARY_COMPARISON")
    expect(resolveComparisonOriginal({ summary: f.session }, f.reference).status).toBe("TEMPORARY_COMPARISON")
    expect(resolveComparisonOriginal(doc.data.plans[1]!.snapshot, f.reference).status).toBe("TEMPORARY_COMPARISON")
  })

  it("rejects changed snapshot, date, slot, session content and missing retained evidence", () => {
    const f = fixture()
    for (const patch of [{ sessionSlot: "PM" }, { plannedDate: "2026-08-18" }, { sessionDay: 99 },
      { sessionContentFingerprint: `sha256:${"f".repeat(64)}` }]) {
      expect(resolveComparisonOriginal(f.snapshot, { ...f.reference, session: { ...f.reference.session, ...patch } }).status).toBe("TEMPORARY_COMPARISON")
    }
    const changed = structuredClone(f.snapshot)
    Reflect.set(changed.state, "updatedAt", "2026-08-18T03:00:00.000Z")
    expect(resolveComparisonOriginal(changed, f.reference).status).toBe("TEMPORARY_COMPARISON")
    expect(resolveComparisonOriginal({ ...f.snapshot, evidence: null }, f.reference).status).toBe("TEMPORARY_COMPARISON")
    expect(resolveComparisonOriginal(f.snapshot, { ...f.reference, planFingerprint: `sha256:${"f".repeat(64)}` }).status).toBe("TEMPORARY_COMPARISON")
  })

  it("rejects internally consistent links for another date, slot or prescription in the selected snapshot", () => {
    const f = fixture(4, true)
    const state = { ...f.state, intake: { ...f.state.intake, startDate: "2026-08-18" } }
    const differentDate = createPlannedSessionLogDraft(state, f.session, at)!.link
    expect(resolveComparisonOriginal(f.snapshot, { ...f.reference, session: differentDate }).status).toBe("TEMPORARY_COMPARISON")
    const moved = { ...f.session, slot: f.session.slot === "AM" ? "PM" as const : "AM" as const }
    const otherSlot = createPlannedSessionLogDraft({ ...f.state, activePlan: { ...f.state.activePlan, sessions: [moved] } }, moved, at)!.link
    expect(resolveComparisonOriginal(f.snapshot, { ...f.reference, session: otherSlot }).status).toBe("TEMPORARY_COMPARISON")
    if (f.session.prescription.kind !== "PACE_TARGET") throw Error("pace fixture")
    const edited = { ...f.session, prescription: { ...f.session.prescription, targetRepSeconds: f.session.prescription.targetRepSeconds + 1 } }
    const otherContent = createPlannedSessionLogDraft({ ...f.state, activePlan: { ...f.state.activePlan, sessions: [edited] } }, edited, at)!.link
    expect(resolveComparisonOriginal(f.snapshot, { ...f.reference, session: otherContent }).status).toBe("TEMPORARY_COMPARISON")
  })

  it("requires an acknowledged collection index and exact snapshot/progress hashes", () => {
    const f = fixture(), document = emptyAccountPlanDocument()
    document.data.plans = [f.entry]
    const parts = splitAccountPlanCollection(document)
    const resolve = (index: unknown, snapshot: unknown, progress: unknown) => resolveComparisonOriginalFromPlanCollection(index, snapshot, progress, f.reference)
    expect(resolve(parts.index, parts.snapshots[0], parts.progress[0]).status).toBe("ORIGINAL_VERIFIED")
    expect(resolve(null, parts.snapshots[0], parts.progress[0]).status).toBe("TEMPORARY_COMPARISON")
    expect(resolve({ ...parts.index, plans: [] }, parts.snapshots[0], parts.progress[0]).status).toBe("TEMPORARY_COMPARISON")
    expect(resolve(parts.index, parts.snapshots[0], { ...parts.progress[0], archivedAt: "2026-08-16T03:00:00.000Z" }).status).toBe("TEMPORARY_COMPARISON")
    expect(resolve(parts.index, { ...parts.snapshots[0], planId: `sha256:${"f".repeat(64)}` }, parts.progress[0]).status).toBe("TEMPORARY_COMPARISON")
  })

  it("does not accept materialized progress as an immutable snapshot or a JSON attestation", () => {
    const f = fixture(3), changed = structuredClone(f.snapshot)
    Reflect.set(changed.state, "progress", [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }])
    expect(validateAccountPlanPacket(changed)).toBe(true)
    expect(resolveComparisonOriginal(changed, { ...f.reference, planFingerprint: accountPlanFingerprint(changed) }).status).toBe("TEMPORARY_COMPARISON")
    const actual = observation([])
    expect(compareFileToPlan(structuredClone(f.original), actual).status).toBe("TEMPORARY_COMPARISON")
    expect(Object.isFrozen(f.original.original.session)).toBe(true)
  })
})

describe("historical original mapping validation", () => {
  it("validates active, stale and released history without filtering, sorting or rewriting its exact list", () => {
    const f = fixture(4, true), actual = observation(lapsFor(f.original))
    const stale = { ...relation(f.original, actual), contentRevisionFingerprint: `sha256:${"f".repeat(64)}`,
      observationInterpretationFingerprint: `sha256:${"e".repeat(64)}` }
    const released = { ...stale, relationId: "10000000-0000-4000-8000-000000000002", releasedAt: at }
    const history = Object.freeze([released, stale]), before = JSON.stringify(history)
    const write = vi.spyOn(Storage.prototype, "setItem")
    for (const value of history) {
      expect(validateComparisonRelationOriginalMapping(value, f.original)).toEqual({ status: "VALID_ORIGINAL_MAPPING", executionAuthority: "NONE" })
      expect(compareFileToPlan(f.original, actual, value, 8).status).toBe("INVALID_COMPARISON")
    }
    const reopened = resolveComparisonOriginal(f.snapshot, { ...f.reference,
      session: { ...f.reference.session, linkedAt: "2026-09-19T10:00:00.000Z" } })
    expect(validateComparisonRelationOriginalMapping(stale, reopened).status).toBe("VALID_ORIGINAL_MAPPING")
    expect(JSON.stringify(history)).toBe(before)
    expect(history[0]).toBe(released)
    expect(history[1]).toBe(stale)
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects changed plan segment IDs, order, kind and unit even when preserving stale history", () => {
    const f = fixture(4, true), value = relation(f.original, observation(lapsFor(f.original)))
    const first = value.segmentMappings[0]!, second = value.segmentMappings[1]!
    const variants = [
      { ...value, segmentMappings: [{ ...first, planSegmentId: "missing-plan-segment" }] },
      { ...value, segmentMappings: [{ ...second, sourceLapIndex: 0 }, { ...first, sourceLapIndex: 1 }] },
      { ...value, segmentMappings: [{ ...first, sourceLapIndex: 1 }, { ...second, sourceLapIndex: 0 }] },
      { ...value, segmentMappings: [{ ...first, confirmedKind: first.confirmedKind === "WORK" ? "RECOVERY" : "WORK", confirmedRecoveryMode: null }] },
      { ...value, segmentMappings: [{ ...first, confirmedTargetUnit: first.confirmedTargetUnit === "DISTANCE" ? "DURATION" : "DISTANCE" }] },
      { ...value, segmentMappings: [first, first] },
      { ...value, historicalAuthority: true },
    ]
    expect(validateComparisonRelationOriginalMapping(value, f.original).status).toBe("VALID_ORIGINAL_MAPPING")
    for (const changed of variants) {
      expect(validateComparisonRelationOriginalMapping(changed, f.original).status).toBe("INVALID_COMPARISON")
    }
  })

  it("requires a verified exact original, never a JSON attestation or a different selected plan", () => {
    const f = fixture(4, true), value = relation(f.original, observation(lapsFor(f.original)))
    expect(validateComparisonRelationOriginalMapping(value, resolveComparisonOriginal(null, value.original)))
      .toMatchObject({ status: "TEMPORARY_COMPARISON", reason: "ORIGINAL_UNAVAILABLE" })
    expect(validateComparisonRelationOriginalMapping(value, structuredClone(f.original)))
      .toMatchObject({ status: "TEMPORARY_COMPARISON" })
    expect(validateComparisonRelationOriginalMapping({ ...value,
      original: { ...value.original, planFingerprint: `sha256:${"f".repeat(64)}` } }, f.original))
      .toMatchObject({ status: "INVALID_COMPARISON", reason: "ORIGINAL_IDENTITY_MISMATCH" })
    const other = fixture(4)
    expect(validateComparisonRelationOriginalMapping(value, other.original))
      .toMatchObject({ status: "INVALID_COMPARISON", reason: "ORIGINAL_IDENTITY_MISMATCH" })
  })
})

describe("explicit lap comparison and read-only relation binding", () => {
  it("requires confirmation even for numerically exact laps; unknown auto-laps stay unmatched", () => {
    const f = fixture(4, true), actual = observation(lapsFor(f.original))
    const before = compareFileToPlan(f.original, actual)
    expect(before).toMatchObject({ status: "MAPPING_REQUIRED", automaticMappingCandidates: [], actualLaps: actual.laps })
    expect(before).not.toHaveProperty("rows")
    expect(before).not.toHaveProperty("delta")
    const after = compareFileToPlan(f.original, actual, relation(f.original, actual), 8)
    expect(after.status).toBe("QUANTITATIVE_COMPARISON")
  })

  it("uses exact per-lap distance, seconds and pace differences, preserves unmatched order, and invents no success score", () => {
    const f = fixture(4, true), segment = f.original.segments.find(s => s.phase === "main" && s.kind === "WORK")!
    const laps: FileObservationInput["laps"] = [
      { sourceIndex: 0, distanceMeters: 100, durationSeconds: 35, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
      { sourceIndex: 1, distanceMeters: segment.distanceMeters! + 10, durationSeconds: segment.durationSeconds! + 2, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
      { sourceIndex: 2, distanceMeters: 50, durationSeconds: 18, durationMeaning: "UNKNOWN", kind: "UNKNOWN" },
    ]
    const actual = observation(laps), value = relation(f.original, actual)
    value.segmentMappings = [{ planSegmentId: segment.id, sourceLapIndex: 1, confirmedKind: "WORK", confirmedTargetUnit: "DISTANCE", confirmedDurationMeaning: "TIMER", confirmedRecoveryMode: null }]
    const before = JSON.stringify({ original: f.snapshot, actual, value }), write = vi.spyOn(Storage.prototype, "setItem")
    const result = compareFileToPlan(f.original, actual, value, 8)
    expect(result.status).toBe("QUANTITATIVE_COMPARISON")
    if (result.status !== "QUANTITATIVE_COMPARISON") throw Error("comparison missing")
    expect(result.rows[0]!.delta).toEqual({ distanceMeters: 10, durationSeconds: 2,
      paceSecondsPerKm: laps[1]!.durationSeconds! * 1000 / laps[1]!.distanceMeters! - segment.paceSecondsPerKm! })
    expect(result.unmatchedSourceLapIndices).toEqual([0, 2])
    expect(result.unmatchedPlanSegmentIds).toEqual(f.original.segments.filter(s => s.id !== segment.id).map(s => s.id))
    expect(result.actualLaps).toEqual(laps)
    expect(JSON.stringify(result)).not.toMatch(/score|success|adherence|adaptation|plannedSessionLink|rpe/iu)
    expect(JSON.stringify({ original: f.snapshot, actual, value })).toBe(before)
    expect(write).not.toHaveBeenCalled()
  })

  it("retains N-1 and set recovery occurrences instead of inventing a final recovery", () => {
    const f = fixture(4, true)
    if (f.session.prescription.kind !== "PACE_TARGET") throw Error("pace fixture")
    const p = f.session.prescription, main = f.original.segments.filter(s => s.phase === "main")
    expect(main.filter(s => s.kind === "WORK")).toHaveLength(p.setCount * p.repetitionsPerSet)
    expect(main.filter(s => s.kind === "RECOVERY")).toHaveLength(p.setCount * (p.repetitionsPerSet - 1) + p.setCount - 1)
    expect(main.at(-1)!.kind).toBe("WORK")
    expect(main.filter(s => s.kind === "RECOVERY").reduce((sum, s) => sum + s.durationSeconds!, 0)).toBe(p.totals.plannedRecoverySeconds)
  })

  it.each([5, 6] as const)("V%s expands adjusted V3 roles and ordered recovery consistently with retained structural totals", version => {
    const f = fixture(version)
    if (f.session.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("V3 fixture")
    const totals = f.session.prescription.projection.structuralTotals.main
    const main = f.original.segments.filter(s => s.phase === "main")
    expect(main.filter(s => s.role === "WORK")).toHaveLength(totals.workSegments)
    expect(main.filter(s => s.kind === "RECOVERY")).toHaveLength(totals.recoverySteps)
    expect(main.filter(s => s.kind === "RECOVERY").reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)).toBe(totals.knownRecoverySeconds)
    const actual = observation(lapsFor(f.original))
    expect(compareFileToPlan(f.original, actual, relation(f.original, actual), 8).status).toBe("QUANTITATIVE_COMPARISON")
  })

  it("preserves missing values and true zeros and never produces a non-finite pace", () => {
    const f = fixture(4, true)
    for (const patch of [{ distanceMeters: null, durationSeconds: null }, { distanceMeters: 0, durationSeconds: 0 }]) {
      const actual = observation(lapsFor(f.original).map(lap => ({ ...lap, ...patch })))
      const result = compareFileToPlan(f.original, actual, relation(f.original, actual), 8)
      if (result.status !== "QUANTITATIVE_COMPARISON") throw Error("comparison missing")
      expect(result.rows.every(row => row.delta.paceSecondsPerKm === null)).toBe(true)
      expect(result.actualLaps[0]!.distanceMeters).toBe(patch.distanceMeters)
      const work = result.rows.find(row => row.planned.phase === "main" && row.planned.kind === "WORK")!
      expect(work.delta.distanceMeters).toBe(patch.distanceMeters === null ? null : -work.planned.distanceMeters!)
      expect(work.delta.durationSeconds).toBe(patch.durationSeconds === null ? null : -work.planned.durationSeconds!)
    }
  })

  it("never reconstructs repeated laps from activity totals", () => {
    const f = fixture(4, true), actual = observation([{ sourceIndex: 0, distanceMeters: 10000, durationSeconds: 3000, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }])
    expect(compareFileToPlan(f.original, actual)).toMatchObject({ status: "MAPPING_REQUIRED", actualLaps: actual.laps })
    expect(actual.laps).toHaveLength(1)
    expect(compareFileToPlan(f.original, actual, relation(f.original, actual), 8)).toMatchObject({ status: "INVALID_COMPARISON", reason: "MAPPING_ADDRESS_OR_ORDER" })
    expect(compareFileToPlan(f.original, observation([]))).toMatchObject({ status: "MAPPING_REQUIRED", actualLaps: [] })
  })

  it("withholds unconfirmed/source-defined time and mismatched recovery while retaining raw values", () => {
    const f = fixture(4, true), actual = observation(lapsFor(f.original)), value = relation(f.original, actual)
    value.segmentMappings = value.segmentMappings.map(m => ({ ...m, confirmedDurationMeaning: null, confirmedRecoveryMode: null }))
    const result = compareFileToPlan(f.original, actual, value, 8)
    expect(result.status).toBe("QUANTITATIVE_COMPARISON")
    if (result.status !== "QUANTITATIVE_COMPARISON") throw Error("comparison missing")
    expect(result.rows.every(r => r.delta.durationSeconds === null && r.delta.paceSecondsPerKm === null)).toBe(true)
    const recovery = result.rows.find(r => r.planned.kind === "RECOVERY")!
    expect(recovery.delta).toEqual({ distanceMeters: null, durationSeconds: null, paceSecondsPerKm: null })
    expect(recovery.limitations).toContain("RECOVERY_MODE_UNKNOWN_OR_DIFFERENT")
    expect(result.rows[0]!.actual.durationMeaning).toBe("SOURCE_DEFINED")
  })

  it("rejects reordered, contradictory and changed-unit mappings instead of fuzzy matching", () => {
    const f = fixture(4, true), actual = observation(lapsFor(f.original)), value = relation(f.original, actual)
    expect(compareFileToPlan(f.original, actual, { ...value, segmentMappings: [...value.segmentMappings].reverse() }, 8)).toMatchObject({ status: "INVALID_COMPARISON" })
    const first = value.segmentMappings[0]!
    expect(compareFileToPlan(f.original, actual, { ...value, segmentMappings: [{ ...first, confirmedTargetUnit: first.confirmedTargetUnit === "DISTANCE" ? "DURATION" : "DISTANCE" }] }, 8)).toMatchObject({ reason: "MAPPING_SEMANTICS" })
    const known = observation(lapsFor(f.original).map(lap => ({ ...lap, kind: "RECOVERY", durationMeaning: "MOVING" })))
    expect(compareFileToPlan(f.original, known, relation(f.original, known), 8)).toMatchObject({ reason: "MAPPING_SEMANTICS" })
    const moving = observation(lapsFor(f.original).map(lap => ({ ...lap, durationMeaning: "MOVING" })))
    expect(compareFileToPlan(f.original, moving, relation(f.original, moving), 8)).toMatchObject({ reason: "TIME_MEANING_CONFLICT" })
  })

  it("distinguishes save-induced revision increments from observation corrections and interpretation changes", () => {
    const f = fixture(), actual = observation(lapsFor(f.original)), value = relation(f.original, actual)
    expect(prepareComparisonRelation(request(value), f.original, actual, 7).status).toBe("READY_FOR_PERSISTENCE")
    expect(prepareComparisonRelation(request(value), f.original, actual, 8)).toMatchObject({ status: "INVALID_COMPARISON", reason: "CAS_OR_REQUEST_INVALID" })
    expect(validateComparisonRelationBinding(value, f.original, actual, 8).status).toBe("VALID_COMPARISON")
    expect(validateComparisonRelationBinding(value, f.original, actual, 6).status).toBe("INVALID_COMPARISON")
    const corrected = observation(lapsFor(f.original).map((lap, i) => i ? lap : { ...lap, distanceMeters: lap.distanceMeters! + 1 }))
    expect(validateComparisonRelationBinding(value, f.original, corrected, 8)).toMatchObject({ reason: "OBSERVATION_CHANGED" })
    const interpreted = observation(lapsFor(f.original), { confirmation: { durationMeaning: "MOVING", sport: "RUNNING" } })
    expect(interpreted.contentRevisionFingerprint).toBe(actual.contentRevisionFingerprint)
    expect(validateComparisonRelationBinding(value, f.original, interpreted, 8)).toMatchObject({ reason: "OBSERVATION_CHANGED" })
    expect(validateComparisonRelationBinding(value, f.original, observation(lapsFor(f.original), {}, "other-journal"), 8)).toMatchObject({ reason: "OBSERVATION_CHANGED" })
    expect(validateComparisonRelationBinding({ ...value, releasedAt: at }, f.original, actual, 8)).toMatchObject({ reason: "RELATION_RELEASED" })
  })

  it("reopens unchanged originals with a different linkedAt without weakening exact plan/session identity", () => {
    const f = fixture(), actual = observation(lapsFor(f.original)), value = relation(f.original, actual)
    const freshReference = { ...f.reference, session: { ...f.reference.session, linkedAt: "2026-08-18T03:00:00.000Z" } }
    const reopened = resolveComparisonOriginal(f.snapshot, freshReference)
    expect(sameComparisonOriginalIdentity(value.original, freshReference)).toBe(true)
    expect(validateComparisonRelationBinding(value, reopened, actual, 8).status).toBe("VALID_COMPARISON")
    expect(validateComparisonRelationBinding(value, resolveComparisonOriginal(f.snapshot, value.original), actual, 8).status).toBe("VALID_COMPARISON")
    expect(sameComparisonOriginalIdentity(value.original, { ...freshReference, planFingerprint: `sha256:${"f".repeat(64)}` })).toBe(false)
    expect(sameComparisonOriginalIdentity(value.original, { ...freshReference, session: { ...freshReference.session, sessionSlot: "PM" } })).toBe(false)
  })

  it("never prepares a stored relation without the original or accepts a copied observation attestation", () => {
    const f = fixture(), actual = observation(lapsFor(f.original)), value = relation(f.original, actual), missing = resolveComparisonOriginal(null, f.reference)
    expect(prepareComparisonRelation(request(value), missing, actual, 7)).toEqual({ status: "TEMPORARY_COMPARISON", reason: "ORIGINAL_UNAVAILABLE", executionAuthority: "NONE" })
    const result = compareFileToPlan(missing, actual, value, 8)
    expect(result.status).toBe("TEMPORARY_COMPARISON")
    expect(result).not.toHaveProperty("relation")
    expect(result).not.toHaveProperty("rows")
    expect(compareFileToPlan(f.original, structuredClone(actual), value, 8)).toMatchObject({ status: "INVALID_COMPARISON", reason: "OBSERVATION_NOT_ADOPTED" })
  })
})

describe("previous performance compatibility", () => {
  it("compares only confirmed compatible methods and reports date differences without causation", () => {
    const f = fixture(4, true), prior = observation(lapsFor(f.original), { date: "2026-08-16" }, "previous-journal")
    const laps = lapsFor(f.original).map((lap, i) => f.original.segments[i]!.kind === "WORK" ? { ...lap, durationSeconds: lap.durationSeconds! + 2 } : lap)
    const current = observation(laps)
    const result = comparePreviousFilePerformance(input(f.original, current), input(f.original, prior))
    expect(result.status).toBe("PREVIOUS_QUANTITATIVE_COMPARISON")
    if (result.status !== "PREVIOUS_QUANTITATIVE_COMPARISON") throw Error("previous comparison missing")
    expect(result.rows[0]!.delta.durationSeconds).toBe(2)
    expect(result.rows[0]!.delta.paceSecondsPerKm).toBeNull()
    expect(result.changedConditions).toEqual(["OBSERVATION_DATE"])
    expect(result.causation).toBe("NOT_INFERRED")
    expect(result.unobservedConditions).toContain("WEATHER")
    expect(comparePreviousFilePerformance({ ...input(f.original, current), relation: null }, input(f.original, prior))).toMatchObject({ reason: "CONFIRMED_MAPPING_REQUIRED" })
  })

  it("refuses different configurations, unknown/missing recovery, changed actual recovery and mismatched time meaning", () => {
    const f = fixture(4, true), adjusted = fixture(), actual = observation(lapsFor(f.original)), prior = observation(lapsFor(f.original), {}, "previous-journal")
    const adjustedActual = observation(lapsFor(adjusted.original), {}, "adjusted-journal")
    expect(comparePreviousFilePerformance(input(f.original, actual), input(adjusted.original, adjustedActual))).toMatchObject({ reason: "INCOMPATIBLE_METHOD" })
    const missingRecovery = relation(f.original, prior)
    missingRecovery.segmentMappings = missingRecovery.segmentMappings.map(m => ({ ...m, confirmedRecoveryMode: null }))
    expect(comparePreviousFilePerformance(input(f.original, actual), input(f.original, prior, missingRecovery))).toMatchObject({ reason: "RECOVERY_NOT_COMPATIBLE" })
    const changedRecovery = observation(lapsFor(f.original).map((lap, i) => f.original.segments[i]!.kind === "RECOVERY" ? { ...lap, durationSeconds: lap.durationSeconds! + 1 } : lap), {}, "previous-journal")
    expect(comparePreviousFilePerformance(input(f.original, actual), input(f.original, changedRecovery))).toMatchObject({ reason: "RECOVERY_VALUES_NOT_COMPATIBLE", changedConditions: ["ACTUAL_RECOVERY_VALUES"] })
    const movedTime = relation(f.original, prior)
    movedTime.segmentMappings = movedTime.segmentMappings.map(m => ({ ...m, confirmedDurationMeaning: "MOVING" }))
    expect(comparePreviousFilePerformance(input(f.original, actual), input(f.original, prior, movedTime))).toMatchObject({ reason: "DIFFERENT_TIME_MEANING" })
    expect(comparePreviousFilePerformance(input(f.original, actual), input(f.original, actual))).toMatchObject({ reason: "UNKNOWN_SPORT_OR_SAME_OBSERVATION" })
    const workOnly = (actual: ProjectedFileObservation) => {
      const value = relation(f.original, actual)
      value.segmentMappings = value.segmentMappings.filter(mapping => mapping.confirmedKind === "WORK")
      return value
    }
    expect(comparePreviousFilePerformance(input(f.original, actual, workOnly(actual)), input(f.original, prior, workOnly(prior)))).toMatchObject({ reason: "RECOVERY_COVERAGE_UNCONFIRMED" })
  })
})
