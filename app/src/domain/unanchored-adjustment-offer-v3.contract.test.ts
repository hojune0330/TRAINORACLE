import { expect, it, vi } from "vitest"
import { createAdjustmentDraftV3, applyAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { unanchoredAdjustmentFixtureV3 as fixture } from "./unanchored-adjustment-v3.test-fixtures"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { createAdjustedMethodSnapshotV3, revalidateUnanchoredAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareUnanchoredAdjustmentOfferV3, revalidateUnanchoredAdjustmentApplicationV3 } from "./unanchored-adjustment-offer-v3"

function apply(input = fixture()) {
  const offer = prepareUnanchoredAdjustmentOfferV3(input)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    contextKey: offer.contextKey, nowMs: input.nowMs, target: offer.targets[0]! })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: input.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  return applied
}

it("offers and revalidates a real reviewed-edge receipt without any athlete record or invented pace", () => {
  const input = fixture(), original = JSON.stringify(input), applied = apply(input)
  const result = revalidateUnanchoredAdjustmentApplicationV3(input, applied.receipt)
  expect(result).toMatchObject({ kind: "applied", recordBasis: "NOT_USED", executionAuthority: "NONE" })
  expect(applied.receipt.afterTotals.main.workSeconds).toBe(120)
  expect(applied.receipt.afterTotals.main.recoverySeconds).toBe(120)
  expect(applied.receipt.afterTotals.main.workDistanceM).toBeNull()
  expect(JSON.stringify(input)).toBe(original)
  const fields = (value: unknown): string[] => value !== null && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => [key, ...fields(child)]) : []
  expect(fields(result)).not.toEqual(expect.arrayContaining(["anchor"]))
  for (const key of ["anchorRef", "selectedAnchor", "performanceSeconds", "secondsPerKm", "targetRepSeconds"]) {
    expect(fields(result)).not.toContain(key)
  }
})
it("rejects record-dependent targets rather than silently converting them to effort", () => {
  expect(prepareUnanchoredAdjustmentOfferV3(fixture(true))).toMatchObject({ kind: "unavailable", code: "RECORD_BASED_TARGET_REQUIRES_ANCHOR" })
})
it("rechecks expiry, revision, removed edges and tampered totals", () => {
  const input = fixture(), receipt = apply(input).receipt
  for (const changed of [{ ...input, nowMs: 201 }, { ...input, resolutionRevision: "2" },
    { ...input, authority: { ...input.authority, policies: [] } }]) {
    expect(revalidateUnanchoredAdjustmentApplicationV3(changed, receipt).kind).toBe("unavailable")
  }
  expect(revalidateUnanchoredAdjustmentApplicationV3(input, { ...receipt,
    afterTotals: { ...receipt.afterTotals, main: { ...receipt.afterTotals.main, workSeconds: 999 } } }).kind).toBe("unavailable")
})
it("rejects an added anchor or private getter without reading it", () => {
  expect(prepareUnanchoredAdjustmentOfferV3({ ...fixture(), anchor: null } as ReturnType<typeof fixture>).kind).toBe("unavailable")
  const getter = vi.fn(() => "PRIVATE")
  expect(prepareUnanchoredAdjustmentOfferV3(Object.defineProperty(fixture(), "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
  expect(getter).not.toHaveBeenCalled()
})

it("binds explanation and slot scope into a real unanchored snapshot and rejects relocation", () => {
  const source = fixture(), applied = apply(source), offer = prepareUnanchoredAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const scope = { candidateLineageId: "TEST-CANDIDATE", mainSlotId: "TEST-SLOT" }
  const explanation = { configuration: applied.prescription.configuration, resolutionContextKey: offer.contextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "test", energySupply: "test", workRationale: "test",
    recoveryRationale: "test", cycleRole: "test", expectedAdaptation: "test", limitations: "test", observation: "test",
    evidenceRefs: ["TEST"], sequenceContentIdentity: sequenceV3ContentIdentity(applied.prescription.sequence), nodeIds: ["work"] }
  const saved = createAdjustedMethodSnapshotV3({ authority: offer.authority, receipt: applied.receipt, current: offer.current,
    contextKey: offer.contextKey, nowMs: source.nowMs, scope, explanation })
  if (saved.kind !== "prepared") throw Error(saved.code)
  const raw = JSON.stringify(saved.snapshot)
  expect(revalidateUnanchoredAdjustedMethodSnapshotV3(raw, { source, scope, explanation }))
    .toMatchObject({ kind: "candidate_ready", recordBasis: "NOT_USED", executionAuthority: "NONE" })
  expect(revalidateUnanchoredAdjustedMethodSnapshotV3(raw, { source, scope: { ...scope, mainSlotId: "OTHER" }, explanation }).kind).toBe("unavailable")
  expect(revalidateUnanchoredAdjustedMethodSnapshotV3(raw, { source, scope, explanation: { ...explanation, purpose: "changed" } }).kind).toBe("unavailable")
})
