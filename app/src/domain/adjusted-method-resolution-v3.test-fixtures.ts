import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { applyAdjustmentDraftV3, configurationReferenceV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { SequenceWork } from "@impl/prescription/sequence"
import { prepareSourceAdjustmentOfferV3 } from "./source-adjustment-offer"
import { projectLegacyPaceSourceV3 } from "./adjusted-method-resolution-v3"
import { adjustedMethodFixtureWithCandidate } from "./adjusted-method-resolution.test-fixtures"
import { RUNTIME_CASES } from "./prescription-quality-matrix.test-fixtures"

/** Synthetic transitions only; no operating template/adoption registry writes. */
export function adjustedMethodV3FixtureWithCandidate(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!,
  work: SequenceWork = { kind: "distance", distanceM: 200, durationSeconds: null },
  transform?: (s: PrescriptionSequenceV3) => PrescriptionSequenceV3) {
  const prior = adjustedMethodFixtureWithCandidate(event), old = prior.resolution
  const bridge = projectLegacyPaceSourceV3(old.original)
  if (bridge.kind !== "projected") throw Error(bridge.code)
  const base: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "TEST-V3", label: null,
    warmup: [], cooldown: [], main: [{ kind: "group", id: "v3-sets", label: null, repeatUnit: "SET", repeatCount: 2,
      recoveryBetweenRepeats: [{ mode: "STAND", seconds: 180 }], recoveryAfter: [], children: [{
        kind: "segment", role: "WORK", id: "v3-work", label: null, repeatCount: 3, work,
        target: { kind: "RACE_PACE", eventDistanceM: event.eventDistanceM, anchorRef: null },
        recoveryBetweenRepeats: [{ mode: "WALK", distanceM: 100, seconds: null }, { mode: "STAND", seconds: 17 }],
        recoveryAfter: [{ mode: "STAND", seconds: 31 }],
      }] }] }
  const target = transform?.(base) ?? base
  const from = bridge.source.configuration
  const to = configurationReferenceV3({ familyId: from.familyId, configurationId: "TEST-V3", version: "1" }, target)
  const policy = { policyId: "TEST-V3", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "TEST-CONTEXT",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [{ from, to }] }
  const authority = { catalog: [{ familyId: from.familyId, reviewRef: "TEST_NOT_APPROVAL", configurations: [
    { configurationId: from.configurationId, version: from.version, sequence: bridge.source.sequence },
    { configurationId: to.configurationId, version: to.version, sequence: target },
  ] }], policies: [policy] }
  const source = { ...old.source, authority, current: from, policy: adjustmentPolicyReference(policy), contextKey: policy.contextKey, nowMs: 150 }
  const offer = prepareSourceAdjustmentOfferV3(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraftV3({ authority: offer.authority, current: offer.current, policy: offer.policy,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: source.nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraftV3({ authority: offer.authority, current: offer.current, draft: draft.draft,
    contextKey: offer.contextKey, nowMs: source.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  return { candidate: prior.candidate, generation: prior.generation,
    resolution: { original: old.original, source, receipt: applied.receipt } }
}

export function adjustedMethodResolutionV3Fixture(...args: Parameters<typeof adjustedMethodV3FixtureWithCandidate>) {
  return adjustedMethodV3FixtureWithCandidate(...args).resolution
}
