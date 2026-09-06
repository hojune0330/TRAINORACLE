import { describe, expect, it, vi } from "vitest"
import { adjustmentPolicyReference, applyAdjustmentDraft, configurationReference, createAdjustmentDraft } from "@impl/prescription/prescription-adjustment"
import type { AdjustmentAuthority } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import { prepareSourceAdjustmentOffer, revalidateSourceAdjustmentApplication } from "./source-adjustment-offer"
import type { SourceAdjustmentOfferInput } from "./source-adjustment-offer"
import { createSourceAdjustmentCommitAdapter } from "./source-adjustment-commit-adapter"
import { createAdjustmentCommitController } from "./prescription-adjustment-commit"
import type { AdjustmentCommitState, AdjustmentExplanationBinding } from "./prescription-adjustment-commit"

/** Synthetic structural values only, not operating templates or coaching approvals. */
function fixture(): SourceAdjustmentOfferInput {
  const sequence = (id: string, work: { kind: "distance"; distanceM: number; durationSeconds: null } | { kind: "duration"; distanceM: null; durationSeconds: number }): PrescriptionSequence => ({
    kind: "PRESCRIPTION_SEQUENCE", version: 2, id, label: null, warmup: [], cooldown: [],
    terminalRecovery: { mode: "NOT_APPLICABLE", seconds: null },
    main: [{ kind: "segment", id: "work", label: null, repeatCount: 3, work,
      target: { kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: null },
      recoveryBetweenRepeats: { mode: "JOG", seconds: 17 }, recoveryAfter: { mode: "NOT_APPLICABLE", seconds: null } }],
  })
  const sequences = [sequence("TEST-A", { kind: "distance", distanceM: 111, durationSeconds: null }),
    sequence("TEST-B", { kind: "duration", distanceM: null, durationSeconds: 23 }),
    sequence("TEST-C", { kind: "distance", distanceM: 333, durationSeconds: null })]
  const references = sequences.map((s, i) => configurationReference({ familyId: "TEST-FAMILY", configurationId: `TEST-${i}`, version: "1" }, s))
  const policy = { policyId: "TEST-POLICY", version: "1", reviewRef: "TEST-NOT-APPROVAL", contextKey: "TEST-SLOT-CONTEXT",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [
      { from: references[0]!, to: references[1]! }, { from: references[0]!, to: references[2]! },
      { from: references[1]!, to: references[2]! },
    ] }
  const authority: AdjustmentAuthority = { policies: [policy], catalog: [{ familyId: "TEST-FAMILY", reviewRef: "TEST-NOT-APPROVAL",
    configurations: sequences.map((s, i) => ({ configurationId: `TEST-${i}`, version: "1", sequence: s })) }] }
  return { authority, policy: adjustmentPolicyReference(policy), current: references[0]!, contextKey: policy.contextKey,
    resolutionRevision: "TEST-CANDIDATE-REVISION-1", anchor: { eventDistanceM: 5000, sourceRef: "athlete-record:TEST-ONLY", contentFingerprint: `sha256:${"a".repeat(64)}` }, nowMs: 150 }
}

function available(input = fixture()) {
  const offer = prepareSourceAdjustmentOffer(input)
  if (offer.kind !== "available") throw new Error(offer.code)
  return offer
}

function apply(input = fixture(), index = 0) {
  const offer = available(input)
  const draft = createAdjustmentDraft({ authority: offer.authority, policy: offer.policy, current: offer.current,
    target: offer.targets[index]!, contextKey: offer.contextKey, nowMs: input.nowMs })
  if (draft.kind !== "draft") throw new Error(draft.code)
  const applied = applyAdjustmentDraft({ authority: offer.authority, draft: draft.draft,
    current: offer.current, contextKey: offer.contextKey, nowMs: input.nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw new Error(applied.code)
  return applied
}

describe("exact source edges to independently resolved adjustment offers", () => {
  it("offers all direct allowed targets without forcing an A/B pair or adding reverse edges", () => {
    const input = fixture()
    const before = JSON.stringify(input)
    const offer = available(input)
    expect(offer.targets).toHaveLength(2)
    expect(offer.sourcePolicy).toEqual(input.policy)
    expect(offer.policy).not.toEqual(input.policy)
    expect(offer.authority.policies[0]).toMatchObject({ validFromMs: 100, expiresAtMs: 200, reviewRef: "TEST-NOT-APPROVAL" })
    expect(offer.authority.policies[0]!.allowedEdges).toHaveLength(2)
    const first = offer.current.sequence.main[0]!
    expect(first.kind).toBe("segment")
    if (first.kind !== "segment") throw new Error("Expected test segment")
    expect(first.target).toEqual({ kind: "RACE_PACE", eventDistanceM: 5000, anchorRef: input.anchor.sourceRef })
    expect(first.work).toEqual({ kind: "distance", distanceM: 111, durationSeconds: null })
    expect(first.recoveryBetweenRepeats).toEqual({ mode: "JOG", seconds: 17 })
    expect(JSON.stringify(input)).toBe(before)
    expect(createAdjustmentDraft({ authority: offer.authority, policy: offer.policy,
      current: offer.bindings[1]!.resolved, target: offer.current.configuration, contextKey: offer.contextKey, nowMs: 150 }).kind).toBe("rejected")
  })

  it.each([0, 1])("maps applied target %s back to the exact source edge and preserves unknown duration", index => {
    const input = fixture()
    const applied = apply(input, index)
    const result = revalidateSourceAdjustmentApplication(input, applied.receipt)
    expect(result.kind).toBe("applied")
    if (result.kind !== "applied") throw new Error(result.code)
    expect(result.source.from).toEqual(input.current)
    expect(result.source.to).toEqual(input.authority.policies[0]!.allowedEdges[index]!.to)
    expect(result.source.policy).toEqual(input.policy)
    expect(result.prescription).toEqual(applied.prescription)
    expect(result.receipt.beforeTotals.qualityDurationSeconds).toBeNull()
    expect(result.receipt.afterTotals.qualityDurationSeconds).toBe(index === 0 ? 69 : null)
    expect(result.receipt.delta.qualityDurationSeconds).toBeNull()
  })

  it("does not infer a transitive A-to-C transition from A-to-B and B-to-C", () => {
    const input = fixture()
    const old = input.authority.policies[0]!
    const policy = { ...old, allowedEdges: [old.allowedEdges[0]!, old.allowedEdges[2]!] }
    const offer = available({ ...input, authority: { ...input.authority, policies: [policy] }, policy: adjustmentPolicyReference(policy) })
    expect(offer.targets).toHaveLength(1)
    expect(offer.targets[0]!.configurationId).toBe("TEST-1")
  })

  it.each([99, 200, 201, NaN])("rejects invalid or expired evaluation %s without extending source lifetime", nowMs => {
    expect(prepareSourceAdjustmentOffer({ ...fixture(), nowMs }).kind).toBe("unavailable")
  })

  it.each([
    { contextKey: "other-slot" }, { resolutionRevision: "" },
    { anchor: { eventDistanceM: 1500, sourceRef: "athlete-record:OTHER", contentFingerprint: `sha256:${"a".repeat(64)}` } },
    { anchor: { eventDistanceM: 5000, sourceRef: "", contentFingerprint: `sha256:${"a".repeat(64)}` } },
  ])("rejects incompatible source/context %j", change => {
    expect(prepareSourceAdjustmentOffer({ ...fixture(), ...change }).kind).toBe("unavailable")
  })

  it.each([
    { resolutionRevision: "NEXT-REVISION" },
    { anchor: { eventDistanceM: 5000, sourceRef: "athlete-record:OTHER", contentFingerprint: `sha256:${"a".repeat(64)}` } },
    { anchor: { eventDistanceM: 5000, sourceRef: "athlete-record:TEST-ONLY", contentFingerprint: `sha256:${"b".repeat(64)}` } },
  ])("does not replay a receipt after the live resolution context changes %j", change => {
    const input = fixture()
    expect(revalidateSourceAdjustmentApplication({ ...input, ...change }, apply(input).receipt).kind).toBe("unavailable")
  })

  it("rechecks current source authority instead of trusting a formerly derived policy", () => {
    const input = fixture()
    const receipt = apply(input).receipt
    expect(revalidateSourceAdjustmentApplication({ ...input, nowMs: 200 }, receipt).kind).toBe("unavailable")
    const sourcePolicy = { ...input.authority.policies[0]!, allowedEdges: [] }
    expect(revalidateSourceAdjustmentApplication({ ...input, authority: { ...input.authority, policies: [sourcePolicy] },
      policy: adjustmentPolicyReference(sourcePolicy) }, receipt).kind).toBe("unavailable")
  })

  it("rechecks receipt totals and rejects a manufactured numeric improvement", () => {
    const input = fixture()
    const receipt = apply(input).receipt
    expect(revalidateSourceAdjustmentApplication(input, { ...receipt, delta: { ...receipt.delta, qualityDistanceM: 100 } }).kind).toBe("unavailable")
  })

  it("refuses source configurations that already contain another private anchor", () => {
    const input = fixture()
    const family = input.authority.catalog[0]!
    const config = family.configurations[0]!
    const first = config.sequence.main[0]!
    if (first.kind !== "segment") throw new Error("Expected fixture segment")
    const sequence = { ...config.sequence, main: [{ ...first, target: { kind: "RACE_PACE" as const, eventDistanceM: 5000, anchorRef: "athlete-record:OLD" } }] }
    const current = configurationReference(input.current, sequence)
    const policy = { ...input.authority.policies[0]!, allowedEdges: [{ from: current, to: input.authority.policies[0]!.allowedEdges[0]!.to }] }
    const authority = { policies: [policy], catalog: [{ ...family, configurations: [{ ...config, sequence }, ...family.configurations.slice(1)] }] }
    expect(prepareSourceAdjustmentOffer({ ...input, current, authority, policy: adjustmentPolicyReference(policy) }).kind).toBe("unavailable")
  })

  it("rejects duplicate or no-op edges rather than rendering duplicate/no-op options", () => {
    const input = fixture()
    for (const edge of [input.authority.policies[0]!.allowedEdges[0]!, { from: input.current, to: input.current }]) {
      const policy = { ...input.authority.policies[0]!, allowedEdges: [input.authority.policies[0]!.allowedEdges[0]!, edge] }
      expect(prepareSourceAdjustmentOffer({ ...input, authority: { ...input.authority, policies: [policy] },
        policy: adjustmentPolicyReference(policy) }).kind).toBe("unavailable")
    }
  })

  it("does not evaluate input getters and rejects extra source policy prose", () => {
    const input = fixture()
    const getter = vi.fn(() => "private")
    expect(prepareSourceAdjustmentOffer(Object.defineProperty({ ...input }, "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
    const policy = { ...input.authority.policies[0]!, memo: "PRIVATE_SOURCE_EXTRA" }
    expect(prepareSourceAdjustmentOffer({ ...input, authority: { ...input.authority, policies: [policy] },
      policy: adjustmentPolicyReference(policy) }).kind).toBe("unavailable")
  })
})

describe("resolved source offer to existing commit controller", () => {
  function workspace() {
    let source = fixture()
    const offer = available(source)
    const applied = apply(source)
    let explanations: readonly AdjustmentExplanationBinding[] = offer.bindings.map((item, index) => ({ configuration: item.source,
      explanationVersion: `TEST-${index}`, evidenceRefs: [`TEST-SOURCE-${index}`] }))
    let now = 151
    const base: AdjustmentCommitState = { candidateLineageId: "TEST-CANDIDATE", mainSlotId: "TEST-MAIN", contextKey: offer.contextKey,
      revision: "TEST-REVISION", prescription: offer.current, explanation: { ...explanations[0]!, configuration: offer.current.configuration }, lastCommit: null }
    let state = structuredClone(base)
    let writes = 0
    let beforeWrite = () => {}
    let allowed = true
    const adapter = createSourceAdjustmentCommitAdapter({
      isAllowed: () => allowed,
      readSource: () => source, readSourceExplanations: () => explanations, readState: () => state, now: () => now,
      compareAndSwap: (expected, next, validate) => {
        beforeWrite()
        if (JSON.stringify(expected) !== JSON.stringify(state) || !validate()) return false
        state = structuredClone(next)
        writes++
        return true
      },
    })
    return { source, base, applied, adapter, writes: () => writes, state: () => state,
      setAllowed: (value: boolean) => { allowed = value },
      setTime: (value: number) => { now = value }, setSource: (value: SourceAdjustmentOfferInput) => { source = value },
      setExplanations: (value: readonly AdjustmentExplanationBinding[]) => { explanations = value },
      beforeWrite: (run: () => void) => { beforeWrite = run } }
  }

  it("commits the selected resolved configuration and mapped explanation exactly once", async () => {
    const f = workspace()
    const controller = createAdjustmentCommitController(f.adapter)
    const input = { base: f.base, receipt: f.applied.receipt, prescription: f.applied.prescription }
    const result = await controller.commit(input)
    expect(result.kind).toBe("committed")
    expect(f.state().prescription).toEqual(f.applied.prescription)
    expect(f.state().explanation).toMatchObject({ explanationVersion: "TEST-1", evidenceRefs: ["TEST-SOURCE-1"] })
    expect((await controller.commit(input)).kind).toBe("replayed")
    expect(f.writes()).toBe(1)
  })

  it.each(["expiry", "revision", "revocation", "eligibility"] as const)("rechecks %s while waiting for the actual owner lock", async change => {
    const f = workspace()
    f.beforeWrite(() => {
      if (change === "expiry") f.setTime(200)
      else if (change === "eligibility") f.setAllowed(false)
      else if (change === "revision") f.setSource({ ...f.source, resolutionRevision: "NEW-REVISION" })
      else f.setSource({ ...f.source, authority: { ...f.source.authority, policies: [] } })
    })
    const result = await createAdjustmentCommitController(f.adapter).commit({ base: f.base,
      receipt: f.applied.receipt, prescription: f.applied.prescription })
    expect(result.kind).toBe("rejected")
    expect(f.writes()).toBe(0)
    expect(f.state()).toEqual(f.base)
  })

  it("does not commit when a source explanation is missing", async () => {
    const f = workspace()
    f.setExplanations([])
    expect((await createAdjustmentCommitController(f.adapter).commit({ base: f.base,
      receipt: f.applied.receipt, prescription: f.applied.prescription })).kind).toBe("rejected")
    expect(f.writes()).toBe(0)
  })

  it("does not expose an available environment when the current account or safety gate disallows it", () => {
    const f = workspace()
    f.setAllowed(false)
    expect(f.adapter.readEnvironment()).toEqual({ allowed: false, contextKey: "SOURCE_UNAVAILABLE",
      authority: { catalog: [], policies: [] }, explanations: [] })
  })
})
