import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { RUNTIME_CASES, draftFor, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { listDetailedSessionTargets } from "./plan-session-target"
import { snapshotPlanMainDraft } from "./plan-main-draft"
import { isInitialCandidatePair, isSupportOnlyCandidatePair } from "@impl/plan-generator/support-only-candidate-pair"
import { rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.useRealTimers() })

it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM: moving A preserves B and keeps one detailed MAIN in each", fixture => {
  const intake = { ...draftFor(fixture), requestedFrameLength: 9 as const, availableDayCount: "EVERY_DAY" as const }
  const record = { selectedRecordId: saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds) }
  const baseline = generatePlanFromDraft(intake, "NO_KNOWN_RISK", record)
  if (baseline.kind !== "generated") throw new Error("Expected baseline")
  const targets = listDetailedSessionTargets(baseline.generated)
  expect(targets.length).toBeGreaterThan(1)
  const changed = generatePlanFromDraft(intake, "NO_KNOWN_RISK", record, undefined, { BALANCED: targets.at(-1)! })
  if (changed.kind !== "generated") throw new Error("Expected changed candidate")
  expect(changed.prescriptionBinding.kind).toBe("bound")
  const [a, b] = changed.generated.candidates
  expect(isInitialCandidatePair(a, b)).toBe(true)
  expect(isSupportOnlyCandidatePair(a, b)).toBe(false)
  expect(b.sessions).toEqual(baseline.generated.candidates[1].sessions)
  expect(b.candidateId).toBe(baseline.generated.candidates[1].candidateId)
  expect(a.sessions.filter(s => s.prescription.kind === "PACE_TARGET")).toHaveLength(1)
  expect(b.sessions.filter(s => s.prescription.kind === "PACE_TARGET")).toHaveLength(1)
  const selected = a.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
  expect({ day: selected.day, slot: selected.slot }).toEqual(targets.at(-1))
  const support = (sessions: typeof a.sessions) => sessions.filter(s => s.role !== "QUALITY")
  expect(support(a.sessions)).toEqual(support(baseline.generated.candidates[0].sessions))
  for (const candidate of [a, b]) {
    const result = selectPlanForActivation(candidate.candidateId, changed.generated, changed.gate,
      { ...changed.intake, startDate: "2026-08-17" }, changed.athleteEvidence)
    if (result.kind !== "selected") throw new Error(`${candidate.kind}: ${result.code}`)
    if (result.kind === "selected") expect(result.state.activePlan.sessions).toEqual(candidate.sessions)
  }
})

it("rejects changed dose even with recomputed content hashes", () => {
  const fixture = RUNTIME_CASES[3]!
  const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK",
    { selectedRecordId: saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds) })
  if (result.kind !== "generated") throw new Error("Expected baseline")
  const candidates = [structuredClone(result.generated.candidates[0]), structuredClone(result.generated.candidates[1])] as const
  const detailed = candidates[0].sessions.find(s => s.prescription.kind === "PACE_TARGET")!
  Object.assign(detailed.prescription, { targetRepSeconds: 1 })
  const rebound = rebindCandidatePairIdentity(candidates)
  expect(isInitialCandidatePair(...rebound)).toBe(false)
})

it("rejects an unavailable explicit candidate address without moving it elsewhere", () => {
  const fixture = RUNTIME_CASES[3]!
  const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK",
    { selectedRecordId: saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds) }, undefined,
    { CONSERVATIVE: { day: 99, slot: "PM" } })
  if (result.kind !== "generated") throw new Error("Expected fallback")
  expect(result.prescriptionBinding.kind).toBe("fallback")
  expect(result.generated.candidates.flatMap(c => c.sessions).some(s => s.prescription.kind === "PACE_TARGET")).toBe(false)
})

it("keeps scope and slot identities stable when candidate display order changes", () => {
  const result = generatePlanFromDraft(draftFor(RUNTIME_CASES[3]!), "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected baseline")
  const before = snapshotPlanMainDraft(result.generated, result.intake, "2026-08-17")!
  const reordered = snapshotPlanMainDraft({ ...result.generated,
    candidates: [result.generated.candidates[1], result.generated.candidates[0]] }, result.intake, "2026-08-17")!
  expect(reordered.scopeFingerprint).toBe(before.scopeFingerprint)
  expect(reordered.slots).toEqual(before.slots)
  expect(reordered.contentFingerprint).not.toBe(before.contentFingerprint)
})
