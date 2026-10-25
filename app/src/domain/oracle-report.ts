import { bucketDistanceByRecentMonths, cumulativeDistance, type CumulativeDistanceSummary } from "./cumulative-distance"
import { isValidIsoDate, pad2 } from "./dates"
import { buildEnergySystemLedger, energyLedgerWindow, type EnergySystemLedger } from "./energy-system-ledger"
import type { EnergySystemKey } from "./energy-system-taxonomy"
import type { FileAnalysisEntry } from "./import/file-analysis"
import { projectStructuredJournalObservations, type StructuredJournalObservation } from "./journal-observation"
import type { ActivityOutcome, JournalEntry } from "./journal-schema"
import { analysisExclusionSummary } from "./journal-store"
import { bucketByMonth, eligibleMetricValue, summarizeMetricCoverage, type TrendBucket, type TrendMetric } from "./trend-analysis"

export type OracleReportSource = "my" | "example"
export type OracleReportMonths = 3 | 6
export type OracleReportStatus = "ready" | "partial" | "missing"
export const ORACLE_REPORT_METRICS = ["DISTANCE_KM", "SECONDS_PER_KM", "RPE", "MOOD", "PAIN_MAX"] as const satisfies readonly TrendMetric[]
export const ORACLE_EXAMPLE_TODAY = "2026-09-30"
export type OracleReportPeriod = {
  readonly months: OracleReportMonths
  readonly startDate: string
  readonly endDate: string
  readonly currentMonthPartial: boolean
}
export type OracleReportEvidence = {
  readonly id: string
  readonly date: string
  readonly kind: "post-session" | "evening"
  readonly sourceRef: StructuredJournalObservation["sourceRef"]
  readonly metrics: Partial<Readonly<Record<TrendMetric, number>>>
  readonly distanceIncluded: boolean
  readonly energyIncluded: boolean
  readonly energySystem?: EnergySystemKey
  readonly activityOutcome?: ActivityOutcome
}
export type OracleReportMonth = {
  readonly label: string
  readonly startDate: string
  readonly endDate: string
  readonly partialMonth: boolean
  readonly distance: CumulativeDistanceSummary
  readonly metrics: Readonly<Record<TrendMetric, TrendBucket>>
}
export type OracleReport = {
  readonly source: OracleReportSource
  readonly period: OracleReportPeriod
  readonly status: OracleReportStatus
  readonly distance: CumulativeDistanceSummary
  readonly energy: EnergySystemLedger
  readonly monthly: readonly OracleReportMonth[]
  readonly metricCoverage: Readonly<Record<TrendMetric, { readonly included: number; readonly excluded: number }>>
  readonly evidence: readonly OracleReportEvidence[]
  readonly sourceRefs: readonly StructuredJournalObservation["sourceRef"][]
  readonly scopedEntryCount: number
  readonly exclusions: { readonly excludedImported: number; readonly excludedNoProvenance: number }
  readonly notices: readonly string[]
}
export type OracleReportInput = {
  readonly source: OracleReportSource
  readonly months: OracleReportMonths
  readonly today: string
  readonly entries: readonly JournalEntry[]
  /** Only revisions confirmed by the existing account import path. Empty by default. */
  readonly confirmedFileEntries?: readonly FileAnalysisEntry[]
}

export function oracleReportPeriod(months: OracleReportMonths, today: string): OracleReportPeriod {
  if ((months !== 3 && months !== 6) || !isValidIsoDate(today)) throw new RangeError("Oracle report requires 3 or 6 months and a real local date")
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const first = new Date(year, month - months, 1)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    months,
    startDate: `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-01`,
    endDate: today,
    currentMonthPartial: Number(today.slice(8, 10)) < lastDay,
  }
}

/** Pure read projection. It never loads or writes journal/account state, and never
 * reads private memo fields, their purpose, or their presence. */
export function buildOracleReport(input: OracleReportInput): OracleReport {
  const today = input.source === "example" ? ORACLE_EXAMPLE_TODAY : input.today
  const period = oracleReportPeriod(input.months, today)
  const scopedEntries = input.entries.filter(entry => isValidIsoDate(entry.date)
    && entry.date >= period.startDate && entry.date <= period.endDate)
  // Explicit rest/skip is evidence of a recorded day, not performed training.
  const performedEntries = scopedEntries.filter(entry => entry.kind !== "post-session"
    || (entry.activityOutcome !== "RESTED" && entry.activityOutcome !== "SKIPPED"))
  const observations = projectStructuredJournalObservations(performedEntries, { confirmedFileEntries: input.confirmedFileEntries ?? [] })
  const distance = cumulativeDistance(observations, { kind: "CALENDAR_REPORT_RANGE", startDate: period.startDate, endDate: period.endDate, precision: "LOCAL_DATE" })
  const energy = buildEnergySystemLedger(observations, energyLedgerWindow(input.months === 3 ? "CALENDAR_3_MONTHS" : "CALENDAR_6_MONTHS", today))
  const reference = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))
  const buckets = Object.fromEntries(ORACLE_REPORT_METRICS.map(metric => [metric, bucketByMonth(observations, reference, input.months, metric)])) as Record<TrendMetric, readonly TrendBucket[]>
  const monthly = bucketDistanceByRecentMonths(observations, today, input.months).map((month, index): OracleReportMonth => ({
    label: month.label,
    startDate: month.window.startDate,
    endDate: month.window.endDate,
    partialMonth: index === input.months - 1 && period.currentMonthPartial,
    distance: month,
    metrics: Object.fromEntries(ORACLE_REPORT_METRICS.map(metric => [metric, buckets[metric][index]!])) as Record<TrendMetric, TrendBucket>,
  }))
  const metricCoverage = Object.fromEntries(ORACLE_REPORT_METRICS.map(metric => [metric, summarizeMetricCoverage(observations, metric)])) as OracleReport["metricCoverage"]
  // Reducer references are authoritative, including distance de-duplication and
  // conflict rejection. Evidence must not independently re-admit rejected data.
  const refKey = (ref: StructuredJournalObservation["sourceRef"]): string => JSON.stringify(ref)
  const metricRefs = new Map<TrendMetric, Set<string>>(ORACLE_REPORT_METRICS.map(metric => [metric, new Set(buckets[metric].flatMap(bucket => bucket.sourceRefs).map(refKey))]))
  const distanceRefs = new Set(distance.sourceRefs.map(refKey))
  const energyRefs = new Set(energy.sourceRefs.map(refKey))
  const entryById = new Map(performedEntries.map(entry => [entry.id, entry]))
  const evidence = observations.flatMap((observation): OracleReportEvidence[] => {
    const metrics = Object.fromEntries(ORACLE_REPORT_METRICS.flatMap(metric => {
      const value = eligibleMetricValue(observation, metric)
      return value !== null && metricRefs.get(metric)!.has(refKey(observation.sourceRef)) ? [[metric, value]] : []
    })) as OracleReportEvidence["metrics"]
    const energyIncluded = energyRefs.has(refKey(observation.sourceRef))
    const energySystem = energyIncluded ? observation.energySystem ?? undefined : undefined
    if (Object.keys(metrics).length === 0 && energySystem === undefined) return []
    const entry = entryById.get(observation.sourceRef.sourceId)
    return [{
      id: observation.sourceRef.sourceId,
      date: observation.loggedOn,
      kind: observation.sourceRef.sourceKind === "SESSION_RESULT_RECORD" ? "post-session" : "evening",
      sourceRef: observation.sourceRef,
      metrics,
      distanceIncluded: distanceRefs.has(refKey(observation.sourceRef)),
      energyIncluded,
      ...(energySystem === undefined ? {} : { energySystem }),
      ...(entry?.kind === "post-session" && entry.activityOutcome !== undefined ? { activityOutcome: entry.activityOutcome } : {}),
    }]
  }).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id))
  const uniqueEvidence = [...new Map(evidence.map(item => [JSON.stringify(item), item])).values()]
  const sourceRefs = [...new Map(uniqueEvidence.map(item => [refKey(item.sourceRef), item.sourceRef])).values()]
  const incomplete = period.currentMonthPartial || distance.coverage !== "DATA" || energy.coverage !== "DATA"
    || monthly.some(month => month.distance.totalKm === null)
    || Object.values(metricCoverage).some(coverage => coverage.excluded > 0)
  const status = sourceRefs.length === 0 ? "missing" : incomplete ? "partial" : "ready"
  const exclusions = analysisExclusionSummary(scopedEntries, input.confirmedFileEntries ?? [], today)
  return {
    source: input.source, period, status, distance, energy, monthly, metricCoverage, evidence: uniqueEvidence, sourceRefs,
    scopedEntryCount: projectStructuredJournalObservations(scopedEntries, { confirmedFileEntries: input.confirmedFileEntries ?? [] }).length,
    exclusions: { excludedImported: exclusions.excludedImported, excludedNoProvenance: exclusions.excludedNoProvenance },
    notices: [
      ...(period.currentMonthPartial ? ["이번 달은 오늘까지의 부분 기간이에요."] : []),
      ...(sourceRefs.length === 0 ? ["선택한 기간에 분석 가능한 구조화 기록이 없어요."] : []),
      ...(monthly.some(month => month.distance.totalKm === null) ? ["거리 자료가 없는 달은 0km로 바꾸지 않았어요."] : []),
      ...(distance.excludedSourceCount > 0 || energy.excludedSourceCount > 0 ? ["출처를 확인할 수 없는 일부 값은 집계에서 제외했어요."] : []),
    ],
  }
}
