import React from "react"
import { CircleHelp } from "lucide-react"
import type { ExperienceBand } from "@impl/plan-generator/types"
import { ENERGY_INTENT_LABELS, EXPERIENCE_LABELS } from "./labels"
import { planSupportCoverage } from "./plan-support-coverage"

export function PlanSupportCoverage({ experienceBand, evaluatedAt }: {
  readonly experienceBand: ExperienceBand | undefined
  readonly evaluatedAt?: string
}) {
  const [openedAt, setOpenedAt] = React.useState<string | null>(null)
  const rows = React.useMemo(() => experienceBand === undefined || openedAt === null
    ? [] : planSupportCoverage(experienceBand, evaluatedAt ?? openedAt), [experienceBand, evaluatedAt, openedAt])
  if (experienceBand === undefined) return null
  return (
    <details className="plan-support-coverage" onToggle={event => {
      if (event.currentTarget.open) setOpenedAt(previous => previous ?? new Date().toISOString())
    }}>
      <summary><CircleHelp size={16} aria-hidden="true" />종목별 상세 훈련 지원</summary>
      {openedAt !== null && <>
      <p>선택한 경험: {EXPERIENCE_LABELS[experienceBand].title}</p>
      <table>
        <caption>현재 경험의 훈련 구성과 개인 페이스 지원</caption>
        <thead><tr><th scope="col">종목</th><th scope="col">구성과 계산 범위</th></tr></thead>
        <tbody>{rows.map(({ event, methods, catalogConfigurations, catalogPaceConfigurations }) => (
          <tr key={event.distanceM}>
            <th scope="row">{event.title}</th>
            <td><p>훈련 구성 {catalogConfigurations.length}개 · 목적·시간·환경 확인 후 적용</p>
              {catalogPaceConfigurations.length > 0 && <p>기록 기반 페이스 계산 구성 {catalogPaceConfigurations.length}개 · 기준 종목: {Array.from(new Set(catalogPaceConfigurations.flatMap(configuration => configuration.referenceEventDistances)))
                .map(distance => distance === 21097.5 ? "하프마라톤" : distance === 42195 ? "마라톤" : `${distance / 1000}km`).join(" · ")}</p>}
              {methods.length === 0 && catalogPaceConfigurations.length === 0 && <p>자동 기록 페이스 계산 구성 없음</p>}
              {methods.map(method => (
              <div key={`${method.ref.templateId}@${method.ref.version}:${method.trainingFocus}`}>
                <strong>{ENERGY_INTENT_LABELS[method.trainingFocus].title}</strong>
                <span>{method.mainSummary}</span>
                <span>{method.recoverySummary}</span>
              </div>
            ))}</td>
          </tr>
        ))}</tbody>
      </table>
      <p>구성 수는 종목·경험에 해당하는 목록이며, 지금 모두 적용할 수 있다는 뜻은 아니에요. 목적·시간·환경·안전과 기준 기록 조건은 훈련마다 따로 확인해요.</p>
      <p>일부 LT·유산소 반복은 5km 기록을, 10km·하프·마라톤 경기 페이스 구성은 같은 종목의 실제 기록 또는 직접 선택한 목표 기록을 기준으로 계산해요. 목표는 현재 능력이 아니에요. 기존 상세 훈련은 해당 종목의 현재 기록 조건을 따라요. 스프린트·언덕은 경기 페이스로 환산하지 않아요.</p>
      <p>기록 저장만으로 계획이 바뀌지는 않아요. 변경 내용을 확인하고 적용하면 조건에 맞는 남은 훈련들의 페이스를 갱신해요. 지난 훈련과 일지가 연결된 훈련은 유지해요.</p>
      <p>A/B는 다른 훈련법 두 개가 아니라, 주요 훈련을 유지한 채 기초·회복 운동의 구성을 고르는 선택이에요. 개별 훈련은 같은 목적의 다른 구성으로 바꿀 수 있어요.</p>
      </>}
    </details>
  )
}
