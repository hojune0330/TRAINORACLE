import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { adjustedMethodV3FixtureWithCandidate } from "./adjusted-method-resolution-v3.test-fixtures"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { prepareAdjustedPlanCandidateV3, resolveAdjustedCandidateScope } from "./adjusted-plan-candidate"
import { planAdaptationCandidateSchema } from "./plan-beta-schema"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function fixture(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!) {
  const { candidate, resolution } = adjustedMethodV3FixtureWithCandidate(event)
  const slot = candidate.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
  const address = { day: slot.day, slot: slot.slot }, startDate = "2026-09-07"
  const scope = resolveAdjustedCandidateScope(candidate, address, startDate)!
  const offer = prepareSourceAdjustmentOfferV3(resolution.source)
  if (offer.kind !== "available") throw Error(offer.code)
  const explanation = { configuration: resolution.receipt.after.configuration, resolutionContextKey: offer.contextKey,
    version: "TEST-1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test purpose", energySupply: "test energy",
    workRationale: "test work", recoveryRationale: "test recovery", cycleRole: "test cycle", expectedAdaptation: "test expectation",
    limitations: "test limit", observation: "test observation", evidenceRefs: ["TEST-SOURCE"],
    sequenceContentIdentity: sequenceV3ContentIdentity(resolution.receipt.after.sequence), nodeIds: ["v3-sets", "v3-work"] }
  const saved = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current,
    receipt: resolution.receipt, contextKey: offer.contextKey, nowMs: resolution.source.nowMs, scope, explanation })
  if (saved.kind !== "prepared") throw Error(saved.code)
  return { candidate, address, startDate, rawSnapshot: JSON.stringify(saved.snapshot), source: resolution.source, explanation }
}

it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM attaches V3 snapshot and actual targets to only the selected slot", event => {
  const input = fixture(event), before = JSON.stringify(input), write = vi.spyOn(Storage.prototype, "setItem")
  const result = prepareAdjustedPlanCandidateV3(input)
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.sessions).toHaveLength(input.candidate.sessions.length)
  expect(result.candidate.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(1)
  input.candidate.sessions.forEach((original, i) => {
    const updated = result.candidate.sessions[i]!
    if (original.day !== input.address.day || original.slot !== input.address.slot) expect(updated).toEqual(original)
    else {
      if (original.prescription.kind !== "PACE_TARGET" || updated.prescription.kind !== "ADJUSTED_METHOD_V3") throw Error("fixture slot")
      expect(updated.prescription.projection.segmentTargets[0]!.targetRepSeconds)
        .toBe(original.prescription.selectedAnchor.performanceSeconds * 200 / event.eventDistanceM)
      expect(updated.prescription.projection.sequence.warmup).toHaveLength(2)
      expect(updated.prescription.snapshot.schemaVersion).toBe(3)
    }
  })
  expect(result.candidate).toMatchObject({ schemaVersion: 3, activationState: "NOT_ACCEPTED", selectionAuthority: "NONE",
    frame: input.candidate.frame, continuityContext: input.candidate.continuityContext })
  expect(planAdaptationCandidateSchema.safeParse(result.candidate).success).toBe(false)
  expect(JSON.stringify(input)).toBe(before)
  expect(write).not.toHaveBeenCalled()
})

it("rejects snapshot relocation and current source/record changes", () => {
  const input = fixture()
  for (const change of [{ startDate: "2026-09-08" }, { address: { day: 99, slot: "AM" as const } },
    { source: { ...input.source, nowMs: 201 } },
    { source: { ...input.source, anchor: { ...input.source.anchor, contentFingerprint: `sha256:${"b".repeat(64)}` } } },
    { candidate: { ...input.candidate, candidateId: "invented" } }]) {
    expect(prepareAdjustedPlanCandidateV3({ ...input, ...change }).kind).toBe("unavailable")
  }
})

it("rejects another original's snapshot even if it is otherwise readable", () => {
  const first = fixture(RUNTIME_CASES[0]!)
  localStorage.clear()
  const other = fixture(RUNTIME_CASES[1]!)
  expect(prepareAdjustedPlanCandidateV3({ ...first, rawSnapshot: other.rawSnapshot, source: other.source, explanation: other.explanation }).kind).toBe("unavailable")
})

it("recomputes projection and rejects changed explanation or additional private fields", () => {
  const input = fixture()
  expect(prepareAdjustedPlanCandidateV3({ ...input, explanation: { ...input.explanation, purpose: "different" } }).kind).toBe("unavailable")
  const getter = vi.fn(() => "private")
  expect(prepareAdjustedPlanCandidateV3(Object.defineProperty(input, "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
  expect(getter).not.toHaveBeenCalled()
})
