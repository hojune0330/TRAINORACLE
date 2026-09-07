import { adjustmentPolicyReference, applyAdjustmentDraft, configurationReference, createAdjustmentDraft } from "@impl/prescription/prescription-adjustment"
import type { AdjustmentAuthority, ReviewedAdjustmentPolicy } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import type { AdjustmentCommitAdapter, AdjustmentCommitEnvironment, AdjustmentCommitState } from "./prescription-adjustment-commit"

/** Arithmetic-only test authority. Never imported by runtime components. */
export function adjustmentCommitFixture() {
  const sequence = (count: number): PrescriptionSequence => ({
    kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "TEST-ONLY", label: null, warmup: [], cooldown: [],
    terminalRecovery: { mode: "NOT_APPLICABLE", seconds: null },
    main: [{ kind: "segment", id: "test-work", label: null, repeatCount: count,
      recoveryBetweenRepeats: { mode: "STAND", seconds: 7 }, recoveryAfter: { mode: "NOT_APPLICABLE", seconds: null },
      work: { kind: "duration", durationSeconds: 13, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: "TEST-ONLY" } }],
  })
  const before = sequence(6)
  const after = sequence(4)
  const refs = [before, after].map((value, index) => configurationReference({ familyId: "test", configurationId: `c${index}`, version: "1" }, value))
  const policy: ReviewedAdjustmentPolicy = { policyId: "test-policy", version: "1", reviewRef: "TEST-NOT-APPROVAL",
    contextKey: "test-account-candidate-slot-context", validFromMs: 100, expiresAtMs: 200,
    allowedEdges: [{ from: refs[0]!, to: refs[1]! }] }
  const authority: AdjustmentAuthority = { policies: [policy], catalog: [{ familyId: "test", reviewRef: "TEST-NOT-APPROVAL",
    configurations: [before, after].map((value, index) => ({ configurationId: `c${index}`, version: "1", sequence: value })) }] }
  const explanation = (index: number) => ({ configuration: refs[index]!, explanationVersion: `test-${index}`, evidenceRefs: [`test-source-${index}`] })
  const base: AdjustmentCommitState = { candidateLineageId: "test-A", mainSlotId: "test-slot", contextKey: policy.contextKey,
    revision: "r0", prescription: { configuration: refs[0]!, sequence: before }, explanation: explanation(0), lastCommit: null }
  const draft = createAdjustmentDraft({ authority, policy: adjustmentPolicyReference(policy), contextKey: policy.contextKey,
    current: base.prescription, target: refs[1]!, nowMs: 150 })
  if (draft.kind !== "draft") throw new Error(draft.code)
  const applied = applyAdjustmentDraft({ authority, draft: draft.draft, current: base.prescription,
    contextKey: policy.contextKey, nowMs: 150, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw new Error(applied.code)
  const environment: AdjustmentCommitEnvironment = { allowed: true, contextKey: policy.contextKey,
    authority, explanations: [explanation(0), explanation(1)] }
  let current = structuredClone(base)
  let currentEnvironment = environment
  let nowMs = 151
  let writes = 0
  const adapter: AdjustmentCommitAdapter = {
    readState: () => structuredClone(current), readEnvironment: () => currentEnvironment, now: () => nowMs,
    compareAndSwap: (expected, next, validate) => {
      if (JSON.stringify(expected) !== JSON.stringify(current) || !validate()) return false
      current = structuredClone(next)
      writes++
      return true
    },
  }
  return { base, applied, environment, authority, refs, policy: adjustmentPolicyReference(policy), adapter,
    input: { base, receipt: applied.receipt, prescription: applied.prescription },
    setState: (value: AdjustmentCommitState) => { current = value },
    setEnvironment: (value: AdjustmentCommitEnvironment) => { currentEnvironment = value },
    setTime: (value: number) => { nowMs = value }, writes: () => writes }
}
