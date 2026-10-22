import type { ReactNode } from "react"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { InstantPlanRecommendation } from "../../domain/instant-plan-contract"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { sessionLabel, sessionSlotLabel } from "./labels"
import "./plan-candidate-overview.css"

export function PlanCandidateOverview({
  recommendation,
  candidate,
  startDate,
  inputSummary,
  supply,
  basis,
  controls,
  selection,
}: {
  readonly recommendation: InstantPlanRecommendation
  readonly candidate: PlanGenerationSuccess["candidates"][number]
  readonly startDate: string
  readonly inputSummary?: ReactNode
  readonly supply?: ReactNode
  readonly basis?: ReactNode
  readonly controls?: ReactNode
  readonly selection?: ReactNode
}) {
  const frameLength = Math.ceil(candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays)
  const visibleSessions = candidate.sessions.filter(session => session.day >= 1 && session.day <= frameLength)
  const trainingDays = new Set(visibleSessions
    .filter(session => session.role !== "REST")
    .map(session => session.day)).size
  const qualitySessions = visibleSessions
    .filter(session => session.role === "QUALITY")
    .sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot))

  return <section className="plan-candidate-overview" aria-label="선택한 계획 요약">
    <dl className="plan-candidate-overview__facts">
      <div><dt>기간</dt><dd>{recommendation.periodLabel}</dd></div>
      <div><dt>훈련하는 날</dt><dd>{trainingDays}일</dd></div>
      <div><dt>훈련 횟수</dt><dd>{recommendation.sessionCount}회</dd></div>
      <div><dt>총 훈련 시간</dt><dd>{recommendation.durationLabel}</dd></div>
    </dl>
    {inputSummary}
    {qualitySessions.length > 0 && <section className="plan-candidate-overview__quality" aria-labelledby="plan-candidate-overview-quality-title">
      <h3 id="plan-candidate-overview-quality-title">주요 훈련과 실제 처방</h3>
      <ol>
        {qualitySessions.map(session => {
          const steps = projectInstantExecutionSteps(session)
          const mainSteps = steps.filter(step => step.role === "MAIN" || step.role === "RECOVERY")
          const otherSteps = steps.filter(step => step.role !== "MAIN" && step.role !== "RECOVERY")
          const date = isValidIsoDate(startDate) ? isoShift(startDate, session.day - 1) : null
          return <li key={`${session.day}-${session.slot}`}>
            <h4>{date ? `${date} · ` : `Day ${session.day} · `}{sessionSlotLabel(session.slot)} · {sessionLabel(session)}</h4>
            {mainSteps.length > 0 ? <dl>
              {mainSteps.map((step, index) => <div key={`${step.role}-${index}`}><dt>{step.label}</dt><dd>{step.instruction}</dd></div>)}
            </dl> : <p>이 주요 훈련은 시간·힘든 정도 안내예요. 반복·회복 구성은 정해지지 않았어요.</p>}
            {otherSteps.length > 0 && <details className="plan-candidate-overview__support">
              <summary>준비·정리·전체 시간</summary>
              <dl>{otherSteps.map((step, index) => <div key={`${step.role}-${index}`}><dt>{step.label}</dt><dd>{step.instruction}</dd></div>)}</dl>
            </details>}
          </li>
        })}
      </ol>
    </section>}
    {supply}
    {basis}
    {controls}
    {selection}
  </section>
}
