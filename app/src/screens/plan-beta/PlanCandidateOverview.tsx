import type { ReactNode } from "react"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import type { InstantPlanRecommendation } from "../../domain/instant-plan-contract"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { sessionPrimaryBasis } from "../../domain/prescription-basis"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { formatTrainingSeconds, sessionExecutionSteps, sessionLabel, sessionSlotLabel } from "./labels"
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
  compact = false,
}: {
  readonly recommendation: InstantPlanRecommendation
  readonly candidate: PlanGenerationSuccess["candidates"][number]
  readonly startDate: string
  readonly inputSummary?: ReactNode
  readonly supply?: ReactNode
  readonly basis?: ReactNode
  readonly controls?: ReactNode
  readonly selection?: ReactNode
  readonly compact?: boolean
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
    {!compact && <dl className="plan-candidate-overview__facts">
      <div><dt>기간</dt><dd>{recommendation.periodLabel}</dd></div>
      <div><dt>훈련하는 날</dt><dd>{trainingDays}일</dd></div>
      <div><dt>훈련 횟수</dt><dd>{recommendation.sessionCount}회</dd></div>
      <div><dt>총 훈련 시간</dt><dd>{recommendation.durationLabel}</dd></div>
    </dl>}
    {!compact && inputSummary}
    {compact && qualitySessions.length === 0 && <p>주요 훈련 없음 · 훈련 {recommendation.sessionCount}회</p>}
    {qualitySessions.length > 0 && <section className="plan-candidate-overview__quality" aria-labelledby="plan-candidate-overview-quality-title">
      <h3 id="plan-candidate-overview-quality-title">{compact ? "첫 주요 훈련" : "주요 훈련 구성"}</h3>
      <ol>
        {(compact ? qualitySessions.slice(0, 1) : qualitySessions).map(session => {
          const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
          const calculated = binding ? resolveCatalogBinding(binding) : null
          const calculationUnavailable = Boolean(binding && !calculated)
          const guidanceOnly = session.prescription.kind === "RPE_TIME_RANGE" && !binding
          // The reviewed reader preserves each source's work/recovery order and
          // pace provenance. An unreadable binding is not a generic RPE plan.
          const steps = calculationUnavailable ? [] : calculated
            ? sessionExecutionSteps(session, true).map(step => ({ role: step.role, label: step.title, instruction: step.detail }))
            : projectInstantExecutionSteps(session)
          const mainSteps = steps.filter(step => step.role === "MAIN" || step.role === "RECOVERY")
          const otherSteps = steps.filter(step => step.role !== "MAIN" && step.role !== "RECOVERY" && step.role !== "TOTAL_DURATION")
          const total = calculated?.totals.seconds
          const totalInstruction = total
            ? `전체 구간 합계 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : `~${formatTrainingSeconds(total.maximum)}`}`
            : steps.find(step => step.role === "TOTAL_DURATION")?.instruction
          const date = isValidIsoDate(startDate) ? isoShift(startDate, session.day - 1) : null
          return <li key={`${session.day}-${session.slot}`}>
            <h4>{date ? `${date} · ` : `Day ${session.day} · `}{sessionSlotLabel(session.slot)} · {sessionLabel(session)}</h4>
            {calculationUnavailable && <p className="plan-candidate-overview__notice" role="alert">이 훈련의 계산을 확인하지 못했어요. 훈련 조절에서 구성을 다시 확인해 주세요.</p>}
            {guidanceOnly && <p className="plan-candidate-overview__notice">상세 구성 미정 · 전체 시간을 본운동 시간으로 사용하지 마세요.</p>}
            {mainSteps.length > 0 ? <dl>
              {mainSteps.map((step, index) => <div key={`${step.role}-${index}`}><dt>{step.label}</dt><dd>{step.instruction}</dd></div>)}
            </dl> : null}
            {!calculationUnavailable && !guidanceOnly && sessionPrimaryBasis(session) && <p className="plan-candidate-overview__basis">기준: {sessionPrimaryBasis(session)}</p>}
            {totalInstruction && <dl className="plan-candidate-overview__duration"><div><dt>총 시간</dt><dd>{totalInstruction}</dd></div></dl>}
            {otherSteps.length > 0 && <details className="plan-candidate-overview__support">
              <summary>준비·정리 방법</summary>
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
