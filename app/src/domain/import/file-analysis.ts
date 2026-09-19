import { isValidIsoDate } from "../dates"
import { parseFileObservation, type FileObservationV1 } from "./file-observation"
import { FILE_ANALYSIS_POLICY_VERSION, fileAnalysisFormats, type FileAnalysisFormat } from "./file-analysis-policy"

export const FILE_ANALYSIS_FORMULA_VERSION = "FILE_DESCRIPTIVE_SUM_V1" as const
export type FileAnalysisSourceContext = "ACCOUNT_CONFIRMED" | "DEVICE_PREVIEW"
export type FileAnalysisOptions = {
  readonly formats?: readonly FileAnalysisFormat[]
  /** The caller supplies only the current account's acknowledged, non-deleted revisions. */
  readonly sourceContext?: FileAnalysisSourceContext
}

/** Deliberately excludes titles, file names, raw notes, GPS and account credentials. */
export type FileAnalysisEntry = {
  readonly id: string
  readonly kind: string
  readonly date: string
  readonly fileObservation?: unknown
}

export type FileAnalysisExclusion =
  | "NOT_FILE_OBSERVATION" | "INVALID_FILE_OBSERVATION" | "DATE_MISMATCH"
  | "CONFIRMATION_REQUIRED" | "FORMAT_DISABLED" | "ACCOUNT_CONFIRMATION_REQUIRED"
  | "CONFLICTING_SOURCE_KEY" | "MISSING_DISTANCE" | "MISSING_DURATION"
  | "DIFFERENT_TIME_MEANING" | "TIME_MEANING_UNCONFIRMED" | "ZERO_DISTANCE"
  | "ZERO_DURATION" | "NON_FINITE_RESULT"

type DurationMeaning = FileObservationV1["durationMeaning"]
type Sport = FileObservationV1["sport"]
export type ProjectedFileObservation = {
  readonly policyVersion: typeof FILE_ANALYSIS_POLICY_VERSION
  readonly source: "FILE_UPLOAD"
  readonly journalEntryId: string
  readonly sourceObservationKey: string
  readonly contentRevisionFingerprint: string
  readonly date: string
  readonly format: FileAnalysisFormat
  readonly sport: Sport
  readonly sourceSport: Sport
  readonly distanceMeters: number | null
  readonly durationSeconds: number | null
  readonly durationMeaning: DurationMeaning
  readonly sourceDurationMeaning: DurationMeaning
  readonly durationMeaningConfirmed: boolean
  readonly laps: readonly Readonly<FileObservationV1["laps"][number]>[]
  readonly completeness: Readonly<FileObservationV1["completeness"]>
  readonly lapDurationReferences: readonly {
    readonly durationMeaning: DurationMeaning
    readonly partialSeconds: number | null
    readonly sampleCount: number
    readonly missingCount: number
  }[]
}

// JSON/restored payloads cannot manufacture an in-memory adoption attestation.
const projectedObservations = new WeakSet<object>()
type ProjectionIdentity = { readonly sourceKey: string; readonly journalId: string; readonly signature: string }
const projectionIdentities = new WeakMap<object, ProjectionIdentity>()
export function isProjectedFileObservation(value: unknown): value is ProjectedFileObservation {
  return typeof value === "object" && value !== null && projectedObservations.has(value)
}

export type FileObservationProjection =
  | { readonly status: "ACCEPTED"; readonly observation: ProjectedFileObservation }
  | { readonly status: "EXCLUDED"; readonly reasonCode: FileAnalysisExclusion }

export function projectFileObservation(
  entry: FileAnalysisEntry,
  options: FileAnalysisOptions = {},
): FileObservationProjection {
  let identity: ProjectionIdentity | undefined
  const result = (value: FileObservationProjection): FileObservationProjection => {
    if (identity !== undefined) projectionIdentities.set(value, identity)
    return value
  }
  const exclude = (reasonCode: FileAnalysisExclusion) => result({ status: "EXCLUDED", reasonCode })
  if (entry.kind !== "post-session" || entry.fileObservation === undefined) return exclude("NOT_FILE_OBSERVATION")
  const parsed = parseFileObservation(entry.fileObservation)
  if (parsed === null || entry.id.trim() === "") return exclude("INVALID_FILE_OBSERVATION")
  identity = { sourceKey: parsed.sourceObservationKey, journalId: entry.id, signature: JSON.stringify([
    parsed.contentRevisionFingerprint, entry.date, parsed.confirmation !== null,
    parsed.confirmation?.sport ?? parsed.sport, parsed.confirmation?.durationMeaning ?? parsed.durationMeaning,
    parsed.confirmation?.durationMeaning !== null && parsed.confirmation?.durationMeaning !== undefined,
  ]) }
  if (!isValidIsoDate(entry.date) || parsed.date !== entry.date) return exclude("DATE_MISMATCH")
  if (parsed.confirmation === null) return exclude("CONFIRMATION_REQUIRED")
  if (!(options.formats ?? fileAnalysisFormats()).includes(parsed.format)) return exclude("FORMAT_DISABLED")
  if (options.sourceContext !== "ACCOUNT_CONFIRMED") return exclude("ACCOUNT_CONFIRMATION_REQUIRED")
  const observation: ProjectedFileObservation = Object.freeze({
    policyVersion: FILE_ANALYSIS_POLICY_VERSION,
    source: "FILE_UPLOAD",
    journalEntryId: entry.id,
    sourceObservationKey: parsed.sourceObservationKey,
    contentRevisionFingerprint: parsed.contentRevisionFingerprint,
    date: parsed.date,
    format: parsed.format,
    sport: parsed.confirmation.sport ?? parsed.sport,
    sourceSport: parsed.sport,
    distanceMeters: parsed.distanceMeters,
    durationSeconds: parsed.durationSeconds,
    durationMeaning: parsed.confirmation.durationMeaning ?? parsed.durationMeaning,
    sourceDurationMeaning: parsed.durationMeaning,
    durationMeaningConfirmed: parsed.confirmation.durationMeaning !== null,
    laps: Object.freeze(parsed.laps.map(lap => Object.freeze({ ...lap }))),
    completeness: Object.freeze({ ...parsed.completeness }),
    lapDurationReferences: Object.freeze(meanings.flatMap(meaning => {
      const laps = parsed.laps.filter(lap => lap.durationMeaning === meaning)
      if (laps.length === 0) return []
      const seconds = laps.flatMap(lap => lap.durationSeconds === null ? [] : [lap.durationSeconds])
      return [Object.freeze({ durationMeaning: meaning, partialSeconds: sum(seconds),
        sampleCount: seconds.length, missingCount: laps.length - seconds.length })]
    })),
  })
  projectedObservations.add(observation)
  return result({ status: "ACCEPTED", observation })
}

/** Confirmation is separate from the content digest, but disagreements still conflict. */
export function fileObservationAnalysisSignature(observation: ProjectedFileObservation): string {
  return JSON.stringify([
    observation.contentRevisionFingerprint, observation.date, observation.sport,
    observation.durationMeaning, observation.durationMeaningConfirmed,
  ])
}

export type FileMetricSummary = {
  readonly value: number | null
  readonly sampleCount: number
  readonly excludedCount: number
  readonly exclusions: readonly { readonly reasonCode: FileAnalysisExclusion; readonly count: number }[]
  readonly reasonCodes: readonly FileAnalysisExclusion[]
}

export type FileTimeSummary = {
  readonly durationMeaning: DurationMeaning
  readonly referenceOnly: boolean
  readonly reportedDurationSampleCount: number
  readonly durationSeconds: FileMetricSummary
  readonly paceSecondsPerKm: FileMetricSummary
  readonly pairedDistanceMeters: number | null
  readonly pairedDurationSeconds: number | null
  /** Lap partial sums are references, never substitutes for missing activity totals. */
  readonly lapDurationSeconds: FileMetricSummary
  readonly missingDurationLapCount: number
}

export type FileAnalysisReport = {
  readonly formulaVersion: typeof FILE_ANALYSIS_FORMULA_VERSION
  readonly policyVersion: typeof FILE_ANALYSIS_POLICY_VERSION
  readonly sourceContext: FileAnalysisSourceContext
  readonly window: { readonly startDate: string; readonly endDate: string; readonly precision: "LOCAL_DATE" }
  readonly coverage: "NO_DATA" | "ALL_EXCLUDED" | "PARTIAL" | "DATA"
  readonly inputCount: number
  readonly includedSourceCount: number
  readonly excludedSourceCount: number
  readonly duplicateSourceCount: number
  readonly conflictingSourceCount: number
  readonly exclusions: readonly { readonly reasonCode: FileAnalysisExclusion; readonly count: number }[]
  readonly observations: readonly ProjectedFileObservation[]
  readonly sports: readonly {
    readonly sport: Sport
    readonly sampleCount: number
    readonly distanceMeters: FileMetricSummary
    readonly timeSummaries: readonly FileTimeSummary[]
  }[]
}

const meanings: readonly DurationMeaning[] = ["TIMER", "MOVING", "ELAPSED", "SOURCE_DEFINED", "UNKNOWN"]
const sports: readonly Sport[] = ["RUNNING", "WALKING", "CYCLING", "OTHER", "UNKNOWN"]
const isReferenceOnly = (meaning: DurationMeaning) => meaning === "SOURCE_DEFINED" || meaning === "UNKNOWN"
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

function counts(reasons: readonly FileAnalysisExclusion[]) {
  const grouped = new Map<FileAnalysisExclusion, number>()
  for (const reason of reasons) grouped.set(reason, (grouped.get(reason) ?? 0) + 1)
  return [...grouped].sort(([a], [b]) => compare(a, b)).map(([reasonCode, count]) => ({ reasonCode, count }))
}

function sum(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const total = values.reduce((total, value) => total + value, 0)
  return Number.isFinite(total) ? total : null
}

function metric(values: readonly number[], reasons: readonly FileAnalysisExclusion[]): FileMetricSummary {
  const value = sum(values)
  return {
    value,
    sampleCount: values.length,
    excludedCount: reasons.length,
    exclusions: counts(reasons),
    reasonCodes: value === null && values.length > 0 ? ["NON_FINITE_RESULT"] : [],
  }
}

function timeSummary(observations: readonly ProjectedFileObservation[], meaning: DurationMeaning): FileTimeSummary {
  const durations: number[] = []
  const durationExclusions: FileAnalysisExclusion[] = []
  const pairedDistances: number[] = []
  const pairedDurations: number[] = []
  const paceExclusions: FileAnalysisExclusion[] = []
  const lapDurations: number[] = []
  const lapExclusions: FileAnalysisExclusion[] = []
  let missingDurationLapCount = 0
  for (const observation of observations) {
    if (observation.durationMeaning !== meaning) {
      durationExclusions.push("DIFFERENT_TIME_MEANING")
      paceExclusions.push("DIFFERENT_TIME_MEANING")
    } else {
      const { durationSeconds: seconds, distanceMeters: meters } = observation
      if (seconds === null) durationExclusions.push("MISSING_DURATION")
      else if (isReferenceOnly(meaning)) durationExclusions.push("TIME_MEANING_UNCONFIRMED")
      else durations.push(seconds)
      const reason = isReferenceOnly(meaning) ? "TIME_MEANING_UNCONFIRMED"
        : seconds === null ? "MISSING_DURATION"
          : meters === null ? "MISSING_DISTANCE"
            : seconds === 0 ? "ZERO_DURATION" : meters === 0 ? "ZERO_DISTANCE" : null
      if (reason !== null) paceExclusions.push(reason)
      else if (meters !== null && seconds !== null) {
        pairedDistances.push(meters)
        pairedDurations.push(seconds)
      }
    }
    for (const lap of observation.laps) {
      // An activity-level interpretation does not rewrite a lap's source semantics.
      if (lap.durationMeaning !== meaning) continue
      if (lap.durationSeconds === null) {
        missingDurationLapCount += 1
        lapExclusions.push("MISSING_DURATION")
      } else if (isReferenceOnly(meaning)) lapExclusions.push("TIME_MEANING_UNCONFIRMED")
      else lapDurations.push(lap.durationSeconds)
    }
  }
  const meters = sum(pairedDistances)
  const seconds = sum(pairedDurations)
  const pace = meters !== null && meters > 0 && seconds !== null && seconds > 0 ? seconds / (meters / 1000) : null
  const paceValue = pace !== null && Number.isFinite(pace) ? pace : null
  return {
    durationMeaning: meaning,
    referenceOnly: isReferenceOnly(meaning),
    reportedDurationSampleCount: observations.filter(value => value.durationMeaning === meaning && value.durationSeconds !== null).length,
    durationSeconds: metric(durations, durationExclusions),
    paceSecondsPerKm: {
      value: paceValue,
      sampleCount: pairedDistances.length,
      excludedCount: paceExclusions.length,
      exclusions: counts(paceExclusions),
      reasonCodes: paceValue === null && pairedDistances.length > 0 ? ["NON_FINITE_RESULT"] : [],
    },
    pairedDistanceMeters: meters,
    pairedDurationSeconds: seconds,
    lapDurationSeconds: metric(lapDurations, lapExclusions),
    missingDurationLapCount,
  }
}

export function buildFileAnalysisReport(
  entries: readonly FileAnalysisEntry[],
  options: FileAnalysisOptions & { readonly startDate: string; readonly endDate: string },
): FileAnalysisReport {
  if (!isValidIsoDate(options.startDate) || !isValidIsoDate(options.endDate) || options.startDate > options.endDate) {
    throw new RangeError("INVALID_FILE_ANALYSIS_WINDOW")
  }
  const scoped = entries.filter(entry => entry.kind === "post-session" && entry.fileObservation !== undefined
    && isValidIsoDate(entry.date) && entry.date >= options.startDate && entry.date <= options.endDate)
  const groups = new Map<string, { readonly projection: FileObservationProjection; readonly identity: ProjectionIdentity }[]>()
  const journalKeys = new Map<string, Set<string>>()
  const reasons: FileAnalysisExclusion[] = []
  for (const entry of scoped) {
    const projection = projectFileObservation(entry, options)
    const identity = projectionIdentities.get(projection)
    if (identity === undefined) {
      if (projection.status === "EXCLUDED") reasons.push(projection.reasonCode)
      continue
    }
    const group = groups.get(identity.sourceKey) ?? []
    group.push({ projection, identity })
    groups.set(identity.sourceKey, group)
    const keys = journalKeys.get(identity.journalId) ?? new Set<string>()
    keys.add(identity.sourceKey)
    journalKeys.set(identity.journalId, keys)
  }
  const observations: ProjectedFileObservation[] = []
  let duplicateSourceCount = 0
  let conflictingSourceCount = 0
  for (const [, group] of [...groups].sort(([a], [b]) => compare(a, b))) {
    if (new Set(group.map(value => value.identity.signature)).size !== 1
      || group.some(value => (journalKeys.get(value.identity.journalId)?.size ?? 0) > 1)) {
      reasons.push("CONFLICTING_SOURCE_KEY")
      conflictingSourceCount += 1
      continue
    }
    // Stable representative for identical copies only; no newest-revision winner.
    const first = [...group].sort((a, b) => compare(a.identity.journalId, b.identity.journalId))[0]?.projection
    if (first?.status === "ACCEPTED") observations.push(first.observation)
    else if (first?.status === "EXCLUDED") reasons.push(first.reasonCode)
    duplicateSourceCount += group.length - 1
  }
  const sportSummaries = sports.flatMap(sport => {
    const values = observations.filter(value => value.sport === sport)
    if (values.length === 0) return []
    const distances = values.flatMap(value => value.distanceMeters === null ? [] : [value.distanceMeters])
    return [{
      sport, sampleCount: values.length,
      distanceMeters: metric(distances, values.filter(value => value.distanceMeters === null).map(() => "MISSING_DISTANCE")),
      timeSummaries: meanings.filter(meaning => values.some(value => value.durationMeaning === meaning
        || value.laps.some(lap => lap.durationMeaning === meaning))).map(meaning => timeSummary(values, meaning)),
    }]
  })
  const partialMetrics = sportSummaries.some(sport => sport.distanceMeters.excludedCount > 0 || sport.distanceMeters.reasonCodes.length > 0
    || sport.timeSummaries.some(time => time.referenceOnly || time.durationSeconds.reasonCodes.length > 0 || time.paceSecondsPerKm.reasonCodes.length > 0
      || time.durationSeconds.exclusions.some(value => value.reasonCode !== "DIFFERENT_TIME_MEANING")
      || time.paceSecondsPerKm.exclusions.some(value => value.reasonCode !== "DIFFERENT_TIME_MEANING")))
  return {
    formulaVersion: FILE_ANALYSIS_FORMULA_VERSION,
    policyVersion: FILE_ANALYSIS_POLICY_VERSION,
    sourceContext: options.sourceContext ?? "DEVICE_PREVIEW",
    window: { startDate: options.startDate, endDate: options.endDate, precision: "LOCAL_DATE" },
    coverage: scoped.length === 0 ? "NO_DATA" : observations.length === 0 ? "ALL_EXCLUDED"
      : reasons.length > 0 || duplicateSourceCount > 0 || partialMetrics ? "PARTIAL" : "DATA",
    inputCount: scoped.length,
    includedSourceCount: observations.length,
    excludedSourceCount: reasons.length,
    duplicateSourceCount,
    conflictingSourceCount,
    exclusions: counts(reasons),
    observations,
    sports: sportSummaries,
  }
}
