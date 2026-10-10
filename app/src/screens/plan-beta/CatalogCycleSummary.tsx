import type { CatalogCycleSuccessorSummary } from "../../domain/catalog-cycle-successor"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"

const workoutName = (id: string | null | undefined) => ALL_WORKOUT_CATALOG.find(entry => entry.id === id)?.name

export function CatalogCycleSummary({ summary, startDate }: {
  readonly summary: CatalogCycleSuccessorSummary
  readonly startDate: string
}) {
  return <section aria-label="이전 수행 반영" className="plan-cycle-summary">
    <p role="status">{summary.headline}</p>
    <InfoDisclosure title="이전 수행을 어떻게 반영했나요?">
      {summary.rows.map(row => <div key={`${row.target.day}-${row.target.slot}`}>
        <strong>{isValidIsoDate(startDate) ? isoShift(startDate, row.target.day - 1) : `${row.target.day}일째`}
          {" · "}{row.target.slot === "AM" ? "오전" : "오후"}
          {" · "}{row.status === "REDUCED" ? "짧은 구성으로 조정" : row.status === "REVIEW_REQUIRED" ? "확인 필요" : "구성 유지"}</strong>
        <p>{row.explanation}</p>
        {row.applied && row.sourceNotation && row.targetNotation && <dl>
          <dt>이전 훈련</dt><dd>{workoutName(row.source?.catalogId) && <>{workoutName(row.source?.catalogId)}<br /></>}{row.sourceNotation}</dd>
          <dt>다음 훈련</dt><dd>{workoutName(row.target.catalogId) && <>{workoutName(row.target.catalogId)}<br /></>}{row.targetNotation}</dd>
        </dl>}
        {row.sourceActualRpe !== null && <p>지난 훈련의 힘든 정도 {row.sourceActualRpe}/10 · 직접 입력</p>}
        {row.repeatedAboveCount > 0 && <p>같은 훈련 목적에서 계획보다 힘들었다고 남긴 기록 {row.repeatedAboveCount}회</p>}
      </div>)}
      <p>훈련량을 자동으로 늘리지 않아요. 새 일정을 시작하기 전까지 현재 계획은 그대로예요.</p>
    </InfoDisclosure>
  </section>
}
