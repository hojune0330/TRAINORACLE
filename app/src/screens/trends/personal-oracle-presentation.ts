import { isoShift } from "../../domain/dates"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { derivePersonalOracle } from "../../domain/personal-oracle"
import { eligibleMetricValue } from "../../domain/trend-analysis"

export const PERSONAL_ORACLE_INSIGHT_LABEL = {
  DISTANCE_FLOW: "달린 거리",
  ENERGY_COVERAGE: "훈련 종류",
  PLAN_FOLLOW_THROUGH: "계획 진행",
} as const

/** Share the facts actually displayed in the summary with its surrounding UI. */
export function personalOraclePresentation({ observations, today, planState, savedSessions = [] }: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
  readonly savedSessions?: readonly { readonly id: string; readonly date: string }[]
}) {
  const oracle = derivePersonalOracle({ observations, today, planState })
  const since = isoShift(today, -55)
  const savedCount = new Set(savedSessions.filter(entry => entry.date >= since && entry.date <= today).map(entry => entry.id)).size
  const latestSaved = savedSessions.filter(entry => entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const hasPlan = oracle.insights.some(insight => insight.id === "PLAN_FOLLOW_THROUGH" && insight.available)
  const bySource = new Map<string, StructuredJournalObservation | null>()
  for (const item of observations) {
    if (item.sourceRef.sourceKind !== "SESSION_RESULT_RECORD") continue
    const prior = bySource.get(item.sourceRef.sourceId)
    bySource.set(item.sourceRef.sourceId, prior === null || (prior && (prior.loggedOn !== item.loggedOn
      || eligibleMetricValue(prior, "RPE") !== eligibleMetricValue(item, "RPE"))) ? null : item)
  }
  const recent = [...bySource.values()].filter((item): item is StructuredJournalObservation => item !== null
    && item.loggedOn >= since && item.loggedOn <= today && eligibleMetricValue(item, "RPE") !== null)
    .sort((a, b) => b.loggedOn.localeCompare(a.loggedOn) || (b.sourceRef.observedAt ?? "").localeCompare(a.sourceRef.observedAt ?? ""))[0]
  const available = oracle.insights.filter(insight => insight.available && insight.id !== "PLAN_FOLLOW_THROUGH")
  const receipt = savedCount > 0 ? `최근 8주 훈련 일지 ${savedCount}건을 남겼어요.` : null
  const metricItems = available.map(insight => {
    const period = insight.id === "DISTANCE_FLOW" ? "최근 4주" : "최근 8주"
    const prefix = `${period} `
    const headlineValue = insight.headline.startsWith(prefix) ? insight.headline.slice(prefix.length) : insight.headline
    const value = headlineValue.replace(/(?:을|를) 기록했어요$/u, "")
    return { id: insight.id, label: PERSONAL_ORACLE_INSIGHT_LABEL[insight.id], value, period }
  })
  return { oracle, latestSaved, hasPlan, recent, available, receipt, metricItems,
    hasAnalysisFacts: available.length > 0 || recent !== undefined }
}

export type PersonalOraclePresentation = ReturnType<typeof personalOraclePresentation>
