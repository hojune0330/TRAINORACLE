import { beforeEach, describe, expect, it } from "vitest"
import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { isInitialCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import type { PlanCandidate, PlanSession } from "@impl/plan-generator/types"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { bindCatalogSession, resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { resolveCatalogCycleSuccessor } from "./catalog-cycle-successor"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { catalogScheduleConditions } from "./catalog-schedule-conditions"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { PostSessionEntry } from "./journal-schema"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { planBetaStateV3Schema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { loadPreviousContinuity, savePlanBetaState } from "./plan-beta-store"
import { derivePlanCycleResponse } from "./plan-cycle-response"
import { createPlannedSessionLogDraft } from "./planned-session-link"

const evaluatedAt = new Date("2026-10-01T12:00:00Z")
const base = { eventGroup: "FIVE_K" as const, eventDistanceM: 5000 as const, competitionDivision: "OPEN" as const,
  experienceBand: "EXPERIENCED" as const, availableDayCount: 5 as const, requestedFrameLength: 10 as const,
  trainingFocus: "LT_INTENT" as const, secondSessionMode: "SINGLE_SESSION_ONLY" as const,
  trainingTimePreference: "MORNING" as const, selectedDetailedTemplateRef: null }
const inputs: WorkoutCalculationInputs = { eventDistanceM: 5000, experience: "EXPERIENCED", availableSeconds: null,
  confirmedRequirements: [], fiveK: null, segmentPaces: [] }
const main = (sessions: readonly PlanSession[]) => sessions.filter(s => s.role === "QUALITY")
const idOf = (session: PlanSession) => session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout?.catalogId : undefined
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function draft(focus: PlanSession["plannedEnergyIntent"] = "LT_INTENT", evening = false) {
  const result = generatePlanFromDraft({ ...base, trainingFocus: focus,
    trainingTimePreference: evening ? "EVENING" : "MORNING" }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(result.kind)
  return result
}

function fixture(id = "P-LT-B", focus: PlanSession["plannedEnergyIntent"] = "LT_INTENT", values = inputs,
  sourceDate = new Date("2026-09-01T12:00:00Z")) {
  const result = draft(focus)
  let generated = result.generated
  for (const session of main(generated.candidates[0].sessions)) {
    const changed = replaceCandidateCatalogWorkout(generated, session, id, values, true)
    if (!changed) throw Error(`Cannot bind ${id}`)
    generated = changed
  }
  const selected = selectPlanForActivation(generated.candidates[0].candidateId, generated, result.gate,
    { ...result.intake, startDate: "2026-09-01" }, result.athleteEvidence, sourceDate)
  if (selected.kind !== "selected") throw Error(selected.code)
  return { generated, predecessor: planBetaStateV3Schema.parse(selected.state), original: result }
}

function entry(state: PlanBetaStateV3, index: number, rpe: number): PostSessionEntry {
  const session = main(state.activePlan.sessions)[index]!
  return entryAt(state, session, rpe)
}

function entryAt(state: PlanBetaStateV3, session: PlanSession, rpe: number): PostSessionEntry {
  const draft = createPlannedSessionLogDraft(state, session, state.generatedAt)
  if (!draft) throw Error("Missing fixture link")
  return { id: `actual-${session.day}-${session.slot}`, kind: "post-session", date: draft.date,
    savedAt: "2026-09-30T12:00:00Z", syncState: "local", system: "base", title: "", memo: "",
    distanceKm: "", durationMin: "", avgPace: "", rpe, fieldProvenance: { rpe: { provenance: FIELD_PROVENANCE.explicit } },
    plannedSessionLink: draft.link }
}

function result(f: ReturnType<typeof fixture>, entries: readonly PostSessionEntry[] = [], generated = draft(f.predecessor.intake.trainingFocus).generated) {
  return resolveCatalogCycleSuccessor({ generated, predecessor: f.predecessor,
    response: derivePlanCycleResponse(entries, f.predecessor), evaluatedAt })
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe("bounded catalog cycle successor", () => {
  it.each([
    ["P-LT-B", "LT_INTENT", "P-LT-B-480"],
    ["P-VO2-2", "VO2_INTENT", "P-VO2-2-5"],
  ] as const)("uses actual repeated above-range results for reviewed %s (%s)", (id, focus, lower) => {
    const f = fixture(id, focus), response = [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)]
    const next = result(f, response)
    expect(next.summary).toMatchObject({ status: "APPLIED", responseStatus: "COMPLETE_RESPONSE", reducedCount: 2, reviewCount: 0 })
    expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual([lower, lower])
    expect(next.summary.rows[0]).toMatchObject({ sourceActualRpe: 10, sourceComparison: "ABOVE_RANGE", repeatedAboveCount: 2 })
    expect(next.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
    expect(isInitialCandidatePair(...next.generated.candidates)).toBe(true)
    for (const [i, s] of main(next.generated.candidates[0].sessions).entries()) {
      const old = main(f.predecessor.activePlan.sessions)[i]!
      if (s.prescription.kind !== "RPE_TIME_RANGE" || old.prescription.kind !== "RPE_TIME_RANGE") throw Error("Bad fixture")
      const a = resolveCatalogBinding(s.prescription.catalogWorkout!)!, b = resolveCatalogBinding(old.prescription.catalogWorkout!)!
      expect(a.totals.seconds!.maximum).toBeLessThanOrEqual(b.totals.seconds!.maximum)
      expect(s.prescription.rpe.maximum).toBeLessThanOrEqual(old.prescription.rpe.maximum)
      expect(a.totals.workOccurrences).toBeLessThanOrEqual(b.totals.workOccurrences)
      expect(a.totals.knownMainDistanceM).toBeLessThanOrEqual(b.totals.knownMainDistanceM)
      expect(s.prescription.catalogWorkout!.originalEnvelope).toEqual(old.prescription.catalogWorkout!.originalEnvelope)
      expect(a.steps.filter(r => r.phase === "main" && r.kind === "RECOVERY").every(r => r.seconds!.minimum >= 60)).toBe(true)
    }
  })

  it.each(["single", "missing", "duplicates", "below", "within"] as const)("maintains exact original detail for %s evidence", mode => {
    const f = fixture(), first = entry(f.predecessor, 0, mode === "below" ? 1 : mode === "within" ? 6 : 10)
    const entries = mode === "missing" ? [] : mode === "single" ? [first] : mode === "duplicates" ? [first, first]
      : [first, entry(f.predecessor, 1, mode === "below" ? 1 : 6)]
    const next = result(f, entries)
    expect(next.summary).toMatchObject({ reducedCount: 0, maintainedCount: 2, reviewCount: 0 })
    expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-LT-B", "P-LT-B"])
    if (mode === "missing") expect(next.summary.rows.every(r => r.sourceActualRpe === null && r.sourceComparison === "NO_LINKED_RESULT")).toBe(true)
    expect(next.summary.responseStatus).toBe(mode === "missing" ? "NO_LINKED_RESULTS"
      : ["single", "duplicates"].includes(mode) ? "SINGLE_SIGNAL" : "COMPLETE_RESPONSE")
  })

  it("explicitly reports a missing response while preserving the prior detail", () => {
    const f = fixture()
    const next = resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: f.predecessor, response: null, evaluatedAt })
    expect(next.summary).toMatchObject({ responseStatus: "MISSING_RESPONSE", maintainedCount: 2, reducedCount: 0 })
  })

  it("distinguishes linked but uncomparable RPE from zero effort", () => {
    const f = fixture(), missing = main(f.predecessor.activePlan.sessions).map((_, i) =>
      ({ ...entry(f.predecessor, i, 8), fieldProvenance: undefined }))
    const next = result(f, missing)
    expect(next.summary).toMatchObject({ responseStatus: "NO_COMPARABLE_RESULTS", reducedCount: 0, maintainedCount: 2 })
    expect(next.summary.rows.every(r => r.sourceActualRpe === null && r.sourceComparison === "RPE_MISSING")).toBe(true)
  })

  it.each(["conflict", "changed", "partial", "missing-rpe", "incomplete-history"] as const)("never reduces with %s evidence", mode => {
    const f = fixture(), entries = [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)]
    if (mode === "conflict") entries.push({ ...entries[0]!, id: "another-result" })
    else if (mode !== "incomplete-history") entries[1] = { ...entries[1]!,
      ...(mode === "changed" ? { planExecutionRelation: "MODIFIED" as const }
        : mode === "partial" ? { activityOutcome: "PARTIAL" as const } : { fieldProvenance: undefined }) }
    const response = derivePlanCycleResponse(entries, f.predecessor)
    const next = resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: f.predecessor,
      response: mode === "incomplete-history" ? { ...response, historyReadIncomplete: true } : response, evaluatedAt })
    expect(next.summary).toMatchObject({ status: "REVIEW_REQUIRED", reducedCount: 0, maintainedCount: 2 })
    expect(next.summary.responseStatus).toBe(mode === "conflict" ? "CONFLICTING_RESPONSE" : "INCOMPLETE_RESPONSE")
    expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-LT-B", "P-LT-B"])
  })

  it("reports review and keeps an exact MAIN if no safe same-method lower configuration exists", () => {
    const f = fixture("P-LT-C")
    const next = result(f, [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)])
    expect(next.summary).toMatchObject({ status: "REVIEW_REQUIRED", reducedCount: 0, maintainedCount: 2, reviewCount: 2 })
    expect(next.summary.rows.every(r => r.reason === "NO_REVIEWED_LOWER_CONFIGURATION")).toBe(true)
    expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-LT-C", "P-LT-C"])
    expect(next.summary.rows[0]!.explanation).toContain("같은 방법")
    expect(next.summary.appliedCount).toBe(next.summary.maintainedCount + next.summary.reducedCount)
    expect(next.summary.rows.every(r => r.applied && r.status === "REVIEW_REQUIRED")).toBe(true)
  })

  it.each(["BASE_INTENT", "RECOVERY_INTENT"] as const)("does not claim maintained detailed MAIN when %s has none", focus => {
    const f = fixture(undefined, focus)
    const next = result(f)
    expect(next.summary).toMatchObject({ status: "NOT_APPLICABLE", reason: "NO_MAIN_SESSIONS",
      appliedCount: 0, maintainedCount: 0, reducedCount: 0, reviewCount: 0, rows: [] })
    expect(next.summary.headline).toBe("이번 목적에는 MAIN 훈련이 없어 상세 MAIN 조정은 하지 않았어요.")
    expect(next.generated).toEqual(draft(focus).generated)
  })

  it("matches prior same-purpose ordinal rather than the last arbitrary detailed MAIN", () => {
    const f = fixture()
    let mixed = f.generated
    const sourceMain = main(mixed.candidates[0].sessions)
    for (const [index, id] of ["P-LT-C", "P-LT-B"].entries()) {
      mixed = replaceCandidateCatalogWorkout(mixed, sourceMain[index]!, id, inputs, true)!
    }
    const selected = selectPlanForActivation(mixed.candidates[0].candidateId, mixed, f.original.gate,
      { ...f.original.intake, startDate: "2026-09-01" }, f.original.athleteEvidence, new Date("2026-09-01T12:00:00Z"))
    if (selected.kind !== "selected") throw Error(selected.code)
    const predecessor = planBetaStateV3Schema.parse(selected.state), target = draft("LT_INTENT", true).generated
    const next = resolveCatalogCycleSuccessor({ generated: target, predecessor, response: derivePlanCycleResponse([], predecessor), evaluatedAt })
    expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-LT-C", "P-LT-B"])
    expect(next.summary.rows.map(r => r.ordinal)).toEqual([1, 2])
    expect(next.summary.rows.every(r => r.source?.slot === "AM" && r.target.slot === "PM")).toBe(true)
  })

  it("counts higher reports per purpose rather than combining different purposes", () => {
    const f = fixture()
    const secondDay = main(f.generated.candidates[0].sessions)[1]!.day
    const candidates = rebindCandidatePairIdentity(f.generated.candidates.map(c => ({ ...c, sessions: c.sessions.map(s => {
      if (s.day !== secondDay || s.role !== "QUALITY") return s
      const changed: PlanSession = { ...s, plannedEnergyIntent: "VO2_INTENT" }
      return bindCatalogSession(changed, "P-VO2-2", inputs, true)!
    }) })) as unknown as readonly [PlanCandidate, PlanCandidate])
    const generated = { ...f.generated, candidates, pairId: candidates[0].pairId }
    expect(candidates.every(isVerifiedPlanCandidate)).toBe(true)
    const selected = selectPlanForActivation(candidates[0].candidateId, generated, f.original.gate,
      { ...f.original.intake, startDate: "2026-09-01" }, f.original.athleteEvidence, new Date("2026-09-01T12:00:00Z"))
    if (selected.kind !== "selected") throw Error(selected.code)
    const predecessor = planBetaStateV3Schema.parse(selected.state)
    const next = resolveCatalogCycleSuccessor({ generated, predecessor,
      response: derivePlanCycleResponse([entry(predecessor, 0, 10), entry(predecessor, 1, 10)], predecessor), evaluatedAt })
    expect(next.summary).toMatchObject({ reducedCount: 0, maintainedCount: 2 })
    expect(next.summary.rows.map(r => r.repeatedAboveCount)).toEqual([1, 1])
  })

  it("rejects duplicate projected occurrences and responses from a changed predecessor", () => {
    const f = fixture(), response = derivePlanCycleResponse([entry(f.predecessor, 0, 10)], f.predecessor)
    for (const changed of [{ ...response, rows: [response.rows[0]!, response.rows[0]!] },
      { ...response, rows: response.rows.map(r => ({ ...r, currentPlannedSessionId: "old-or-forged-session" })) }]) {
      const next = resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: f.predecessor, response: changed, evaluatedAt })
      expect(next.summary).toMatchObject({ responseStatus: "RESPONSE_MISMATCH", reducedCount: 0, maintainedCount: 2 })
    }
    const changedPredecessor = { ...f.predecessor, generatedAt: "2026-09-02T12:00:00Z" }
    const next = resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: changedPredecessor, response, evaluatedAt })
    expect(next.summary).toMatchObject({ responseStatus: "RESPONSE_MISMATCH", reducedCount: 0 })
  })

  it("refreshes fiveK evaluation dates without changing the reference or original envelope", () => {
    const f = fixture("X-LT-01", "LT_INTENT", { ...inputs,
      fiveK: { recordId: "verified-5k", seconds: 1111.7, achievedAt: "2026-08-01", evaluatedAt: "2026-09-01" } })
    const next = result(f)
    expect(next.summary.maintainedCount).toBe(2)
    for (const s of main(next.generated.candidates[0].sessions)) {
      if (s.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong fixture")
      const b = s.prescription.catalogWorkout!
      expect(b.inputs.fiveK).toEqual({ recordId: "verified-5k", seconds: 1111.7, achievedAt: "2026-08-01", evaluatedAt: "2026-10-01" })
      expect(resolveCatalogBinding(b)).not.toBeNull()
      expect(b.acceptedDurationSeconds).toBeGreaterThan(b.originalEnvelope.durationMinutes.maximum * 60)
    }
  })

  it("does not resurrect a stale fiveK reference or unresolvable original", () => {
    const f = fixture("X-LT-01", "LT_INTENT", { ...inputs,
      fiveK: { recordId: "old-5k", seconds: 1111.7, achievedAt: "2025-01-01", evaluatedAt: "2026-06-01" } }, new Date("2026-06-01T12:00:00Z"))
    const next = result(f)
    expect(next.summary).toMatchObject({ status: "REVIEW_REQUIRED", appliedCount: 0, reducedCount: 0 })
    expect(next.summary.rows.every(r => r.reason === "STALE_OR_UNRESOLVABLE_REFERENCE")).toBe(true)
    const tampered = clone(f.predecessor)
    const s = main(tampered.activePlan.sessions)[0]!
    if (s.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong fixture")
    Object.assign(s.prescription.catalogWorkout!, { calculationFingerprint: "sha256:" + "0".repeat(64) })
    expect(resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: tampered, response: null, evaluatedAt }).summary)
      .toMatchObject({ status: "INCOMPATIBLE", appliedCount: 0 })
  })

  it("keeps historic environment prerequisites but requires fresh new-date UI confirmation", () => {
    const f = fixture("P-ATP-A-5", "ATP_PC_INTENT", { ...inputs, confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"],
      segmentSeconds: [{ segmentId: "part-0", seconds: 4 }] })
    const next = result(f, [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)])
    expect(next.summary).toMatchObject({ reducedCount: 2, requiresEnvironmentConfirmation: true, futureEnvironmentVerified: false })
    expect(next.summary.rows.every(r => r.environmentRequirements.join() === "ACCELERATION_AND_DECELERATION_SPACE")).toBe(true)
    const conditions = catalogScheduleConditions(next.generated, "2026-10-02", null)
    expect(conditions.length).toBe(2)
    expect(conditions.every(c => c.date >= "2026-10-02")).toBe(true)
    const unsafe = clone(f.predecessor), first = main(unsafe.activePlan.sessions)[0]!
    if (first.prescription.kind !== "RPE_TIME_RANGE") throw Error("Wrong fixture")
    Object.assign(first.prescription.catalogWorkout!.inputs, { confirmedRequirements: [] })
    expect(resolveCatalogCycleSuccessor({ generated: draft("ATP_PC_INTENT").generated, predecessor: unsafe, response: null, evaluatedAt }).summary.status)
      .toBe("INCOMPATIBLE")
  })

  it.each(["event", "experience", "focus", "frame", "frequency"] as const)("refuses incompatible %s scope", scope => {
    const f = fixture()
    const source = generatePlanFromDraft({ ...base,
      ...(scope === "event" ? { eventDistanceM: 3000 as const, eventGroup: "MIDDLE_DISTANCE" as const }
        : scope === "experience" ? { experienceBand: "DEVELOPING" as const }
          : scope === "focus" ? { trainingFocus: "VO2_INTENT" as const }
            : scope === "frame" ? { requestedFrameLength: 7 as const } : { secondSessionMode: "RECOVERY_PM_ALLOWED" as const }) }, "NO_KNOWN_RISK")
    if (source.kind !== "generated") throw Error(source.kind)
    const next = resolveCatalogCycleSuccessor({ generated: source.generated, predecessor: f.predecessor, response: null, evaluatedAt })
    expect(next.summary).toMatchObject({ status: "INCOMPATIBLE", appliedCount: 0, reducedCount: 0 })
    expect(next.generated).toEqual(source.generated)
  })

  it("preserves draft scheduling, EASY/REST, exposure count, safety and the stored source", () => {
    const f = fixture(), target = draft().generated, before = JSON.stringify({ predecessor: f.predecessor, target })
    const next = result(f, [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)], target)
    expect(JSON.stringify({ predecessor: f.predecessor, target })).toBe(before)
    for (const [i, c] of next.generated.candidates.entries()) {
      const original = target.candidates[i]!
      expect(c.sessions.map(s => [s.day, s.slot, s.role, s.plannedEnergyIntent]))
        .toEqual(original.sessions.map(s => [s.day, s.slot, s.role, s.plannedEnergyIntent]))
      expect(c.sessions.filter(s => s.role !== "QUALITY")).toEqual(original.sessions.filter(s => s.role !== "QUALITY"))
      expect(c.mainExposureLedger).toEqual(original.mainExposureLedger)
      expect(c.selectionAuthority).toBe(original.selectionAuthority)
      expect(c.frame).toEqual(original.frame)
    }
    Object.assign(next.generated.candidates[0].sessions[0]!, { day: 999 })
    const source = main(f.predecessor.activePlan.sessions)[0]!
    const row = next.summary.rows[0]!
    Object.assign(row.source!, { day: 888 })
    expect(source.day).not.toBe(888)
    expect(JSON.stringify({ predecessor: f.predecessor, target })).toBe(before)
  })

  it("does not read free text and returns only structured source comparisons", () => {
    const f = fixture(), actual = [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)]
    for (const e of actual) Object.defineProperty(e, "memo", { get: () => { throw Error("Private text read") } })
    const response = derivePlanCycleResponse(actual, f.predecessor)
    for (const key of ["headline", "evidence"]) Object.defineProperty(response, key, { get: () => { throw Error("Response text read") } })
    const next = resolveCatalogCycleSuccessor({ generated: draft().generated, predecessor: f.predecessor, response, evaluatedAt })
    expect(next.summary.reducedCount).toBe(2)
    expect(JSON.stringify(next.summary)).not.toContain("memo")
    expect(next.summary.rows[0]!.comparisons).toHaveLength(2)
  })

  it("cannot select the closest lower option with shorter recovery even if total duration is lower", () => {
    const option = ALL_WORKOUT_CATALOG.find(e => e.id === "P-VO2-2-5")!
    const sequence = option.sequence!
    const group = sequence.main[0]!
    const priorRecovery = group.recoveryBetweenRepeats
    Object.assign(group, { recoveryBetweenRepeats: priorRecovery.map(r => ({ ...r, seconds: 30 })) })
    try {
      const f = fixture("P-VO2-2", "VO2_INTENT")
      const next = result(f, [entryFor(f.predecessor, 0), entryFor(f.predecessor, 1)])
      expect(next.summary.reducedCount).toBe(2)
      expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-VO2-2-4", "P-VO2-2-4"])
      expect(next.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
    } finally { Object.assign(group, { recoveryBetweenRepeats: priorRecovery }) }
  })

  it("rejects a longer individual work repeat even when fewer repeats lower the total", () => {
    const option = ALL_WORKOUT_CATALOG.find(e => e.id === "P-VO2-2-5")!
    const group = option.sequence!.main[0]!
    if (group.kind !== "group" || group.children[0]?.kind !== "segment") throw Error("Wrong catalog fixture")
    const work = group.children[0].work, old = work.durationSeconds
    Object.assign(work, { durationSeconds: 130 })
    try {
      const f = fixture("P-VO2-2", "VO2_INTENT")
      const next = result(f, [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)])
      expect(next.summary.reducedCount).toBe(2)
      expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-VO2-2-4", "P-VO2-2-4"])
    } finally { Object.assign(work, { durationSeconds: old }) }
  })

  it("rejects longer individual distances even when fewer repeats lower total distance", () => {
    const option = ALL_WORKOUT_CATALOG.find(e => e.id === "P-ATP-A-4")!
    const group = option.sequence!.main[0]!
    if (group.kind !== "group" || group.children[0]?.kind !== "segment") throw Error("Wrong catalog fixture")
    const work = group.children[0].work, old = work.distanceM
    Object.assign(work, { distanceM: 22 })
    try {
      const f = fixture("P-ATP-A-5", "ATP_PC_INTENT", { ...inputs,
        confirmedRequirements: ["ACCELERATION_AND_DECELERATION_SPACE"], segmentSeconds: [{ segmentId: "part-0", seconds: 4 }] })
      const next = result(f, [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10)])
      expect(next.summary).toMatchObject({ reducedCount: 0, maintainedCount: 2, reviewCount: 2 })
      expect(main(next.generated.candidates[0].sessions).map(idOf)).toEqual(["P-ATP-A-5", "P-ATP-A-5"])
    } finally { Object.assign(work, { distanceM: old }) }
  })

  it("rejects a forged candidate and leaves the candidate pair untouched", () => {
    const f = fixture(), forged = clone(draft().generated)
    Object.assign(forged.candidates[0], { candidateId: "plan-candidate:forged" })
    const next = resolveCatalogCycleSuccessor({ generated: forged, predecessor: f.predecessor, response: null, evaluatedAt })
    expect(next.summary.status).toBe("INCOMPATIBLE")
    expect(next.generated).toEqual(forged)
  })

  it("rejects invalid evaluation dates without changing the new draft", () => {
    const f = fixture(), generated = draft().generated
    const next = resolveCatalogCycleSuccessor({ generated, predecessor: f.predecessor, response: null, evaluatedAt: new Date(NaN) })
    expect(next.summary).toMatchObject({ status: "INCOMPATIBLE", appliedCount: 0 })
    expect(next.generated).toEqual(generated)
  })

  it.each(["missing-rpe", "changed", "conflict"] as const)("does not let another purpose's %s block valid repeated LT evidence", mode => {
    const f = fixture(), easy = f.predecessor.activePlan.sessions.find(s => s.role === "EASY")!
    const other = entryAt(f.predecessor, easy, 8)
    const entries = [entry(f.predecessor, 0, 10), entry(f.predecessor, 1, 10),
      { ...other, ...(mode === "missing-rpe" ? { fieldProvenance: undefined }
        : mode === "changed" ? { planExecutionRelation: "MODIFIED" as const } : {}) },
      ...(mode === "conflict" ? [{ ...other, id: "conflicting-easy" }] : [])]
    const next = result(f, entries)
    expect(next.summary).toMatchObject({ reducedCount: 2, reviewCount: 0,
      responseStatus: mode === "conflict" ? "CONFLICTING_RESPONSE" : "INCOMPLETE_RESPONSE" })
    expect(next.summary.rows.every(r => r.comparisons.length === 2 && r.repeatedAboveCount === 2)).toBe(true)
  })

  it("supports next generation through real loadPreviousContinuity and the first-plan caller", () => {
    const f = fixture()
    const predecessor = planBetaStateV3Schema.parse({ ...f.predecessor, progress: main(f.predecessor.activePlan.sessions)
      .map(s => ({ sessionDay: s.day, sessionSlot: s.slot, state: "COMPLETED" })) })
    expect(savePlanBetaState(predecessor)).toEqual({ ok: true })
    expect(loadPreviousContinuity(predecessor)).toMatchObject({ previousCandidateKind: "BALANCED" })
    const next = generatePlanFromDraft(base, "NO_KNOWN_RISK", undefined, undefined, undefined, predecessor)
    if (next.kind !== "generated") throw Error(next.kind === "rejected" ? next.code : next.kind)
    expect(next.generated.candidates[0].continuityContext).toMatchObject({ kind: "PREVIOUS_FRAME_CONTEXT_RETAINED" })
    const linked = resolveCatalogCycleSuccessor({ generated: next.generated, predecessor,
      response: derivePlanCycleResponse([entry(predecessor, 0, 10), entry(predecessor, 1, 10)], predecessor), evaluatedAt })
    expect(linked.summary).toMatchObject({ status: "APPLIED", reducedCount: 2, reviewCount: 0 })
    expect(linked.generated.candidates[0].continuityContext).toEqual(next.generated.candidates[0].continuityContext)
    expect(linked.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
  })
})

function entryFor(state: PlanBetaStateV3, index: number) { return entry(state, index, 10) }
