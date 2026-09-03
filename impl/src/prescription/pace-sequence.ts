import type { PaceTargetPlanPrescription } from "../plan-generator/session-types"
import {
  parsePrescriptionSequence,
  type PrescriptionSequence,
  type PrescriptionSequenceNode,
  type SequenceRecovery,
} from "./sequence"

/** Structural inputs only; this projection neither adopts nor recalculates a prescription. */
export type PaceSequenceSource = Pick<
  PaceTargetPlanPrescription,
  | "templateId"
  | "templateVersion"
  | "operationalComponents"
  | "setCount"
  | "repetitionsPerSet"
  | "repetitionDistanceM"
  | "targetEventDistanceM"
  | "selectedAnchor"
  | "repetitionRecoverySeconds"
  | "repetitionRecoveryMode"
  | "setRecoverySeconds"
  | "setRecoveryMode"
>

const noRecovery: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }

/** Lossless V2 structural view; original pace targets remain in the prescription. */
export function projectPacePrescriptionSequence(
  prescription: PaceSequenceSource,
): PrescriptionSequence | null {
  const warmup = prescription.operationalComponents.warmup
  const cooldown = prescription.operationalComponents.cooldown
  const recovery = (
    seconds: number | null,
    mode: typeof prescription.repetitionRecoveryMode,
  ): SequenceRecovery => (
    mode === "NOT_APPLICABLE" ? noRecovery : { mode, seconds }
  )
  const timed = (
    id: string,
    minutes: number,
    min: number,
    max: number,
  ): PrescriptionSequenceNode => ({
    kind: "segment",
    id,
    label: null,
    repeatCount: 1,
    work: { kind: "duration", distanceM: null, durationSeconds: minutes * 60 },
    target: { kind: "EFFORT_GUIDANCE", cue: `RPE ${min}~${max}` },
    recoveryBetweenRepeats: noRecovery,
    recoveryAfter: noRecovery,
  })

  return validated({
    kind: "PRESCRIPTION_SEQUENCE",
    version: 2,
    id: `pace-${prescription.templateId}-${prescription.templateVersion}`,
    label: null,
    warmup: [
      timed("warmup", warmup.easyDurationMinutes, warmup.rpeMin, warmup.rpeMax),
      {
        kind: "segment",
        id: "strides",
        label: "점진 가속",
        repeatCount: warmup.strides.repetitions,
        work: {
          kind: "duration",
          distanceM: null,
          durationSeconds: warmup.strides.durationSeconds,
        },
        target: { kind: "EFFORT_GUIDANCE", cue: "점진 가속" },
        recoveryBetweenRepeats: {
          mode: "WALK_OR_JOG",
          seconds: warmup.strides.recoverySeconds,
        },
        recoveryAfter: noRecovery,
      },
    ],
    main: [{
      kind: "group",
      id: "sets",
      label: null,
      repeatCount: prescription.setCount,
      recoveryBetweenRepeats: recovery(
        prescription.setRecoverySeconds,
        prescription.setRecoveryMode,
      ),
      recoveryAfter: noRecovery,
      children: [{
        kind: "segment",
        id: "main",
        label: null,
        repeatCount: prescription.repetitionsPerSet,
        work: {
          kind: "distance",
          distanceM: prescription.repetitionDistanceM,
          durationSeconds: null,
        },
        target: {
          kind: "RACE_PACE",
          eventDistanceM: prescription.targetEventDistanceM,
          anchorRef: prescription.selectedAnchor.sourceRef,
        },
        recoveryBetweenRepeats: recovery(
          prescription.repetitionRecoverySeconds,
          prescription.repetitionRecoveryMode,
        ),
        recoveryAfter: noRecovery,
      }],
    }],
    cooldown: [
      timed("cooldown", cooldown.easyDurationMinutes, cooldown.rpeMin, cooldown.rpeMax),
    ],
    terminalRecovery: noRecovery,
  })
}

function validated(sequence: unknown): PrescriptionSequence | null {
  const result = parsePrescriptionSequence(sequence)
  return result.kind === "parsed" ? result.sequence : null
}

/** Parse both structure and exact source binding; a recomputed hash is not approval. */
export function matchesPacePrescriptionSequence(source: PaceSequenceSource, sequence: unknown): boolean {
  const parsed = parsePrescriptionSequence(sequence)
  if (parsed.kind !== "parsed" || parsed.sequence.version !== 2) return false
  const expected = projectPacePrescriptionSequence(source)
  return expected !== null && JSON.stringify(parsed.sequence) === JSON.stringify(expected)
}
