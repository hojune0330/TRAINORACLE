import { ChevronDown } from "lucide-react"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { derivePersonalOracle } from "../../domain/personal-oracle"
import { isoShift } from "../../domain/dates"
import { eligibleMetricValue } from "../../domain/trend-analysis"
import { AppHeading } from "../../components/AppHeading"
import { CategoryCard } from "../../components/CategoryCard"
import { MetricSummary } from "../../components/MetricSummary"

const INSIGHT_LABEL = {
  DISTANCE_FLOW: "달린 거리",
  ENERGY_COVERAGE: "훈련 종류",
  PLAN_FOLLOW_THROUGH: "계획 진행",
} as const

export function PersonalOraclePanel({
  observations,
  today,
  planState,
  savedSessions = [],
  onOpenPlan,
  onOpenDay,
  onWriteLog,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
  readonly savedSessions?: readonly { readonly id: string; readonly date: string }[]
  readonly onOpenPlan?: (() => void) | undefined
  readonly onOpenDay?: ((date: string, entryId?: string) => void) | undefined
  readonly onWriteLog?: (() => void) | undefined
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
  const showRecent = recent && available.length === 0
  const receipt = savedCount > 0 ? `최근 8주 훈련 일지 ${savedCount}건을 남겼어요.` : null
  const metricItems = available.map(insight => {
    const period = insight.id === "DISTANCE_FLOW" ? "최근 4주" : "최근 8주"
    const prefix = `${period} `
    const headlineValue = insight.headline.startsWith(prefix) ? insight.headline.slice(prefix.length) : insight.headline
    const value = headlineValue.replace(/(?:을|를) 기록했어요$/u, "")
    return { id: insight.id, label: INSIGHT_LABEL[insight.id], value, period }
  })
  const showRecentAction = Boolean((latestSaved && onOpenDay) || (!latestSaved && onWriteLog))
  const showPlanAction = hasPlan && Boolean(onOpenPlan)
  // The parent owns the first-record/example entry. Do not fill an empty result
  // with unavailable metrics or explanations of a result that does not exist.
  if (available.length === 0 && !recent && !latestSaved) {
    return hasPlan && onOpenPlan ? <CategoryCard category="training" variant="row" title="훈련표 보기" onClick={onOpenPlan} /> : null
  }
  return (
    <section className="personal-oracle" aria-labelledby="personal-oracle-title">
      <header className="personal-oracle__header">
        <AppHeading as="h2" accent id="personal-oracle-title">내 훈련 요약</AppHeading>
      </header>

      {receipt && <p className="personal-oracle__summary">{receipt}</p>}

      <MetricSummary label="최근 분석 지표" items={metricItems} />

      {(showRecent || (available.length === 0 && !recent && latestSaved)) && <div className="personal-oracle__insights">
        {showRecent && <article className="personal-oracle__insight">
          <div><span>{recent.loggedOn} 운동 기록</span><h3>힘든 정도 {recent.rpe}/10</h3>
            <p>직접 남긴 느낌이에요. 체력 점수는 아니에요.</p></div>
        </article>}
        {!recent && available.length === 0 && latestSaved && <article className="personal-oracle__insight">
          <div><span>최근 훈련 일지</span><h3>{latestSaved.date}</h3><p>그날 남긴 운동을 다시 읽어보세요.</p></div>
        </article>}
      </div>
      }

      {(showRecentAction || showPlanAction) && <div className="personal-oracle__actions">
        {latestSaved && onOpenDay ? <CategoryCard category="journal" variant="row" title="최근 일지 읽기"
          onClick={() => onOpenDay(latestSaved.date)} />
          : !latestSaved && onWriteLog ? <CategoryCard category="journal" variant="row" title="운동 기록 남기기" onClick={onWriteLog} /> : null}
        {hasPlan && onOpenPlan && <CategoryCard category="training" variant="row" title="훈련표 보기" onClick={onOpenPlan} />}
      </div>}

      {(available.length > 0 || recent) && <details className="personal-oracle__details">
        <summary>
          집계 기준
          <ChevronDown aria-hidden="true" size={17} />
        </summary>
        <div className="personal-oracle__details-grid">
          {available.map(insight => <div key={insight.id}><strong>{INSIGHT_LABEL[insight.id]}</strong><p>{insight.detail}</p><p>{insight.evidence}</p></div>)}
          <p className="personal-oracle__source">최근 8주 거리·훈련 구성 분석에 사용한 기록 {oracle.structuredSourceCount}건</p>
          <div>
            <strong>확인한 기준</strong>
            {oracle.knownFacts.map((fact) => <p key={fact}>{fact}</p>)}
          </div>
          <div>
            <strong>아직 알 수 없는 것</strong>
            {oracle.unknowns.map((unknown) => <p key={unknown}>{unknown}</p>)}
          </div>
          <div><p>확인된 기록만 분석해요. 개인 메모는 읽지 않아요.</p><p>기록을 정리한 결과이며, 계획·안전 판단은 자동으로 바꾸지 않아요.</p></div>
        </div>
      </details>}
    </section>
  )
}
