import React from "react"
import { readMatchingPendingSuccessor } from "../../domain/plan-adaptation-store"
import { planErrorMessage } from "./plan-feedback"
import {
  readPlanBetaStateFromStorage,
  savePlanProgressWithLock,
} from "../../domain/plan-beta-store"
import {
  activateAcceptedNextFrameSuccessor,
  isPlanFrameCompletionEligible,
  type ActivateAcceptedSuccessorResult,
} from "../../domain/plan-successor-activation"
import { todayISO } from "../../domain/journal-store"
import type {
  PlanBetaState,
  PlanBetaStateV3,
  StoredPlanProgress,
} from "../../domain/plan-beta-store"
import { ActivePlan } from "./ActivePlan"
import { ActiveCatalogWorkoutPicker } from "./ActiveCatalogWorkoutPicker"
import { OraclePlanReviewButton } from "../../components/OraclePlanReviewButton"
import { evaluatePlanSafety, type PlanCurrentCheck } from "../../domain/plan-beta-flow"
import {
  recheckStoredDetailedPrescriptionAuthority,
  type StoredPaceTargetPrescription,
} from "../../domain/plan-session-schema"
import {
  createPlannedSessionLogDraft,
  type PlannedSessionLogDraft,
} from "../../domain/planned-session-link"
import type { PlanSession } from "@impl/plan-generator/types"
import type { PlanCloudPersistenceState } from "../../domain/account/plan-cloud-backup"

type PersistenceRetry =
  | { readonly kind: "progress"; readonly progress: StoredPlanProgress }
  | { readonly kind: "activate"; readonly currentCheck: PlanCurrentCheck }

export function PlanActiveState({
  state,
  cloudPersistence = "DEVICE_ONLY",
  onRetryCloudBackup,
  celebrateOnMount = false,
  onStateChange,
  onPrepareNextFrame,
  onWritePlannedSessionLog,
  returnToSession,
}: {
  readonly state: PlanBetaState
  readonly cloudPersistence?: PlanCloudPersistenceState
  readonly onRetryCloudBackup?: () => void
  readonly celebrateOnMount?: boolean
  readonly onStateChange: (state: PlanBetaState) => void
  readonly onPrepareNextFrame: (predecessor: PlanBetaStateV3) => void
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
}) {
  const [error, setError] = React.useState<string | null>(null)
  const [retry, setRetry] = React.useState<PersistenceRetry | null>(null)
  const [executionMessage, setExecutionMessage] = React.useState<string | null>(null)
  const [executionBlocked, setExecutionBlocked] = React.useState(false)

  const saveProgress = async (progress: StoredPlanProgress) => {
    setExecutionMessage(null)
    if (state.version !== 3) {
      setError("이전 계획은 내용만 확인할 수 있어요. 새 계획을 만들어 진행을 기록해 주세요.")
      return
    }
    const result = await savePlanProgressWithLock(state.activePlan.candidateId, progress)
    if (result.kind === "failed") {
      setError(result.rollbackComplete
        ? "계획을 이 기기에 저장하지 못했어요. 화면은 바뀌지 않았고 다시 시도할 수 있어요."
        : "진행 기록 저장을 되돌렸는지 확인할 수 없어요. 이 화면을 새로 열어 현재 계획을 확인해 주세요.")
      setRetry(result.rollbackComplete ? { kind: "progress", progress } : null)
      return
    }
    if (result.kind === "rejected") {
      setError(result.code === "PLAN_STORAGE_STATE_UNCERTAIN"
        ? "이 기기의 계획 저장 상태를 확인할 수 없어요. 이 화면을 새로 열어 현재 계획을 확인해 주세요."
        : result.code === "INVALID_STORED_PLAN"
          ? "저장된 계획을 읽을 수 없어요. 이 화면을 새로 열어 계획 상태를 확인해 주세요."
          : result.code === "MUTATION_LOCK_UNAVAILABLE"
            ? "다른 계획 변경 작업이 진행 중이거나 안전한 저장 잠금을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요."
            : result.code === "STALE_BASE"
              ? "다른 화면에서 계획이 바뀌었어요. 현재 계획을 다시 연 뒤 진행을 기록해 주세요."
              : "현재 계획에서 이 훈련을 찾을 수 없어 진행을 저장하지 않았어요.")
      setRetry(result.code === "MUTATION_LOCK_UNAVAILABLE" ? { kind: "progress", progress } : null)
      return
    }
    setError(null)
    setRetry(null)
    onStateChange(result.state)
  }

  const startNextFrame = () => {
    setExecutionMessage(null)
    const current = readPlanBetaStateFromStorage()
    setRetry(null)
    if (current.kind !== "loaded" || current.state.version !== 3
        || JSON.stringify(current.state) !== JSON.stringify(state)) {
      setError("현재 계획이 바뀌었거나 읽을 수 없어요. 계획을 다시 연 뒤 계속해 주세요.")
      return
    }
    if (!isPlanFrameCompletionEligible(current.state, todayISO())
        || current.state.progress.some(progress => progress.state === "PAIN_CHECKIN")) {
      setError("현재 훈련 기록과 몸 상태를 먼저 확인해 주세요. 계획은 그대로 두었어요.")
      return
    }
    if (current.state.activePlan.selectionActor !== "SELF") {
      setError("이 계획은 지도자가 선택한 계획이에요. 연결된 지도자와 다음 계획을 확인해 주세요.")
      return
    }
    try {
      if (readMatchingPendingSuccessor(current.state) !== null) {
        setError("이미 선택한 다음 계획이 있어요. 이번 주기 기록을 다시 열어 확인해 주세요.")
        return
      }
    } catch {
      setError("선택해 둔 다음 계획을 확인하지 못했어요. 현재 계획은 그대로예요. 다시 열어 확인해 주세요.")
      return
    }
    setError(null)
    onPrepareNextFrame(current.state)
  }

  const activateNextFrame = async (nextCurrentCheck: PlanCurrentCheck) => {
    setExecutionMessage(null)
    const now = new Date()
    const result = await activateAcceptedNextFrameSuccessor({
      currentCheck: nextCurrentCheck,
      activatedAt: now.toISOString(),
      localDate: todayISO(now),
    })
    if (result.kind === "activated" || result.kind === "already_consumed") {
      setError(null)
      setRetry(null)
      setExecutionMessage(result.kind === "activated"
        ? "선택한 다음 계획을 시작했어요. 이전 계획은 이 기기의 계획 이력에 보관했어요."
        : "이미 시작된 다음 계획을 그대로 보여드려요.")
      onStateChange(result.state)
      return
    }
    if (result.kind === "blocked") {
      setRetry(null)
      setError(result.code === "INCOMPLETE_FRAME"
        ? "현재 화면에 보이는 훈련을 먼저 기록해 주세요. 다음 계획은 시작하지 않았어요."
        : "지금 몸 상태나 통증 기록을 먼저 확인해야 해요. 다음 계획은 시작하지 않았어요.")
      return
    }
    if (result.kind === "failed") {
      setError(result.rollbackComplete
        ? "다음 계획을 저장하지 못했지만 이전 계획과 선택 내용은 그대로예요. 다시 시도할 수 있어요."
        : "다음 계획 저장 상태를 확인하지 못했어요. 이 화면에서 계획을 다시 확인해 주세요.")
      setRetry(result.rollbackComplete ? { kind: "activate", currentCheck: nextCurrentCheck } : null)
      return
    }
    setRetry(null)
    setError(successorRejectionMessage(result.code))
  }

  const retryPendingWrite = () => {
    if (retry === null) return
    switch (retry.kind) {
      case "progress":
        void saveProgress(retry.progress)
        return
      case "activate":
        void activateNextFrame(retry.currentCheck)
        return
    }
  }

  const writePlannedSessionLog = (session: PlanSession) => {
    const draft = createPlannedSessionLogDraft(state, session, new Date().toISOString())
    if (draft === null) {
      setError("이 훈련의 계획 연결 정보를 확인할 수 없어 일지 화면을 열지 않았어요.")
      return
    }
    setError(null)
    onWritePlannedSessionLog?.(draft)
  }

  const checkDetailedExecution = (
    prescription: StoredPaceTargetPrescription,
    operation: "START" | "RESTART",
    currentCheck: PlanCurrentCheck,
  ) => {
    const evaluatedAt = new Date()
    const safety = evaluatePlanSafety(currentCheck, evaluatedAt)
    if (safety.kind === "blocked") {
      setExecutionBlocked(true)
      setExecutionMessage("지금은 상세 세션을 시작하지 않아요. 몸 상태를 먼저 직접 확인해 주세요.")
      return
    }
    const authority = recheckStoredDetailedPrescriptionAuthority({
      operation,
      prescription,
      evaluatedAt: evaluatedAt.toISOString(),
      safetyGate: safety.gate,
    })
    setExecutionBlocked(authority.kind !== "permitted")
    setExecutionMessage(authority.kind === "permitted"
      ? `현재 안전 상태와 승인 상태를 다시 확인했어요. ${operation === "START" ? "시작" : "다시 시작"}할 수 있어요. 의료 판단은 아닙니다.`
      : "현재 승인 상태에서 상세 세션을 시작하지 않아요. 저장된 계획은 그대로 유지됩니다.")
  }

  return (
    <>
      <ActivePlan
        state={state}
        cloudPersistence={cloudPersistence}
        onRetryCloudBackup={onRetryCloudBackup}
        showCreatedCelebration={celebrateOnMount}
        onProgress={saveProgress}
        onNextFrame={() => void startNextFrame()}
        onActivateNextFrame={(nextCurrentCheck) => void activateNextFrame(nextCurrentCheck)}
        onCheckDetailedExecution={checkDetailedExecution}
        onWriteSessionLog={onWritePlannedSessionLog === undefined ? undefined : writePlannedSessionLog}
        returnToSession={returnToSession}
        executionMessage={executionMessage}
        executionBlocked={executionBlocked}
        futureTrainingEditor={state.version === 3 ? <ActiveCatalogWorkoutPicker key={state.activePlan.candidateId}
          state={state} onApplied={next => {
            setError(null); setRetry(null); setExecutionBlocked(false)
            setExecutionMessage("선택한 훈련으로 바꿨어요. 이전 계획과 일지는 그대로 보관했어요.")
            onStateChange(next)
          }} /> : null}
      />
      {error !== null && (
        <div className="plan-inline-error" role="alert">{error}</div>
      )}
      <OraclePlanReviewButton />
      {retry !== null && (
        <button className="plan-text-action" type="button" onClick={retryPendingWrite}>
          {retry.kind === "progress"
            ? "진행 상태 다시 저장하기"
            : "선택한 다음 계획 다시 시작하기"}
        </button>
      )}
    </>
  )
}

type SuccessorRejectionCode = Extract<
  ActivateAcceptedSuccessorResult,
  { readonly kind: "rejected" }
>["code"]

function successorRejectionMessage(code: SuccessorRejectionCode): string {
  switch (code) {
    case "NO_PENDING_SUCCESSOR":
      return "먼저 위에서 다음 계획안을 골라 주세요. 현재 계획은 그대로예요."
    case "MUTATION_LOCK_UNAVAILABLE":
      return "이 브라우저에서는 안전한 계획 전환 잠금을 사용할 수 없어요. 현재 계획은 그대로예요."
    case "STALE_BASE":
      return "계획안을 고른 뒤 현재 계획이 바뀌었어요. 지금 기록을 기준으로 다음 계획을 다시 골라 주세요."
    case "CONTEXT_MISMATCH":
      return "현재 계획의 두 계획안 정보를 확인할 수 없어요. 현재 계획은 그대로이며 새 계획을 다시 만들어야 해요."
    case "PENDING_ENVELOPE_MISMATCH":
      return "선택해 둔 다음 계획이 현재 계획과 일치하지 않아요. 현재 기록을 기준으로 다음 계획을 다시 골라 주세요."
    case "TEMPLATE_AUTHORITY_UNAVAILABLE":
      return "상세 훈련표의 현재 승인 상태를 확인할 수 없어 다음 계획을 시작하지 않았어요."
    case "TRANSFORM_UNAVAILABLE":
      return "선택한 조정 규칙의 현재 승인 상태를 확인할 수 없어 다음 계획을 시작하지 않았어요."
    case "RECORD_SNAPSHOT_MISMATCH":
      return "다음 계획에 연결된 경기 기록이 바뀌었거나 없어졌어요. 현재 기록을 확인하고 다시 골라 주세요."
    case "RECEIPT_MISMATCH":
      return "이미 시작한 다음 계획의 확인 기록이 현재 계획과 맞지 않아요. 계획 내용을 다시 확인해 주세요."
    case "MALFORMED_INPUT":
      return "저장된 다음 계획 정보가 손상되어 시작하지 않았어요. 현재 계획은 그대로예요."
    default:
      return planErrorMessage(code)
  }
}
