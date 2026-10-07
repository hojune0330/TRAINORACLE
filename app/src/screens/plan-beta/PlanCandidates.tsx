import React from "react"
import { formatPaceSeconds } from "@impl/prescription/record-pace"
import { InitialRecordPaceOffer } from "./InitialRecordPaceOffer"
import { ArrowLeft, CalendarDays, BookOpen, SlidersHorizontal, ShieldCheck } from "lucide-react"
import type {
  PlanGenerationSuccess,
} from "@impl/plan-generator/types"
import { TermHelp } from "../../components/TermHelp"
import { isValidIsoDate, isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import type { PlanAthleteEvidence } from "../../domain/plan-beta-flow"
import type { AthleteRecord } from "../../domain/athlete-records"
import type { CandidatePrescriptionBinding } from "../../domain/plan-candidate-prescription"
import { deriveRecordCurrentness } from "../../domain/pace-target-evidence"
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
import { PlanRefinePanel } from "./PlanRefinePanel"
import type { IntakeStep } from "./PlanIntake"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import { listDetailedSessionTargets, type PlanSessionTarget, type CandidateSessionTargets } from "../../domain/plan-session-target"
import { PlanSessionTargetPicker } from "./PlanSessionTargetPicker"
import type { RepeatPreference } from "@impl/prescription/method-recommendation"
import { InstantPlanRecommendationFacts, InstantPlanRecommendationView } from "../../components/instant-plan/InstantPlanRecommendationView"
import type { InstantPlanEntry } from "../../domain/instant-plan-contract"
import { formatRecordTime } from "../../domain/athlete-record-display"
import { defaultInstantCandidate, projectInstantRecommendation } from "./instant-plan-projection"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { sameDetailedTemplateReference } from "../../domain/plan-method-selection"
import { CatalogWorkoutPicker } from "./CatalogWorkoutPicker"
import { findCatalogConditionReview, type CatalogConditionRequest } from "../../domain/catalog-condition-review"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { catalogScheduleConditions } from "../../domain/catalog-schedule-conditions"
import { CatalogScheduleReview } from "./CatalogScheduleReview"
import { CatalogCycleSummary } from "./CatalogCycleSummary"
import { PlanPrescriptionBasis } from "./PlanPrescriptionBasis"
import type { CatalogCycleSuccessorSummary } from "../../domain/catalog-cycle-successor"
import { InitialMainConditions } from "./InitialMainConditions"
import type { InitialMainConditionsProps } from "./InitialMainConditions"

export type InitialMainCandidateReview = Omit<InitialMainConditionsProps, "disabled" | "onPendingChange"> & {
  readonly applying: boolean
  readonly confirmed?: { readonly pairId: string; readonly startDate: string; readonly accountScope: string | null;
    readonly revision: number; readonly keys: readonly string[] } | null
}

const PURPOSE_ENTRIES = [
  { id: "schedule", label: "일정 바꾸기", icon: CalendarDays },
  { id: "workout", label: "훈련 조절", icon: SlidersHorizontal },
  { id: "basis", label: "추천 근거", icon: BookOpen },
] as const
type CandidatePurpose = typeof PURPOSE_ENTRIES[number]["id"]

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
  candidateSessionTargets = {},
  onChangeCandidateSessionTarget,
  onSelectionDetailsChange,
  onManageRecords,
  startDateValue,
  onStartDateChange,
  recordReturnCount,
  targetRaceDate,
  onRefine,
  onBack,
  onSelect,
  adjustmentActions = {},
  instantEntry,
  saving = false,
  saveError,
  saveCode,
  onRetrySave,
  onCatalogChange,
  cycleSummary = null,
  onRebuildCycle,
  initialMain,
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
  readonly candidateSessionTargets?: CandidateSessionTargets
  readonly onChangeCandidateSessionTarget?: (kind: PlanGenerationSuccess["candidates"][number]["kind"], target: PlanSessionTarget) => void
  readonly onSelectionDetailsChange?: () => void
  readonly onManageRecords?: () => void
  readonly startDateValue?: string
  readonly onStartDateChange?: (value: string) => void
  readonly recordReturnCount?: number
  readonly targetRaceDate?: string
  /** 결과 화면에서 항목 하나를 열어 다듬기. 없으면 다듬기 패널을 숨긴다. */
  readonly onRefine?: (step: IntakeStep) => void
  readonly onBack: () => void
  readonly onSelect: (selection: CandidateSelection) => void
  readonly adjustmentActions?: Readonly<Record<string, (() => void) | undefined>>
  readonly instantEntry?: InstantPlanEntry
  readonly saving?: boolean
  readonly saveError?: string | null
  readonly saveCode?: string | null
  readonly onRetrySave?: () => void
  readonly onCatalogChange?: (next: PlanGenerationSuccess) => void
  readonly cycleSummary?: CatalogCycleSuccessorSummary | null
  readonly onRebuildCycle?: () => void
  readonly initialMain?: InitialMainCandidateReview
}) {
  const [purpose, setPurpose] = React.useState<CandidatePurpose | null>(null)
  const [workoutOpened, setWorkoutOpened] = React.useState(false)
  const purposeId = React.useId()
  const resultRef = React.useRef<HTMLElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const optionsRef = React.useRef<HTMLDivElement>(null)
  const methodRef = React.useRef<HTMLDivElement>(null)
  const recordRef = React.useRef<HTMLDivElement>(null)
  const catalogRef = React.useRef<HTMLDivElement>(null)
  const dateRef = React.useRef<HTMLLabelElement>(null)
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  const recoveryRef = React.useRef<HTMLElement>(null)
  const confirmationRequested = React.useRef(false)
  const [navigation, setNavigation] = React.useState<{ kind: "result" | "options" | "date" | "method" | "catalog" | "recovery" | "record"; revision: number } | null>(null)
  const reveal = React.useCallback((kind: "result" | "options" | "date" | "method" | "catalog" | "recovery" | "record") => {
    if (kind === "date" || kind === "options") setPurpose("schedule")
    else if (kind === "method" || kind === "catalog" || kind === "record") {
      setWorkoutOpened(true)
      setPurpose("workout")
    }
    else if (kind === "result") setPurpose(null)
    setNavigation(previous => ({ kind, revision: (previous?.revision ?? 0) + 1 }))
  }, [])
  useActiveContentScroll(navigation?.revision ?? null,
    navigation?.kind === "record" ? recordRef : navigation?.kind === "catalog" ? catalogRef : navigation?.kind === "recovery" ? recoveryRef : navigation?.kind === "method" ? methodRef : navigation?.kind === "options" ? optionsRef : navigation?.kind === "date" ? dateRef : resultRef,
    navigation?.kind === "record" ? recordRef : navigation?.kind === "catalog" ? catalogRef : navigation?.kind === "recovery" ? recoveryRef : navigation?.kind === "method" ? methodRef : navigation?.kind === "options" ? optionsRef : navigation?.kind === "date" ? dateInputRef : headingRef)
  React.useEffect(() => {
    if (saveError && !saving) reveal("recovery")
  }, [saveError, saveCode, saving, reveal])
  const [repeatPreference, setRepeatPreference] = React.useState<RepeatPreference>("NEUTRAL")
  const [targetDraftPending, setTargetDraftPending] = React.useState(false)
  const [methodDraftPending, setMethodDraftPending] = React.useState(false)
  const [catalogDraftPending, setCatalogDraftPending] = React.useState(false)
  const [initialMainPending, setInitialMainPending] = React.useState(false)
  const [conditionRequest, setConditionRequest] = React.useState<CatalogConditionRequest | null>(null)
  const [reviewedConditionContext, setReviewedConditionContext] = React.useState<string | null>(null)
  React.useEffect(() => {
    setRepeatPreference("NEUTRAL")
  }, [intake.eventGroup, intake.eventDistanceM, intake.trainingFocus, intake.experienceBand])
  const [localStartDate, setLocalStartDate] = React.useState(todayISO)
  const startDate = startDateValue ?? localStartDate
  const [expandedCandidateKind, setExpandedCandidateKind] = React.useState<PlanGenerationSuccess["candidates"][number]["kind"] | null>(
    null,
  )
  const hasValidStartDate = isValidIsoDate(startDate)
  const detailedEvidencePending = intake.selectedDetailedTemplateRef !== null
    && prescriptionBinding.kind !== "bound"
  const selectionUnavailable = saving || saveCode?.startsWith("ACCOUNT_PLAN_") === true
  const accountScope = localAccountScopeSnapshot()
  const scheduleReviewScope = JSON.stringify([intake, startDate, accountScope])
  const [scheduleReview, setScheduleReview] = React.useState<{ scope: string; keys: readonly string[] }>({ scope: scheduleReviewScope, keys: [] })
  const initialMainActive = initialMain !== undefined && cycleSummary === null && initialMain.input.context.mode === "newplan"
    && initialMain.input.generated.pairId === generated.pairId
    && initialMain.input.context.startDate === startDate && initialMain.input.context.accountScope === accountScope
  const initialApplying = initialMainActive && initialMain.applying
  const initialConfirmed = initialMainActive && initialMain.confirmed?.pairId === generated.pairId
    && initialMain.confirmed.startDate === startDate && initialMain.confirmed.accountScope === accountScope
    && initialMain.confirmed.revision === initialMain.input.context.revision ? initialMain.confirmed.keys : []
  const reviewedConditionKeys = [...new Set([...(scheduleReview.scope === scheduleReviewScope ? scheduleReview.keys : []), ...initialConfirmed])]
  const scheduleConditions = catalogScheduleConditions(generated, startDate, accountScope)
  const currentConditionIdentity = JSON.stringify(scheduleConditions.map(condition => condition.key))
  const initialConfirmedIdentity = JSON.stringify(initialConfirmed)
  React.useEffect(() => {
    const keys = JSON.parse(initialConfirmedIdentity) as string[]
    if (!keys.length) return
    setScheduleReview(previous => ({ scope: scheduleReviewScope,
      keys: [...new Set([...(previous.scope === scheduleReviewScope ? previous.keys : []), ...keys])] }))
  }, [scheduleReviewScope, initialConfirmedIdentity])
  React.useEffect(() => {
    const currentKeys = JSON.parse(currentConditionIdentity) as string[]
    setScheduleReview(previous => {
      if (previous.scope !== scheduleReviewScope) return { scope: scheduleReviewScope, keys: [] }
      const keys = previous.keys.filter(key => currentKeys.includes(key))
      return keys.length === previous.keys.length ? previous : { scope: scheduleReviewScope, keys }
    })
  }, [scheduleReviewScope, currentConditionIdentity])
  const unreviewedConditions = scheduleConditions.filter(condition => !reviewedConditionKeys.includes(condition.key))
  // A rejected review may be corrected; an in-flight/uncertain write must not fork.
  const canRevise = !saving && !initialApplying && (saveCode === undefined || saveCode === null
    || !saveCode.startsWith("ACCOUNT_PLAN_")
    || ["ACCOUNT_PLAN_STALE", "ACCOUNT_PLAN_EVIDENCE_REQUIRED", "ACCOUNT_PLAN_REVIEW_REQUIRED"].includes(saveCode))
  const canSelect = hasValidStartDate && !recordConfirmationPending && !detailedEvidencePending && !targetDraftPending && !methodDraftPending && !catalogDraftPending
    && !initialMainPending && !initialApplying && !selectionUnavailable && unreviewedConditions.length === 0 && saveCode !== "CYCLE_EVIDENCE_CHANGED"
  const selectedRecord = athleteRecords.find((record) => record.id === selectedRecordId)
  const selectedEventLabel = selectedRecord === undefined
    ? "선택한 종목"
    : `${selectedRecord.eventDistanceM}m`
  const recommendation = projectInstantRecommendation(defaultInstantCandidate(generated), startDate)
  const instantAdjustment = recommendation === null ? undefined : adjustmentActions[recommendation.id]
  const conditionContext = JSON.stringify([intake, startDate, accountScope])
  const conditionReview = React.useMemo(() => !initialMainActive && onCatalogChange && instantAdjustment === undefined && reviewedConditionContext !== conditionContext && unreviewedConditions.length === 0
    ? findCatalogConditionReview(generated, intake) : null, [initialMainActive, generated, intake, onCatalogChange, instantAdjustment, reviewedConditionContext, conditionContext, unreviewedConditions.length])
  const detailedOptions = workoutOpened || intake.selectedDetailedTemplateRef !== null
    ? resolveDetailedPlanTemplateOptions(intake, undefined, undefined, repeatPreference, { anchor: selectedRecord })
    : []
  const selectedDetailedOption = detailedOptions.find(option => sameDetailedTemplateReference(option.ref, intake.selectedDetailedTemplateRef))
  const pacePrescription = defaultInstantCandidate(generated).sessions.find(session => session.prescription.kind === "PACE_TARGET")?.prescription
  const workoutSummary = selectedDetailedOption?.mainSummary && pacePrescription?.kind === "PACE_TARGET"
    ? `${selectedDetailedOption.mainSummary} · ${pacePrescription.repetitionDistanceM}m당 ${formatPaceSeconds(pacePrescription.targetRepSeconds)}`
    : selectedDetailedOption?.mainSummary
  const needsReview = recordConfirmationPending || detailedEvidencePending || targetDraftPending || methodDraftPending || !hasValidStartDate
  const visiblePurpose = purpose
  React.useEffect(() => {
    if (!confirmationRequested.current || needsReview || selectionUnavailable) return
    confirmationRequested.current = false
    reveal("result")
  }, [needsReview, selectionUnavailable, reveal])

  return (
    <section ref={resultRef} className="plan-candidates" aria-labelledby="plan-candidates-title">
      <p className="plan-eyebrow">오라클 · 훈련 계획</p>
      <div className="plan-result-header">
      <button className="plan-back" type="button" onClick={onBack} disabled={!canRevise || initialMainPending} aria-label="질문 다시 보기" title="질문 다시 보기">
        <ArrowLeft aria-hidden="true" size={17} />
      </button>
      <div className="plan-heading-row">
        <h1 ref={headingRef} tabIndex={-1} id="plan-candidates-title">계획이 준비됐어요</h1>
        <TermHelp term="plan-option" />
      </div>
      </div>
      {cycleSummary && <CatalogCycleSummary summary={cycleSummary} startDate={startDate} />}
      {instantEntry?.kind === "CURRENT_RECORD" && intake.selectedDetailedTemplateRef === null
        && selectedRecord && deriveRecordCurrentness(selectedRecord, new Date()) !== "CURRENT" && (
        <p className="plan-copy" role="status">
          {selectedRecord.achievedOn === null ? "기록 날짜가 없어" : "현재 페이스 기준으로 쓰기에는 오래된 기록이라"}
          {" 이 기록으로는 개인 페이스를 적용하지 않았어요. 입력한 기록은 보관하고, 시간·힘든 정도 기준 계획으로 시작할 수 있어요."}
        </p>
      )}
      {recommendation && <InstantPlanRecommendationView recommendation={recommendation}
        showSupportingDetails={false}
        recoveryRef={recoveryRef}
        blockedAction={!selectionUnavailable && !saveError && !initialApplying && !catalogDraftPending && !initialMainPending
          && !methodDraftPending && !targetDraftPending && hasValidStartDate && unreviewedConditions.length === 0
          && intake.selectedDetailedTemplateRef !== null && intake.experienceBand === "EXPERIENCED"
          && (recordConfirmationPending || detailedEvidencePending)
          ? { label: "기준 기록 확인하기", onClick: () => reveal("record") } : undefined}
        actionState={saving ? { kind: "SAVING" } : saveCode === "ACCOUNT_PLAN_PENDING" ? { kind: "PENDING", message: saveError ?? "계정 저장을 확인하고 있어요." }
          : selectionUnavailable ? { kind: "BLOCKED", message: saveError ?? "계정 저장 상태를 먼저 확인해 주세요." }
          : saveError ? { kind: "FAILED", message: saveError }
          : initialApplying ? { kind: "BLOCKED", message: "확인한 구성을 계획안에 반영하고 있어요." }
          : catalogDraftPending || initialMainPending ? { kind: "BLOCKED", message: "바꾼 훈련을 적용하거나 취소해 주세요." }
          : unreviewedConditions.length ? { kind: "BLOCKED", message: "새 날짜에 사용할 운동 환경을 확인해 주세요." }
          : needsReview ? { kind: "BLOCKED", message: !hasValidStartDate
            ? "일정 바꾸기에서 실제 시작 날짜를 골라 주세요."
            : "훈련 조절에서 기준 기록이나 변경한 내용을 확인해 주세요." } : { kind: "READY" }}
        onStart={candidateId => {
          if (!canSelect || !localAccountScopeIsCurrent(accountScope)) return
          const adjust = adjustmentActions[candidateId]
          if (adjust) adjust()
          else onSelect({ candidateId, startDate })
        }}
        onRetry={saveCode === "PLAN_STORAGE_WRITE_FAILED" && canSelect ? onRetrySave : undefined}
        scheduleReview={unreviewedConditions.length > 0 && <CatalogScheduleReview
          key={JSON.stringify(unreviewedConditions.map(condition => condition.key))}
          conditions={unreviewedConditions} disabled={selectionUnavailable || catalogDraftPending || initialMainPending || initialApplying || methodDraftPending || targetDraftPending || recordConfirmationPending}
          onConfirm={() => {
            if (selectionUnavailable || catalogDraftPending || initialMainPending || initialApplying || methodDraftPending || targetDraftPending || recordConfirmationPending
              || !localAccountScopeIsCurrent(accountScope)) return
            setScheduleReview({ scope: scheduleReviewScope, keys: scheduleConditions.map(condition => condition.key) })
            setReviewedConditionContext(conditionContext)
            onSelectionDetailsChange?.()
            reveal("result")
          }} />}
        workoutLabel={instantAdjustment ? "거리·시간·반복·회복을 확인하고 조절해요" : workoutSummary}
        workoutLabelTitle={instantAdjustment ? "상세 훈련" : undefined}
        startLabel={instantAdjustment ? "처방 훈련 확인" : undefined}
        conditionReviewLabel={conditionReview && hasValidStartDate
          ? `${isoShift(startDate, conditionReview.day - 1)} ${conditionReview.slot === "AM" ? "오전" : "오후"} · 공간 확인하고 상세 훈련 보기` : undefined}
        onReviewCondition={conditionReview ? () => {
          if (!canSelect || !localAccountScopeIsCurrent(accountScope)) return
          setConditionRequest(previous => ({ ...conditionReview, startDate, accountScope, revision: (previous?.revision ?? 0) + 1 }))
          reveal("catalog")
        } : undefined}
        anchorLabel={prescriptionBinding.kind === "bound" && selectedRecord
          ? `${selectedEventLabel} ${formatRecordTime(selectedRecord.performanceSeconds)}` : undefined}
        goalLabel={instantEntry?.kind === "GOAL_ONLY" ? `${instantEntry.eventDistanceM}m ${formatRecordTime(instantEntry.performanceSeconds)}` : undefined}
      />}
      {initialMainActive && instantAdjustment === undefined && <InitialMainConditions {...initialMain}
        disabled={!canRevise || selectionUnavailable || catalogDraftPending || methodDraftPending || targetDraftPending || recordConfirmationPending}
        onPendingChange={setInitialMainPending} />}
      {saveCode === "CYCLE_EVIDENCE_CHANGED" && onRebuildCycle && <button type="button" className="plan-text-action"
        disabled={saving} onClick={onRebuildCycle}>일지를 반영해 다시 만들기</button>}
      <div className="plan-purpose-entries" role="group" aria-label="계획 확인·변경">
        {PURPOSE_ENTRIES.map(({ id, label, icon: Icon }) => <button key={id} type="button"
          id={`${purposeId}-${id}-entry`} aria-expanded={visiblePurpose === id} aria-controls={`${purposeId}-${id}`}
          onClick={() => {
            if (id === "workout") setWorkoutOpened(true)
            setPurpose(visiblePurpose === id ? null : id)
          }}>
          <Icon size={18} aria-hidden="true" />{label}
        </button>)}
      </div>
      <section id={`${purposeId}-workout`} hidden={visiblePurpose !== "workout"} aria-labelledby={`${purposeId}-workout-entry`}>
      {workoutOpened && <>
      {instantAdjustment && <button type="button" className="plan-text-action" disabled={!canSelect} onClick={instantAdjustment}>처방 확인·조절</button>}
      {onCatalogChange && intake.selectedDetailedTemplateRef === null && <InitialRecordPaceOffer
        generated={generated} records={athleteRecords} disabled={!canRevise || !canSelect}
        onChange={onCatalogChange} />}
      {onCatalogChange && intake.selectedDetailedTemplateRef === null && <div ref={catalogRef} tabIndex={-1}>
        <CatalogWorkoutPicker inline generated={generated} intake={intake} openRequest={navigation?.kind === "catalog" ? navigation.revision : null}
          conditionRequest={conditionRequest} startDate={startDate} reviewedConditionKeys={reviewedConditionKeys}
          records={athleteRecords} onChange={(next, reviewedAddress) => {
            if (!localAccountScopeIsCurrent(accountScope)) return
            if (reviewedAddress) {
              const applied = catalogScheduleConditions(next, startDate, accountScope)
                .filter(condition => condition.day === reviewedAddress.day && condition.slot === reviewedAddress.slot)
              setScheduleReview(previous => ({ scope: scheduleReviewScope, keys: [...new Set([
                ...(previous.scope === scheduleReviewScope ? previous.keys : []), ...applied.map(condition => condition.key),
              ])] }))
            }
            if (conditionReview && next.candidates.every(candidate => {
              const target = candidate.sessions.find(s => s.day === conditionReview.day && s.slot === conditionReview.slot)
              return target?.prescription.kind === "RPE_TIME_RANGE" && target.prescription.catalogWorkout !== undefined
            })) setReviewedConditionContext(conditionContext)
            onCatalogChange(next)
          }} onPendingChange={setCatalogDraftPending} disabled={saving || recordConfirmationPending || selectionUnavailable || initialMainPending || initialApplying} />
      </div>}
      {!recommendation && saveError && <p role="alert">{saveError}</p>}
      {instantAdjustment === undefined && onChangeMethod !== undefined && detailedOptions.length > 0 && <div ref={methodRef} tabIndex={-1}>
        <PlanMethodPicker
          inline
          options={detailedOptions}
          openRequest={navigation?.kind === "method" ? navigation.revision : null}
          selected={intake.selectedDetailedTemplateRef}
          contextKey={JSON.stringify([intake, startDate, selectedRecordId, selectedRecord?.performanceSeconds, prescriptionBinding])}
          onPendingChange={setMethodDraftPending}
          onChange={onChangeMethod}
          repeatPreference={repeatPreference}
          onRepeatPreferenceChange={setRepeatPreference}
        />
      </div>}
      <fieldset disabled={selectionUnavailable || initialMainPending || initialApplying} style={{ border: 0, padding: 0, minWidth: 0 }}>
      {intake.selectedDetailedTemplateRef !== null
        && (intake.eventGroup === "FIVE_K" || intake.eventGroup === "MIDDLE_DISTANCE")
        && intake.experienceBand === "EXPERIENCED"
        && (
        <>
        {onChangeSessionTarget !== undefined && Object.keys(candidateSessionTargets).length === 0 && <PlanSessionTargetPicker
          targets={listDetailedSessionTargets(generated)} selected={detailedSessionTarget}
          onPendingChange={setTargetDraftPending}
          startDate={startDate} onChange={onChangeSessionTarget} />}
        <div ref={recordRef} tabIndex={-1}>
        <PaceEvidenceFlow
          records={athleteRecords}
          eventDistanceM={intake.eventDistanceM}
          selectedRecordId={selectedRecordId}
          comparisonRecordId={comparisonRecordId}
          binding={prescriptionBinding}
          onSelectRecord={onSelectRecord}
          onCompareRecord={onCompareRecord}
          onConfirm={() => { confirmationRequested.current = true; onConfirmRecord() }}
          onManageRecords={onManageRecords}
          onUseRpe={onChangeMethod === undefined ? undefined : () => onChangeMethod(null)}
          recordReturnCount={recordReturnCount}
        />
        </div>
        </>
      )}
      {recordConfirmationPending && (
        <p className="plan-start-date-error" role="alert">
          새로 고른 기준 기록을 확인한 뒤 계획을 선택해 주세요.
        </p>
      )}
      {detailedEvidencePending && !recordConfirmationPending && (
        <p className="plan-start-date-error" role="alert">
          같은 종목의 경기 기록 또는 목표기록을 고르고 확인해 주세요. 기록 없이 받으려면 상세 훈련에서 ‘기록 없이 시간·RPE로 받기’를 고르세요.
        </p>
      )}
      </fieldset>
      {onRefine !== undefined && canRevise && <fieldset disabled={initialMainPending} className="plan-purpose-fields">
        <PlanRefinePanel purpose="workout" intake={intake} targetRaceDate={targetRaceDate} onRefine={onRefine}
          detailedTemplateAvailable={resolveDetailedPlanTemplateOptions(intake, undefined, undefined, repeatPreference).length > 0} />
      </fieldset>}
      </>}
      </section>
      <section id={`${purposeId}-schedule`} hidden={visiblePurpose !== "schedule"} aria-labelledby={`${purposeId}-schedule-entry`}>
      <fieldset disabled={selectionUnavailable || initialMainPending || initialApplying} className="plan-purpose-fields">
      {!hasValidStartDate && <p className="plan-start-date-error" role="alert">실제 날짜를 고른 뒤 계획을 선택해 주세요.</p>}
      <label ref={dateRef} className="plan-start-date" htmlFor="plan-start-date">
        <span>계획 시작 날짜</span>
        <input
          id="plan-start-date"
          ref={dateInputRef}
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
          오늘부터 시작해요. 바꿀 수 있어요.
        </small>
      </label>
      {onRefine !== undefined && canRevise && <PlanRefinePanel purpose="schedule" intake={intake}
        targetRaceDate={targetRaceDate} onRefine={onRefine} detailedTemplateAvailable={false} />}
      {unreviewedConditions.length > 0 && <button type="button" className="plan-text-action"
        onClick={() => reveal("result")}>바뀐 날짜의 운동 환경 확인</button>}
      <div ref={optionsRef} tabIndex={-1} role="region" aria-label="다른 계획 비교" className="plan-candidate-list">
        <h2>일정을 보고 골라요</h2>
        {generated.candidates.map((candidate) => (
          <CandidateSection
            key={candidate.kind}
            candidate={candidate}
            startDate={startDate}
            detailedTargets={intake.selectedDetailedTemplateRef === null ? [] : listDetailedSessionTargets(generated)}
            detailedTarget={candidateSessionTargets[candidate.kind] ?? detailedSessionTarget}
            onChangeSessionTarget={onChangeCandidateSessionTarget === undefined ? undefined : target => onChangeCandidateSessionTarget(candidate.kind, target)}
            canSelect={canSelect}
            recommended={candidate.kind === "BALANCED"}
            expanded={expandedCandidateKind === candidate.kind}
            onToggleSchedule={() => setExpandedCandidateKind((current) =>
              current === candidate.kind ? null : candidate.kind)}
            onSelect={() => { if (canSelect && localAccountScopeIsCurrent(accountScope)) onSelect({ candidateId: candidate.candidateId, startDate }) }}
            onAdjust={adjustmentActions[candidate.candidateId] === undefined ? undefined : () => {
              if (canSelect && localAccountScopeIsCurrent(accountScope)) adjustmentActions[candidate.candidateId]?.()
            }}
          />
        ))}
      </div>
      </fieldset>
      </section>
      {generated.racePlacement.kind !== "NO_TARGET_RACE" && <RacePlacementNotice state={generated.racePlacement} />}
      <section id={`${purposeId}-basis`} hidden={visiblePurpose !== "basis"} aria-labelledby={`${purposeId}-basis-entry`}>
      <h2>전체 훈련 시간·목표</h2>
      {recommendation && <InstantPlanRecommendationFacts recommendation={recommendation}
        goalLabel={instantEntry?.kind === "GOAL_ONLY" ? `${instantEntry.eventDistanceM}m ${formatRecordTime(instantEntry.performanceSeconds)}` : undefined} />}
      {recommendation?.reason && <p>{recommendation.reason}</p>}
      <h2>무엇을 기준으로 만든 훈련인가요?</h2>
      <PlanPrescriptionBasis inline sessions={defaultInstantCandidate(generated).sessions}
        confirmationPending={recordConfirmationPending || detailedEvidencePending} />
      {generated.racePlacement.kind === "NO_TARGET_RACE" && <RacePlacementNotice state={generated.racePlacement} />}
      <h2>A와 B는 뭐가 달라요?</h2>
        <CandidateComparison candidates={generated.candidates} />
      <h2>이 계획은 어떤 정보로 만들었나요?</h2>
      <p className="plan-copy">
        {prescriptionBinding.kind === "bound"
          ? `직접 고르고 확인한 현재 ${selectedEventLabel} 기록으로 한 강도 세션의 상세 페이스를 계산했어요. 다른 훈련과 일지 값은 시간이나 RPE를 바꾸지 않습니다.`
          : generated.sourceMode === "PROFILE_ONLY"
          ? "고른 목표·경험·운동할 날로 만들었어요. 아래에서 조금씩 다듬을 수 있어요."
          : "최근 일지가 있는지만 확인했어요. 일지의 거리, RPE, 메모는 계획의 시간이나 강도를 바꾸지 않아요."}
      </p>
      <h2>기준 기록·참가 부문·이전 계획</h2>
      <div className="plan-source-strip">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>
          <strong>
            <span className="plan-source-strip__title">
              {athleteEvidence.storedRecordCount + athleteEvidence.recentJournalSessionCount === 0
                ? "기준 기록 없이 만든 계획"
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
              : "확인한 기준 기록이 없어 개인 기록과 일지 수치는 이번 계획 계산에 사용하지 않았어요"}
          </small>
          {athleteEvidence.goalRecordCount > 0 && prescriptionBinding.kind === "bound" && selectedRecord?.purpose === "RACE_GOAL" ? (
            <small>확인한 목표기록으로 페이스를 계산했어요. 달성한 기록이나 현재 실력을 뜻하지 않아요.</small>
          ) : athleteEvidence.goalRecordCount > 0 && (
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
      </section>
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
        {comparison.hasUnsupportedCatalog ? <>
          {comparison.contextMatches && <>두 계획 모두 주요 훈련 목적은 &lsquo;{selectedIntentLabel}&rsquo;
            <TermHelp term={ENERGY_INTENT_LABELS[sharedCandidate.selectedEnergyIntent].term} />이에요. </>}
          카탈로그 상세 구성은 이 비교에서 공통 여부를 확인할 수 없어요. 각 일정의 훈련 방법을 확인해 주세요.
        </> : comparison.sameMainValues ? <>
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
          const hasCatalog = candidate.sessions.some(s => s.prescription.kind === "RPE_TIME_RANGE" && s.prescription.catalogWorkout)
          const label = candidateLabel(candidate.kind, candidate.selectedEnergyIntent, hasCatalog)
          const purposeStatus = candidatePurposeStatus(candidate.kind, hasCatalog)
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
