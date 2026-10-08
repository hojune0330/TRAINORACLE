import { ChevronDown, ChevronRight, TableProperties } from "lucide-react"
import type { OracleAxisId, OracleAxisScore } from "../domain/oracle-profile-v2"
import "./preference-radar.css"

const AXES = [
  { id: "STRUCTURE", label: "계획", chartLabel: "계획" },
  { id: "CHALLENGE", label: "기록 도전", chartLabel: "기록 도전" },
  { id: "INTENSITY", label: "강한 달리기", chartLabel: "강한 달리기" },
  { id: "SOCIAL", label: "함께 달리기", chartLabel: "함께" },
  { id: "EXPLORE", label: "새로운 경험", chartLabel: "새 경험" },
  { id: "REFRESH", label: "기분 전환", chartLabel: "기분 전환" },
] as const satisfies ReadonlyArray<{ id: OracleAxisId; label: string; chartLabel: string }>

type PreferenceRadarProps = {
  scores: readonly OracleAxisScore[]
  onSelectAxis: (axisId: OracleAxisId) => void
  disabled?: boolean
}

const CENTER = { x: 180, y: 144 }
const RADIUS = 86

function pointAt(index: number, radius: number) {
  const angle = -Math.PI / 2 + index * Math.PI / 3
  return {
    x: CENTER.x + Math.cos(angle) * radius,
    y: CENTER.y + Math.sin(angle) * radius,
  }
}

function pointText(point: { x: number; y: number }) {
  return `${point.x},${point.y}`
}

function visibleScore(score: OracleAxisScore | undefined): number | null {
  return score?.state === "COMPLETE" && typeof score.display === "number"
    && Number.isFinite(score.display) && score.display >= 0 && score.display <= 100
    ? score.display : null
}

export function PreferenceRadar({ scores, onSelectAxis, disabled = false }: PreferenceRadarProps) {
  const axes = AXES.map((axis, index) => {
    const score = scores.find(score => score.axisId === axis.id)
    const value = visibleScore(score)
    const action = value !== null ? "결과 보기" : score?.state === "PARTIAL" ? "응답 보기" : "답 더하기"
    return { ...axis, index, value, action, mixed: score?.mixed === true,
      point: value === null ? null : pointAt(index, RADIUS * value / 100) }
  })
  const completeCount = axes.filter(axis => axis.value !== null).length
  if (completeCount === 0) return null

  const summary = `러닝 취향, 내 응답 기준 0에서 100점. ${axes.map(axis => (
    `${axis.label}: ${axis.value === null ? `${axis.action}, 점수 없음` : `${axis.value}점`}${axis.mixed ? ", 답이 엇갈림" : ""}`
  )).join(". ")}.`

  return <div className="preference-radar">
    <figure className="preference-radar__figure">
      <svg className="preference-radar__chart" viewBox="0 0 360 288" role="img" aria-label={summary}>
        <g aria-hidden="true">
          {[50, 100].map(value => <polygon key={value} className="preference-radar__guide"
            points={AXES.map((_, index) => pointText(pointAt(index, RADIUS * value / 100))).join(" ")} />)}
          {[0, 50, 100].map(value => <text key={value} className="preference-radar__scale"
            x={CENTER.x + 8} y={CENTER.y - RADIUS * value / 100 + 4}>{value}</text>)}
          {completeCount === AXES.length && <polygon className="preference-radar__shape"
            points={axes.map(axis => pointText(axis.point!)).join(" ")} />}
          {axes.map(axis => <g key={axis.id}>
            <text className="preference-radar__axis-label" x={pointAt(axis.index, 106).x}
              y={pointAt(axis.index, 106).y} textAnchor={axis.index === 0 || axis.index === 3 ? "middle" : axis.index < 3 ? "start" : "end"}>{axis.chartLabel}</text>
            {axis.point !== null && <circle className="preference-radar__point" data-axis={axis.id}
              cx={axis.point.x} cy={axis.point.y} r="4" />}
          </g>)}
        </g>
      </svg>
      <figcaption className="preference-radar__caption">내 응답 기준 · 0–100점
        {completeCount < AXES.length && <span>답이 더 필요한 항목 {AXES.length - completeCount}개</span>}
      </figcaption>
    </figure>
    <ol className="preference-radar__axes" aria-label="취향별 결과와 질문">
      {axes.map(axis => <li key={axis.id}>
        <button type="button" className="preference-radar__axis" disabled={disabled}
          aria-label={`${axis.label}, ${axis.value === null ? axis.action : `${axis.value}점, 결과 보기`}${axis.mixed ? ", 답이 엇갈림" : ""}`}
          onClick={() => onSelectAxis(axis.id)}>
          <span className="preference-radar__axis-copy"><span>{axis.label}</span>
            <span className="preference-radar__value" data-scored={axis.value !== null}>{axis.value === null ? axis.action : `${axis.value}점`}
              {axis.mixed && <span className="preference-radar__mixed"> · 답이 엇갈림</span>}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ol>
    <details className="preference-radar__table">
      <summary><TableProperties size={16} aria-hidden="true" />점수 표로 보기<ChevronDown size={16} aria-hidden="true" /></summary>
      <table>
        <caption>러닝 취향 점수 · 내 응답 기준 0–100점</caption>
        <tbody>{axes.map(axis => <tr key={axis.id}>
          <th scope="row">{axis.label}</th>
          <td>{axis.value === null ? `— · ${axis.action}` : `${axis.value}점`}{axis.mixed && " · 답이 엇갈림"}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </div>
}
