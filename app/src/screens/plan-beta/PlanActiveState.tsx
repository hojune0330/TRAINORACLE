import React from "react"
import { recordPlanProgress } from "@impl/plan-generator/generator"
import {
  archiveAndClearActivePlan,
  savePlanBetaState,
  updateStoredProgress,
} from "../../domain/plan-beta-store"
import type {
  PlanBetaState,
  StoredPlanBetaIntake,
  StoredPlanProgress,
} from "../../domain/plan-beta-store"
import { ActivePlan } from "./ActivePlan"
import { evaluatePlanSafety, type PlanCurrentCheck } from "../../domain/plan-beta-flow"
import {
  recheckStoredDetailedPrescriptionAuthority,
  type StoredPaceTargetPrescription,
} from "../../domain/plan-session-schema"

type PersistenceRetry =
  | { readonly kind: "progress"; readonly progress: StoredPlanProgress }
  | { readonly kind: "next-frame" }

export function PlanActiveState({
  state,
  onStateChange,
  onArchived,
}: {
  readonly state: PlanBetaState
  readonly onStateChange: (state: PlanBetaState) => void
  readonly onArchived: (intake: StoredPlanBetaIntake) => void
}) {
  const [error, setError] = React.useState<string | null>(null)
  const [retry, setRetry] = React.useState<PersistenceRetry | null>(null)
  const [executionMessage, setExecutionMessage] = React.useState<string | null>(null)

  const saveProgress = (progress: StoredPlanProgress) => {
    const result = recordPlanProgress({
      kind: "PLAN_BETA_PROGRESS_REQUEST",
      activePlan: state.activePlan,
      sessionDay: progress.sessionDay,
      sessionSlot: progress.sessionSlot,
      state: progress.state,
    })
    if (result.kind !== "recorded") return
    const next = updateStoredProgress(state, progress)
    const saveResult = savePlanBetaState(next)
    if (!saveResult.ok) {
      setError("계획을 이 기기에 저장하지 못했어요. 화면은 바뀌지 않았고 다시 시도할 수 있어요.")
      setRetry({ kind: "progress", progress })
      return
    }
    setError(null)
    setRetry(null)
    onStateChange(next)
  }

  const startNextFrame = () => {
    const result = archiveAndClearActivePlan(state)
    if (!result.ok) {
      setError(result.rollbackComplete
        ? "다음 주기로 넘기지 못했어요. 지금 계획과 진행 기록은 그대로 두었어요."
        : "다음 주기로 넘기지 못했고 저장 상태도 확인하지 못했어요. 이 화면에서 계획을 다시 확인해 주세요.")
      setRetry(result.rollbackComplete ? { kind: "next-frame" } : null)
      return
    }
    setError(null)
    setRetry(null)
    onArchived(result.intake)
  }

  const retryPendingWrite = () => {
    if (retry === null) return
    switch (retry.kind) {
      case "progress":
        saveProgress(retry.progress)
        return
      case "next-frame":
        startNextFrame()
        return
    }
  }

  const checkDetailedExecution = (
    prescription: StoredPaceTargetPrescription,
    operation: "START" | "RESTART",
    currentCheck: PlanCurrentCheck,
  ) => {
    const evaluatedAt = new Date()
    const safety = evaluatePlanSafety(currentCheck, evaluatedAt)
    if (safety.kind === "blocked") {
      setExecutionMessage("지금은 상세 세션을 시작하지 않아요. 몸 상태를 먼저 직접 확인해 주세요.")
      return
    }
    const authority = recheckStoredDetailedPrescriptionAuthority({
      operation,
      prescription,
      evaluatedAt: evaluatedAt.toISOString(),
      safetyGate: safety.gate,
    })
    setExecutionMessage(authority.kind === "permitted"
      ? `현재 안전 상태와 승인 상태를 다시 확인했어요. ${operation === "START" ? "시작" : "다시 시작"}할 수 있어요. 의료 판단은 아닙니다.`
      : "현재 승인 상태에서 상세 세션을 시작하지 않아요. 저장된 계획은 그대로 유지됩니다.")
  }

  return (
    <>
      <ActivePlan
        state={state}
        onProgress={saveProgress}
        onNextFrame={startNextFrame}
        onCheckDetailedExecution={checkDetailedExecution}
      />
      {executionMessage !== null && (
        <div className="plan-execution-status" role="status">{executionMessage}</div>
      )}
      {error !== null && (
        <div className="plan-inline-error" role="alert">{error}</div>
      )}
      {retry !== null && (
        <button className="plan-text-action" type="button" onClick={retryPendingWrite}>
          {retry.kind === "progress" ? "진행 상태 다시 저장하기" : "다음 주기 다시 만들기"}
        </button>
      )}
    </>
  )
}
