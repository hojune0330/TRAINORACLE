import { describe, expect, it } from "vitest"
import { adjustmentPolicyReference, applyAdjustmentDraft, configurationReference, createAdjustmentDraft, resetAdjustmentDraft } from "./prescription-adjustment"
import type { AdjustmentAuthority, AdjustmentDraft, PrescriptionSnapshot, ReviewedAdjustmentPolicy } from "./prescription-adjustment"
import type { PrescriptionSequence, PrescriptionSequenceNode, PrescriptionSequenceSegment, SequenceRecovery } from "./sequence"

// Entire registry is synthetic; these numbers are arithmetic fixtures, not accepted doses.
const none = { mode: "NOT_APPLICABLE", seconds: null } as const
const recovery = (seconds: number): SequenceRecovery => ({ mode: "STAND", seconds })
function segment(count: number, seconds: number | null = 13): PrescriptionSequenceSegment {
  return { kind: "segment", id: "work", label: "SYNTHETIC", repeatCount: count,
    recoveryBetweenRepeats: recovery(7), recoveryAfter: recovery(999),
    work: { kind: "duration", durationSeconds: seconds, distanceM: null },
    target: { kind: "EFFORT_GUIDANCE", cue: "SYNTHETIC-NOT-ACTIVATED" } }
}
function sequence(main: readonly PrescriptionSequenceNode[], terminalRecovery: SequenceRecovery = none): PrescriptionSequence {
  return { kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "synthetic-root", label: null,
    warmup: [], main, cooldown: [], terminalRecovery }
}
function fixture(beforeSequence = sequence([segment(6)]), afterSequence = sequence([{
  kind: "group", id: "sets", label: null, repeatCount: 2,
  recoveryBetweenRepeats: recovery(19), recoveryAfter: recovery(999), children: [segment(3)],
}])) {
  const beforeRef = configurationReference({ familyId: "synthetic-family", configurationId: "base", version: "1" }, beforeSequence)
  const afterRef = configurationReference({ familyId: "synthetic-family", configurationId: "split", version: "1" }, afterSequence)
  const current: PrescriptionSnapshot = { configuration: beforeRef, sequence: beforeSequence }
  const policy: ReviewedAdjustmentPolicy = { policyId: "synthetic-policy", version: "1", reviewRef: "SYNTHETIC-NOT-APPROVAL",
    contextKey: "synthetic-session-purpose-anchor-eligibility-revision", validFromMs: 100, expiresAtMs: 200,
    allowedEdges: [{ from: beforeRef, to: afterRef }] }
  const authority: AdjustmentAuthority = { catalog: [{ familyId: "synthetic-family", reviewRef: "SYNTHETIC-NOT-APPROVAL", configurations: [
    { configurationId: "base", version: "1", sequence: beforeSequence },
    { configurationId: "split", version: "1", sequence: afterSequence },
  ] }], policies: [policy] }
  return { authority, policy: adjustmentPolicyReference(policy), contextKey: policy.contextKey, current, target: afterRef, nowMs: 150 }
}
function draft(input = fixture()): AdjustmentDraft {
  const result = createAdjustmentDraft(input)
  if (result.kind !== "draft") throw new Error(result.code)
  return result.draft
}
function apply(input = fixture(), pending = draft(input)) {
  return applyAdjustmentDraft({ ...input, draft: pending, action: "USER_EXPLICIT" })
}

describe("synthetic exact-configuration adjustment", () => {
  it("creates a draft without applying and resets pending intent without mutating a plan", () => {
    const input = fixture()
    const serialized = JSON.stringify(input)
    const pending = draft(input)
    expect(pending.before).toEqual(input.current)
    expect(pending.after.configuration).toEqual(input.target)
    expect(resetAdjustmentDraft(pending)).toBeNull()
    expect(JSON.stringify(input)).toBe(serialized)
    expect(pending.after.sequence).not.toBe(input.authority.catalog[0]?.configurations[1]?.sequence)
    expect(Object.isFrozen(pending.after.sequence.main)).toBe(true)
  })

  it("applies only USER_EXPLICIT and records exact before/after plus real set-splitting boundary deltas", () => {
    const input = fixture()
    const original = JSON.stringify(input)
    const result = apply(input)
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.receipt.action).toBe("USER_EXPLICIT")
    expect(result.receipt.before).toEqual(input.current)
    expect(result.receipt.after).toEqual(result.prescription)
    expect(result.receipt.beforeTotals).toMatchObject({ totalRepetitions: 6, qualityDurationSeconds: 78,
      repetitionRecoveryOccurrences: 5, repetitionRecoveryTotalSeconds: 35, setRecoveryOccurrences: 0,
      plannedRecoverySeconds: 35, mainSessionTotalExcludingWarmupCooldown: 113 })
    expect(result.receipt.afterTotals).toMatchObject({ totalRepetitions: 6, qualityDurationSeconds: 78,
      repetitionRecoveryOccurrences: 4, repetitionRecoveryTotalSeconds: 28, setRecoveryOccurrences: 1,
      setRecoveryTotalSeconds: 19, transitionRecoveryOccurrences: 0, plannedRecoverySeconds: 47,
      mainSessionTotalExcludingWarmupCooldown: 125 })
    expect(result.receipt.delta).toMatchObject({ totalRepetitions: 0, qualityDurationSeconds: 0,
      repetitionRecoveryOccurrences: -1, setRecoveryOccurrences: 1, plannedRecoverySeconds: 12,
      mainSessionTotalExcludingWarmupCooldown: 12, qualityDistanceM: null })
    expect(result.receipt.methodDifferences).toEqual(expect.arrayContaining(["WORK_STRUCTURE", "RECOVERY"]))
    expect(result.draft).toBeNull()
    expect(JSON.stringify(input)).toBe(original)
    expect(Object.isFrozen(result.receipt.delta)).toBe(true)
  })

  it("handles one repetition per set without phantom repetition or trailing-child recovery", () => {
    const after = sequence([{ kind: "group", id: "sets", label: null, repeatCount: 2,
      recoveryBetweenRepeats: recovery(19), recoveryAfter: recovery(999), children: [segment(1)] }])
    const result = apply(fixture(sequence([segment(2)]), after))
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.receipt.afterTotals).toMatchObject({ totalRepetitions: 2, repetitionRecoveryOccurrences: 0,
      setRecoveryOccurrences: 1, transitionRecoveryOccurrences: 0, terminalRecoveryOccurrences: 0, plannedRecoverySeconds: 19 })
  })

  it("preserves unknown work durations in totals and delta instead of zero or pace inference", () => {
    const result = apply(fixture(sequence([segment(3, null)]), sequence([segment(4, null)])))
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.receipt.beforeTotals.qualityDurationSeconds).toBeNull()
    expect(result.receipt.afterTotals.mainSessionTotalExcludingWarmupCooldown).toBeNull()
    expect(result.receipt.delta.qualityDurationSeconds).toBeNull()
    expect(result.receipt.delta.mainSessionTotalExcludingWarmupCooldown).toBeNull()
    expect(result.receipt.afterTotals.uncomputableReasonCodes).toContain("WORK_DURATION_UNAVAILABLE")
    expect(result.receipt.delta.totalRepetitions).toBe(1)
    expect(result.receipt.methodDifferences).toEqual([])
  })

  it("counts distance recovery and terminal recovery separately without converting to time", () => {
    const roll = { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 17 } as const
    const work = { ...segment(3), recoveryBetweenRepeats: roll, work: { kind: "distance", distanceM: 111, durationSeconds: null } } as const
    const result = apply(fixture(sequence([work]), sequence([work], roll)))
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.receipt.afterTotals).toMatchObject({ qualityDistanceM: 333, repetitionRecoveryOccurrences: 2,
      repetitionRecoveryTotalDistanceM: 34, terminalRecoveryOccurrences: 1, terminalRecoveryDistanceM: 17,
      plannedRecoveryDistanceM: 51, plannedRecoverySeconds: null, qualityDurationSeconds: null })
    expect(result.receipt.delta).toMatchObject({ qualityDistanceM: 0, plannedRecoveryDistanceM: 17,
      plannedRecoverySeconds: null, terminalRecoveryOccurrences: 1 })
    expect(result.receipt.methodDifferences).toEqual(["TERMINAL_RECOVERY"])
  })

  it("rejects forged policy content even when the attacker recomputes its identity", () => {
    const input = fixture()
    const original = input.authority.policies[0]!
    const forged = { ...original, expiresAtMs: 900, allowedEdges: [...original.allowedEdges, { from: input.target, to: input.current.configuration }] }
    expect(createAdjustmentDraft({ ...input, policy: adjustmentPolicyReference(forged) })).toEqual({ kind: "rejected", code: "POLICY_MISMATCH" })
    expect(createAdjustmentDraft({ ...input, policy: { ...input.policy, version: "unreviewed" } })).toEqual({ kind: "rejected", code: "POLICY_MISMATCH" })
  })

  it("rejects expired/not-yet-valid policies including exact expiry and rechecks on apply", () => {
    const input = fixture()
    const pending = draft(input)
    for (const nowMs of [99, 200]) {
      expect(createAdjustmentDraft({ ...input, nowMs })).toEqual({ kind: "rejected", code: "POLICY_EXPIRED" })
      expect(apply({ ...input, nowMs }, pending)).toEqual({ kind: "rejected", code: "POLICY_EXPIRED" })
    }
    expect(createAdjustmentDraft({ ...input, nowMs: 100 }).kind).toBe("draft")
    expect(apply({ ...input, nowMs: 199 }, pending).kind).toBe("applied")
  })

  it("rejects mismatched session/purpose/anchor/eligibility context and withdrawn authority", () => {
    const input = fixture()
    const pending = draft(input)
    expect(createAdjustmentDraft({ ...input, contextKey: "different-session" })).toEqual({ kind: "rejected", code: "CONTEXT_MISMATCH" })
    expect(apply({ ...input, contextKey: "new-anchor" }, pending)).toEqual({ kind: "rejected", code: "CONTEXT_MISMATCH" })
    expect(apply({ ...input, authority: { ...input.authority, policies: [] } }, pending)).toEqual({ kind: "rejected", code: "POLICY_MISMATCH" })
  })

  it("rejects altered configuration bodies even with matching recomputed identities", () => {
    const input = fixture()
    const forgedSequence = sequence([segment(99)])
    const configuration = configurationReference(input.current.configuration, forgedSequence)
    expect(createAdjustmentDraft({ ...input, current: { configuration, sequence: forgedSequence } })).toEqual({ kind: "rejected", code: "CONFIGURATION_MISMATCH" })
    expect(createAdjustmentDraft({ ...input, target: { ...input.target, contentIdentity: configuration.contentIdentity } })).toEqual({ kind: "rejected", code: "CONFIGURATION_MISMATCH" })
    expect(createAdjustmentDraft({ ...input, target: { ...input.target, version: "2" } })).toEqual({ kind: "rejected", code: "CONFIGURATION_MISMATCH" })
  })

  it("rejects draft-body tampering, unknown injected fields and non-explicit apply", () => {
    const input = fixture()
    const pending = draft(input)
    expect(apply(input, { ...pending, after: { ...pending.after, sequence: sequence([segment(99)]) } })).toEqual({ kind: "rejected", code: "DRAFT_MISMATCH" })
    expect(apply(input, { ...pending, approved: true } as AdjustmentDraft)).toEqual({ kind: "rejected", code: "DRAFT_MISMATCH" })
    expect(applyAdjustmentDraft({ ...input, draft: pending, action: "AUTO" as "USER_EXPLICIT" })).toEqual({ kind: "rejected", code: "EXPLICIT_ACTION_REQUIRED" })
  })

  it("rejects current-plan drift and immediate replay against the already changed prescription", () => {
    const input = fixture()
    const pending = draft(input)
    expect(apply({ ...input, current: pending.after }, pending)).toEqual({ kind: "rejected", code: "CURRENT_MISMATCH" })
  })

  it("does not infer reverse edges, transitive permission or an unreviewed scalar combination", () => {
    const input = fixture()
    const pending = draft(input)
    expect(createAdjustmentDraft({ ...input, current: pending.after, target: input.current.configuration })).toEqual({ kind: "rejected", code: "EDGE_NOT_ALLOWED" })
    expect(createAdjustmentDraft({ ...input, target: input.current.configuration })).toEqual({ kind: "rejected", code: "EDGE_NOT_ALLOWED" })
    const hybrid = sequence([segment(5)])
    expect(createAdjustmentDraft({ ...input, target: configurationReference(input.target, hybrid) })).toEqual({ kind: "rejected", code: "CONFIGURATION_MISMATCH" })
    const thirdRef = configurationReference({ ...input.target, configurationId: "third" }, hybrid)
    const policy: ReviewedAdjustmentPolicy = { ...input.authority.policies[0]!, allowedEdges: [
      ...input.authority.policies[0]!.allowedEdges, { from: input.target, to: thirdRef },
    ] }
    const authority: AdjustmentAuthority = { catalog: [{ ...input.authority.catalog[0]!, configurations: [
      ...input.authority.catalog[0]!.configurations, { configurationId: "third", version: "1", sequence: hybrid },
    ] }], policies: [policy] }
    expect(createAdjustmentDraft({ ...input, authority, policy: adjustmentPolicyReference(policy), target: thirdRef })).toEqual({ kind: "rejected", code: "EDGE_NOT_ALLOWED" })
    expect(createAdjustmentDraft({ ...input, authority, policy: adjustmentPolicyReference(policy), current: pending.after, target: thirdRef }).kind).toBe("draft")
  })

  it("rejects duplicate authority IDs and edges whose bound configuration no longer matches", () => {
    const input = fixture()
    expect(createAdjustmentDraft({ ...input, authority: { ...input.authority, policies: [...input.authority.policies, ...input.authority.policies] } })).toEqual({ kind: "rejected", code: "INVALID_AUTHORITY" })
    const altered = { ...input.authority.catalog[0]!, configurations: [{ configurationId: "base", version: "1", sequence: sequence([segment(9)]) }, input.authority.catalog[0]!.configurations[1]!] }
    expect(createAdjustmentDraft({ ...input, authority: { ...input.authority, catalog: [altered] } })).toEqual({ kind: "rejected", code: "INVALID_AUTHORITY" })
  })

  it("accepts a detached serialized draft but does not use it as authority", () => {
    const input = fixture()
    const restored = JSON.parse(JSON.stringify(draft(input))) as AdjustmentDraft
    expect(apply(input, restored).kind).toBe("applied")
    expect(apply({ ...input, authority: { catalog: input.authority.catalog, policies: [] } }, restored).kind).toBe("rejected")
  })

  it("exports opaque SHA256 identities without embedded private anchors or prescription text", () => {
    const privateSequence = sequence([{ ...segment(2), target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: "synthetic-private-anchor" } }])
    const input = fixture(privateSequence)
    expect(input.current.configuration.contentIdentity).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(input.policy.contentIdentity).toMatch(/^sha256:[a-f0-9]{64}$/)
    const references = JSON.stringify([input.current.configuration, input.policy])
    expect(references).not.toContain("synthetic-private-anchor")
    expect(references).not.toContain("SYNTHETIC-NOT-ACTIVATED")
    const reordered = { version: "1", configurationId: "base", familyId: "synthetic-family" }
    expect(configurationReference(reordered, privateSequence)).toEqual(input.current.configuration)
    expect(apply(input).kind).toBe("applied")
  })

  it("rejects cycles, nonfinite values, sparse arrays and getters without invoking hooks", () => {
    const input = fixture()
    const pending = draft(input)
    let reads = 0
    const getterPolicy = { ...input.authority.policies[0]! }
    Object.defineProperty(getterPolicy, "reviewRef", { enumerable: true, get() { reads += 1; return "forged" } })
    expect(() => adjustmentPolicyReference(getterPolicy)).toThrow(TypeError)
    expect(createAdjustmentDraft({ ...input, authority: { ...input.authority, policies: [getterPolicy] } }).kind).toBe("rejected")
    const getterInput = { ...input, draft: pending, action: "USER_EXPLICIT" as const }
    Object.defineProperty(getterInput, "action", { enumerable: true, get() { reads += 1; return "USER_EXPLICIT" } })
    expect(applyAdjustmentDraft(getterInput).kind).toBe("rejected")
    expect(reads).toBe(0)
    const cyclic = { ...input.authority.policies[0]!, cycle: null as unknown }
    cyclic.cycle = cyclic
    expect(() => adjustmentPolicyReference(cyclic)).toThrow(TypeError)
    const cyclicDraft = { ...pending, loop: null as unknown }
    cyclicDraft.loop = cyclicDraft
    expect(apply(input, cyclicDraft)).toEqual({ kind: "rejected", code: "DRAFT_MISMATCH" })
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => adjustmentPolicyReference({ ...input.authority.policies[0]!, expiresAtMs: value })).toThrow(TypeError)
      expect(createAdjustmentDraft({ ...input, nowMs: value }).kind).toBe("rejected")
      expect(apply({ ...input, nowMs: value }, pending).kind).toBe("rejected")
    }
    const sparse = new Array(1) as ReviewedAdjustmentPolicy["allowedEdges"]
    expect(() => adjustmentPolicyReference({ ...input.authority.policies[0]!, allowedEdges: sparse })).toThrow(TypeError)
  })

  it("counts repeated sibling transitions, parent set recovery and terminal recovery once per boundary", () => {
    const after = sequence([{ kind: "group", id: "sets", label: null, repeatCount: 2,
      recoveryBetweenRepeats: recovery(19), recoveryAfter: recovery(999), children: [
        { ...segment(2), recoveryAfter: recovery(11) }, { ...segment(1), id: "second" },
      ] }], recovery(5))
    const result = apply(fixture(sequence([segment(6)]), after))
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.receipt.afterTotals).toMatchObject({ totalRepetitions: 6, repetitionRecoveryOccurrences: 2,
      repetitionRecoveryTotalSeconds: 14, transitionRecoveryOccurrences: 2, transitionRecoveryTotalSeconds: 22,
      setRecoveryOccurrences: 1, setRecoveryTotalSeconds: 19, terminalRecoveryOccurrences: 1,
      terminalRecoveryTotalSeconds: 5, plannedRecoverySeconds: 60 })
    expect(result.receipt.delta.plannedRecoverySeconds).toBe(25)
  })
})
