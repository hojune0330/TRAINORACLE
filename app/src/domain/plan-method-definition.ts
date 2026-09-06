import type { DetailedTemplateRef } from "@impl/plan-generator/types"
import { parsePrescriptionNotation } from "@impl/prescription/notation"
import { configurationReference } from "@impl/prescription/prescription-adjustment"
import { parsePrescriptionSequence, type SequenceRecovery } from "@impl/prescription/sequence"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { resolvePlanMethodMapping } from "./plan-method-registry"

/** Exact source structure only. Runtime eligibility and personal targets are separate. */
export function readPlanMethodDefinition(reference: DetailedTemplateRef) {
  const mapping = resolvePlanMethodMapping(reference)
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(item => item.templateId === reference.templateId
    && item.templateVersion === reference.version && item.templateContentFingerprint === reference.fingerprint)
  if (mapping === null || approval === undefined) return null
  const parsed = parsePrescriptionNotation(approval.notation)
  if (parsed.kind !== "parsed") return null
  const notation = parsed.notation
  const noRecovery: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }
  const recovery = (seconds: number | null, mode: typeof notation.repetitionRecoveryMode): SequenceRecovery => (
    mode === "NOT_APPLICABLE" ? noRecovery : { seconds, mode }
  )
  const result = parsePrescriptionSequence({
    kind: "PRESCRIPTION_SEQUENCE", version: 2, id: approval.templateId, label: null,
    warmup: [], cooldown: [], terminalRecovery: noRecovery,
    main: [{ kind: "group", id: "sets", label: null, repeatCount: notation.setCount,
      recoveryAfter: noRecovery, recoveryBetweenRepeats: recovery(notation.setRecoverySeconds, notation.setRecoveryMode),
      children: [{ kind: "segment", id: "work", label: null, repeatCount: notation.repetitionsPerSet,
        work: notation.repetitionDistanceM === null
          ? { kind: "duration", distanceM: null, durationSeconds: notation.repetitionDurationSeconds }
          : { kind: "distance", distanceM: notation.repetitionDistanceM, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: notation.paceTargetEventDistanceM, anchorRef: null },
        recoveryAfter: noRecovery,
        recoveryBetweenRepeats: recovery(notation.repetitionRecoverySeconds, notation.repetitionRecoveryMode),
      }],
    }],
  })
  if (result.kind !== "parsed") return null
  return {
    mapping: structuredClone(mapping),
    reference: configurationReference(mapping.method, result.sequence),
    configuration: { configurationId: mapping.method.configurationId, version: mapping.method.version, sequence: result.sequence },
    reviewRef: approval.approvalDecisionId,
    sourceRef: approval.sourceEvidenceRef,
  }
}

export type PlanMethodDefinition = NonNullable<ReturnType<typeof readPlanMethodDefinition>>
