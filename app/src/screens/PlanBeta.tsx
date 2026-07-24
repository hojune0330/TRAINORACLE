import React from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { recordPlanProgress } from "@impl/plan-generator/generator"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { SafetyGateDecision } from "@impl/safety-gate/gate"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "../domain/plan-beta-flow"
import {
  archiveAndClearActivePlan,
  loadPlanBetaState,
  loadPreviousIntake,
  savePlanBetaState,
  updateStoredProgress,
} from "../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../domain/plan-beta-store"
import type { JournalEntryType } from "./log-entry/shared"
import { ActivePlan } from "./plan-beta/ActivePlan"
import { PlanCandidates } from "./plan-beta/PlanCandidates"
import { PlanIntake } from "./plan-beta/PlanIntake"
import type { IntakeStep } from "./plan-beta/PlanIntake"

const STEP_ORDER: readonly IntakeStep[] = [
  "goal",
  "experience",
  "days",
  "frame",
  "safety",
]

export function PlanBeta({
  onWriteLog,
}: {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
}) {
  const [stored, setStored] = React.useState<PlanBetaState | null>(
    () => loadPlanBetaState(),
  )
  const previousIntake = React.useState(() => loadPreviousIntake())[0]
  const [draft, setDraft] = React.useState<Partial<PlanBetaIntake>>(
    previousIntake ?? {},
  )
  const [step, setStep] = React.useState<IntakeStep>(
    previousIntake === null ? "goal" : "safety",
  )
  const [generated, setGenerated] = React.useState<PlanGenerationSuccess | null>(
    null,
  )
  const [generatedIntake, setGeneratedIntake] =
    React.useState<PlanBetaIntake | null>(null)
  const [gate, setGate] = React.useState<SafetyGateDecision | null>(null)
  const [blocked, setBlocked] = React.useState(false)
  const [errorCode, setErrorCode] = React.useState<string | null>(null)

  if (stored !== null) {
    return (
      <ActivePlan
        state={stored}
        onProgress={(progress) => {
          const result = recordPlanProgress({
            kind: "PLAN_BETA_PROGRESS_REQUEST",
            activePlan: stored.activePlan,
            sessionDay: progress.sessionDay,
            state: progress.state,
          })
          if (result.kind !== "recorded") return
          const next = updateStoredProgress(stored, progress)
          savePlanBetaState(next)
          setStored(next)
        }}
        onNextFrame={() => {
          const intake = archiveAndClearActivePlan(stored)
          setStored(null)
          setDraft(intake)
          setGenerated(null)
          setGate(null)
          setBlocked(false)
          setStep("safety")
        }}
      />
    )
  }

  if (blocked) {
    return (
      <section className="plan-blocked" aria-labelledby="plan-blocked-title">
        <AlertTriangle aria-hidden="true" size={28} />
        <div className="plan-eyebrow">PLAN NOT GENERATED</div>
        <h1 id="plan-blocked-title">지금은 계획을 멈췄어요</h1>
        <p>
          몸 상태는 사람의 확인이 필요해요.
          <br />
          확인 전에는 계획을 만들지 않아요.
        </p>
        <button type="button" onClick={() => onWriteLog?.("evening")}>
          통증·컨디션 기록하기
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

  if (generated !== null && gate !== null) {
    return (
      <PlanCandidates
        generated={generated}
        onBack={() => {
          setGenerated(null)
          setGate(null)
          setStep("frame")
        }}
        onSelect={(candidate) => {
          selectAndStore(
            candidate,
            generated,
            gate,
            generatedIntake,
            setStored,
            setErrorCode,
          )
        }}
      />
    )
  }

  return (
    <>
      <PlanIntake
        step={step}
        draft={draft}
        onBack={() => setStep(previousStep(step))}
        onGoal={(eventGroup) => {
          setDraft((current) => ({ ...current, eventGroup }))
          setStep("experience")
        }}
        onExperience={(experienceBand) => {
          setDraft((current) => ({ ...current, experienceBand }))
          setStep("days")
        }}
        onDays={(availableDayCount) => {
          setDraft((current) => ({ ...current, availableDayCount }))
          setStep("frame")
        }}
        onFrame={(requestedFrameLength) => {
          setDraft((current) => ({ ...current, requestedFrameLength }))
          setStep("safety")
        }}
        onSafety={(currentCheck) => {
          const result = generatePlanFromDraft(draft, currentCheck)
          if (result.kind === "blocked") {
            setErrorCode(null)
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
      />
      {errorCode !== null && (
        <div className="plan-inline-error" role="alert">
          계획을 만들지 못했어요 · {errorCode}
        </div>
      )}
    </>
  )
}

function previousStep(step: IntakeStep): IntakeStep {
  const index = STEP_ORDER.indexOf(step)
  return index <= 0 ? "goal" : STEP_ORDER[index - 1] ?? "goal"
}

function selectAndStore(
  candidate: Parameters<typeof selectPlanForActivation>[0],
  generated: PlanGenerationSuccess,
  gate: SafetyGateDecision,
  intake: PlanBetaIntake | null,
  setStored: React.Dispatch<React.SetStateAction<PlanBetaState | null>>,
  setErrorCode: React.Dispatch<React.SetStateAction<string | null>>,
): void {
  if (intake === null) {
    setErrorCode("MINIMUM_PROFILE_INCOMPLETE")
    return
  }
  const result = selectPlanForActivation(candidate, generated, gate, intake)
  if (result.kind !== "selected") {
    setErrorCode(result.code)
    return
  }
  savePlanBetaState(result.state)
  setStored(result.state)
}
