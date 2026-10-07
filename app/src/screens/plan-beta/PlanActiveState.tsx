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
import { ActivePlanEditHub, type ActivePlanEditIntent } from "./ActivePlanEditHub"
import { ActivePlanSessionEditor } from "./ActivePlanSessionEditor"
import { ActivePlanRebuildEditor } from "./ActivePlanRebuildEditor"
import { loadEntriesForPlanSafety } from "../../domain/journal-store"
import { listPermittedActivePlanEditTargets } from "../../domain/active-plan-edit"
import { prepareCurrentActivePlanEdit, applyActivePlanEdit, type ActivePlanEditSelection } from "../../domain/active-plan-edit-store"
import { useEligibleAccountPaceRecords } from "../../hooks/useEligibleAccountPaceRecords"
import { areCatalogPaceSourcesCurrent } from "../../domain/account/eligible-account-pace-records"
import { LOCAL_JOURNALS_CHANGED } from "../../domain/journal-change-events"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { useLocalToday } from "../../hooks/useLocalToday"
import { accountPlansEnabled } from "../../domain/account/account-plan-service"
import { ensureAccountPlanHistory } from "../../domain/account/account-plan-domain"
import { loadVersionedPlanBetaState } from "../../domain/plan-beta-store"

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
  onManagePaceRecords,
  returnToSession,
}: {
  readonly state: PlanBetaState
  readonly cloudPersistence?: PlanCloudPersistenceState
  readonly onRetryCloudBackup?: () => void
  readonly celebrateOnMount?: boolean
  readonly onStateChange: (state: PlanBetaState) => void
  readonly onPrepareNextFrame: (predecessor: PlanBetaStateV3) => void
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly onManagePaceRecords?: () => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
}) {
  const [error, setError] = React.useState<string | null>(null)
  const { records } = useEligibleAccountPaceRecords()
  const [retry, setRetry] = React.useState<PersistenceRetry | null>(null)
  const [executionMessage, setExecutionMessage] = React.useState<string | null>(null)
  const [executionBlocked, setExecutionBlocked] = React.useState(false)
  const [editing, setEditing] = React.useState<ActivePlanEditIntent | "hub" | null>(null)
  const [editTarget, setEditTarget] = React.useState<{ day: number; slot: "AM" | "PM" } | undefined>()
  const editHeading = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    // A deferred screen may mount after its parent's view-change focus effect.
    const root = editHeading.current
    const active = document.activeElement
    const focusIsUnclaimed = active === null || active === document.body || active === document.documentElement
    if (root && focusIsUnclaimed && !root.closest("[hidden], [inert]")) {
      root.querySelector<HTMLElement>("#active-plan-title")?.focus({ preventScroll: true })
    }
  }, [])
  const [editContextRevision, refreshEditContext] = React.useReducer(value => value + 1, 0)
  const today = useLocalToday()
  const wasEditing = React.useRef(false)
  React.useLayoutEffect(() => {
    if (editing === null && wasEditing.current) editHeading.current?.querySelector<HTMLElement>("[data-plan-edit-button]")?.focus({ preventScroll: true })
    wasEditing.current = editing !== null
  }, [editing])
  React.useEffect(() => {
    const unsubscribe = onLocalJournalScopeChange(() => { setEditing(null); setEditTarget(undefined); refreshEditContext() })
    const events = [LOCAL_JOURNALS_CHANGED, "trainoracle:account-journals-changed", "storage", "focus"]
    events.forEach(event => window.addEventListener(event, refreshEditContext))
    return () => { unsubscribe(); events.forEach(event => window.removeEventListener(event, refreshEditContext)) }
  }, [])
  const closeEditor = () => { setEditing(null); setEditTarget(undefined) }
  const editApplied = (next: typeof state) => { closeEditor(); setExecutionMessage("계획을 수정했어요. 이전 계획과 일지는 남겨두었어요."); onStateChange(next) }
  const retryEditRead = async () => {
    const openingScope = localAccountScopeSnapshot()
    if (accountPlansEnabled() && !await ensureAccountPlanHistory()) return
    if (localAccountScopeSnapshot() !== openingScope) return
    const latest = loadVersionedPlanBetaState()
    if (latest) onStateChange(latest)
    refreshEditContext()
  }
  const editRead = loadEntriesForPlanSafety()
  const editOptions = state.version === 3 && editRead.status === "complete"
    ? listPermittedActivePlanEditTargets({ state, entries: editRead.entries, today, noFixedFutureCommitments: true }) : []
  const editSelection: ActivePlanEditSelection | undefined = editTarget === undefined ? undefined : {
    source: editTarget, action: editOptions.find(option => option.address.day === editTarget.day && option.address.slot === editTarget.slot)?.actions.includes("DURATION") ? "DURATION" : "CATALOG",
    unstartedConfirmed: false, noFixedFutureCommitments: false,
  }

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
    <div ref={editHeading}>
      {editing === "new-plan" && state.version === 3 ? <ActivePlanRebuildEditor state={state} onCancel={closeEditor} onApplied={editApplied} onManageRecords={onManagePaceRecords} />
        : (editing === "workout" || editing === "schedule") && state.version === 3 ? <ActivePlanSessionEditor
          state={state} intent={editing} selection={editSelection} onClose={closeEditor} onApplied={editApplied}
          sourceOptions={editOptions} entriesReady={editRead.status === "complete"}
          contextKey={`${localAccountScopeSnapshot() ?? "guest"}:${editContextRevision}:${today}`}
          onRetryEntries={() => void retryEditRead()} onPrepare={selection => {
            if (selection.inputs && !areCatalogPaceSourcesCurrent(selection.inputs)) return Promise.resolve({
              kind: "blocked" as const, reasonCode: "INVALID_INPUT" as const, permittedTargets: [],
              message: "기준 기록이 바뀌었어요. 최신 기록을 다시 선택해 주세요.",
            })
            return prepareCurrentActivePlanEdit(selection)
          }} onApply={(proposal, confirmed) => {
            const changed = proposal.after.activePlan.sessions.find(session => session.day === proposal.source.day && session.slot === proposal.source.slot)
            const inputs = changed?.prescription.kind === "RPE_TIME_RANGE" ? changed.prescription.catalogWorkout?.inputs : undefined
            if (proposal.action === "CATALOG" && inputs && !areCatalogPaceSourcesCurrent(inputs)) return Promise.resolve({
              kind: "blocked" as const, message: "기준 기록이 바뀌었어요. 최신 기록을 다시 선택해 주세요.",
            })
            return applyActivePlanEdit(proposal, confirmed)
          }} records={records} />
        : <>
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
        saveNotice={error !== null ? <div className="plan-inline-error" role="alert">
          <p>{error}</p>
          {retry?.kind === "progress" && <button className="plan-text-action" type="button" onClick={retryPendingWrite}>
            진행 상태 다시 저장하기
          </button>}
        </div> : undefined}
        onEditPlan={state.version === 3 ? () => { setEditTarget(undefined); setEditing("hub") } : undefined}
        onManagePaceRecords={onManagePaceRecords}
        onEditSession={state.version === 3 ? session => { setEditTarget({ day: session.day, slot: session.slot }); setEditing("workout") } : undefined}
        futureTrainingEditor={editing === "hub" ? <ActivePlanEditHub onClose={closeEditor} onChoose={intent => setEditing(intent)}
          availability={{
            schedule: { available: state.version === 3, reason: "이전 형식의 계획은 원본을 그대로 보관해요." },
            workout: { available: state.version === 3, reason: "이전 형식의 계획은 원본을 그대로 보관해요." },
            remaining: { available: false, hidden: true },
            "new-plan": { available: state.version === 3, reason: "이전 형식의 계획은 먼저 보관해 주세요." },
          }} /> : undefined}
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
      </>}
    </div>
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
