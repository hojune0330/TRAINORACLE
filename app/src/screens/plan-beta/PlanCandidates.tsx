import React from "react"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import type {
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { isValidIsoDate } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { PlanAthleteEvidence } from "../../domain/plan-beta-flow"
import type { AthleteRecord } from "../../domain/athlete-records"
import type { CandidatePrescriptionBinding } from "../../domain/plan-candidate-prescription"
import {
  candidateDurationSummary,
  candidateLabel,
  candidateSharedSessionSummary,
  ENERGY_INTENT_LABELS,
} from "./labels"
import { candidatePurposeStatus } from "./candidate-purpose-status"
import { DIVISION_LABELS } from "./plan-intake-meta"
import { CandidateSection } from "./CandidateSection"
import type { CandidateSelection } from "./plan-selection"
import { PaceEvidenceFlow } from "./PaceEvidenceFlow"
import { RacePlacementNotice } from "./RacePlacementNotice"
import { comparePlanMainWork } from "../../domain/plan-main-comparison"
import { MainWorkComparison } from "./MainWorkComparison"
import { PlanMethodPicker } from "./PlanMethodPicker"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { listDetailedSessionTargets, type PlanSessionTarget } from "../../domain/plan-session-target"
import { PlanSessionTargetPicker } from "./PlanSessionTargetPicker"
import type { RepeatPreference } from "@impl/prescription/method-recommendation"

export function PlanCandidates({
  generated,
  intake,
  athleteEvidence,
  athleteRecords,
  selectedRecordId,
  comparisonRecordId,
  prescriptionBinding,
  recordConfirmationPending,
  onSelectRecord,
  onCompareRecord,
  onConfirmRecord,
  onChangeMethod,
  detailedSessionTarget = null,
  onChangeSessionTarget,
  onSelectionDetailsChange,
  onManageRecords,
  startDateValue,
  onStartDateChange,
  recordReturnCount,
  onBack,
  onSelect,
}: {
  readonly generated: PlanGenerationSuccess
  readonly intake: PlanBetaIntake
  readonly athleteEvidence: PlanAthleteEvidence
  readonly athleteRecords: readonly AthleteRecord[]
  readonly selectedRecordId: string | null
  readonly comparisonRecordId: string | null
  readonly prescriptionBinding: Omit<CandidatePrescriptionBinding, "generated">
  readonly recordConfirmationPending: boolean
  readonly onSelectRecord: (recordId: string) => void
  readonly onCompareRecord: (recordId: string | null) => void
  readonly onConfirmRecord: () => void
  readonly onChangeMethod?: (reference: PlanBetaIntake["selectedDetailedTemplateRef"]) => void
  readonly detailedSessionTarget?: PlanSessionTarget | null
  readonly onChangeSessionTarget?: (target: PlanSessionTarget) => void
  readonly onSelectionDetailsChange?: () => void
  readonly onManageRecords?: () => void
  readonly startDateValue?: string
  readonly onStartDateChange?: (value: string) => void
  readonly recordReturnCount?: number
  readonly onBack: () => void
  readonly onSelect: (selection: CandidateSelection) => void
}) {
  const [repeatPreference, setRepeatPreference] = React.useState<RepeatPreference>("NEUTRAL")
  React.useEffect(() => {
    setRepeatPreference("NEUTRAL")
  }, [intake.eventGroup, intake.eventDistanceM, intake.trainingFocus, intake.experienceBand])
  const [localStartDate, setLocalStartDate] = React.useState(todayISO)
  const startDate = startDateValue ?? localStartDate
  const [expandedCandidateId, setExpandedCandidateId] = React.useState<string | null>(
    generated.candidates[0]?.candidateId ?? null,
  )
  React.useEffect(() => {
    setExpandedCandidateId(generated.candidates[0]?.candidateId ?? null)
  }, [generated])
  const hasValidStartDate = isValidIsoDate(startDate)
  const detailedEvidencePending = intake.selectedDetailedTemplateRef !== null
    && prescriptionBinding.kind !== "bound"
  const canSelect = hasValidStartDate && !recordConfirmationPending && !detailedEvidencePending
  const selectedRecord = athleteRecords.find((record) => record.id === selectedRecordId)
  const selectedEventLabel = selectedRecord === undefined
    ? "선택한 종목"
    : `${selectedRecord.eventDistanceM}m`

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
        {prescriptionBinding.kind === "bound"
          ? `직접 고르고 확인한 현재 ${selectedEventLabel} 기록으로 한 강도 세션의 상세 페이스를 계산했어요. 다른 훈련과 일지 값은 시간이나 RPE를 바꾸지 않습니다.`
          : generated.sourceMode === "PROFILE_ONLY"
          ? "종목, 경험, 고른 훈련 목적, 가능한 훈련일과 9.5일 기본 틀만 사용했어요. 개인 페이스와 최근 훈련량은 추정하지 않습니다."
          : "최근 일지가 있는지만 확인했어요. 일지의 거리, RPE, 메모는 이번 베타 계획의 시간이나 강도를 바꾸지 않습니다."}
      </p>
      <RacePlacementNotice state={generated.racePlacement} />
      {onChangeMethod !== undefined && <PlanMethodPicker
        options={resolveDetailedPlanTemplateOptions(intake, undefined, undefined, repeatPreference)}
        selected={intake.selectedDetailedTemplateRef}
        onChange={onChangeMethod}
        repeatPreference={repeatPreference}
        onRepeatPreferenceChange={setRepeatPreference}
      />}
      {intake.selectedDetailedTemplateRef !== null
        && (intake.eventGroup === "FIVE_K" || intake.eventGroup === "MIDDLE_DISTANCE")
        && intake.experienceBand === "EXPERIENCED"
        && (
        <>
        {onChangeSessionTarget !== undefined && <PlanSessionTargetPicker
          targets={listDetailedSessionTargets(generated)} selected={detailedSessionTarget}
          startDate={startDate} onChange={onChangeSessionTarget} />}
        <PaceEvidenceFlow
          records={athleteRecords}
          eventDistanceM={intake.eventDistanceM}
          selectedRecordId={selectedRecordId}
          comparisonRecordId={comparisonRecordId}
          binding={prescriptionBinding}
          onSelectRecord={onSelectRecord}
          onCompareRecord={onCompareRecord}
          onConfirm={onConfirmRecord}
          onManageRecords={onManageRecords}
          onUseRpe={onChangeMethod === undefined ? undefined : () => onChangeMethod(null)}
          recordReturnCount={recordReturnCount}
        />
        </>
      )}
      <CandidateComparison candidates={generated.candidates} />
      <div className="plan-source-strip">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>
          <strong>
            <span className="plan-source-strip__title">
              {athleteEvidence.storedRecordCount + athleteEvidence.recentJournalSessionCount === 0
                ? "기록 없이 시작한 베타 계획"
                : "경기 기록 "
                  + athleteEvidence.storedRecordCount
                  + "개 · 최근 일지 "
                  + athleteEvidence.recentJournalSessionCount
                  + "개 연결"}
            </span>
            <TermHelp term="plan-beta-basis" />
          </strong>
          <small>
            {prescriptionBinding.kind === "bound"
              ? `선택하고 확인한 ${selectedEventLabel} 기록만 상세 페이스 계산에 사용 · 연결된 일지 값은 이번 계획 계산에 사용하지 않았어요`
              : "확인한 기준 기록이 없어 기록값과 구조화 일지는 이번 계획 계산에 사용하지 않았어요"}
          </small>
          {athleteEvidence.goalRecordCount > 0 && (
            <small>목표 기록 {athleteEvidence.goalRecordCount}개 포함 · 현재 수치 계산에는 사용하지 않았어요</small>
          )}
          {intake.competitionDivision !== "NOT_PROVIDED" && (
            <small>
              참가 부문: {DIVISION_LABELS[intake.competitionDivision].title} · 화면에만 표시하며 훈련 강도와 안전 판단에는 사용하지 않았어요
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
          onChange={(event) => {
            if (event.target.value !== startDate) onSelectionDetailsChange?.()
            setLocalStartDate(event.target.value)
            onStartDateChange?.(event.target.value)
          }}
        />
        <small id="plan-start-date-help">
          고른 날짜부터 실제 달력에 맞춰 보여드려요.
        </small>
      </label>
      {!hasValidStartDate && (
        <>
          <p className="plan-start-date-error" role="alert">
            실제 날짜를 고른 뒤 계획을 선택해 주세요.
          </p>
          <p className="plan-schedule-unavailable" role="status">
            시작 날짜를 고르면 실제 날짜에 맞춘 계획을 보여드려요.
          </p>
        </>
      )}
      {recordConfirmationPending && (
        <p className="plan-start-date-error" role="alert">
          새로 고른 기준 기록을 확인한 뒤 계획을 선택해 주세요.
        </p>
      )}
      {detailedEvidencePending && !recordConfirmationPending && (
        <p className="plan-start-date-error" role="alert">
          상세 훈련을 선택했어요. 같은 종목의 현재 기록을 고르고 확인해 주세요. 기록 없이 받으려면 위의 훈련 방법 선택에서 시간·RPE 기준으로 바꿀 수 있어요.
        </p>
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
            onSelect={() => onSelect({ candidateId: candidate.candidateId, startDate })}
          />
        ))}
      </div>
    </section>
  )
}

function CandidateComparison({
  candidates,
}: {
  readonly candidates: PlanGenerationSuccess["candidates"]
}) {
  const sharedCandidate = candidates[0]
  const selectedIntentLabel = ENERGY_INTENT_LABELS[sharedCandidate.selectedEnergyIntent].title
  const comparison = comparePlanMainWork(candidates[0], candidates[1])

  return (
    <section className="plan-candidate-comparison" aria-label="두 계획 핵심 비교">
      <h2>{comparison.easyDurationOnly ? "고른 목표는 같고, 쉬운 훈련 시간만 달라요" : "두 계획의 본운동 구성을 확인하세요"}</h2>
      <p className="plan-candidate-comparison__intro">
        {comparison.sameMainValues ? <>
          두 계획 모두 주요 훈련 목적은 &lsquo;{selectedIntentLabel}&rsquo;
          <TermHelp term={ENERGY_INTENT_LABELS[sharedCandidate.selectedEnergyIntent].term} />이에요.
          {comparison.hasDetailed
            ? " 상세 처방이 있는 본운동의 반복·회복·목표 페이스가 같아요."
            : " 같은 날·시간대에 같은 시간·RPE 범위를 넣었어요. 구체적인 반복과 회복 방법이 정해진 것은 아니에요."}
          {comparison.hasDetailed && comparison.hasUnspecified && " 구간이 미지정인 다른 본운동은 시간·RPE 범위만 같아요."}
          {" "}여기서 쉬운 훈련은 기초 달리기와 회복 운동을 말해요.
        </> : "일정이나 본운동의 수치가 달라 공통 구성이라고 단정할 수 없어요."}
      </p>
      {comparison.easyDurationOnly && <div className="plan-candidate-comparison__shared">
        <strong>두 계획의 공통 일정</strong>
        <span>{candidateSharedSessionSummary(sharedCandidate)}</span>
      </div>}
      <div className="plan-candidate-comparison__options">
        {candidates.map((candidate) => {
          const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent)
          const purposeStatus = candidatePurposeStatus(candidate.kind)
          return (
            <article key={candidate.candidateId}>
              <span>계획안 {candidate.kind === "BALANCED" ? "A" : "B"}</span>
              <strong>{label.title}</strong>
              <p>{purposeStatus.label}</p>
              <small>{candidateDurationSummary(candidate)}</small>
            </article>
          )
        })}
      </div>
      <MainWorkComparison comparison={comparison} />
      <p className="plan-candidate-comparison__note">
        {comparison.easyDurationOnly
          ? "두 합계의 차이는 조절할 수 있는 쉬운 훈련을 A에서는 시간 범위로, B에서는 가장 짧은 시간으로 계산해서 생겨요. 주요 훈련이 더 많거나 세지는 차이는 아니에요."
          : "시간 합계만으로 훈련 방법이나 부담이 같다고 판단하지 않아요."}
      </p>
    </section>
  )
}
