import { useId } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, NotebookPen, Target, ListChecks } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { ORACLE_TOPICS, getOracleTopic, type OracleTopicId } from "../domain/oracle-exploration"
import { AccessibleTrendTable } from "./trends/AccessibleTrendTable"
import "./oracle-explore.css"

type OraclePersonalAction = "records" | "journal" | "trends" | "plan"

export type OracleExploreProps = {
  readonly topicId: OracleTopicId
  readonly onBack: () => void
  readonly onSelectTopic: (id: OracleTopicId) => void
  readonly onPersonalAction: (action: OraclePersonalAction) => void
}

export function OracleExplore({ topicId, onBack, onSelectTopic, onPersonalAction }: OracleExploreProps) {
  const topic = getOracleTopic(topicId)
  const selectId = useId()
  const headlineId = useId()
  const rows = topic.example.rows
  const maxValue = Math.max(...rows.map(row => row.value), 0)
  const chartLabel = `${topic.title} 예시. ${topic.example.source}. 단위 ${topic.example.unit}. ${rows.map(row => `${row.label} ${row.valueLabel}`).join(". ")}. 내 기록 분석이 아닙니다.`

  return <div className="oracle-explore">
    <header className="oracle-explore__header">
      <button type="button" className="oracle-explore__back" onClick={onBack} aria-label="이전 화면으로 돌아가기">
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <span>훈련 분석</span>
      <span className="oracle-explore__header-note">탐색</span>
    </header>

    <div className="oracle-explore__body">
      <div className="oracle-explore__picker">
        <label htmlFor={selectId}>분석 주제</label>
        <div className="oracle-explore__select-wrap">
          <select id={selectId} value={topicId} onChange={event => {
            const selectedTopic = ORACLE_TOPICS.find(item => item.id === event.target.value)
            if (selectedTopic) onSelectTopic(selectedTopic.id)
          }}>
            {ORACLE_TOPICS.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
      </div>

      <section key={topicId} className="oracle-explore__result" aria-labelledby={headlineId}>
        <div className="oracle-explore__example-label">
          <span>{rows.length > 0 ? "예시 기록" : "예시 상황"}</span>
          <p>내 기록을 분석한 결과가 아니에요</p>
        </div>
        <h1 id={headlineId} aria-live="polite" aria-atomic="true">{topic.example.headline}</h1>

        {rows.length > 0 ? <div className="oracle-explore__data">
          <div className="oracle-explore__chart" role="img" aria-label={chartLabel}>
            <div className="oracle-explore__chart-caption" aria-hidden="true">
              <span>{topic.example.source}</span><span>단위 · {topic.example.unit}</span>
            </div>
            <div className="oracle-explore__bars" aria-hidden="true">
              {rows.map(row => <div key={row.label} className="oracle-explore__bar-row">
                <span className="oracle-explore__bar-label">{row.label}</span>
                <div className="oracle-explore__bar-track">
                  <span className="oracle-explore__bar" style={{ width: `${maxValue > 0 ? row.value / maxValue * 100 : 0}%` }} />
                </div>
                <strong className="oracle-explore__bar-value">{row.valueLabel}</strong>
              </div>)}
            </div>
          </div>
          <AccessibleTrendTable
            caption={`${topic.title} · 예시 데이터 · 단위 ${topic.example.unit}`}
            rows={rows.map(row => ({ key: row.label, label: row.label, value: row.valueLabel }))}
          />
        </div> : <PriorityExample source={topic.example.source} />}

      </section>

      <div className="oracle-explore__actions">
        <button type="button" className="oracle-explore__personal" onClick={() => onPersonalAction(topic.personalAction)}>
          <span>{topic.personalLabel}</span><ArrowRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="oracle-explore__related" onClick={() => onSelectTopic(topic.nextId)}>
          <span><small>이어서 살펴보기</small><strong>{topic.nextLabel}</strong></span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <InfoDisclosure key={`explanation-${topicId}`} title="예시의 기준과 읽는 방법">
        <p>{topic.example.summary}</p>
        <p>{topic.example.detail}</p>
      </InfoDisclosure>
    </div>
  </div>
}

function PriorityExample({ source }: { readonly source: string }) {
  return <div className="oracle-explore__priority">
    <p className="oracle-explore__chart-caption">{source}</p>
    <ol>
      <li><NotebookPen size={18} aria-hidden="true" /><span><small>관찰</small><strong>전·후반의 페이스 차이</strong></span></li>
      <li><Target size={18} aria-hidden="true" /><span><small>연습 목표</small><strong>페이스 조절</strong></span></li>
      <li><ListChecks size={18} aria-hidden="true" /><span><small>다음 비교</small><strong>구간별 페이스·체감강도</strong></span></li>
    </ol>
  </div>
}
