import React from "react"
import type {
  PlanGenerationSuccess,
  TrainingTimePreference,
} from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  evaluatePlanSafety,
  generatePlanFromDraft,
} from "../domain/plan-beta-flow"
import type {
  PlanAthleteEvidence,
  PlanCurrentCheck,
  PlanDraftGeneration,
} from "../domain/plan-beta-flow"
import {
  loadPlanBetaState,
  loadPreviousIntake,
  savePlanBetaState,
} from "../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../domain/plan-beta-store"
import type { JournalEntryType } from "./log-entry/shared"
import { PlanActiveState } from "./plan-beta/PlanActiveState"
import { PlanCandidates } from "./plan-beta/PlanCandidates"
import { PlanIntake } from "./plan-beta/PlanIntake"
import type { IntakeStep } from "./plan-beta/PlanIntake"
import { NotationReader } from "./plan-beta/NotationReader"
import { RaceDatePreview } from "./plan-beta/RaceDatePreview"
import {
  saveSelectedPlanCandidate,
} from "./plan-beta/plan-selection"
import type { CandidateSelection } from "./plan-beta/plan-selection"
import { planErrorMessage } from "./plan-beta/plan-feedback"
import { loadAthleteRecords } from "../domain/athlete-records"
import type { CandidatePrescriptionBinding } from "../domain/plan-candidate-prescription"
import {
  eventGroupForDistance,
  firstUnansweredQuickStep,
  previousIntakeStep,
  QUICK_INTAKE_DEFAULTS,
  withQuickDefaults,
} from "./plan-beta/plan-intake-navigation"
import { PlanBlockedGuide } from "./plan-beta/PlanBlockedGuide"
import {
  backupActivePlanToServer,
  loadLatestPlanFromServer,
  planCloudBackupEnabled,
} from "../domain/account/plan-cloud-backup"
import type { PlanCloudPersistenceState } from "../domain/account/plan-cloud-backup"
import type { PlannedSessionLogDraft } from "../domain/planned-session-link"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../hooks/useOrderedStepMotion"
import { resolvePlanMethodChange } from "../domain/plan-method-selection"
import { todayISO } from "../domain/journal-store"

const AthleteRecords = React.lazy(() => import("./AthleteRecords").then(module => ({ default: module.AthleteRecords })))

const INTAKE_MOTION_ORDER: readonly IntakeStep[] = [
  "goal",
  "experience",
  "days",
  "safety",
  "preview",
  "division",
  "focus",
  "template",
  "frame-length",
  "training-time",
  "two-a-day",
  "race-date",
]

/** 다듬기에서 열 수 있는 단계. 결과 화면에서 하나씩 열고, 고르면 바로 결과로 돌아간다. */
const REFINE_STEPS: readonly IntakeStep[] = [
  "goal",
  "experience",
  "days",
  "division",
  "focus",
  "template",
  "frame-length",
  "training-time",
  "two-a-day",
  "race-date",
]

export function PlanBeta({
  onWriteLog,
  onManageRecords,
  onWritePlannedSessionLog,
  returnToSession,
}: {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onManageRecords?: () => void
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
}) {
  const [stored, setStored] = React.useState<PlanBetaState | null>(
    () => loadPlanBetaState(),
  )
  const [cloudRestorePending, setCloudRestorePending] = React.useState(
    stored === null && planCloudBackupEnabled(),
  )
  const [cloudPersistence, setCloudPersistence] = React.useState<PlanCloudPersistenceState>(
    planCloudBackupEnabled() ? "CHECKING" : "DEVICE_ONLY",
  )
  const cloudBackupAttempt = React.useRef(0)
  const previousIntake = React.useState(() => loadPreviousIntake())[0]
  const [draft, setDraft] = React.useState<Partial<PlanBetaIntake>>(
    previousIntake ?? {},
  )
  const [step, setStep] = React.useState<IntakeStep>(
    () => firstUnansweredQuickStep(previousIntake ?? {}),
  )
  /** 결과 화면의 "다듬기"에서 연 질문인지. 고르면 결과로 바로 돌아간다. */
  const [refining, setRefining] = React.useState(false)
  const [generated, setGenerated] = React.useState<PlanGenerationSuccess | null>(
    null,
  )
  const [generatedIntake, setGeneratedIntake] =
    React.useState<PlanBetaIntake | null>(null)
  const [gate, setGate] = React.useState<SafetyGateDecision | null>(null)
  const [generatedEvidence, setGeneratedEvidence] = React.useState<PlanAthleteEvidence | null>(null)
  const [targetRaceDate, setTargetRaceDate] = React.useState("")
  const [racePreview, setRacePreview] = React.useState<
    Extract<PlanDraftGeneration, { readonly kind: "preview_only" }> | null
  >(null)
  const [blocked, setBlocked] = React.useState(false)
  const [currentCheck, setCurrentCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const [retrySelection, setRetrySelection] = React.useState<CandidateSelection | null>(null)
  const [notationReaderOpen, setNotationReaderOpen] = React.useState(false)
  const [celebrateActivePlan, setCelebrateActivePlan] = React.useState(false)
  const [athleteRecords, setAthleteRecords] = React.useState(() => loadAthleteRecords())
  const [recordsOpen, setRecordsOpen] = React.useState(false)
  const [recordReturnCount, setRecordReturnCount] = React.useState(0)
  const [candidateStartDate, setCandidateStartDate] = React.useState(todayISO)
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  const [comparisonRecordId, setComparisonRecordId] = React.useState<string | null>(null)
  const [recordConfirmationPending, setRecordConfirmationPending] = React.useState(false)
  const draftRevision = React.useRef(0)
  React.useEffect(() => () => { draftRevision.current += 1 }, [])
  const [prescriptionBinding, setPrescriptionBinding] = React.useState<
    Omit<CandidatePrescriptionBinding, "generated">
  >({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" })
  const intakeQuestionRef = React.useRef<HTMLDivElement>(null)
  const intakeMotion = useOrderedStepMotion(step, INTAKE_MOTION_ORDER)
  const viewKey = recordsOpen
    ? "records"
    : notationReaderOpen
    ? "notation-reader"
    : stored !== null
    ? "active"
    : racePreview !== null
      ? "race-preview"
    : blocked
      ? "blocked"
      : generated !== null && gate !== null
        ? "candidates"
        : `intake-${step}`

  React.useLayoutEffect(() => {
    if (viewKey.startsWith("intake-")) return
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    if (scrollRegion !== null) scrollRegion.scrollTop = 0
  }, [viewKey])
  useActiveContentScroll(
    viewKey.startsWith("intake-") ? viewKey : null,
    intakeQuestionRef,
    undefined,
    true,
  )

  React.useEffect(() => {
    if (stored !== null || !planCloudBackupEnabled()) {
      setCloudRestorePending(false)
      if (!planCloudBackupEnabled()) setCloudPersistence("DEVICE_ONLY")
      return
    }
    let cancelled = false
    void loadLatestPlanFromServer().then((result) => {
      if (cancelled) return
      if (result.kind === "loaded" && savePlanBetaState(result.state).ok) {
        setStored(result.state)
        setCloudPersistence("SAVED")
      } else if (result.kind === "failed") {
        setCloudPersistence("FAILED")
      } else {
        setCloudPersistence("DEVICE_ONLY")
      }
      setCloudRestorePending(false)
    })
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (stored !== null && planCloudBackupEnabled()) {
      const attempt = ++cloudBackupAttempt.current
      setCloudPersistence("SAVING")
      void backupActivePlanToServer(stored).then((result) => {
        if (attempt !== cloudBackupAttempt.current) return
        setCloudPersistence(result.kind === "saved" ? "SAVED" : "FAILED")
      })
    } else if (!planCloudBackupEnabled()) {
      setCloudPersistence("DEVICE_ONLY")
    }
  }, [stored])

  const retryCloudBackup = () => {
    if (stored === null || !planCloudBackupEnabled()) return
    const attempt = ++cloudBackupAttempt.current
    setCloudPersistence("SAVING")
    void backupActivePlanToServer(stored).then((result) => {
      if (attempt !== cloudBackupAttempt.current) return
      setCloudPersistence(result.kind === "saved" ? "SAVED" : "FAILED")
    })
  }

  const generateCandidates = (
    nextDraft: Partial<PlanBetaIntake>,
    recordId: string | null = null,
    raceDate?: string,
  ) => {
    draftRevision.current += 1
    setRetrySelection(null)
    if (currentCheck === null) {
      setErrorCode(null)
      setStep("safety")
      return
    }
    const completed = withQuickDefaults(nextDraft)
    const result = generatePlanFromDraft(
      raceDate === undefined ? completed : { ...completed, targetRaceDate: raceDate },
      currentCheck,
      recordId === null ? undefined : { selectedRecordId: recordId },
    )
    switch (result.kind) {
      case "blocked":
        setErrorCode(null)
        setCurrentCheck(null)
        setBlocked(true)
        return
      case "rejected":
        setErrorCode(result.code)
        return
      case "generated":
        setRacePreview(null)
        setErrorCode(null)
        setGate(result.gate)
        setGenerated(result.generated)
        setGeneratedIntake(result.intake)
        setGeneratedEvidence(result.athleteEvidence)
        setPrescriptionBinding(result.prescriptionBinding)
        return
      case "preview_only":
        setErrorCode(null)
        setGenerated(null)
        setGate(null)
        setRacePreview(result)
        return
    }
  }

  /**
   * 다듬기에서 항목 하나를 고른 뒤: 초안을 갱신하고 계획을 다시 만들어 결과로 돌아간다.
   * 안전 확인은 `generateCandidates` 안에서 다시 적용된다(현재 확인 값이 없으면 안전 질문으로).
   */
  const continueAfterRefinement = (nextDraft: Partial<PlanBetaIntake>) => {
    const completed = withQuickDefaults(nextDraft)
    setDraft(completed)
    setRefining(false)
    setSelectedRecordId(null)
    setComparisonRecordId(null)
    setRecordConfirmationPending(false)
    generateCandidates(completed, null, targetRaceDate || undefined)
  }

  /** 결과 화면에서 "다듬기" 항목을 탭하면 해당 질문 하나만 연다. */
  const openRefinement = (target: IntakeStep) => {
    if (!REFINE_STEPS.includes(target)) return
    draftRevision.current += 1
    setRetrySelection(null)
    setGenerated(null)
    setGate(null)
    setErrorCode(null)
    setRefining(true)
    setStep(target)
  }

  const selectRecord = (recordId: string) => {
    if (recordId === selectedRecordId) return
    setSelectedRecordId(recordId)
    setComparisonRecordId(null)
    setRecordConfirmationPending(true)
    if (generatedIntake !== null) generateCandidates(generatedIntake)
  }

  const changeMethod = (reference: PlanBetaIntake["selectedDetailedTemplateRef"]) => {
    if (generatedIntake === null) return
    const change = resolvePlanMethodChange(generatedIntake, reference)
    if (change.kind === "unchanged") return
    draftRevision.current += 1
    setRetrySelection(null)
    if (change.kind === "rejected") {
      setGenerated(null)
      setGate(null)
      setErrorCode(change.code)
      setStep("template")
      return
    }
    setDraft(change.intake)
    setComparisonRecordId(null)
    setRecordConfirmationPending(reference !== null && selectedRecordId !== null)
    // A previously confirmed record is never silently rebound to another method.
    generateCandidates(change.intake)
  }

  const saveCandidate = async (
    selection: CandidateSelection,
    activeGenerated: PlanGenerationSuccess,
  ) => {
    if (recordConfirmationPending
        || (generatedIntake?.selectedDetailedTemplateRef != null && prescriptionBinding.kind !== "bound")) return
    const revision = draftRevision.current
    const safety = currentCheck === null ? null : evaluatePlanSafety(currentCheck)
    if (safety === null || safety.kind === "blocked") {
      setGenerated(null)
      setGate(null)
      setCurrentCheck(null)
      setErrorCode(null)
      setRetrySelection(null)
      setBlocked(true)
      return
    }
    if (generatedEvidence === null) {
      setErrorCode("MINIMUM_PROFILE_INCOMPLETE")
      return
    }
    const result = await saveSelectedPlanCandidate(
      selection,
      activeGenerated,
      safety.gate,
      generatedIntake,
      generatedEvidence,
      () => draftRevision.current === revision,
    )
    if (draftRevision.current !== revision) return
    switch (result.kind) {
      case "saved":
        setErrorCode(null)
        setRetrySelection(null)
        setCelebrateActivePlan(true)
        setStored(result.state)
        return
      case "rejected":
        setErrorCode(result.code)
        setRetrySelection(result.code === "PLAN_STORAGE_WRITE_FAILED" ? selection : null)
        return
    }
  }

  if (recordsOpen) {
    return <React.Suspense fallback={<p role="status">경기 기록을 열고 있어요.</p>}>
      <AthleteRecords onBack={() => {
        setAthleteRecords(loadAthleteRecords())
        setSelectedRecordId(null)
        setComparisonRecordId(null)
        setRecordConfirmationPending(false)
        setRecordsOpen(false)
        setRecordReturnCount(count => count + 1)
        // Re-evaluate current safety and authority; never reuse the old bound numbers.
        if (generatedIntake !== null) generateCandidates(generatedIntake, null, targetRaceDate || undefined)
      }} />
    </React.Suspense>
  }

  if (notationReaderOpen) {
    return <NotationReader onBack={() => setNotationReaderOpen(false)} />
  }

  if (cloudRestorePending && stored === null) {
    return <p role="status" style={{ padding: 24 }}>계정에 저장된 훈련 계획을 확인하고 있어요.</p>
  }

  if (stored !== null) {
    return (
      <PlanActiveState
        state={stored}
        cloudPersistence={cloudPersistence}
        onRetryCloudBackup={retryCloudBackup}
        celebrateOnMount={celebrateActivePlan}
        onStateChange={setStored}
        onArchived={(intake) => {
          setCelebrateActivePlan(false)
          setStored(null)
          setDraft(intake)
          setGenerated(null)
          setGate(null)
          setBlocked(false)
          setCurrentCheck(null)
          setRefining(false)
          setStep("safety")
        }}
        onWritePlannedSessionLog={onWritePlannedSessionLog}
        returnToSession={returnToSession}
      />
    )
  }

  if (blocked) {
    return (
      <PlanBlockedGuide
        draft={draft}
        onWriteLog={() => onWriteLog?.("evening")}
        onRecheck={() => {
          setBlocked(false)
          setRefining(false)
          setStep("safety")
        }}
      />
    )
  }

  if (racePreview !== null) {
    return (
      <RaceDatePreview
        result={racePreview}
        onChangeDate={() => {
          setRacePreview(null)
          setStep("race-date")
        }}
        onContinueWithoutDate={() => {
          setTargetRaceDate("")
          setRacePreview(null)
          generateCandidates(draft)
        }}
      />
    )
  }

  if (generated !== null && gate !== null && generatedIntake !== null && generatedEvidence !== null) {
    return (
      <>
        <PlanCandidates
          generated={generated}
          intake={generatedIntake}
          athleteEvidence={generatedEvidence}
          athleteRecords={athleteRecords}
          selectedRecordId={selectedRecordId}
          comparisonRecordId={comparisonRecordId}
          prescriptionBinding={prescriptionBinding}
          recordConfirmationPending={recordConfirmationPending}
          startDateValue={candidateStartDate}
          onStartDateChange={setCandidateStartDate}
          recordReturnCount={recordReturnCount}
          targetRaceDate={targetRaceDate}
          onManageRecords={() => {
            draftRevision.current += 1
            setRetrySelection(null)
            setRecordsOpen(true)
          }}
          onSelectRecord={selectRecord}
          onCompareRecord={setComparisonRecordId}
          onChangeMethod={changeMethod}
          onSelectionDetailsChange={() => {
            draftRevision.current += 1
            setRetrySelection(null)
          }}
          onConfirmRecord={() => {
            if (selectedRecordId !== null) {
              setRecordConfirmationPending(false)
              generateCandidates(generatedIntake, selectedRecordId)
            }
          }}
          onBack={() => {
            draftRevision.current += 1
            setGenerated(null)
            setGate(null)
            setErrorCode(null)
            setRetrySelection(null)
            setSelectedRecordId(null)
            setComparisonRecordId(null)
            setRecordConfirmationPending(false)
            setRefining(false)
            setStep("safety")
          }}
          onRefine={openRefinement}
          onSelect={(selection) => {
            void saveCandidate(selection, generated)
          }}
        />
        {errorCode !== null && (
          <div className="plan-inline-error" role="alert">
            {planErrorMessage(errorCode)}
          </div>
        )}
        {errorCode === "PLAN_STORAGE_WRITE_FAILED" && retrySelection !== null && (
          <button
            className="plan-text-action"
            type="button"
            onClick={() => {
              void saveCandidate(retrySelection, generated)
            }}
          >
            계획 다시 저장하기
          </button>
        )}
      </>
    )
  }

  return (
    <>
      <PlanIntake
        key={step}
        step={step}
        motion={intakeMotion}
        questionRef={intakeQuestionRef}
        draft={draft}
        refining={refining}
        onBack={() => {
          if (refining) {
            setRefining(false)
            generateCandidates(draft, null, targetRaceDate || undefined)
            return
          }
          setStep(previousIntakeStep(step, draft.eventGroup))
        }}
        onJump={(target) => setStep(target)}
        onGoal={(eventDistanceM) => {
          const eventGroup = eventGroupForDistance(eventDistanceM)
          setSelectedRecordId(null)
          setComparisonRecordId(null)
          setRecordConfirmationPending(false)
          const nextDraft: Partial<PlanBetaIntake> = {
            ...draft,
            eventGroup,
            eventDistanceM,
            competitionDivision: draft.competitionDivision ?? QUICK_INTAKE_DEFAULTS.competitionDivision,
            // 종목이 바뀌면 상세 훈련표는 다시 고른다(다른 종목 표를 그대로 쓰지 않음).
            selectedDetailedTemplateRef: draft.eventDistanceM === eventDistanceM
              ? draft.selectedDetailedTemplateRef
              : QUICK_INTAKE_DEFAULTS.selectedDetailedTemplateRef,
          }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep(draft.experienceBand === undefined ? "experience" : firstUnansweredQuickStep(nextDraft))
        }}
        onDivision={(competitionDivision) => continueAfterRefinement({ ...draft, competitionDivision })}
        onExperience={(experienceBand) => {
          const nextDraft = { ...draft, experienceBand }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep(firstUnansweredQuickStep(nextDraft))
        }}
        onFocus={(trainingFocus) => continueAfterRefinement({
          ...draft,
          trainingFocus,
          selectedDetailedTemplateRef: null,
        })}
        onTemplate={(selectedDetailedTemplateRef) => continueAfterRefinement({
          ...draft,
          selectedDetailedTemplateRef,
        })}
        onDays={(availableDayCount) => {
          const nextDraft = { ...draft, availableDayCount }
          if (refining) {
            continueAfterRefinement(nextDraft)
            return
          }
          setDraft(nextDraft)
          setStep("safety")
        }}
        onFrameLength={(requestedFrameLength) => continueAfterRefinement({ ...draft, requestedFrameLength })}
        onTrainingTime={(trainingTimePreference: TrainingTimePreference) => continueAfterRefinement({ ...draft, trainingTimePreference })}
        onSecondSession={(secondSessionMode) => continueAfterRefinement({ ...draft, secondSessionMode })}
        targetRaceDate={targetRaceDate}
        onTargetRaceDateChange={setTargetRaceDate}
        onRaceDate={(raceDate) => {
          setRefining(false)
          if (raceDate === undefined) setTargetRaceDate("")
          generateCandidates(draft, null, raceDate)
        }}
        onManageRecords={() => onManageRecords?.()}
        onOpenNotationReader={() => setNotationReaderOpen(true)}
        onSafety={(nextCurrentCheck) => {
          const safety = evaluatePlanSafety(nextCurrentCheck)
          if (safety.kind === "blocked") {
            setErrorCode(null)
            setCurrentCheck(null)
            setBlocked(true)
            return
          }
          setErrorCode(null)
          setCurrentCheck(nextCurrentCheck)
          // 네 번째 답과 함께 바로 계획을 만든다. 나머지 항목은 기본값, 결과에서 다듬는다.
          const completed = withQuickDefaults(draft)
          setDraft(completed)
          draftRevision.current += 1
          setRetrySelection(null)
          const result = generatePlanFromDraft(completed, nextCurrentCheck)
          switch (result.kind) {
            case "blocked":
              setCurrentCheck(null)
              setBlocked(true)
              return
            case "rejected":
              setErrorCode(result.code)
              return
            case "generated":
              setRacePreview(null)
              setGate(result.gate)
              setGenerated(result.generated)
              setGeneratedIntake(result.intake)
              setGeneratedEvidence(result.athleteEvidence)
              setPrescriptionBinding(result.prescriptionBinding)
              return
            case "preview_only":
              setGenerated(null)
              setGate(null)
              setRacePreview(result)
              return
          }
        }}
        onContinue={() => generateCandidates(draft, null, targetRaceDate || undefined)}
      />
      {errorCode !== null && (
        <div className="plan-inline-error" role="alert">
          {planErrorMessage(errorCode)}
        </div>
      )}
    </>
  )
}
