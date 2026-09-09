import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { configurationReferenceV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"

/** Arithmetic-only test source, never registered as an operating dose. */
export function unanchoredAdjustmentFixtureV3(race = false, nowMs = 150, includeSets = false) {
  const sequences: PrescriptionSequenceV3[] = [2, 3].map(count => ({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
    id: `TEST-${count}`, label: null, warmup: [], cooldown: [], main: [{ kind: "segment", role: "WORK",
      id: "work", label: null, repeatCount: count, work: { kind: "duration", durationSeconds: 40, distanceM: null },
      target: race ? { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null } : { kind: "EFFORT_GUIDANCE", cue: "TEST_ONLY" },
      recoveryBetweenRepeats: [{ mode: "STAND", seconds: 60 }], recoveryAfter: [] }] }))
  if (includeSets) sequences.push({ kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "TEST-SETS", label: "시험용 세트 구성",
    warmup: [], cooldown: [], main: [{ kind: "group", id: "sets", label: null, repeatUnit: "SET", repeatCount: 2,
      recoveryBetweenRepeats: [{ mode: "STAND", seconds: 120 }], recoveryAfter: [], children: [{ kind: "segment", role: "WORK",
        id: "work", label: null, repeatCount: 2, work: { kind: "duration", durationSeconds: 30, distanceM: null },
        target: { kind: "EFFORT_GUIDANCE", cue: "TEST_ONLY" }, recoveryBetweenRepeats: [{ mode: "WALK", seconds: 30 }], recoveryAfter: [] }] }] })
  const refs = sequences.map((s, i) => configurationReferenceV3({ familyId: "TEST", configurationId: `C${i}`, version: "1" }, s))
  const policy = { policyId: "TEST", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "TEST", validFromMs: nowMs - 50,
    expiresAtMs: nowMs + 50, allowedEdges: refs.slice(1).map(to => ({ from: refs[0]!, to })) }
  return { kind: "UNANCHORED_SOURCE_V3" as const, contextKey: "TEST", resolutionRevision: "1", nowMs,
    policy: adjustmentPolicyReference(policy), current: refs[0]!, authority: { policies: [policy], catalog: [{ familyId: "TEST",
      reviewRef: "TEST_NOT_APPROVAL", configurations: sequences.map((sequence, i) => ({ configurationId: `C${i}`, version: "1", sequence })) }] } }
}
