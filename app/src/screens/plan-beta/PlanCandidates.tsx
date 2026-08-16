import React from "react"
import { ArrowLeft, Check, ChevronDown, ShieldCheck } from "lucide-react"
import type {
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { isValidIsoDate } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { PlanAthleteEvidence } from "../../domain/plan-beta-flow"
import {
  candidateSessionSummary,
  candidateLabel,
  ENERGY_INTENT_LABELS,
  EVENT_LABELS,
} from "./labels"
import { candidatePurposeStatus } from "./candidate-purpose-status"
import { DIVISION_LABELS } from "./plan-intake-meta"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import type { CandidateSelection } from "./plan-selection"

export function PlanCandidates({
  generated,
  intake,
  athleteEvidence,
  onBack,
  onSelect,
}: {
  readonly generated: PlanGenerationSuccess
  readonly intake: PlanBetaIntake
  readonly athleteEvidence: PlanAthleteEvidence
  readonly onBack: () => void
  readonly onSelect: (selection: CandidateSelection) => void
}) {
  const [startDate, setStartDate] = React.useState(todayISO)
  const [expandedCandidateId, setExpandedCandidateId] = React.useState<string | null>(
    generated.candidates[0]?.candidateId ?? null,
  )
  const canSelect = isValidIsoDate(startDate)

  return (
    <section className="plan-candidates" aria-labelledby="plan-candidates-title">
      <button className="plan-back" type="button" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        질문 다시 보기
      </button>
      <div className="plan-eyebrow">선택 가능한 계획 2가지</div>
      <div className="plan-heading-row">
        <h1 id="plan-candidates-title">두 계획에서 하나를 골라보세요</h1>
        <TermHelp term="plan-option" />
      </div>
      <p className="plan-copy">
        {generated.sourceMode === "PROFILE_ONLY"
          ? "종목, 경험, 고른 훈련 목적, 가능한 훈련일과 9.5일 기본 틀만 사용했어요. 개인 페이스와 최근 훈련량은 추정하지 않습니다."
          : "최근 일지가 있는지만 확인했어요. 일지의 거리, RPE, 메모는 이번 베타 계획의 시간이나 강도를 바꾸지 않습니다."}
      </p>
      <section className="plan-candidate-comparison" aria-label="두 계획 핵심 비교">
        <h2>먼저 핵심만 비교</h2>
        <div>
          {generated.candidates.map((candidate) => {
            const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
            const purposeStatus = candidatePurposeStatus(candidate.kind)
            return (
              <article key={candidate.candidateId}>
                <span>후보 {candidate.kind === "BALANCED" ? "A" : "B"}</span>
                <strong>{label.title}</strong>
                <p>{purposeStatus.label}</p>
                <small>{candidateSessionSummary(candidate)}</small>
              </article>
            )
          })}
        </div>
      </section>
      <div className="plan-source-strip">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>
          <strong>
            {athleteEvidence.storedRecordCount + athleteEvidence.recentJournalSessionCount === 0
              ? "기록 없이 시작한 베타 계획"
              : "경기 기록 "
                + athleteEvidence.storedRecordCount
                + "개 · 최근 일지 "
                + athleteEvidence.recentJournalSessionCount
                + "개 연결"}
            <TermHelp term="plan-beta-basis" />
          </strong>
          <small>
            기록값과 구조화 일지는 존재 여부만 확인 · 개인 페이스·훈련 시간·RPE 계산에는 아직 미사용
          </small>
          {athleteEvidence.goalRecordCount > 0 && (
            <small>목표 기록 {athleteEvidence.goalRecordCount}개 포함 · 현재는 수치 계산에 미사용</small>
          )}
          {intake.competitionDivision !== "NOT_PROVIDED" && (
            <small>
              참가 부문: {DIVISION_LABELS[intake.competitionDivision].title} · 표시용 정보이며 훈련 강도와 안전 판정에는 미사용
            </small>
          )}
          {generated.candidates[0].continuityContext.kind ===
            "PREVIOUS_FRAME_CONTEXT_RETAINED" && (
            <small>
              지난 계획의 선택·진행 집계를 이어받음 · 자동 강도 상승 없음
            </small>
          )}
        </span>
      </div>
      <label className="plan-start-date" htmlFor="plan-start-date">
        <span>계획 시작 날짜</span>
        <input
          id="plan-start-date"
          type="date"
          value={startDate}
          aria-label="계획 시작 날짜"
          aria-describedby="plan-start-date-help"
          onChange={(event) => setStartDate(event.target.value)}
        />
        <small id="plan-start-date-help">
          고른 날짜부터 실제 달력에 맞춰 보여드려요.
        </small>
      </label>
      {!canSelect && (
        <>
          <p className="plan-start-date-error" role="alert">
            실제 날짜를 고른 뒤 계획을 선택해 주세요.
          </p>
          <p className="plan-schedule-unavailable" role="status">
            시작 날짜를 고르면 실제 날짜에 맞춘 계획을 보여드려요.
          </p>
        </>
      )}
      <div className="plan-candidate-list">
        {generated.candidates.map((candidate) => (
          <CandidateSection
            key={candidate.candidateId}
            candidate={candidate}
            startDate={startDate}
            canSelect={canSelect}
            expanded={expandedCandidateId === candidate.candidateId}
            onToggleSchedule={() => setExpandedCandidateId((current) =>
              current === candidate.candidateId ? null : candidate.candidateId)}
            onSelect={() => onSelect({ candidate, startDate })}
          />
        ))}
      </div>
    </section>
  )
}

function CandidateSection({
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
          {EVENT_LABELS[candidate.eventGroup].title} · {frameLengthDays}일
          {" · "}훈련일마다 총 시간·RPE·훈련 목적 표시
        </small>
        <div className="plan-session-legend" aria-label="훈련 수치와 의도 설명">
          <span>RPE<TermHelp term="rpe" /></span>
          <span>
            {ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].title}
            <TermHelp term={ENERGY_INTENT_LABELS[candidate.selectedEnergyIntent].term} />
          </span>
          <span>RPE 기준 실행 안내<TermHelp term="quality-session" /></span>
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
