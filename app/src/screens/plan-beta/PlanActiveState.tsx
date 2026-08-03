import React from "react"
import { recordPlanProgress } from "@impl/plan-generator/generator"
import {
  archiveAndClearActivePlan,
  savePlanBetaState,
  updateStoredProgress,
} from "../../domain/plan-beta-store"
import type {
  PlanBetaIntake,
  PlanBetaState,
} from "../../domain/plan-beta-store"
import { ActivePlan } from "./ActivePlan"

export function PlanActiveState({
  state,
  onStateChange,
  onArchived,
}: {
  readonly state: PlanBetaState
  readonly onStateChange: (state: PlanBetaState) => void
  readonly onArchived: (intake: PlanBetaIntake) => void
}) {
  const [error, setError] = React.useState<string | null>(null)

  return (
    <>
      <ActivePlan
        state={state}
        onProgress={(progress) => {
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
            return
          }
          setError(null)
          onStateChange(next)
        }}
        onNextFrame={() => {
          const result = archiveAndClearActivePlan(state)
          if (!result.ok) {
            setError(result.rollbackComplete
              ? "다음 주기로 넘기지 못했어요. 지금 계획과 진행 기록은 그대로 두었어요."
              : "다음 주기로 넘기지 못했고 저장 상태도 확인하지 못했어요. 이 화면에서 계획을 다시 확인해 주세요.")
            return
          }
          setError(null)
          onArchived(result.intake)
        }}
      />
      {error !== null && (
        <div className="plan-inline-error" role="alert">{error}</div>
      )}
    </>
  )
}
