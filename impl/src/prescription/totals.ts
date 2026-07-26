import type {
  PrescriptionDerivedTotals,
  PrescriptionUncomputableReasonCode,
  UnboundPrescriptionNotation,
} from "./types"

function freezeReasons(
  reasons: readonly PrescriptionUncomputableReasonCode[],
): readonly PrescriptionUncomputableReasonCode[] {
  return Object.freeze([...reasons])
}

export function derivePrescriptionTotals(
  notation: UnboundPrescriptionNotation,
): PrescriptionDerivedTotals {
  const totalRepetitions = notation.setCount * notation.repetitionsPerSet
  const repetitionRecoveryOccurrences = notation.setCount * (notation.repetitionsPerSet - 1)
  const setRecoveryOccurrences = notation.setCount - 1
  const repetitionRecoveryTotalSeconds = repetitionRecoveryOccurrences === 0
    ? 0
    : notation.repetitionRecoverySeconds === null
      ? null
      : repetitionRecoveryOccurrences * notation.repetitionRecoverySeconds
  const setRecoveryTotalSeconds = setRecoveryOccurrences === 0
    ? 0
    : notation.setRecoverySeconds === null
      ? null
      : setRecoveryOccurrences * notation.setRecoverySeconds
  const qualityDurationSeconds = notation.repetitionDurationSeconds === null
    ? null
    : totalRepetitions * notation.repetitionDurationSeconds
  const qualityDistanceM = notation.repetitionDistanceM === null
    ? null
    : totalRepetitions * notation.repetitionDistanceM
  const plannedRecoverySeconds = repetitionRecoveryTotalSeconds === null || setRecoveryTotalSeconds === null
    ? null
    : repetitionRecoveryTotalSeconds + setRecoveryTotalSeconds
  const mainSessionTotalExcludingWarmupCooldown = qualityDurationSeconds === null || plannedRecoverySeconds === null
    ? null
    : qualityDurationSeconds + plannedRecoverySeconds
  const reasons: PrescriptionUncomputableReasonCode[] = []
  if (qualityDistanceM === null) reasons.push("QUALITY_DISTANCE_UNAVAILABLE")
  if (qualityDurationSeconds === null) reasons.push("WORK_DURATION_UNAVAILABLE")
  if (repetitionRecoveryTotalSeconds === null) reasons.push("REPETITION_RECOVERY_UNAVAILABLE")
  if (setRecoveryTotalSeconds === null) reasons.push("SET_RECOVERY_UNAVAILABLE")

  return Object.freeze({
    totalRepetitions,
    qualityDistanceM,
    qualityDurationSeconds,
    repetitionRecoveryOccurrences,
    repetitionRecoveryTotalSeconds,
    setRecoveryOccurrences,
    setRecoveryTotalSeconds,
    plannedRecoverySeconds,
    mainSessionTotalExcludingWarmupCooldown,
    uncomputableReasonCodes: freezeReasons(reasons),
  })
}
