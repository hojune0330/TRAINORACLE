import { adjustmentPolicyReference } from "@impl/prescription/prescription-adjustment"
import { configurationReferenceV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"

/** Arithmetic-only test source, never registered as an operating dose. */
export function unanchoredAdjustmentFixtureV3(race = false) {
  const sequences: PrescriptionSequenceV3[] = [2, 3].map(count => ({ kind: "PRESCRIPTION_SEQUENCE", version: 3,
    id: `TEST-${count}`, label: null, warmup: [], cooldown: [], main: [{ kind: "segment", role: "WORK",
      id: "work", label: null, repeatCount: count, work: { kind: "duration", durationSeconds: 40, distanceM: null },
      target: race ? { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null } : { kind: "EFFORT_GUIDANCE", cue: "TEST_ONLY" },
      recoveryBetweenRepeats: [{ mode: "STAND", seconds: 60 }], recoveryAfter: [] }] }))
  const refs = sequences.map((s, i) => configurationReferenceV3({ familyId: "TEST", configurationId: `C${i}`, version: "1" }, s))
  const policy = { policyId: "TEST", version: "1", reviewRef: "TEST_NOT_APPROVAL", contextKey: "TEST", validFromMs: 100,
    expiresAtMs: 200, allowedEdges: [{ from: refs[0]!, to: refs[1]! }] }
  return { kind: "UNANCHORED_SOURCE_V3" as const, contextKey: "TEST", resolutionRevision: "1", nowMs: 150,
    policy: adjustmentPolicyReference(policy), current: refs[0]!, authority: { policies: [policy], catalog: [{ familyId: "TEST",
      reviewRef: "TEST_NOT_APPROVAL", configurations: sequences.map((sequence, i) => ({ configurationId: `C${i}`, version: "1", sequence })) }] } }
}
