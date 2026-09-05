import { useEffect, useId, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { candidatePurposeStatus } from "./candidate-purpose-status"
import {
  candidateLabel,
  candidateSessionSummary,
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
  expanded,
  onToggleSchedule,
  onSelect,
  detailedTargets = [],
  detailedTarget = null,
  onChangeSessionTarget,
}: {
  readonly candidate: PlanGenerationSuccess["candidates"][number]
  readonly startDate: string
  readonly canSelect: boolean
  readonly expanded: boolean
  readonly onToggleSchedule: () => void
  readonly onSelect: () => void
  readonly detailedTargets?: readonly PlanSessionTarget[]
  readonly detailedTarget?: PlanSessionTarget | null
  readonly onChangeSessionTarget?: (target: PlanSessionTarget) => void
}) {
  const localId = useId()
  const [pendingTarget, setPendingTarget] = useState<PlanSessionTarget | null>(null)
  const currentTarget = detailedTarget ?? detailedTargets[0] ?? null
  useEffect(() => { setPendingTarget(null) }, [candidate, startDate, detailedTarget])
  const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
  const purposeStatus = candidatePurposeStatus(candidate.kind)
  const optionLetter = candidate.kind === "BALANCED" ? "A" : "B"
  const frameLengthDays = candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays
  const hasDetailedPrescription = candidate.sessions.some(
    (session) => session.prescription.kind === "PACE_TARGET",
  )
  const headingId = `candidate-heading-${localId}`
  const scheduleId = `candidate-schedule-${localId}`
  return (
    <article className="plan-candidate" aria-labelledby={headingId}>
      <header>
        <span>계획안 {optionLetter}</span>
        <h2 id={headingId}>{label.title}</h2>
        <p>{label.detail}</p>
        <p className={`plan-candidate-purpose plan-candidate-purpose--${purposeStatus.tone}`}>
          <strong>{purposeStatus.label}</strong>
          <span>{purposeStatus.detail}</span>
        </p>
        <strong className="plan-candidate-summary">
          {candidateSessionSummary(candidate)}
        </strong>
        <small>
          {eventDistanceLabel(candidate.eventDistanceM)} · {EVENT_LABELS[candidate.eventGroup].title} · {frameLengthDays}일
          {" · "}훈련일마다 총 시간·RPE·훈련 목적 표시
        </small>
        <div className="plan-session-legend" aria-label="훈련 수치와 의도 설명">
          <span>RPE<TermHelp term="rpe" /></span>
          <span>
            {ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].title}
            <TermHelp term={ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].term} />
          </span>
          <span>
            {hasDetailedPrescription ? "개인 페이스 상세 훈련 포함" : "RPE 기준 실행 안내"}
            <TermHelp term="quality-session" />
          </span>
        </div>
      </header>
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
              startDate={startDate}
              frameLengthDays={frameLengthDays}
              sessions={candidate.sessions}
              explanationContext={{ plan: candidate, kind: "CANDIDATE" }}
              renderSessionFooter={onChangeSessionTarget === undefined ? undefined : (session) => {
                const target = detailedTargets.find(item => samePlanSessionTarget(item, session))
                if (target === undefined) return null
                if (samePlanSessionTarget(currentTarget, target)) return <p role="status">개인 페이스 적용 대상으로 고른 훈련</p>
                if (samePlanSessionTarget(pendingTarget, target)) return <div>
                  <p>두 계획안의 상세 훈련 위치를 이 날짜로 옮겨요. 훈련을 추가하지 않으며, 적용 후 기준 기록을 다시 확인해야 해요.</p>
                  <button type="button" className="plan-text-action" onClick={() => { onChangeSessionTarget(target); setPendingTarget(null) }}>이 날짜에 적용</button>
                  <button type="button" className="plan-text-action" onClick={() => setPendingTarget(null)}>변경 취소</button>
                </div>
                return <button type="button" className="plan-text-action" onClick={() => setPendingTarget(target)}>이 훈련을 개인 페이스로 받기</button>
              }}
            />
          </div>
        </>
      )}
      <button
        className="plan-select-action"
        type="button"
        disabled={!canSelect}
        onClick={onSelect}
      >
        <Check aria-hidden="true" size={18} />
        {label.title} 선택하기
      </button>
    </article>
  )
}
