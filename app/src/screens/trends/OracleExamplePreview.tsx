import { useId } from "react"
import { ArrowRight } from "lucide-react"
import { getOracleTopic } from "../../domain/oracle-exploration"
import { CategoryCard } from "../../components/CategoryCard"
import { AccessibleTrendTable } from "./AccessibleTrendTable"
import "./oracle-example-preview.css"

/** Authored examples only: this surface has no store, save or award dependency. */
export function OracleExamplePreview({ topicId = "mix", compact = false, onOpen }: {
  readonly topicId?: "mix" | "compare" | "focus"
  readonly compact?: boolean
  readonly onOpen: () => void
}) {
  const scopeId = useId()
  const topic = getOracleTopic(topicId)
  const example = topic.example
  const max = Math.max(...example.rows.map(row => row.value), 0)
  const scope = "예시 · 내 기록 분석이 아니에요"
  if (compact) return <section className="oracle-example-preview oracle-example-preview--compact" aria-label="오라클 예시">
    <CategoryCard category="oracle" variant="row" title="예시 결과 보기" aria-label="예시 결과 보기" description={<span id={scopeId}>{scope}</span>}
      aria-describedby={scopeId} onClick={onOpen} />
  </section>
  return <section className="oracle-example-preview" aria-label="오라클 예시">
    <p className="oracle-example-preview__scope" id={scopeId}>{scope}</p>
    <h2>{topicId === "mix" ? "어떤 훈련을 많이 했을까?" : topicId === "compare" ? "한 번에 달린 거리" : "계획과 실제 느낌"}</h2>
    <div className="oracle-example-preview__chart" role="img"
      aria-label={`${scope}. ${example.source}. ${example.rows.map(row => `${row.label} ${row.valueLabel}`).join(". ")}`}>
      {example.rows.map(row => <div className="oracle-example-preview__row" key={row.label} aria-hidden="true">
        <span>{row.label}</span><strong>{row.valueLabel}</strong>
        <div className="oracle-example-preview__track"><span style={{ width: `${max > 0 ? row.value / max * 100 : 0}%` }} /></div>
      </div>)}
    </div>
    <p className="oracle-example-preview__basis">{topicId === "mix" ? "가상 일지 6건 · 직접 표시한 훈련 종류" : topicId === "compare" ? "가상 기록 · 월별 중앙값" : example.source}</p>
    <AccessibleTrendTable caption={`${topic.title} · 예시 · ${example.unit}`}
      rows={example.rows.map(row => ({ key: row.label, label: row.label, value: row.valueLabel }))} />
    <button className="oracle-example-preview__open" type="button" aria-label="예시 결과 보기" aria-describedby={scopeId} onClick={onOpen}>
      예시 더 보기<ArrowRight size={18} aria-hidden="true" />
    </button>
  </section>
}
