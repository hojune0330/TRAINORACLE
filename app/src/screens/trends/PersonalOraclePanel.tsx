import { BookOpenCheck, ChevronDown, Route, Sparkles } from "lucide-react"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import type { PlanBetaState } from "../../domain/plan-beta-schema"
import { derivePersonalOracle } from "../../domain/personal-oracle"
import { InfoDisclosure } from "../../components/InfoDisclosure"

const MATURITY_LABEL = {
  EMPTY: "기록 없음",
  STARTING: "기록을 모으는 중",
  DESCRIPTIVE: "최근 기록 요약",
} as const

export function PersonalOraclePanel({
  observations,
  today,
  planState,
}: {
  readonly observations: readonly StructuredJournalObservation[]
  readonly today: string
  readonly planState: PlanBetaState | null
}) {
  const oracle = derivePersonalOracle({ observations, today, planState })
  return (
    <section className="personal-oracle" aria-labelledby="personal-oracle-title">
      <header className="personal-oracle__header">
        <div className="personal-oracle__mark" aria-hidden="true"><Sparkles size={18} /></div>
        <div>
          <span className="personal-oracle__eyebrow">내 기록 분석</span>
          <h2 id="personal-oracle-title">내 훈련 요약</h2>
        </div>
        <span className="personal-oracle__status">{MATURITY_LABEL[oracle.maturity]}</span>
      </header>

      <p className="personal-oracle__summary">{oracle.summary}</p>
      <p className="personal-oracle__source">
        <Route aria-hidden="true" size={15} /> 최근 8주 훈련 일지 {oracle.structuredSourceCount}건 기준
      </p>

      <div className="personal-oracle__insights">
        {oracle.insights.map((insight, index) => (
          <article key={insight.id} className="personal-oracle__insight">
            <span className="personal-oracle__number" aria-hidden="true">{index + 1}</span>
            <div>
              <span>{insight.title}</span>
              <h3>{insight.headline}</h3>
              <InfoDisclosure title={`${insight.title} · 근거 보기`}>
                <p>{insight.detail}</p>
                <p>{insight.evidence}</p>
              </InfoDisclosure>
            </div>
          </article>
        ))}
      </div>

      <details className="personal-oracle__details">
        <summary>
          <BookOpenCheck aria-hidden="true" size={17} />
          근거와 해석 범위 보기
          <ChevronDown aria-hidden="true" size={17} />
        </summary>
        <div className="personal-oracle__details-grid">
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
