import { ArrowRight } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { AccessibleTrendTable } from "./trends/AccessibleTrendTable"
import type { OraclePersonalResult } from "../domain/oracle-personal-result"
import "./oracle-personal-result.css"

export type OraclePersonalResultProps = {
  readonly result: OraclePersonalResult
  readonly onAction: () => void
  readonly onShowExample: () => void
}

export function OraclePersonalResult({ result, onAction, onShowExample }: OraclePersonalResultProps) {
  const headlineId = "oracle-personal-result-headline"
  const rows = result.rows
  const maxValue = Math.max(...rows.map(row => row.value), 0)
  const chartLabel = `${result.headline}. ${result.source}. 단위 ${result.unit}. ${rows.length > 0
    ? rows.map(row => `${row.label} ${row.valueLabel}`).join(". ")
    : "표시할 행이 없습니다."}`

  return <section className="oracle-personal-result" aria-labelledby={headlineId}>
    <div className="oracle-personal-result__label">내 기록 결과</div>
    <h1 id={headlineId}>{result.headline}</h1>
    <p className="oracle-personal-result__summary">{result.summary}</p>
    {result.notice && <p className="oracle-personal-result__missing" role="status">{result.notice}</p>}

    {result.status === "missing" && (
      <p className="oracle-personal-result__missing" role="status">
        필요한 입력: {result.requiredInput}
      </p>
    )}

    {result.status !== "missing" && <div className="oracle-personal-result__source">
      <span>출처</span><strong>{result.source}</strong><span>단위 · {result.unit}</span>
    </div>}

    {rows.length > 0 ? <div className="oracle-personal-result__data">
      <div className="oracle-personal-result__chart" role="img" aria-label={chartLabel}>
        <div className="oracle-personal-result__bars" aria-hidden="true">
          {rows.map(row => <div key={row.label} className="oracle-personal-result__bar-row">
            <span className="oracle-personal-result__bar-label">{row.label}</span>
            <div className="oracle-personal-result__bar-track">
              <span className="oracle-personal-result__bar" style={{ width: `${maxValue > 0 ? row.value / maxValue * 100 : 0}%` }} />
            </div>
            <strong className="oracle-personal-result__bar-value">{row.valueLabel}</strong>
          </div>)}
        </div>
      </div>
      <AccessibleTrendTable
        caption={`내 기록 · 단위 ${result.unit}`}
        rows={rows.map(row => ({ key: row.label, label: row.label, value: row.valueLabel }))}
      />
    </div> : null}

    <div className="oracle-personal-result__actions">
      <button type="button" className="oracle-personal-result__primary" onClick={onAction}>
        <span>{result.actionLabel}</span><ArrowRight size={18} aria-hidden="true" />
      </button>
      <button type="button" className="oracle-personal-result__secondary" onClick={onShowExample}>
        예시로 읽는 방법 보기<ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>

    <InfoDisclosure title="이 결과의 기준과 한계">
      <p>{result.detail}</p>
    </InfoDisclosure>
  </section>
}
