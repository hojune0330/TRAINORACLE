import type { PlanCycleResponse } from "../../domain/plan-cycle-response"
import type { PlanJournalComparison } from "../../domain/plan-journal-evidence"

export const COMPARISON_LABELS: Record<PlanJournalComparison, string> = {
  WITHIN_RANGE: "계획 범위 안",
  ABOVE_RANGE: "계획보다 높음",
  BELOW_RANGE: "계획보다 낮음",
  RPE_MISSING: "힘든 정도를 입력하지 않아 비교하지 않음",
  NO_PLANNED_RPE: "페이스로 정한 훈련이라 힘든 정도는 비교하지 않음",
  NOT_PERFORMED: "휴식·건너뜀은 훈련 수행으로 비교하지 않음",
  CHANGED_SESSION: "일부만 하거나 바꾼 훈련이라 원래 계획과 비교하지 않음",
  CONFLICTING_RESULT: "겹친 기록의 내용이 달라 비교하지 않음",
}

export function PlanCycleEvidence({ response }: { readonly response: PlanCycleResponse }) {
  return (
    <div className="plan-adaptation__evidence">
      <strong>{response.historyReadIncomplete && response.linkedResultCount === 0
        ? "이전 계획의 기록 연결을 확인하지 못했어요"
        : response.signal === "NO_LINKED_RESULTS"
        ? "현재 계획과 연결해 비교할 일지가 없어요"
        : response.headline}</strong>
      {response.evidence.map((item) => <p key={item}>{item}</p>)}
      {response.rows.length > 0 && (
        <details>
          <summary>훈련별 비교 근거 {response.rows.length}건</summary>
          <ul>
            {response.rows.map(row => (
              <li key={row.plannedSessionId}>
                <strong>{row.date} · {row.slot === "AM" ? "오전" : "오후"}</strong>
                {row.source === "ARCHIVED" && <small>변경 전 계획의 같은 훈련 기준</small>}
                <p>
                  {row.plannedRpe === null ? "계획의 힘든 정도 없음" : `계획의 힘든 정도 ${row.plannedRpe.minimum}–${row.plannedRpe.maximum}/10`}
                  {" · "}{row.actualRpe === null ? "힘든 정도 미기록" : `실제 힘든 정도 ${row.actualRpe}/10 · 직접 입력`}
                </p>
                <p>{COMPARISON_LABELS[row.comparison]}</p>
                {row.executionComparison && <details>
                  <summary>거리·구간·회복 기록</summary>
                  {row.executionComparison.facts.map((fact, index) => <p key={`fact-${index}`}>{fact}</p>)}
                  {row.executionComparison.interpretation && <p>{row.executionComparison.interpretation}</p>}
                  {row.executionComparison.unknowns.map((fact, index) => <p key={`unknown-${index}`}>{fact}</p>)}
                </details>}
              </li>
            ))}
          </ul>
        </details>
      )}
      <small>일지 원문·비밀 메모·통증 문장은 읽지 않으며, 이 결과만으로 훈련량을 늘리지 않아요.</small>
    </div>
  )
}
