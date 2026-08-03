export const OBJECTIVE_EVIDENCE_STATUS = {
  normalizedWithinAthlete: "NORMALIZED_WITHIN_ATHLETE",
  normalizedWithinSession: "NORMALIZED_WITHIN_SESSION",
  descriptiveOnly: "DESCRIPTIVE_ONLY",
  withheld: "WITHHELD",
} as const

type BaselineStatus = "CURRENT" | "STALE" | "UNKNOWN"
type PaceSource = "CURRENT" | "GOAL"

type RunningPaceRequest = {
  readonly kind: "RUNNING_PACE"
  readonly athleteId: string
  readonly eventId: string
  readonly methodId: string
  readonly actualSecondsPerKm: number
  readonly baseline?: {
    readonly athleteId: string
    readonly eventId: string
    readonly methodId: string
    readonly source: PaceSource
    readonly status: BaselineStatus
    readonly secondsPerKm: number
  }
}

type RunningVolumeRequest = {
  readonly kind: "RUNNING_VOLUME"
  readonly athleteId: string
  readonly sessionArchetype: string
  readonly methodId: string
  readonly distanceKm: number
  readonly baseline?: {
    readonly athleteId: string
    readonly sessionArchetype: string
    readonly methodId: string
    readonly status: BaselineStatus
    readonly distanceKm: number
  }
}

type IntervalDensityRequest = {
  readonly kind: "INTERVAL_DENSITY"
  readonly repetitions: number
  readonly workSeconds: number
  readonly recoverySeconds: number
}

type StrengthDoseRequest = {
  readonly kind: "STRENGTH_DOSE"
  readonly exerciseId: string
  readonly sets: number
  readonly repetitions: number
  readonly loadPercent1Rm?: number
}

type StrengthVelocityLossRequest = {
  readonly kind: "STRENGTH_VELOCITY_LOSS"
  readonly exerciseId: string
  readonly deviceMethodId: string
  readonly firstRepMetersPerSecond: number
  readonly lastRepMetersPerSecond: number
}

type PlyometricContactsRequest = {
  readonly kind: "PLYOMETRIC_CONTACTS"
  readonly athleteId: string
  readonly exerciseId: string
  readonly methodId: string
  readonly contacts: number
  readonly baseline?: {
    readonly athleteId: string
    readonly exerciseId: string
    readonly methodId: string
    readonly status: BaselineStatus
    readonly contacts: number
  }
}

type CrossTrainingHeartRateRequest = {
  readonly kind: "CROSS_TRAINING_HEART_RATE"
  readonly modality: string
  readonly durationMinutes: number
  readonly averageHeartRatePercentMax: number
}

export type ObjectiveFatigueEvidenceRequest =
  | RunningPaceRequest
  | RunningVolumeRequest
  | IntervalDensityRequest
  | StrengthDoseRequest
  | StrengthVelocityLossRequest
  | PlyometricContactsRequest
  | CrossTrainingHeartRateRequest

type EvidenceBoundary = {
  readonly canAggregateAcrossModalities: false
  readonly canDrivePlan: false
  readonly canInferSafety: false
}

type NumericEvidence = EvidenceBoundary & {
  readonly metricId: string
  readonly value: number
  readonly unit: "PERCENT" | "REPETITIONS"
  readonly status:
    | "NORMALIZED_WITHIN_ATHLETE"
    | "NORMALIZED_WITHIN_SESSION"
    | "DESCRIPTIVE_ONLY"
}

export type ObjectiveFatigueEvidenceResult = NumericEvidence | (EvidenceBoundary & {
  readonly status: "WITHHELD"
  readonly reason:
    | "MISSING_BASELINE"
    | "BASELINE_NOT_CURRENT"
    | "GOAL_IS_NOT_CURRENT_ABILITY"
    | "ATHLETE_MISMATCH"
    | "CONTEXT_MISMATCH"
    | "METHOD_MISMATCH"
    | "INVALID_MEASUREMENT"
})

const boundary: EvidenceBoundary = {
  canAggregateAcrossModalities: false,
  canDrivePlan: false,
  canInferSafety: false,
}

function roundedPercent(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 1_000) / 10
}

function withheld(reason: Extract<ObjectiveFatigueEvidenceResult, { status: "WITHHELD" }>["reason"]): ObjectiveFatigueEvidenceResult {
  return { ...boundary, status: "WITHHELD", reason }
}

function numeric(
  status: NumericEvidence["status"],
  metricId: string,
  value: number,
  unit: NumericEvidence["unit"] = "PERCENT",
): ObjectiveFatigueEvidenceResult {
  return { ...boundary, status, metricId, value, unit }
}

function evaluateRunningPace(request: RunningPaceRequest): ObjectiveFatigueEvidenceResult {
  const baseline = request.baseline
  if (baseline === undefined) return withheld("MISSING_BASELINE")
  if (baseline.source === "GOAL") return withheld("GOAL_IS_NOT_CURRENT_ABILITY")
  if (baseline.status !== "CURRENT") return withheld("BASELINE_NOT_CURRENT")
  if (baseline.athleteId !== request.athleteId) return withheld("ATHLETE_MISMATCH")
  if (baseline.eventId !== request.eventId) return withheld("CONTEXT_MISMATCH")
  if (baseline.methodId !== request.methodId) return withheld("METHOD_MISMATCH")
  if (request.actualSecondsPerKm <= 0 || baseline.secondsPerKm <= 0) return withheld("INVALID_MEASUREMENT")
  return numeric(
    "NORMALIZED_WITHIN_ATHLETE",
    "OBJECTIVE_RUNNING_PACE_RATIO_V1",
    roundedPercent(baseline.secondsPerKm, request.actualSecondsPerKm),
  )
}

function evaluateRunningVolume(request: RunningVolumeRequest): ObjectiveFatigueEvidenceResult {
  const baseline = request.baseline
  if (baseline === undefined) return withheld("MISSING_BASELINE")
  if (baseline.status !== "CURRENT") return withheld("BASELINE_NOT_CURRENT")
  if (baseline.athleteId !== request.athleteId) return withheld("ATHLETE_MISMATCH")
  if (baseline.sessionArchetype !== request.sessionArchetype) return withheld("CONTEXT_MISMATCH")
  if (baseline.methodId !== request.methodId) return withheld("METHOD_MISMATCH")
  if (request.distanceKm <= 0 || baseline.distanceKm <= 0) return withheld("INVALID_MEASUREMENT")
  return numeric(
    "NORMALIZED_WITHIN_ATHLETE",
    "OBJECTIVE_RUNNING_VOLUME_RATIO_V1",
    roundedPercent(request.distanceKm, baseline.distanceKm),
  )
}

function evaluatePlyometricContacts(request: PlyometricContactsRequest): ObjectiveFatigueEvidenceResult {
  const baseline = request.baseline
  if (baseline === undefined) return withheld("MISSING_BASELINE")
  if (baseline.status !== "CURRENT") return withheld("BASELINE_NOT_CURRENT")
  if (baseline.athleteId !== request.athleteId) return withheld("ATHLETE_MISMATCH")
  if (baseline.exerciseId !== request.exerciseId) return withheld("CONTEXT_MISMATCH")
  if (baseline.methodId !== request.methodId) return withheld("METHOD_MISMATCH")
  if (request.contacts <= 0 || baseline.contacts <= 0) return withheld("INVALID_MEASUREMENT")
  return numeric(
    "NORMALIZED_WITHIN_ATHLETE",
    "OBJECTIVE_PLYOMETRIC_CONTACT_RATIO_V1",
    roundedPercent(request.contacts, baseline.contacts),
  )
}

function assertNever(value: never): never {
  throw new TypeError(`Unsupported objective evidence request: ${String(value)}`)
}

export function evaluateObjectiveFatigueEvidence(
  request: ObjectiveFatigueEvidenceRequest,
): ObjectiveFatigueEvidenceResult {
  switch (request.kind) {
    case "RUNNING_PACE":
      return evaluateRunningPace(request)
    case "RUNNING_VOLUME":
      return evaluateRunningVolume(request)
    case "PLYOMETRIC_CONTACTS":
      return evaluatePlyometricContacts(request)
    case "INTERVAL_DENSITY": {
      const denominator = request.workSeconds + request.recoverySeconds
      if (request.repetitions <= 0 || request.workSeconds <= 0 || denominator <= 0) {
        return withheld("INVALID_MEASUREMENT")
      }
      return numeric(
        "DESCRIPTIVE_ONLY",
        "OBJECTIVE_INTERVAL_WORK_DENSITY_V1",
        roundedPercent(request.workSeconds, denominator),
      )
    }
    case "STRENGTH_DOSE": {
      if (request.sets <= 0 || request.repetitions <= 0) return withheld("INVALID_MEASUREMENT")
      return numeric(
        "DESCRIPTIVE_ONLY",
        "OBJECTIVE_STRENGTH_REPETITION_VOLUME_V1",
        request.sets * request.repetitions,
        "REPETITIONS",
      )
    }
    case "STRENGTH_VELOCITY_LOSS": {
      if (
        request.firstRepMetersPerSecond <= 0
        || request.lastRepMetersPerSecond < 0
        || request.lastRepMetersPerSecond > request.firstRepMetersPerSecond
      ) return withheld("INVALID_MEASUREMENT")
      return numeric(
        "NORMALIZED_WITHIN_SESSION",
        "OBJECTIVE_STRENGTH_VELOCITY_LOSS_V1",
        roundedPercent(
          request.firstRepMetersPerSecond - request.lastRepMetersPerSecond,
          request.firstRepMetersPerSecond,
        ),
      )
    }
    case "CROSS_TRAINING_HEART_RATE":
      if (
        request.durationMinutes <= 0
        || request.averageHeartRatePercentMax <= 0
        || request.averageHeartRatePercentMax > 100
      ) return withheld("INVALID_MEASUREMENT")
      return numeric(
        "DESCRIPTIVE_ONLY",
        "OBJECTIVE_CROSS_TRAINING_HR_PERCENT_MAX_V1",
        request.averageHeartRatePercentMax,
      )
    default:
      return assertNever(request)
  }
}
