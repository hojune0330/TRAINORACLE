import { expect, it } from "vitest"
import { applyAdjustmentDraftV3, configurationReferenceV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import type { ReviewedAdjustmentPolicy } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { createAdjustedMethodSnapshotV3, readAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"

function fixture() {
  const sequence = (id: string, seconds: number): PrescriptionSequenceV3 => ({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
    id, label: null, warmup: [], cooldown: [], main: [{ kind: "segment", role: "WORK", id: "work", label: null,
      repeatCount: 2, work: { kind: "duration", durationSeconds: seconds, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "synthetic" },
      recoveryBetweenRepeats: [{ mode: "WALK_OR_STAND", seconds: 120 }], recoveryAfter: [] }] })
  const before = sequence("before", 120), after = sequence("after", 180)
  const a = configurationReferenceV3({ familyId: "test", configurationId: "a", version: "1" }, before)
  const b = configurationReferenceV3({ familyId: "test", configurationId: "b", version: "1" }, after)
  const p: ReviewedAdjustmentPolicy = { policyId: "test", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "ctx",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [{ from: a, to: b }] }
  const authority = { catalog: [{ familyId: "test", reviewRef: "TEST_NOT_APPROVAL", configurations: [
    { configurationId: "a", version: "1", sequence: before }, { configurationId: "b", version: "1", sequence: after },
  ] }], policies: [p] }
  const current = { configuration: a, sequence: before }, contextKey = "ctx", nowMs = 150
  const d = createAdjustmentDraftV3({ authority, current, contextKey, nowMs, target: b, policy: adjustmentPolicyReference(p) })
  if (d.kind !== "draft") throw Error(d.code)
  const applied = applyAdjustmentDraftV3({ authority, current, contextKey, nowMs, draft: d.draft, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  const explanation = { configuration: b, resolutionContextKey: contextKey, version: "1", reviewRef: "TEST_NOT_APPROVAL",
    purpose: "test purpose", energySupply: "test energy", workRationale: "test work", recoveryRationale: "test recovery",
    cycleRole: "test cycle", expectedAdaptation: "test expectation", limitations: "test limitations", observation: "test observation",
    evidenceRefs: ["test-source:1"], sequenceContentIdentity: sequenceV3ContentIdentity(after), nodeIds: ["work"] }
  const retained = { authority, contextKey, nowMs, scope: { candidateLineageId: "candidate", mainSlotId: "main-1" }, explanation }
  return { retained, input: { ...retained, receipt: applied.receipt, current } }
}
it("creates exact explanation-bound V3 snapshot and reads it historically without execution authority", () => {
  const f = fixture(), p = createAdjustedMethodSnapshotV3(f.input)
  if (p.kind !== "prepared") throw Error(p.code)
  const raw = JSON.stringify(p.snapshot)
  const read = readAdjustedMethodSnapshotV3(raw, { ...f.retained, nowMs: 500 })
  expect(read).toMatchObject({ kind: "historical", executionAuthority: "NONE", snapshot: p.snapshot })
  expect(raw).not.toContain("test purpose")
  expect(raw).not.toContain('"policies"')
  expect(createAdjustedMethodSnapshotV3({ ...f.input, nowMs: 500 }).kind).toBe("unavailable")
})
it("stale sequence explanation, missing node coverage and duplicate references reject", () => {
  const f = fixture()
  for (const change of [{ sequenceContentIdentity: "old" }, { nodeIds: [] }, { nodeIds: ["work", "work"] },
    { resolutionContextKey: "other" }, { evidenceRefs: ["same", "same"] }, { limitations: "" }]) {
    expect(createAdjustedMethodSnapshotV3({ ...f.input, explanation: { ...f.input.explanation, ...change } }).kind).toBe("unavailable")
  }
})
it("saved contents cannot supply their own approval or substitute another session", () => {
  const f = fixture(), p = createAdjustedMethodSnapshotV3(f.input)
  if (p.kind !== "prepared") throw Error(p.code)
  const raw = JSON.stringify(p.snapshot)
  expect(readAdjustedMethodSnapshotV3(raw, { ...f.retained, authority: { catalog: [], policies: [] } }).kind).toBe("unavailable")
  expect(readAdjustedMethodSnapshotV3(raw, { ...f.retained, scope: { ...f.retained.scope, mainSlotId: "other" } }).kind).toBe("unavailable")
  expect(readAdjustedMethodSnapshotV3(raw, { ...f.retained, explanation: { ...f.retained.explanation, recoveryRationale: "changed" } }).kind).toBe("unavailable")
  expect(readAdjustedMethodSnapshotV3(JSON.stringify({ ...p.snapshot, capturedAtMs: 999 }), f.retained).kind).toBe("unavailable")
  expect(readAdjustedMethodSnapshotV3(JSON.stringify({ ...p.snapshot, memo: "private" }), f.retained).kind).toBe("unavailable")
})
it("receipt and snapshot numeric tampering do not survive historical read", () => {
  const f = fixture(), p = createAdjustedMethodSnapshotV3(f.input)
  if (p.kind !== "prepared") throw Error(p.code)
  const value = structuredClone(p.snapshot)
  Object.assign(value.receipt.afterTotals.main, { workSeconds: 1 })
  expect(readAdjustedMethodSnapshotV3(JSON.stringify(value), f.retained).kind).toBe("unavailable")
})
