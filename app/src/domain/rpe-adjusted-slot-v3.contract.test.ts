import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createAdjustmentDraftV3, applyAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { unanchoredAdjustmentFixtureV3 } from "./unanchored-adjustment-v3.test-fixtures"
import { prepareUnanchoredAdjustmentOfferV3 } from "./unanchored-adjustment-offer-v3"
import { createAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { resolveQualityCandidateScope } from "./adjusted-plan-candidate"
import { prepareRpeAdjustedSlotV3, rpeSourceBindingScopeV3, type RpeAdjustedSlotInputV3 } from "./rpe-adjusted-slot-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  const intake = { ...draftFor(RUNTIME_CASES[3]), selectedDetailedTemplateRef: null }
  const generated = generatePlanFromDraft(intake, "NO_KNOWN_RISK", {})
  if (generated.kind !== "generated") throw Error("No generated candidate")
  const candidate = generated.generated.candidates[0], source = unanchoredAdjustmentFixtureV3()
  const offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: source.nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: source.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  const explanation = { configuration: applied.prescription.configuration, resolutionContextKey: offer.contextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test",
    recoveryRationale: "test", cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test",
    evidenceRefs: ["TEST"], sequenceContentIdentity: sequenceV3ContentIdentity(applied.prescription.sequence), nodeIds: ["work"] }
  const inputs: RpeAdjustedSlotInputV3[] = candidate.sessions.filter(s => s.role === "QUALITY").map(session => {
    const address = { day: session.day, slot: session.slot }, startDate = "2026-09-08"
    const scope = resolveQualityCandidateScope(candidate, address, startDate)!
    const snapshot = createAdjustedMethodSnapshotV3({ authority: offer.authority, current: offer.current, receipt: applied.receipt,
      contextKey: offer.contextKey, nowMs: source.nowMs, scope, explanation })
    if (snapshot.kind !== "prepared") throw Error(snapshot.code)
    return { candidate, address, startDate, source, explanation, rawSnapshot: JSON.stringify(snapshot.snapshot), experienceBand: intake.experienceBand }
  })
  const scopes = inputs.map(input => {
    const result = rpeSourceBindingScopeV3(input)
    if (result.kind !== "scope") throw Error(result.code)
    return result.scopeFingerprint
  })
  const bindings = [...new Set(scopes)].map((scopeFingerprint, i) => ({ bindingId: `TEST-${i}`, version: "1",
    scopeFingerprint, reviewRef: "TEST_NOT_APPROVAL", validFromMs: 100, expiresAtMs: 200, revokedAtMs: null }))
  return { inputs, bindings }
}

it("connects every real generated RPE MAIN to independently scoped detailed content without any athlete record", () => {
  const { inputs, bindings } = fixture()
  expect(inputs.length).toBeGreaterThanOrEqual(2)
  const result = prepareMultiAdjustedPlanCandidateV3(inputs, bindings)
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.changedSlots).toHaveLength(inputs.length)
  expect(result.candidate.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(inputs.length)
  expect(prepareMultiAdjustedPlanCandidateV3([...inputs].reverse(), bindings)).toEqual(result)
  for (const session of result.candidate.sessions) {
    if (session.prescription.kind !== "ADJUSTED_METHOD_V3") continue
    expect(session.prescription.projection).toMatchObject({ recordBasis: "NOT_USED", segmentTargets: [],
      originalPrescription: { kind: "RPE_TIME_RANGE" }, structuralTotals: { main: { workSeconds: 120, recoverySeconds: 120 } } })
  }
  expect(result.candidate.selectionAuthority).toBe("NONE")
})
it("requires a matching binding review and rejects expiration, relocation and changed experience", () => {
  const { inputs, bindings } = fixture(), input = inputs[0]!
  expect(prepareRpeAdjustedSlotV3(input)).toMatchObject({ kind: "unavailable", code: "RPE_SOURCE_BINDING_REVIEW_REQUIRED" })
  expect(prepareRpeAdjustedSlotV3(input, bindings.map(b => ({ ...b, expiresAtMs: 149 }))).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, rawSnapshot: inputs[1]!.rawSnapshot }, bindings).kind).toBe("unavailable")
  expect(prepareRpeAdjustedSlotV3({ ...input, experienceBand: "NEW_TO_RUNNING" }, bindings).kind).toBe("unavailable")
  expect(prepareMultiAdjustedPlanCandidateV3([input, input], bindings)).toMatchObject({ code: "DUPLICATE_ADJUSTED_SLOT" })
})
