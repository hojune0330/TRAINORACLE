import { expect, it } from "vitest"
import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { applyAdjustmentDraftV3, configurationReferenceV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3 } from "@impl/prescription/sequence-v3"
import { sequenceV3ContentIdentity } from "@impl/prescription/sequence-v3-comparison"
import { createAdjustedMethodSnapshotV3, readAdjustedMethodSnapshotV3, revalidateAdjustedMethodSnapshotV3 } from "./adjusted-method-snapshot-v3"
import { prepareSourceAdjustmentOfferV3, revalidateSourceAdjustmentApplicationV3 } from "./source-adjustment-offer"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"

// These are structural fixtures, not adopted training doses.
function fixture(anchorRef: string | null = null): SourceAdjustmentOfferInput<PrescriptionSequenceV3> {
  const sequence = (id: string, seconds: number): PrescriptionSequenceV3 => ({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
    id, label: null, warmup: [], cooldown: [], main: [{ kind: "group", id: "sets", label: null,
      repeatCount: 2, repeatUnit: "SET", recoveryBetweenRepeats: [{ mode: "STAND", seconds: 180 }], recoveryAfter: [],
      children: [{ kind: "segment", role: "WORK", id: "work", label: null, repeatCount: 3,
        work: { kind: "distance", distanceM: 200, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef },
        recoveryBetweenRepeats: [{ mode: "JOG", distanceM: 100, seconds: null }, { mode: "STAND", seconds }],
        recoveryAfter: [{ mode: "WALK_OR_STAND", seconds: 30 }] }] }] })
  const sequences = [sequence("a", 17), sequence("b", 23), sequence("c", 29)]
  const refs = sequences.map((s, i) => configurationReferenceV3({ familyId: "test", configurationId: String(i), version: "1" }, s))
  const policy = { policyId: "test", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "scoped-context",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [
      { from: refs[0]!, to: refs[1]! }, { from: refs[0]!, to: refs[2]! }, { from: refs[1]!, to: refs[2]! },
    ] }
  return { authority: { catalog: [{ familyId: "test", reviewRef: "TEST_NOT_APPROVAL",
    configurations: sequences.map((s, i) => ({ configurationId: String(i), version: "1", sequence: s })) }], policies: [policy] },
    current: refs[0]!, policy: adjustmentPolicyReference(policy), contextKey: policy.contextKey,
    resolutionRevision: "candidate:1:main:2:revision:1",
    anchor: { eventDistanceM: 800, sourceRef: "record:test", contentFingerprint: `sha256:${"a".repeat(64)}` }, nowMs: 150 }
}
function available(input = fixture()) {
  const result = prepareSourceAdjustmentOfferV3(input)
  if (result.kind !== "available") throw Error(result.code)
  return result
}
function apply(input = fixture(), index = 0) {
  const offer = available(input)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[index]!, contextKey: offer.contextKey, nowMs: input.nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: input.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  return { offer, applied }
}

it("binds every direct V3 option without changing ordered recovery, doses or source catalog", () => {
  const input = fixture(), before = JSON.stringify(input), offer = available(input)
  expect(offer.targets).toHaveLength(2)
  const clearAnchor = (node: SequenceNodeV3): SequenceNodeV3 => node.kind === "group"
    ? { ...node, children: node.children.map(clearAnchor) }
    : { ...node, target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: null } }
  for (const [index, binding] of offer.bindings.entries()) {
    const resolved = binding.resolved.sequence
    expect({ ...resolved, main: resolved.main.map(clearAnchor) }).toEqual(input.authority.catalog[0]!.configurations[index]!.sequence)
    expect(JSON.stringify(resolved)).toContain('"anchorRef":"record:test"')
    expect(binding.source).not.toEqual(binding.resolved.configuration)
  }
  expect(JSON.stringify(input)).toBe(before)
  const changed = apply(input, 1)
  expect(revalidateSourceAdjustmentApplicationV3(input, changed.applied.receipt)).toMatchObject({ kind: "applied",
    source: { from: input.current, to: input.authority.policies[0]!.allowedEdges[1]!.to } })
  expect(changed.applied.receipt.afterTotals.main).toMatchObject({ workDistanceM: 1200,
    knownRecoveryDistanceM: 400, knownRecoverySeconds: 356, recoverySeconds: null, recoveryDistanceM: null })
})

it("rejects record-content, record-id, candidate-revision and current policy replay", () => {
  const input = fixture(), { applied } = apply(input)
  for (const change of [
    { anchor: { ...input.anchor, contentFingerprint: `sha256:${"b".repeat(64)}` } },
    { anchor: { ...input.anchor, sourceRef: "record:other" } },
    { resolutionRevision: "candidate:1:main:3:revision:1" },
    { contextKey: "other-context" }, { nowMs: 200 },
    { authority: { catalog: input.authority.catalog, policies: [] } },
  ]) expect(revalidateSourceAdjustmentApplicationV3({ ...input, ...change }, applied.receipt).kind).toBe("unavailable")
})

it("rejects unknown fields, foreign anchors, mismatched event and invalid V3 source structures", () => {
  const input = fixture()
  expect(prepareSourceAdjustmentOfferV3({ ...input, memo: "private" } as typeof input).kind).toBe("unavailable")
  expect(prepareSourceAdjustmentOfferV3({ ...input, anchor: { ...input.anchor, eventDistanceM: 1500 } }).kind).toBe("unavailable")
  // Recompute valid source identities: rejection must be the anchor boundary,
  // not merely the fingerprint mismatch exercised by the mutations below.
  expect(prepareSourceAdjustmentOfferV3(fixture("record:foreign")).kind).toBe("unavailable")
  expect(prepareSourceAdjustmentOfferV3(fixture("record:test")).kind).toBe("unavailable")
  for (const replacement of ['"anchorRef":"record:foreign"', '"anchorRef":null,"memo":"private"']) {
    const authority = JSON.parse(JSON.stringify(input.authority).replaceAll('"anchorRef":null', replacement))
    expect(prepareSourceAdjustmentOfferV3({ ...input, authority }).kind).toBe("unavailable")
  }
  const legacy = JSON.parse(JSON.stringify(input.authority).replaceAll('"version":3', '"version":2'))
  expect(prepareSourceAdjustmentOfferV3({ ...input, authority: legacy }).kind).toBe("unavailable")
})

it("rejects accessors before evaluating untrusted record fields", () => {
  const input = fixture()
  let reads = 0
  const anchor = { ...input.anchor }
  Object.defineProperty(anchor, "sourceRef", { enumerable: true, get() { reads++; return "record:test" } })
  expect(prepareSourceAdjustmentOfferV3({ ...input, anchor }).kind).toBe("unavailable")
  expect(reads).toBe(0)
})

it("preserves direct-edge authority and never invents a reverse or transitive adjustment", () => {
  const input = fixture(), p = input.authority.policies[0]!
  const policy = { ...p, allowedEdges: [p.allowedEdges[0]!, p.allowedEdges[2]!] }
  const offer = available({ ...input, authority: { ...input.authority, policies: [policy] }, policy: adjustmentPolicyReference(policy) })
  expect(offer.targets).toHaveLength(1)
  expect(createAdjustmentDraftV3({ authority: offer.authority, current: offer.bindings[1]!.resolved,
    target: offer.current.configuration, contextKey: offer.contextKey, policy: offer.policy, nowMs: 150 }).kind).toBe("rejected")
})

it("connects exact source application to explanation snapshot and historical read without activation", () => {
  const input = fixture(), { offer, applied } = apply(input)
  const checked = revalidateSourceAdjustmentApplicationV3(input, applied.receipt)
  if (checked.kind !== "applied") throw Error(checked.code)
  const explanation = { configuration: checked.prescription.configuration, resolutionContextKey: checked.resolutionContextKey,
    version: "1", reviewRef: "TEST_NOT_APPROVAL", purpose: "synthetic purpose", energySupply: "synthetic energy",
    workRationale: "synthetic work", recoveryRationale: "synthetic ordered recovery", cycleRole: "synthetic role",
    expectedAdaptation: "synthetic expectation", limitations: "synthetic limitation", observation: "synthetic observation",
    evidenceRefs: ["test-source:1"], sequenceContentIdentity: sequenceV3ContentIdentity(checked.prescription.sequence), nodeIds: ["sets", "work"] }
  const retained = { authority: offer.authority, contextKey: offer.contextKey, nowMs: input.nowMs, explanation,
    scope: { candidateLineageId: "candidate:1", mainSlotId: "main:2" } }
  const snapshot = createAdjustedMethodSnapshotV3({ ...retained, receipt: checked.receipt, current: offer.current })
  if (snapshot.kind !== "prepared") throw Error(snapshot.code)
  const raw = JSON.stringify(snapshot.snapshot)
  const candidateInput = { source: input, scope: retained.scope, explanation }
  expect(revalidateAdjustedMethodSnapshotV3(raw, candidateInput)).toMatchObject({ kind: "candidate_ready",
    executionAuthority: "NONE", requiredNextGate: "FULL_PLAN_SELECTION_REVALIDATION", snapshot: snapshot.snapshot,
    source: checked.source, resolutionContextKey: offer.contextKey })
  for (const source of [{ ...input, nowMs: 201 }, { ...input, resolutionRevision: "other-candidate" },
    { ...input, anchor: { ...input.anchor, contentFingerprint: `sha256:${"b".repeat(64)}` } },
    { ...input, authority: { catalog: input.authority.catalog, policies: [] } }]) {
    expect(revalidateAdjustedMethodSnapshotV3(raw, { ...candidateInput, source }).kind).toBe("unavailable")
  }
  expect(revalidateAdjustedMethodSnapshotV3(raw, { ...candidateInput,
    explanation: { ...explanation, recoveryRationale: "new explanation" } }).kind).toBe("unavailable")
  expect(revalidateAdjustedMethodSnapshotV3(raw, { ...candidateInput,
    scope: { ...retained.scope, mainSlotId: "other-slot" } }).kind).toBe("unavailable")
  expect(revalidateAdjustedMethodSnapshotV3(raw, { ...candidateInput,
    memo: "private" } as typeof candidateInput).kind).toBe("unavailable")
  expect(readAdjustedMethodSnapshotV3(JSON.stringify(snapshot.snapshot), { ...retained, nowMs: 201 }))
    .toMatchObject({ kind: "historical", executionAuthority: "NONE" })
  expect(revalidateSourceAdjustmentApplicationV3({ ...input, nowMs: 201 }, checked.receipt).kind).toBe("unavailable")
})
