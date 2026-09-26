import { useEffect, useId, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, NotebookPen, Target, ListChecks } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { ORACLE_TOPICS, getOracleTopic, type OracleTopicId } from "../domain/oracle-exploration"
import { AccessibleTrendTable } from "./trends/AccessibleTrendTable"
import { OraclePersonalResult } from "./OraclePersonalResult"
import type { OraclePersonalResult as PersonalResult } from "../domain/oracle-personal-result"
import type { AnalysisSection } from "../domain/analysis-navigation"
import { OracleBookmark } from "../components/OracleBookmark"
import "./oracle-explore.css"

type OraclePersonalAction = "records" | "journal" | "trends" | "plan" | "log"

export type OracleExploreProps = {
  readonly topicId: OracleTopicId
  readonly onBack: () => void
  readonly onSelectTopic: (id: OracleTopicId) => void
  readonly onPersonalAction: (action: OraclePersonalAction, section?: AnalysisSection, metric?: PersonalResult["metric"]) => void
  readonly personalResult?: PersonalResult | undefined
  readonly initialMode?: "example" | "personal" | undefined
  readonly onModeChange?: (mode: "example" | "personal") => void
  readonly onPersonalResultSeen?: ((fingerprint: string) => void) | undefined
  readonly bookmarkControl?: ReactNode
}

export function OracleExplore({ topicId, onBack, onSelectTopic, onPersonalAction, personalResult, initialMode, onModeChange, onPersonalResultSeen, bookmarkControl }: OracleExploreProps) {
  const topic = getOracleTopic(topicId)
  const selectId = useId()
  const headlineId = useId()
  const [selection, setSelection] = useState<{ topic: OracleTopicId; mode: "example" | "personal" } | null>(null)
  const mode = selection?.topic === topicId ? selection.mode
    : initialMode ?? (personalResult && personalResult.status !== "missing" ? "personal" : "example")
  const selectMode = (next: "example" | "personal") => {
    setSelection({ topic: topicId, mode: next })
    onModeChange?.(next)
  }
  useEffect(() => {
    if (mode === "personal" && personalResult?.fingerprint) onPersonalResultSeen?.(personalResult.fingerprint)
  }, [mode, topicId, personalResult?.fingerprint, onPersonalResultSeen])
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
      <div className={personalResult ? "oracle-explore__controls" : undefined}>
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

      {personalResult && <div className="oracle-explore__modes" role="group" aria-label="결과 종류">
        <button type="button" aria-pressed={mode === "personal"} onClick={() => selectMode("personal")}>내 기록</button>
        <button type="button" aria-pressed={mode === "example"} onClick={() => selectMode("example")}>예시</button>
      </div>}
      </div>

      {personalResult && mode === "personal" ? <OraclePersonalResult
        key={`personal-${topicId}`}
        result={personalResult}
        onAction={() => onPersonalAction(personalResult.action, personalResult.section, personalResult.metric)}
        onShowExample={() => selectMode("example")}
      /> : <>
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
        <button type="button" className="oracle-explore__personal" onClick={() => personalResult ? selectMode("personal") : onPersonalAction(topic.personalAction)}>
          <span>{personalResult ? "내 기록으로 확인하기" : topic.personalLabel}</span><ArrowRight size={18} aria-hidden="true" />
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
      </>}
      {personalResult && mode === "personal" && <button type="button" className="oracle-explore__related" onClick={() => onSelectTopic(topic.nextId)}>
        <span><small>이어서 살펴보기</small><strong>{topic.nextLabel}</strong></span><ArrowRight size={18} aria-hidden="true" />
      </button>}
      {bookmarkControl}
      {personalResult && <OracleBookmark key={topicId} topicId={topicId} fingerprint={mode === "personal" ? personalResult.fingerprint : undefined} />}
    </div>
  </div>
}

function PriorityExample({ source }: { readonly source: string }) {
  return <div className="oracle-explore__priority">
    <p className="oracle-explore__chart-caption">{source}</p>
    <ol>
      <li><NotebookPen size={18} aria-hidden="true" /><span><small>기록</small><strong>계획에 연결한 훈련 일지</strong></span></li>
      <li><Target size={18} aria-hidden="true" /><span><small>비교</small><strong>계획 강도와 실제 느낌</strong></span></li>
      <li><ListChecks size={18} aria-hidden="true" /><span><small>다음 행동</small><strong>현재 계획 검토</strong></span></li>
    </ol>
  </div>
}
