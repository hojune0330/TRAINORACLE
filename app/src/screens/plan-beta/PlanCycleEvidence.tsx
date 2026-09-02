import type { PlanCycleResponse } from "../../domain/plan-cycle-response"
import type { PlanJournalComparison } from "../../domain/plan-journal-evidence"

export const COMPARISON_LABELS: Record<PlanJournalComparison, string> = {
  WITHIN_RANGE: "계획 범위 안",
  ABOVE_RANGE: "계획보다 높음",
  BELOW_RANGE: "계획보다 낮음",
  RPE_MISSING: "직접 입력한 정확한 RPE가 없어 비교하지 않음",
  NO_PLANNED_RPE: "페이스 기준 훈련이라 계획 RPE와 비교하지 않음",
  NOT_PERFORMED: "휴식·건너뜀은 훈련 수행으로 비교하지 않음",
  CHANGED_SESSION: "일부만 하거나 바꾼 훈련이라 원래 계획과 비교하지 않음",
  CONFLICTING_RESULT: "겹친 기록의 내용이 달라 비교하지 않음",
}

export function PlanCycleEvidence({ response }: { readonly response: PlanCycleResponse }) {
  return (
    <div className="plan-adaptation__evidence">
      <strong>{response.headline}</strong>
      {response.evidence.map((item) => <p key={item}>{item}</p>)}
      {response.rows.length > 0 && (
        <details>
          <summary>훈련별 비교 근거 {response.rows.length}건</summary>
          <ul>
            {response.rows.map(row => (
              <li key={row.plannedSessionId}>
                <strong>{row.date} · {row.slot === "AM" ? "오전" : "오후"}</strong>
                <p>
                  {row.plannedRpe === null ? "계획 RPE 없음" : `계획 RPE ${row.plannedRpe.minimum}-${row.plannedRpe.maximum}`}
                  {" · "}{row.actualRpe === null ? "비교용 RPE 없음" : `직접 기록 RPE ${row.actualRpe}`}
                </p>
                <p>{COMPARISON_LABELS[row.comparison]}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <small>일지 원문·비밀 메모·통증 문장은 읽지 않으며, 이 결과만으로 훈련량을 늘리지 않아요.</small>
    </div>
  )
}
