import {
  PAIN_MAX_DERIVATION_RULE_ID,
  PACE_DERIVATION_RULE_ID,
} from "./journal-observation"
import type {
  ObservationProvenance,
  StructuredJournalObservation,
} from "./journal-observation"
import { pad2 } from "./dates"

export type TrendMetric =
  | "DISTANCE_KM"
  | "SECONDS_PER_KM"
  | "RPE"
  | "MOOD"
  | "PAIN_MAX"

export type TrendUnit =
  | "KILOMETERS"
  | "SECONDS_PER_KM"
  | "RPE"
  | "MOOD_5"
  | "PAIN_5"

export type TrendSourceRef = StructuredJournalObservation["sourceRef"]

export type TrendBucket =
  | {
      readonly kind: "DATA"
      readonly label: string
      readonly n: number
      readonly median: number
      readonly min: number
      readonly max: number
      readonly unit: TrendUnit
      readonly sourceRefs: readonly TrendSourceRef[]
      readonly confidence: number | null
      readonly uncertaintyState:
        | "NONE"
        | "LOW_CONFIDENCE"
        | "STALE_SOURCE"
        | "CONFLICTING_SOURCE"
        | "REQUIRES_HUMAN_REVIEW"
      readonly displayStatus: "OBSERVED" | "DERIVED" | "STALE" | "CONFLICTING"
      readonly nonSensitiveReasonCodes: readonly string[]
    }
  | {
      readonly kind: "MISSING"
      readonly label: string
      readonly sourceRefs: readonly []
      readonly confidence: null
      readonly uncertaintyState: "INSUFFICIENT_SOURCE"
      readonly displayStatus: "MISSING"
      readonly nonSensitiveReasonCodes: readonly ["NO_ELIGIBLE_SOURCE"]
    }

const METRIC_UNITS: Readonly<Record<TrendMetric, TrendUnit>> = {
  DISTANCE_KM: "KILOMETERS",
  SECONDS_PER_KM: "SECONDS_PER_KM",
  RPE: "RPE",
  MOOD: "MOOD_5",
  PAIN_MAX: "PAIN_5",
}

function metricApplies(
  observation: StructuredJournalObservation,
  metric: TrendMetric,
): boolean {
  const sessionMetric = metric === "DISTANCE_KM" || metric === "SECONDS_PER_KM" || metric === "RPE"
  return sessionMetric
    ? observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD"
    : observation.sourceRef.sourceKind === "DAILY_CHECKIN_RECORD"
}

function metricValue(
  observation: StructuredJournalObservation,
  metric: TrendMetric,
): number | null {
  switch (metric) {
    case "DISTANCE_KM": return observation.distanceKm
    case "SECONDS_PER_KM": return observation.secondsPerKm
    case "RPE": return observation.rpe
    case "MOOD": return observation.mood
    case "PAIN_MAX": return observation.painMax
  }
}

function metricProvenance(
  observation: StructuredJournalObservation,
  metric: TrendMetric,
): ObservationProvenance {
  switch (metric) {
    case "DISTANCE_KM": return observation.fieldProvenance.distanceKm
    case "SECONDS_PER_KM": return observation.fieldProvenance.secondsPerKm
    case "RPE": return observation.fieldProvenance.rpe
    case "MOOD": return observation.fieldProvenance.mood
    case "PAIN_MAX": return observation.fieldProvenance.painMax
  }
}

function hasCompletePaceDerivation(observation: StructuredJournalObservation): boolean {
  const distanceKm = observation.distanceKm
  const durationMin = observation.durationMin
  const secondsPerKm = observation.secondsPerKm
  return distanceKm !== null
    && durationMin !== null
    && secondsPerKm !== null
    && Number.isFinite(distanceKm)
    && Number.isFinite(durationMin)
    && Number.isFinite(secondsPerKm)
    && distanceKm > 0
    && durationMin > 0
    && secondsPerKm === Math.round((durationMin * 60) / distanceKm)
    && observation.fieldProvenance.distanceKm === "EXPLICIT"
    && observation.fieldProvenance.durationMin === "EXPLICIT"
    && observation.derivationRefs.some((ref) =>
      ref.field === "secondsPerKm"
      && ref.derivationRuleId === PACE_DERIVATION_RULE_ID
      && ref.derivedFrom[0] === "distanceKm"
      && ref.derivedFrom[1] === "durationMin")
}

function hasCompletePainDerivation(observation: StructuredJournalObservation): boolean {
  const levels = observation.painSourceLevels
  return observation.painMax !== null
    && levels.length > 0
    && levels.every((level) =>
      Number.isInteger(level) && level >= 0 && level <= 5)
    && observation.painMax === Math.max(...levels)
    && observation.derivationRefs.some((ref) =>
      ref.field === "painMax"
      && ref.derivationRuleId === PAIN_MAX_DERIVATION_RULE_ID
      && ref.derivedFrom[0] === "painParts")
}

function isEligible(
  observation: StructuredJournalObservation,
  metric: TrendMetric,
): boolean {
  if (!metricApplies(observation, metric) || metricValue(observation, metric) === null) return false
  if (observation.sourceRef.trustState === "MISSING"
    || observation.sourceRef.trustState === "SOURCE_NOT_VERIFIED") return false

  const provenance = metricProvenance(observation, metric)
  if (provenance === "EXPLICIT") return true
  if (provenance !== "DERIVED") return false
  if (metric === "SECONDS_PER_KM") return hasCompletePaceDerivation(observation)
  return metric === "PAIN_MAX" && hasCompletePainDerivation(observation)
}

export function eligibleMetricValue(
  observation: StructuredJournalObservation,
  metric: TrendMetric,
): number | null {
  return isEligible(observation, metric) ? metricValue(observation, metric) : null
}

function monthLabels(today: Date, monthsBack: number): readonly string[] {
  if (!Number.isInteger(monthsBack) || monthsBack <= 0) {
    throw new RangeError("monthsBack must be a positive integer")
  }
  return Array.from({ length: monthsBack }, (_, index) => {
    const month = new Date(
      today.getFullYear(),
      today.getMonth() - (monthsBack - index - 1),
      1,
    )
    return `${month.getFullYear()}-${pad2(month.getMonth() + 1)}`
  })
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const middleValue = sorted[middle]
  if (middleValue === undefined) throw new RangeError("median requires data")
  if (sorted.length % 2 === 1) return middleValue
  const previousValue = sorted[middle - 1]
  if (previousValue === undefined) throw new RangeError("median requires paired data")
  return (previousValue + middleValue) / 2
}

function statusOf(
  observations: readonly StructuredJournalObservation[],
  metric: TrendMetric,
): Pick<Extract<TrendBucket, { readonly kind: "DATA" }>, "uncertaintyState" | "displayStatus"> {
  if (observations.some((item) => item.sourceRef.trustState === "CONFLICTING")) {
    return { uncertaintyState: "CONFLICTING_SOURCE", displayStatus: "CONFLICTING" }
  }
  if (observations.some((item) => item.sourceRef.trustState === "STALE")) {
    return { uncertaintyState: "STALE_SOURCE", displayStatus: "STALE" }
  }
  if (observations.some((item) => metricProvenance(item, metric) === "DERIVED")) {
    return { uncertaintyState: "NONE", displayStatus: "DERIVED" }
  }
  return { uncertaintyState: "NONE", displayStatus: "OBSERVED" }
}

export function bucketByMonth(
  observations: readonly StructuredJournalObservation[],
  today: Date,
  monthsBack: number,
  metric: TrendMetric,
): readonly TrendBucket[] {
  return monthLabels(today, monthsBack).map((label) => {
    const eligible = observations.filter((observation) =>
      observation.loggedOn.slice(0, 7) === label && isEligible(observation, metric))
    if (eligible.length === 0) {
      return {
        kind: "MISSING",
        label,
        sourceRefs: [],
        confidence: null,
        uncertaintyState: "INSUFFICIENT_SOURCE",
        displayStatus: "MISSING",
        nonSensitiveReasonCodes: ["NO_ELIGIBLE_SOURCE"],
      }
    }

    const values = eligible.flatMap((observation) => {
      const value = metricValue(observation, metric)
      return value === null ? [] : [value]
    })
    return {
      kind: "DATA",
      label,
      n: values.length,
      median: median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      unit: METRIC_UNITS[metric],
      sourceRefs: eligible.map((observation) => observation.sourceRef),
      confidence: null,
      ...statusOf(eligible, metric),
      nonSensitiveReasonCodes: eligible.some((observation) =>
        metricProvenance(observation, metric) === "DERIVED")
        ? ["REGISTERED_DERIVATION"]
        : ["STRUCTURED_OBSERVATION"],
    }
  })
}

export function summarizeMetricCoverage(
  observations: readonly StructuredJournalObservation[],
  metric: TrendMetric,
): { readonly included: number; readonly excluded: number } {
  const applicable = observations.filter((observation) => metricApplies(observation, metric))
  const included = applicable.filter((observation) => isEligible(observation, metric)).length
  return { included, excluded: applicable.length - included }
}
