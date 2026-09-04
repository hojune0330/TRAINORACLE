import React from "react"
import { CircleHelp } from "lucide-react"
import type { ExperienceBand } from "@impl/plan-generator/types"
import { ENERGY_INTENT_LABELS, EXPERIENCE_LABELS } from "./labels"
import { planSupportCoverage } from "./plan-support-coverage"

export function PlanSupportCoverage({ experienceBand, evaluatedAt = new Date().toISOString() }: {
  readonly experienceBand: ExperienceBand | undefined
  readonly evaluatedAt?: string
}) {
  const rows = React.useMemo(() => experienceBand === undefined ? [] : planSupportCoverage(experienceBand, evaluatedAt), [experienceBand, evaluatedAt])
  if (experienceBand === undefined) return null
  return (
    <details className="plan-support-coverage">
      <summary><CircleHelp size={16} aria-hidden="true" />종목별 상세 훈련 지원</summary>
      <p>선택한 경험: {EXPERIENCE_LABELS[experienceBand].title}</p>
      <table>
        <caption>현재 경험에 맞는 기록 기반 상세 훈련</caption>
        <thead><tr><th scope="col">종목</th><th scope="col">목적과 구성</th></tr></thead>
        <tbody>{rows.map(({ event, methods }) => (
          <tr key={event.distanceM}>
            <th scope="row">{event.title}</th>
            <td>{methods.length === 0 ? "상세 훈련 준비 중" : methods.map(method => (
              <div key={`${method.ref.templateId}@${method.ref.version}:${method.trainingFocus}`}>
                <strong>{ENERGY_INTENT_LABELS[method.trainingFocus].title}</strong>
                <span>{method.mainSummary}</span>
                <span>{method.recoverySummary}</span>
              </div>
            ))}</td>
          </tr>
        ))}</tbody>
      </table>
      <p>표의 목적도 내가 고른 목적과 같아야 적용돼요. 같은 종목의 현재 기록을 직접 확인한 뒤 한 번의 주요 훈련에 페이스를 계산해요.</p>
      <p>상세 훈련이 준비 중이어도 시간·RPE 계획은 받을 수 있어요. 제공 범위의 차이이며 실력이나 나이에 대한 판정은 아니에요.</p>
      <p>A/B는 다른 훈련법 두 개가 아니라, 주요 훈련을 유지한 채 다른 날의 운동 시간 범위를 고르는 선택이에요. 계획 저장에는 현재 몸 상태와 선택 조건을 다시 확인해요.</p>
    </details>
  )
}
