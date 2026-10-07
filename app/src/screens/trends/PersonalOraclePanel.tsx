import { BookOpenCheck, ChevronDown, Route } from "lucide-react"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { derivePersonalOracle } from "../../domain/personal-oracle"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { isoShift } from "../../domain/dates"
import { eligibleMetricValue } from "../../domain/trend-analysis"
import { AppHeading } from "../../components/AppHeading"

const MATURITY_LABEL = {
  EMPTY: "분석할 기록 확인 필요",
  STARTING: "기록을 모으는 중",
  DESCRIPTIVE: "최근 기록 요약",
} as const

export function PersonalOraclePanel({
  observations,
  today,
  planState,
  savedSessions = [],
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
  readonly savedSessions?: readonly { readonly id: string; readonly date: string }[]
}) {
  const oracle = derivePersonalOracle({ observations, today, planState })
  const since = isoShift(today, -55)
  const savedCount = new Set(savedSessions.filter(entry => entry.date >= since && entry.date <= today).map(entry => entry.id)).size
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
  const missing = oracle.insights.filter(insight => !insight.available)
  const primary = available.find(insight => insight.id !== "PLAN_FOLLOW_THROUGH")
  const secondary = available.filter(insight => insight !== primary)
  const receipt = savedCount > 0 ? `최근 8주 훈련 일지 ${savedCount}건을 남겼어요.` : null
  const renderInsight = (insight: typeof oracle.insights[number]) => <article key={insight.id} className="personal-oracle__insight">
    <div>
      <span>{insight.title}</span>
      <h3>{insight.headline}</h3>
      <InfoDisclosure title={`${insight.title} · 근거 보기`}>
        <p>{insight.detail}</p><p>{insight.evidence}</p>
      </InfoDisclosure>
    </div>
  </article>
  return (
    <section className="personal-oracle" aria-labelledby="personal-oracle-title">
      <header className="personal-oracle__header">
        <AppHeading as="h2" accent id="personal-oracle-title">내 훈련 요약</AppHeading>
        <span className="personal-oracle__status">{savedCount > 0 && oracle.maturity === "EMPTY" ? "기록을 모으는 중" : MATURITY_LABEL[oracle.maturity]}</span>
      </header>

      {receipt && <p className="personal-oracle__summary">{receipt}</p>}

      <div className="personal-oracle__insights">
        {primary ? renderInsight(primary) : recent ? <article className="personal-oracle__insight">
          <div><span>{recent.loggedOn} 운동 기록</span><h3>힘든 정도 {recent.rpe}/10</h3>
            <p>직접 남긴 느낌이에요. 체력 점수는 아니에요.</p></div>
        </article> : <p>{savedCount > 0 ? "저장한 일지는 그대로 있어요. 거리나 힘든 정도를 남기면 여기서 함께 볼 수 있어요." : "확인할 훈련 기록을 기다리고 있어요."}</p>}
        {secondary.length > 0 && <InfoDisclosure title={secondary.map(item => item.title).join(" · ")}>
          {secondary.map(renderInsight)}
        </InfoDisclosure>}
        {missing.length > 0 && <InfoDisclosure title="더 알아보려면 어떤 기록이 필요한가요?">
          {missing.map(insight => <div key={insight.id}><strong>{insight.title}</strong><p>{insight.detail}</p><p>{insight.evidence}</p></div>)}
        </InfoDisclosure>}
      </div>

      <details className="personal-oracle__details">
        <summary>
          <BookOpenCheck aria-hidden="true" size={17} />
          근거와 해석 범위 보기
          <ChevronDown aria-hidden="true" size={17} />
        </summary>
        <div className="personal-oracle__details-grid">
          <p className="personal-oracle__source"><Route aria-hidden="true" size={15} /> 최근 8주 거리·훈련 구성 분석에 사용한 기록 {oracle.structuredSourceCount}건</p>
          <div>
            <strong>확인한 기준</strong>
            {oracle.knownFacts.map((fact) => <p key={fact}>{fact}</p>)}
          </div>
          <div>
            <strong>아직 알 수 없는 것</strong>
            {oracle.unknowns.map((unknown) => <p key={unknown}>{unknown}</p>)}
          </div>
        </div>
      </details>
    </section>
  )
}
