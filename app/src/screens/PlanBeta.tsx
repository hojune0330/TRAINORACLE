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
import type { PlanCurrentCheck } from "../domain/plan-beta-flow"
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
import {
  divisionForGoal,
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
      : previousIntake.competitionDivision === "NOT_PROVIDED"
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
  const [blocked, setBlocked] = React.useState(false)
  const [currentCheck, setCurrentCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)
  const [retrySelection, setRetrySelection] = React.useState<CandidateSelection | null>(null)
  const [notationReaderOpen, setNotationReaderOpen] = React.useState(false)
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

  const saveCandidate = (
    selection: CandidateSelection,
    activeGenerated: PlanGenerationSuccess,
    activeGate: SafetyGateDecision,
  ) => {
    const result = saveSelectedPlanCandidate(selection, activeGenerated, activeGate, generatedIntake)
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
          setStep("safety")
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

  if (generated !== null && gate !== null && generatedIntake !== null) {
    return (
      <>
        <PlanCandidates
          generated={generated}
          intake={generatedIntake}
          onBack={() => {
            setGenerated(null)
            setGate(null)
            setErrorCode(null)
            setRetrySelection(null)
            setStep("two-a-day")
          }}
          onSelect={(selection) => {
            saveCandidate(selection, generated, gate)
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
              saveCandidate(retrySelection, generated, gate)
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
            ? { ...current, eventGroup }
            : { ...current, eventGroup, competitionDivision })
          setStep(competitionDivision === undefined ? "division" : "experience")
        }}
        onDivision={(competitionDivision) => {
          setDraft((current) => ({ ...current, competitionDivision }))
          setStep(previousIntake === null ? "experience" : "safety")
        }}
        onExperience={(experienceBand) => {
          setDraft((current) => ({ ...current, experienceBand }))
          setStep("safety")
        }}
        onFocus={(trainingFocus) => {
          setDraft((current) => ({ ...current, trainingFocus }))
          setStep("days")
        }}
        onDays={(availableDayCount) => {
          setDraft((current) => ({ ...current, availableDayCount }))
          setStep("frame-length")
        }}
        onFrameLength={(requestedFrameLength) => {
          setDraft((current) => ({ ...current, requestedFrameLength }))
          setStep("training-time")
        }}
        onTrainingTime={(trainingTimePreference: TrainingTimePreference) => {
          setDraft((current) => ({ ...current, trainingTimePreference }))
          setStep("two-a-day")
        }}
        onSecondSession={(secondSessionMode) => {
          const nextDraft = { ...draft, secondSessionMode }
          setDraft(nextDraft)
          if (currentCheck === null) {
            setErrorCode(null)
            setStep("safety")
            return
          }
          const result = generatePlanFromDraft(nextDraft, currentCheck)
          if (result.kind === "blocked") {
            setErrorCode(null)
            setCurrentCheck(null)
            setBlocked(true)
            return
          }
          if (result.kind === "rejected") {
            setErrorCode(result.code)
            return
          }
          setErrorCode(null)
          setGate(result.gate)
          setGenerated(result.generated)
          setGeneratedIntake(result.intake)
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
          setStep("preview")
        }}
        onContinue={() => setStep("focus")}
      />
      {errorCode !== null && (
        <div className="plan-inline-error" role="alert">
          {planErrorMessage(errorCode)}
        </div>
      )}
    </>
  )
}
