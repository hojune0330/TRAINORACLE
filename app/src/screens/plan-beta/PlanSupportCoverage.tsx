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
        <caption>현재 경험의 훈련 구성과 개인 페이스 지원</caption>
        <thead><tr><th scope="col">종목</th><th scope="col">구성과 계산 범위</th></tr></thead>
        <tbody>{rows.map(({ event, methods, catalogConfigurations }) => (
          <tr key={event.distanceM}>
            <th scope="row">{event.title}</th>
            <td><p>훈련 구성 {catalogConfigurations.length}개 · 목적·시간·환경 확인 후 적용</p>
              {methods.length === 0 ? "같은 종목 기록의 페이스 계산은 준비 중" : methods.map(method => (
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
      <p>훈련 구성에는 거리·시간·반복·회복이 들어 있어요. 일부 LT·유산소 반복은 5km 기록으로 참고 페이스를 계산하고, 스프린트·언덕은 경기 페이스로 환산하지 않아요. 미정 값은 직접 확인한 뒤 적용해요.</p>
      <p>A/B는 다른 훈련법 두 개가 아니라, 주요 훈련을 유지한 채 기초·회복 운동의 구성을 고르는 선택이에요. 개별 훈련은 같은 목적의 다른 구성으로 바꿀 수 있어요.</p>
    </details>
  )
}
