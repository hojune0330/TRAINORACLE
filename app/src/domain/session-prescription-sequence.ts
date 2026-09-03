import type { PlanSession } from "@impl/plan-generator/types"
import { parsePrescriptionSequence, type PrescriptionSequence, type PrescriptionSequenceNode, type SequenceRecovery } from "@impl/prescription/sequence"

const noRecovery: SequenceRecovery = { mode: "NOT_APPLICABLE", seconds: null }

/** Lossless structural view: original targets remain in the saved prescription. */
export function sessionPrescriptionSequence(session: PlanSession): PrescriptionSequence | null {
  const p = session.prescription
  // A total-time envelope is not an explicit single work interval with zero recovery.
  if (p.kind !== "PACE_TARGET") return null
  const warmup = p.operationalComponents.warmup
  const cooldown = p.operationalComponents.cooldown
  const recovery = (seconds: number | null, mode: typeof p.repetitionRecoveryMode): SequenceRecovery => (
    mode === "NOT_APPLICABLE" ? noRecovery : { mode, seconds }
  )
  const timed = (id: string, minutes: number, min: number, max: number): PrescriptionSequenceNode => ({
    kind: "segment", id, label: null, repeatCount: 1,
    work: { kind: "duration", distanceM: null, durationSeconds: minutes * 60 },
    target: { kind: "EFFORT_GUIDANCE", cue: `RPE ${min}~${max}` },
    recoveryBetweenRepeats: noRecovery, recoveryAfter: noRecovery,
  })
  return validated({
    kind: "PRESCRIPTION_SEQUENCE", version: 1, id: `session-${session.day}-${session.slot}`, label: null,
    warmup: [timed("warmup", warmup.easyDurationMinutes, warmup.rpeMin, warmup.rpeMax), {
      kind: "segment", id: "strides", label: "점진 가속", repeatCount: warmup.strides.repetitions,
      work: { kind: "duration", distanceM: null, durationSeconds: warmup.strides.durationSeconds },
      target: { kind: "EFFORT_GUIDANCE", cue: "점진 가속" },
      // The existing contract allows walking OR jogging, not one silently selected mode.
      recoveryBetweenRepeats: { mode: "WALK_OR_JOG", seconds: warmup.strides.recoverySeconds },
      recoveryAfter: noRecovery,
    }],
    main: [{
      kind: "group", id: "sets", label: null, repeatCount: p.setCount,
      recoveryBetweenRepeats: recovery(p.setRecoverySeconds, p.setRecoveryMode), recoveryAfter: noRecovery,
      children: [{
        kind: "segment", id: "main", label: null, repeatCount: p.repetitionsPerSet,
        work: { kind: "distance", distanceM: p.repetitionDistanceM, durationSeconds: null },
        target: { kind: "RACE_PACE", eventDistanceM: p.targetEventDistanceM, anchorRef: p.selectedAnchor.sourceRef },
        recoveryBetweenRepeats: recovery(p.repetitionRecoverySeconds, p.repetitionRecoveryMode), recoveryAfter: noRecovery,
      }],
    }],
    cooldown: [timed("cooldown", cooldown.easyDurationMinutes, cooldown.rpeMin, cooldown.rpeMax)],
  })
}

function validated(sequence: unknown): PrescriptionSequence | null {
  const result = parsePrescriptionSequence(sequence)
  return result.kind === "parsed" ? result.sequence : null
}
