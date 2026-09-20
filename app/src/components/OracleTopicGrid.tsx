import { useId } from "react"
import { ArrowRight, ChartNoAxesCombined, GitCompareArrows, ListOrdered, ScanLine, Target, Layers, type LucideIcon } from "lucide-react"
import { ORACLE_TOPICS, type OracleTopicId } from "../domain/oracle-exploration"
import "./oracle-topic-grid.css"

const topicIcons: Record<OracleTopicId, LucideIcon> = {
  level: ChartNoAxesCombined,
  focus: Target,
  compare: GitCompareArrows,
  mix: Layers,
  priority: ListOrdered,
  change: ScanLine,
}

export function OracleTopicGrid({ onSelectTopic, compact = false, title = "훈련 분석" }: {
  readonly onSelectTopic: (id: OracleTopicId) => void
  readonly compact?: boolean
  readonly title?: string
}) {
  const headingId = useId()

  return <section className={`oracle-topic-grid${compact ? " oracle-topic-grid--compact" : ""}`} aria-labelledby={headingId}>
    <div className="oracle-topic-grid__heading">
      <h2 id={headingId}>{title}</h2>
      <span>예시로 살펴보기</span>
    </div>
    <div className="oracle-topic-grid__tiles">
      {ORACLE_TOPICS.map(topic => {
        const Icon = topicIcons[topic.id]
        return <button
          key={topic.id}
          type="button"
          className="oracle-topic-grid__tile"
          onClick={() => onSelectTopic(topic.id)}
          aria-label={`${topic.title} · ${topic.question} · 예시 보기`}
        >
          <span className="oracle-topic-grid__tile-top" aria-hidden="true">
            <Icon size={20} />
            <ArrowRight size={16} />
          </span>
          <strong>{topic.title}</strong>
          {!compact && <span className="oracle-topic-grid__teaser">{topic.teaser}</span>}
        </button>
      })}
    </div>
  </section>
}
