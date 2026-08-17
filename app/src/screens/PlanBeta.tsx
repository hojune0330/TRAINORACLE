import React from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
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
} from "../domain/plan-beta-flow"
import {
  loadPlanBetaState,
  loadPreviousIntake,
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
import {
  saveSelectedPlanCandidate,
} from "./plan-beta/plan-selection"
import type { CandidateSelection } from "./plan-beta/plan-selection"
import { planErrorMessage } from "./plan-beta/plan-feedback"
import { loadAthleteRecords } from "../domain/athlete-records"
import type { CandidatePrescriptionBinding } from "../domain/plan-candidate-prescription"
import {
  divisionForGoal,
  firstUnansweredRefinement,
  previousIntakeStep,
} from "./plan-beta/plan-intake-navigation"

export function PlanBeta({
  onWriteLog,
  onManageRecords,
}: {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onManageRecords?: () => void
}) {
  const [stored, setStored] = React.useState<PlanBetaState | null>(
    () => loadPlanBetaState(),
  )
  const previousIntake = React.useState(() => loadPreviousIntake())[0]
  const [draft, setDraft] = React.useState<Partial<PlanBetaIntake>>(
    previousIntake ?? {},
  )
  const [step, setStep] = React.useState<IntakeStep>(
    previousIntake === null
      ? "goal"
      : previousIntake.competitionDivision === undefined
        && previousIntake.eventGroup !== "GENERAL_ENDURANCE"
        ? "division"
        : "safety",
  )
  const [generated, setGenerated] = React.useState<PlanGenerationSuccess | null>(
    null,
  )
  const [generatedIntake, setGeneratedIntake] =
    React.useState<PlanBetaIntake | null>(null)
  const [gate, setGate] = React.useState<SafetyGateDecision | null>(null)
  const [generatedEvidence, setGeneratedEvidence] = React.useState<PlanAthleteEvidence | null>(null)
  const [blocked, setBlocked] = React.useState(false)
  const [currentCheck, setCurrentCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const [retrySelection, setRetrySelection] = React.useState<CandidateSelection | null>(null)
  const [notationReaderOpen, setNotationReaderOpen] = React.useState(false)
  const [athleteRecords] = React.useState(() => loadAthleteRecords())
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  const [comparisonRecordId, setComparisonRecordId] = React.useState<string | null>(null)
  const [recordConfirmationPending, setRecordConfirmationPending] = React.useState(false)
  const [prescriptionBinding, setPrescriptionBinding] = React.useState<
    Omit<CandidatePrescriptionBinding, "generated">
  >({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" })
  const viewKey = notationReaderOpen
    ? "notation-reader"
    : stored !== null
    ? "active"
    : blocked
      ? "blocked"
      : generated !== null && gate !== null
        ? "candidates"
        : `intake-${step}`

  React.useLayoutEffect(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    if (scrollRegion !== null) scrollRegion.scrollTop = 0
  }, [viewKey])

  const generateCandidates = (
    nextDraft: Partial<PlanBetaIntake>,
    recordId: string | null = null,
  ) => {
    if (currentCheck === null) {
      setErrorCode(null)
      setStep("safety")
      return
    }
    const result = generatePlanFromDraft(
      nextDraft,
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
        setErrorCode(null)
        setGate(result.gate)
        setGenerated(result.generated)
        setGeneratedIntake(result.intake)
        setGeneratedEvidence(result.athleteEvidence)
        setPrescriptionBinding(result.prescriptionBinding)
        return
    }
  }

  const continueAfterRefinement = (nextDraft: Partial<PlanBetaIntake>) => {
    setDraft(nextDraft)
    const nextRefinement = firstUnansweredRefinement(nextDraft)
    if (nextRefinement !== null) {
      setStep(nextRefinement)
      return
    }
    generateCandidates(nextDraft)
  }

  const selectRecord = (recordId: string) => {
    if (recordId === selectedRecordId) return
    setSelectedRecordId(recordId)
    setComparisonRecordId(null)
    setRecordConfirmationPending(true)
    if (generatedIntake !== null) generateCandidates(generatedIntake)
  }

  const saveCandidate = (
    selection: CandidateSelection,
    activeGenerated: PlanGenerationSuccess,
  ) => {
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
    const result = saveSelectedPlanCandidate(
      selection,
      activeGenerated,
      safety.gate,
      generatedIntake,
      generatedEvidence,
    )
    switch (result.kind) {
      case "saved":
        setErrorCode(null)
        setRetrySelection(null)
        setStored(result.state)
        return
      case "rejected":
        setErrorCode(result.code)
        setRetrySelection(result.code === "PLAN_STORAGE_WRITE_FAILED" ? selection : null)
        return
    }
  }

  if (notationReaderOpen) {
    return <NotationReader onBack={() => setNotationReaderOpen(false)} />
  }

  if (stored !== null) {
    return (
      <PlanActiveState
        state={stored}
        onStateChange={setStored}
        onArchived={(intake) => {
          setStored(null)
          setDraft(intake)
          setGenerated(null)
          setGate(null)
          setBlocked(false)
          setCurrentCheck(null)
          setStep(
            intake.competitionDivision === undefined
              && intake.eventGroup !== "GENERAL_ENDURANCE"
              ? "division"
              : "safety",
          )
        }}
      />
    )
  }

  if (blocked) {
    return (
      <section className="plan-blocked" aria-labelledby="plan-blocked-title">
        <AlertTriangle aria-hidden="true" size={28} />
        <div className="plan-eyebrow">계획을 만들 수 없음</div>
        <h1 id="plan-blocked-title">지금은 계획을 멈췄어요</h1>
        <p>
          이 앱은 사람에게 자동으로 연결하거나 몸 상태를 확인할 수 없어요.
          <br />
          계획을 만들지 말고 지도자·보호자 또는 의료진과 직접 상의해 주세요.
        </p>
        <button type="button" onClick={() => onWriteLog?.("evening")}>
          지도자와 상의한 내용을 일지에 남기기
        </button>
        <button
          className="plan-text-action"
          type="button"
          onClick={() => {
            setBlocked(false)
            setStep("safety")
          }}
        >
          <RotateCcw aria-hidden="true" size={16} />
          다시 확인하기
        </button>
      </section>
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
          onSelectRecord={selectRecord}
          onCompareRecord={setComparisonRecordId}
          onConfirmRecord={() => {
            if (selectedRecordId !== null) {
              setRecordConfirmationPending(false)
              generateCandidates(generatedIntake, selectedRecordId)
            }
          }}
          onBack={() => {
            setGenerated(null)
            setGate(null)
            setErrorCode(null)
            setRetrySelection(null)
            setSelectedRecordId(null)
            setComparisonRecordId(null)
            setRecordConfirmationPending(false)
            setStep("two-a-day")
          }}
          onSelect={(selection) => {
            saveCandidate(selection, generated)
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
              saveCandidate(retrySelection, generated)
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
        step={step}
        draft={draft}
        onBack={() => setStep(previousIntakeStep(step, draft.eventGroup))}
        onJump={(target) => setStep(target)}
        onGoal={(eventGroup) => {
          const competitionDivision = divisionForGoal(eventGroup)
          setDraft((current) => competitionDivision === undefined
            ? { ...current, eventGroup, competitionDivision: undefined }
            : { ...current, eventGroup, competitionDivision })
          setStep(competitionDivision === undefined ? "division" : "experience")
        }}
        onDivision={(competitionDivision) => {
          setDraft((current) => ({ ...current, competitionDivision }))
          setStep(draft.experienceBand === undefined ? "experience" : "safety")
        }}
        onExperience={(experienceBand) => {
          setDraft((current) => ({ ...current, experienceBand }))
          setStep("safety")
        }}
        onFocus={(trainingFocus) => continueAfterRefinement({ ...draft, trainingFocus })}
        onDays={(availableDayCount) => continueAfterRefinement({ ...draft, availableDayCount })}
        onFrameLength={(requestedFrameLength) => continueAfterRefinement({ ...draft, requestedFrameLength })}
        onTrainingTime={(trainingTimePreference: TrainingTimePreference) => continueAfterRefinement({ ...draft, trainingTimePreference })}
        onSecondSession={(secondSessionMode) => continueAfterRefinement({ ...draft, secondSessionMode })}
        onManageRecords={() => onManageRecords?.()}
        onOpenNotationReader={() => setNotationReaderOpen(true)}
        onSafety={(nextCurrentCheck) => {
          if (
            draft.eventGroup !== undefined
            && divisionForGoal(draft.eventGroup) === undefined
            && draft.competitionDivision === undefined
          ) {
            setCurrentCheck(null)
            setStep("division")
            return
          }
          const safety = evaluatePlanSafety(nextCurrentCheck)
          if (safety.kind === "blocked") {
            setErrorCode(null)
            setCurrentCheck(null)
            setBlocked(true)
            return
          }
          setErrorCode(null)
          setCurrentCheck(nextCurrentCheck)
          setStep("preview")
        }}
        onContinue={() => {
          const nextRefinement = firstUnansweredRefinement(draft)
          if (nextRefinement !== null) {
            setStep(nextRefinement)
            return
          }
          generateCandidates(draft)
        }}
      />
      {errorCode !== null && (
        <div className="plan-inline-error" role="alert">
          {planErrorMessage(errorCode)}
        </div>
      )}
    </>
  )
}
