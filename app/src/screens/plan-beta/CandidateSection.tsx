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

export function CandidateSection({
  candidate,
  startDate,
  canSelect,
  expanded,
  onToggleSchedule,
  onSelect,
}: {
  readonly candidate: PlanGenerationSuccess["candidates"][number]
  readonly startDate: string
  readonly canSelect: boolean
  readonly expanded: boolean
  readonly onToggleSchedule: () => void
  readonly onSelect: () => void
}) {
  const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
  const purposeStatus = candidatePurposeStatus(candidate.kind)
  const optionLetter = candidate.kind === "BALANCED" ? "A" : "B"
  const frameLengthDays = candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays
  const hasDetailedPrescription = candidate.sessions.some(
    (session) => session.prescription.kind === "PACE_TARGET",
  )
  const scheduleId = `candidate-schedule-${candidate.candidateId}`
  return (
    <article className="plan-candidate" aria-labelledby={`candidate-${candidate.candidateId}`}>
      <header>
        <span>후보 {optionLetter}</span>
        <h2 id={`candidate-${candidate.candidateId}`}>{label.title}</h2>
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
      {canSelect && (
        <>
          <button
            className="plan-candidate-schedule-toggle"
            type="button"
            aria-label={`후보 ${optionLetter} 일정 ${expanded ? "접기" : "펼치기"}`}
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
