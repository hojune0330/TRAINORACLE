import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adjustmentPolicyReference, applyAdjustmentDraft, configurationReference, createAdjustmentDraft } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequence, PrescriptionSequenceNode, SequenceWork } from "@impl/prescription/sequence"
import { resolveAdjustedMethodPrescription } from "./adjusted-method-resolution"
import { prepareSourceAdjustmentOffer } from "./source-adjustment-offer"
import { resolvePlanMethodPrescription } from "./plan-method-resolution"
import { readPlanMethodDefinition } from "./plan-method-definition"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, saveCurrentRecord, TODAY } from "./prescription-quality-matrix.test-fixtures"
import { setActiveLocalAccount } from "./account/local-journal-ownership"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function fixture(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!, work: SequenceWork = { kind: "distance", distanceM: 400, durationSeconds: null }, transform?: (sequence: PrescriptionSequence) => PrescriptionSequence) {
  const selectedRecordId = saveCurrentRecord(event.eventDistanceM, event.performanceSeconds + 0.137)
  const generated = generatePlanFromDraft(draftFor(event), "NO_KNOWN_RISK", { selectedRecordId })
  if (generated.kind !== "generated") throw Error("Expected generated original")
  const original = generated.generated.candidates[0].sessions.find(session => session.prescription.kind === "PACE_TARGET")?.prescription
  if (original?.kind !== "PACE_TARGET") throw Error("Expected original prescription")
  const binding = resolvePlanMethodPrescription(original)!
  const definition = readPlanMethodDefinition(binding.source.template)!
  // Arbitrary structural TEST values, not an adopted or selectable exercise.
  const targetBase: PrescriptionSequence = { kind: "PRESCRIPTION_SEQUENCE", version: 2, id: "TEST-ADJUSTMENT", label: null,
    warmup: [], cooldown: [], terminalRecovery: { mode: "NOT_APPLICABLE", seconds: null },
    main: [{ kind: "segment", id: "TEST-WORK", label: null, repeatCount: 2, work,
      target: { kind: "RACE_PACE", eventDistanceM: event.eventDistanceM, anchorRef: null },
      recoveryBetweenRepeats: { mode: "STAND", seconds: 17 }, recoveryAfter: { mode: "NOT_APPLICABLE", seconds: null } }],
  }
  const target = transform?.(targetBase) ?? targetBase
  const config = { configurationId: "TEST-ALTERNATIVE", version: "1", sequence: target }
  const to = configurationReference({ familyId: definition.mapping.method.familyId,
    configurationId: config.configurationId, version: config.version }, target)
  const policy = { policyId: "TEST-POLICY", version: "1", reviewRef: "TEST-NOT-APPROVAL", contextKey: "TEST-CANDIDATE-SLOT",
    validFromMs: 100, expiresAtMs: 200, allowedEdges: [{ from: definition.reference, to }] }
  const source = { authority: { catalog: [{ familyId: definition.mapping.method.familyId, reviewRef: "TEST-NOT-APPROVAL",
    configurations: [definition.configuration, config] }], policies: [policy] },
    policy: adjustmentPolicyReference(policy), current: definition.reference, contextKey: policy.contextKey,
    resolutionRevision: "TEST-REVISION", anchor: { eventDistanceM: original.selectedAnchor.eventDistanceM,
      sourceRef: original.selectedAnchor.sourceRef, contentFingerprint: binding.resolved.anchorContentFingerprint }, nowMs: 151 }
  const offer = prepareSourceAdjustmentOffer(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraft({ authority: offer.authority, policy: offer.policy, current: offer.current,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs: 151 })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraft({ authority: offer.authority, draft: draft.draft, current: offer.current,
    contextKey: offer.contextKey, nowMs: 151, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  return { original, source, receipt: applied.receipt }
}

describe("adjusted MAIN with exact current-record targets", () => {
  it.each(RUNTIME_CASES.slice(0, 4))("$eventDistanceM resolves fractional targets without rewriting the original", event => {
    const input = fixture(event)
    const before = JSON.stringify(input)
    const result = resolveAdjustedMethodPrescription(input)
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets[0]).toMatchObject({ targetRepSeconds: input.original.selectedAnchor.performanceSeconds * 400 / event.eventDistanceM,
      secondsPerKm: input.original.selectedAnchor.performanceSeconds * 1000 / event.eventDistanceM, distanceM: 400, fixedWorkSeconds: null })
    expect(result.projection.segmentTargets[0]!.targetRepSeconds).not.toBe(Math.round(result.projection.segmentTargets[0]!.targetRepSeconds!))
    expect(result.projection.sequence.warmup).toEqual(input.original.sequence!.warmup)
    expect(result.projection.sequence.cooldown).toEqual(input.original.sequence!.cooldown)
    expect(result.projection.stage).toBe("CANDIDATE_PROJECTION_ONLY")
    expect(result.projection.explanation.kind).toBe("ADJUSTED_CONFIGURATION_EXPLANATION_REQUIRED")
    expect(JSON.stringify(input)).toBe(before)
  })

  it("keeps time-based work explicit and never invents its covered distance", () => {
    const result = resolveAdjustedMethodPrescription(fixture(undefined, { kind: "duration", durationSeconds: 90, distanceM: null }))
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets[0]).toMatchObject({ targetRepSeconds: null, fixedWorkSeconds: 90, distanceM: null, missing: null })
    expect(result.projection.structuralTotals.qualityDurationSeconds).toBe(180)
    expect(result.projection.structuralTotals.qualityDistanceM).toBeNull()
  })

  it("preserves nested mixed distance/time work and distance recovery without assigning sprint pace", () => {
    const input = fixture(undefined, { kind: "distance", distanceM: 50, durationSeconds: null }, sequence => {
      const work = sequence.main[0]!
      if (work.kind !== "segment") throw Error("Expected segment")
      const children: PrescriptionSequenceNode[] = [work, { ...work, id: "TEST-TIME", work: { kind: "duration", durationSeconds: 40, distanceM: null } },
        { ...work, id: "TEST-SPRINT", target: { kind: "SPRINT_REFERENCE", reference: "TEST-NO-NUMERIC-MODEL" } }]
      return { ...sequence, main: [{ kind: "group", id: "TEST-SET", label: null, repeatCount: 2, children,
        recoveryBetweenRepeats: { mode: "WALK", seconds: null, distanceM: 100 }, recoveryAfter: { mode: "NOT_APPLICABLE", seconds: null } }] }
    })
    const result = resolveAdjustedMethodPrescription(input)
    if (result.kind !== "resolved") throw Error(result.code)
    expect(result.projection.segmentTargets.map(target => target.segmentId)).toEqual(["TEST-WORK", "TEST-TIME"])
    expect(result.projection.sequence.main[0]).toMatchObject({ kind: "group", repeatCount: 2, recoveryBetweenRepeats: { mode: "WALK", distanceM: 100, seconds: null } })
  })

  it.each(["fingerprint", "sourceRef", "event"] as const)("rejects changed anchor %s even when candidate revision remains unchanged", field => {
    const input = fixture()
    const anchor = { ...input.source.anchor, ...(field === "fingerprint" ? { contentFingerprint: `sha256:${"f".repeat(64)}` }
      : field === "sourceRef" ? { sourceRef: "athlete-record:OTHER" } : { eventDistanceM: 1500 }) }
    expect(resolveAdjustedMethodPrescription({ ...input, source: { ...input.source, anchor } })).toEqual({ kind: "unavailable", code: "ANCHOR_MISMATCH" })
  })

  it("rejects expired or modified receipts without returning an executable projection", () => {
    const input = fixture()
    expect(resolveAdjustedMethodPrescription({ ...input, source: { ...input.source, nowMs: 200 } }).kind).toBe("unavailable")
    expect(resolveAdjustedMethodPrescription({ ...input, receipt: { ...input.receipt, delta: { ...input.receipt.delta, qualityDistanceM: 123 } } }).kind).toBe("unavailable")
  })

  it("requires separate component authority instead of overwriting preparation", () => {
    const input = fixture(undefined, undefined, sequence => ({ ...sequence,
      warmup: sequence.main.map(node => ({ ...node, id: "TEST-NEW-WARMUP" })) }))
    expect(resolveAdjustedMethodPrescription(input)).toEqual({ kind: "unavailable", code: "COMPONENT_CHANGE_UNSUPPORTED" })
  })

  it("does not read an extra memo getter", () => {
    const getter = vi.fn(() => "PRIVATE")
    expect(resolveAdjustedMethodPrescription(Object.defineProperty(fixture(), "memo", { enumerable: true, get: getter })).kind).toBe("unavailable")
    expect(getter).not.toHaveBeenCalled()
  })
})
