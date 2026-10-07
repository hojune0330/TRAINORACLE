import { useEffect, useId, useState } from "react"
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { EasyTrainingTimes } from "./EasyTrainingTimes"
import { PlanPrescriptionBasis } from "./PlanPrescriptionBasis"
import {
  candidateLabel,
  candidateDurationSummary,
  candidateSharedSessionSummary,
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
} from "./labels"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { eventDistanceLabel } from "./plan-intake-navigation"
import { isValidIsoDate } from "../../domain/dates"
import { samePlanSessionTarget, type PlanSessionTarget } from "../../domain/plan-session-target"

export function CandidateSection({
  candidate,
  startDate,
  canSelect,
  recommended = false,
  expanded,
  onToggleSchedule,
  onSelect,
  onAdjust,
  detailedTargets = [],
  detailedTarget = null,
  onChangeSessionTarget,
}: {
  readonly candidate: PlanGenerationSuccess["candidates"][number]
  readonly startDate: string
  readonly canSelect: boolean
  /** Caller must select this using an explicit display policy, not array position. */
  readonly recommended?: boolean
  readonly expanded: boolean
  readonly onToggleSchedule: () => void
  readonly onSelect: () => void
  readonly onAdjust?: () => void
  readonly detailedTargets?: readonly PlanSessionTarget[]
  readonly detailedTarget?: PlanSessionTarget | null
  readonly onChangeSessionTarget?: (target: PlanSessionTarget) => void
}) {
  const localId = useId()
  const [pendingTarget, setPendingTarget] = useState<PlanSessionTarget | null>(null)
  const currentTarget = detailedTarget ?? detailedTargets[0] ?? null
  useEffect(() => { setPendingTarget(null) }, [candidate, startDate, detailedTarget])
  const hasCatalog = candidate.sessions.some(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout)
  const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent, hasCatalog)
  const optionLetter = candidate.kind === "BALANCED" ? "A" : "B"
  const frameLengthDays = candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays
  const visibleSessions = candidate.sessions.filter(session => session.day >= 1 && session.day <= Math.ceil(frameLengthDays))
  const headingId = `candidate-heading-${localId}`
  const scheduleId = `candidate-schedule-${localId}`
  return (
    <article className="plan-candidate" aria-labelledby={headingId}>
      <header>
        <span>일정·운동 시간{recommended && <em className="plan-choice__badge">먼저 보기</em>}</span>
        <h2 id={headingId}>{label.title}</h2>
      </header>
      <EasyTrainingTimes sessions={visibleSessions} />
      <p className="plan-duration-total">{candidateDurationSummary(candidate)}</p>
      {isValidIsoDate(startDate) && (
        <>
          <button
            className="plan-candidate-schedule-toggle"
            type="button"
            aria-label={`계획안 ${optionLetter} 일정 ${expanded ? "접기" : "펼치기"}`}
            aria-expanded={expanded}
            aria-controls={scheduleId}
            onClick={onToggleSchedule}
          >
            일정 {expanded ? "접기" : "펼치기"}
            <ChevronDown aria-hidden="true" size={18} />
          </button>
          <div id={scheduleId} hidden={!expanded}>
            <PlanSchedulePreview
              detailsId={`${scheduleId}-cards`}
              detailsExpanded={expanded}
              showRpeGuide={false}
              startDate={startDate}
              frameLengthDays={frameLengthDays}
              sessions={candidate.sessions}
              explanationContext={{ plan: candidate, kind: "CANDIDATE" }}
              renderSessionFooter={onChangeSessionTarget === undefined ? undefined : (session) => {
                const target = detailedTargets.find(item => samePlanSessionTarget(item, session))
                if (target === undefined) return null
                if (samePlanSessionTarget(currentTarget, target)) return <p role="status">개인 페이스 적용 대상으로 고른 훈련</p>
                if (samePlanSessionTarget(pendingTarget, target)) return <div>
                  <p>이 계획안의 상세 훈련 위치만 이 날짜로 옮겨요. 다른 계획안은 그대로 두고, 적용 후 기준 기록을 다시 확인해야 해요.</p>
                  <button type="button" className="plan-text-action" onClick={() => { onChangeSessionTarget(target); setPendingTarget(null) }}>이 날짜에 적용</button>
                  <button type="button" className="plan-text-action" onClick={() => setPendingTarget(null)}>변경 취소</button>
                </div>
                return <button type="button" className="plan-text-action" onClick={() => setPendingTarget(target)}>이 훈련을 개인 페이스로 받기</button>
              }}
            />
          </div>
        </>
      )}
      <details className="plan-candidate-explanation">
        <summary>계획안 {optionLetter} 세부 정보<ChevronDown size={16} aria-hidden="true" /></summary>
        <p>{label.detail}</p>
        <strong className="plan-candidate-summary">{candidateSharedSessionSummary(candidate)}</strong>
        <p>{eventDistanceLabel(candidate.eventDistanceM)} · {EVENT_LABELS[candidate.eventGroup].title} · {frameLengthDays}일</p>
        <div className="plan-session-legend" aria-label="훈련 수치와 의도 설명">
          <span>힘든 정도<TermHelp term="rpe" /></span>
          <span>{ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].title}
            <TermHelp term={ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].term} /></span>
        </div>
      </details>
      {onAdjust !== undefined && <button type="button" className="plan-text-action"
        disabled={!canSelect || pendingTarget !== null} onClick={onAdjust}>
        <SlidersHorizontal size={18} aria-hidden="true" />훈련 구성 조정하기
      </button>}
      <PlanPrescriptionBasis sessions={visibleSessions} />
      <button
        className="plan-select-action"
        type="button"
        disabled={!canSelect || pendingTarget !== null}
        onClick={onSelect}
      >
        <Check aria-hidden="true" size={18} />
        {`${label.title}로 시작`}
      </button>
    </article>
  )
}
