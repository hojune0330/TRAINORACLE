import { adjustmentPolicyReference, applyAdjustmentDraft, configurationReference, createAdjustmentDraft } from "@impl/prescription/prescription-adjustment"
import type { PrescriptionSequence, SequenceWork } from "@impl/prescription/sequence"
import { prepareSourceAdjustmentOffer } from "./source-adjustment-offer"
import { resolvePlanMethodPrescription } from "./plan-method-resolution"
import { readPlanMethodDefinition } from "./plan-method-definition"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { draftFor, RUNTIME_CASES, saveCurrentRecord } from "./prescription-quality-matrix.test-fixtures"
import type { PlanBetaIntake } from "./plan-beta-schema"
export type AdjustedFixtureSchedule = Partial<Pick<PlanBetaIntake, "requestedFrameLength" | "secondSessionMode">>

export function adjustedMethodFixtureWithCandidate(event: typeof RUNTIME_CASES[number] = RUNTIME_CASES[3]!, work: SequenceWork = { kind: "distance", distanceM: 400, durationSeconds: null }, transform?: (sequence: PrescriptionSequence) => PrescriptionSequence, nowMs = 151, schedule: AdjustedFixtureSchedule = {}) {
  const selectedRecordId = saveCurrentRecord(event.eventDistanceM, event.performanceSeconds + 0.137)
  const generated = generatePlanFromDraft({ ...draftFor(event), ...schedule }, "NO_KNOWN_RISK", { selectedRecordId })
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
    validFromMs: nowMs - 51, expiresAtMs: nowMs + 49, allowedEdges: [{ from: definition.reference, to }] }
  const source = { authority: { catalog: [{ familyId: definition.mapping.method.familyId, reviewRef: "TEST-NOT-APPROVAL",
    configurations: [definition.configuration, config] }], policies: [policy] },
    policy: adjustmentPolicyReference(policy), current: definition.reference, contextKey: policy.contextKey,
    resolutionRevision: "TEST-REVISION", anchor: { eventDistanceM: original.selectedAnchor.eventDistanceM,
      sourceRef: original.selectedAnchor.sourceRef, contentFingerprint: binding.resolved.anchorContentFingerprint }, nowMs }
  const offer = prepareSourceAdjustmentOffer(source)
  if (offer.kind !== "available") throw Error(offer.code)
  const draft = createAdjustmentDraft({ authority: offer.authority, policy: offer.policy, current: offer.current,
    target: offer.targets[0]!, contextKey: offer.contextKey, nowMs })
  if (draft.kind !== "draft") throw Error(draft.code)
  const applied = applyAdjustmentDraft({ authority: offer.authority, draft: draft.draft, current: offer.current,
    contextKey: offer.contextKey, nowMs, action: "USER_EXPLICIT" })
  if (applied.kind !== "applied") throw Error(applied.code)
  return { candidate: generated.generated.candidates[0], generation: generated, resolution: { original, source, receipt: applied.receipt } }
}

export function adjustedMethodResolutionFixture(...args: Parameters<typeof adjustedMethodFixtureWithCandidate>) {
  return adjustedMethodFixtureWithCandidate(...args).resolution
}
