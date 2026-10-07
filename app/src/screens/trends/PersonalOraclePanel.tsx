import { ArrowRight, ChevronDown } from "lucide-react"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { derivePersonalOracle } from "../../domain/personal-oracle"
import { isoShift } from "../../domain/dates"
import { eligibleMetricValue } from "../../domain/trend-analysis"
import { AppHeading } from "../../components/AppHeading"

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
  const available = oracle.insights.filter(insight => insight.available)
  const showRecent = recent && !available.some(insight => insight.id !== "PLAN_FOLLOW_THROUGH")
  const receipt = savedCount > 0 ? `최근 8주 훈련 일지 ${savedCount}건을 남겼어요.` : null
  // The parent owns the first-record/example entry. Do not fill an empty result
  // with unavailable metrics or explanations of a result that does not exist.
  if (available.length === 0 && !recent && !latestSaved) return null
  const renderInsight = (insight: typeof oracle.insights[number]) => <article key={insight.id} className="personal-oracle__insight">
    <div>
      <span>{INSIGHT_LABEL[insight.id]}</span>
      <h3>{insight.headline}</h3>
      {insight.id === "PLAN_FOLLOW_THROUGH" && <>
        <p>일정에 직접 체크한 횟수예요. 실제 운동 기록과는 달라요.</p>
        {onOpenPlan && <button type="button" className="personal-oracle__action" onClick={onOpenPlan}>훈련 일정 보기<ArrowRight size={16} aria-hidden="true" /></button>}
      </>}
    </div>
  </article>
  return (
    <section className="personal-oracle" aria-labelledby="personal-oracle-title">
      <header className="personal-oracle__header">
        <AppHeading as="h2" accent id="personal-oracle-title">내 훈련 요약</AppHeading>
      </header>

      {receipt && <p className="personal-oracle__summary">{receipt}</p>}

      <div className="personal-oracle__insights">
        {showRecent && <article className="personal-oracle__insight">
          <div><span>{recent.loggedOn} 운동 기록</span><h3>힘든 정도 {recent.rpe}/10</h3>
            <p>직접 남긴 느낌이에요. 체력 점수는 아니에요.</p></div>
        </article>}
        {!recent && available.length === 0 && latestSaved && <article className="personal-oracle__insight">
          <div><span>최근 훈련 일지</span><h3>{latestSaved.date}</h3><p>그날 남긴 운동을 다시 읽어보세요.</p></div>
        </article>}
        {available.map(renderInsight)}
      </div>

      {latestSaved && onOpenDay ? <button type="button" className="personal-oracle__action"
        onClick={() => onOpenDay(latestSaved.date)}>최근 일지 읽기<ArrowRight size={16} aria-hidden="true" /></button>
        : !latestSaved && onWriteLog ? <button type="button" className="personal-oracle__action" onClick={onWriteLog}>운동 기록 남기기<ArrowRight size={16} aria-hidden="true" /></button> : null}

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
