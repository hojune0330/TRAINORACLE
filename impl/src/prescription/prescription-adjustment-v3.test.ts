import { expect, it } from "vitest"
import { adjustmentPolicyReference } from "./prescription-adjustment"
import type { ReviewedAdjustmentPolicy } from "./prescription-adjustment"
import { configurationReferenceV3, createAdjustmentDraftV3, applyAdjustmentDraftV3, revalidateAdjustmentReceiptV3, resetAdjustmentDraftV3 } from "./prescription-adjustment-v3"
import type { AdjustmentAuthorityV3 } from "./prescription-adjustment-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "./sequence-v3"

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
function fixture() {
  const work: SequenceNodeV3 = { kind: "segment", id: "work", label: null, role: "WORK", repeatCount: 6,
    work: { kind: "distance", distanceM: 200, durationSeconds: null },
    target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: "synthetic-record" },
    recoveryBetweenRepeats: [{ mode: "WALK", seconds: 120 }], recoveryAfter: [] }
  const before: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "before", label: null, warmup: [], main: [work], cooldown: [] }
  const after: PrescriptionSequenceV3 = { ...before, id: "after", main: [{ kind: "group", id: "sets", label: null,
    repeatUnit: "SET", repeatCount: 2, children: [{ ...work, repeatCount: 3 }],
    recoveryBetweenRepeats: [{ mode: "WALK_OR_STAND", seconds: 300 }], recoveryAfter: [] }] }
  const a = configurationReferenceV3({ familyId: "family", configurationId: "a", version: "1" }, before)
  const b = configurationReferenceV3({ familyId: "family", configurationId: "b", version: "1" }, after)
  const p: ReviewedAdjustmentPolicy = { policyId: "test-policy", version: "1", reviewRef: "TEST_NOT_APPROVAL",
    contextKey: "context", validFromMs: 100, expiresAtMs: 200, allowedEdges: [{ from: a, to: b }] }
  const authority: AdjustmentAuthorityV3 = { catalog: [{ familyId: "family", reviewRef: "TEST_NOT_APPROVAL",
    configurations: [{ configurationId: "a", version: "1", sequence: before }, { configurationId: "b", version: "1", sequence: after }] }], policies: [p] }
  const current = { configuration: a, sequence: before }
  const input = { authority, policy: adjustmentPolicyReference(p), contextKey: "context", current, target: b, nowMs: 150 }
  const prepared = createAdjustmentDraftV3(input)
  if (prepared.kind !== "draft") throw Error(prepared.code)
  const apply = { authority, current, contextKey: "context", nowMs: 150, draft: prepared.draft, action: "USER_EXPLICIT" as const }
  return { input, apply, p }
}
it("previews, cancels and explicitly applies a set split with exact V3 totals", () => {
  const { apply } = fixture()
  const original = JSON.stringify(apply.current)
  expect(resetAdjustmentDraftV3(apply.draft)).toBe(null)
  expect(JSON.stringify(apply.current)).toBe(original)
  const result = applyAdjustmentDraftV3(apply)
  if (result.kind !== "applied") throw Error(result.code)
  expect(result.receipt.beforeTotals.main.workDistanceM).toBe(1200)
  expect(result.receipt.afterTotals.main.workDistanceM).toBe(1200)
  expect(result.receipt.beforeTotals.main.recoverySeconds).toBe(600)
  expect(result.receipt.afterTotals.main.recoverySeconds).toBe(780)
  expect(result.receipt.delta.main.recoverySeconds).toBe(180)
  expect(result.receipt.delta.main.totalSeconds).toBe(null)
  expect(result.receipt.schemaVersion).toBe(3)
  expect(JSON.stringify(apply.current)).toBe(original)
  expect(revalidateAdjustmentReceiptV3({ ...apply, nowMs: 180, receipt: clone(result.receipt) }).kind).toBe("applied")
})
it("revalidates live policy, context and exact current content before receipt consumption", () => {
  const { apply } = fixture()
  const result = applyAdjustmentDraftV3(apply)
  if (result.kind !== "applied") throw Error(result.code)
  const input = { ...apply, receipt: result.receipt }
  expect(revalidateAdjustmentReceiptV3({ ...input, nowMs: 200 })).toMatchObject({ kind: "rejected", code: "POLICY_EXPIRED" })
  expect(revalidateAdjustmentReceiptV3({ ...input, authority: { ...input.authority, policies: [] } }).kind).toBe("rejected")
  expect(revalidateAdjustmentReceiptV3({ ...input, contextKey: "other" }).kind).toBe("rejected")
  expect(revalidateAdjustmentReceiptV3({ ...input, current: result.prescription }).kind).toBe("rejected")
})
it("forged totals, deltas, dates and missing explicit action are rejected", () => {
  const { apply } = fixture()
  const result = applyAdjustmentDraftV3(apply)
  if (result.kind !== "applied") throw Error(result.code)
  for (const patch of [
    { schemaVersion: 1 }, { appliedAtMs: 999 }, { action: "AUTO" },
    { delta: { ...result.receipt.delta, main: { ...result.receipt.delta.main, recoverySeconds: 0 } } },
    { afterTotals: result.receipt.beforeTotals },
  ]) {
    const receipt = Object.assign(clone(result.receipt), patch)
    expect(revalidateAdjustmentReceiptV3({ ...apply, receipt }).kind).toBe("rejected")
  }
  expect(applyAdjustmentDraftV3(Object.assign({}, apply, { action: "AUTO" })).kind).toBe("rejected")
})
it("no reverse edge or stale configuration is inferred, and duplicate authority is rejected", () => {
  const { input, p } = fixture()
  expect(createAdjustmentDraftV3({ ...input, current: { configuration: input.target,
    sequence: input.authority.catalog[0]!.configurations[1]!.sequence }, target: input.current.configuration }).kind).toBe("rejected")
  expect(createAdjustmentDraftV3({ ...input, authority: { ...input.authority, policies: [p, p] } }).kind).toBe("rejected")
  expect(createAdjustmentDraftV3({ ...input, current: { ...input.current, sequence: { ...input.current.sequence, label: "changed" } } }).kind).toBe("rejected")
})
