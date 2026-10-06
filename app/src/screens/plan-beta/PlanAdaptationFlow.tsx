import React from "react"
import { ArrowLeft, SlidersHorizontal } from "lucide-react"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  recordPurposeLabel,
} from "../../domain/athlete-records"
import { useEligibleAccountPaceRecords } from "../../hooks/useEligibleAccountPaceRecords"
import { isEligiblePaceRecordCurrent } from "../../domain/account/eligible-account-pace-records"
import type { PlanBetaState } from "../../domain/plan-beta-store"
import { readArchivedOriginalPlans } from "../../domain/plan-beta-store"
import type { PlanJournalHistory } from "../../domain/plan-journal-evidence"
import type { PlanCurrentCheck } from "../../domain/plan-beta-flow"
import {
  acceptPreparedNextFrameAdaptation,
  eligiblePbSbRecords,
  evaluateActivePlanAdaptationSafety,
  loadMatchingPendingSuccessor,
  prepareNextFrameAdaptation,
} from "../../domain/plan-adaptation-ui"
import type {
  PreparedNextFrameAdaptation,
  PrepareNextFrameResult,
} from "../../domain/plan-adaptation-ui"
import type { AdaptationAcceptanceResult } from "../../domain/plan-adaptation-store"
import type { PendingNextFrameSuccessor } from "../../domain/plan-beta-schema"
import { PlanChoice } from "./PlanChoice"
import { PlanAdaptationResult, PlanAdaptationReview } from "./PlanAdaptationReview"
import { TermHelp } from "../../components/TermHelp"
import { loadEntries } from "../../domain/journal-store"
import { derivePlanCycleResponse } from "../../domain/plan-cycle-response"
import type { JournalEntry } from "../../domain/journal-schema"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { PlanCycleEvidence } from "./PlanCycleEvidence"
import { inspectNextFrameAdaptation } from "../../domain/plan-adaptation-availability"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "../../domain/account/local-account-scope"
import { usePlanEvidenceHistory } from "../../hooks/usePlanEvidenceHistory"
import { PlanEvidenceHistoryNotice } from "../../components/PlanEvidenceHistoryNotice"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { resolveCurrentCycleContext } from "../../domain/plan-current-cycle-context"
import { readOriginalPlanAdaptationContext } from "../../domain/plan-adaptation-ui-context"
import { isPlanFrameCompletionEligible } from "../../domain/plan-successor-activation"
import { todayISO } from "../../domain/journal-store"

type Step = "closed" | "reason" | "cycle" | "record" | "safety" | "choice" | "review" | "result" | "pending"
type Reason = "PB_SB" | "EXPLICIT_REQUEST"

type PlanAdaptationFlowProps = {
  readonly state: PlanBetaState
  readonly onPrepare?: typeof prepareNextFrameAdaptation
  readonly onAccept?: typeof acceptPreparedNextFrameAdaptation
  readonly onLoadRecords?: () => readonly AthleteRecord[]
  readonly onLoadPending?: typeof loadMatchingPendingSuccessor
  readonly onEvaluateSafety?: typeof evaluateActivePlanAdaptationSafety
  readonly onLoadEntries?: () => readonly JournalEntry[]
  readonly onLoadHistory?: () => PlanJournalHistory
  readonly onPendingChange?: (hasPending: boolean) => void
  readonly onPrepareNextFrame?: (() => void) | undefined
}

export function PlanAdaptationFlow({
  state,
  onPrepare = prepareNextFrameAdaptation,
  onAccept = acceptPreparedNextFrameAdaptation,
  onLoadRecords,
  onLoadPending = loadMatchingPendingSuccessor,
  onEvaluateSafety = evaluateActivePlanAdaptationSafety,
  onLoadEntries = loadEntries,
  onLoadHistory = readArchivedOriginalPlans,
  onPendingChange,
  onPrepareNextFrame,
}: PlanAdaptationFlowProps) {
  const [step, setStep] = React.useState<Step>("closed")
  const [reason, setReason] = React.useState<Reason | null>(null)
  const [record, setRecord] = React.useState<AthleteRecord | null>(null)
  const [currentCheck, setCurrentCheck] = React.useState<PlanCurrentCheck | null>(null)
  const [prepared, setPrepared] = React.useState<PreparedNextFrameAdaptation | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [pending, setPending] = React.useState<PendingNextFrameSuccessor | null>(null)
  const [pendingState, setPendingState] = React.useState<PlanBetaState | null>(null)
  const [pendingScope, setPendingScope] = React.useState<string | null | undefined>(undefined)
  const [pendingFailed, setPendingFailed] = React.useState(false)
  const [pendingRevision, setPendingRevision] = React.useState(0)
  const openAfterRead = React.useRef(false)
  const activeStepRef = React.useRef<HTMLDivElement>(null)
  const requestEpoch = React.useRef(0)
  const inFlight = React.useRef(false)
  const currentState = React.useRef(state)
  currentState.current = state
  const availability = inspectNextFrameAdaptation(state)
  const canRequest = availability.kind === "available" && availability.explicitRequest
  const canUseRecord = availability.kind === "available" && availability.pbSb
  const history = usePlanEvidenceHistory(step === "cycle", onLoadHistory)
  const pendingReady = pendingState === state && pendingScope === history.scope
  const matchingPending = pendingReady && !pendingFailed ? pending : null
  const { records: paceRecords, readRecords } = useEligibleAccountPaceRecords(onLoadRecords)
  const records = eligiblePbSbRecords(state, paceRecords)
  const recordCurrent = () => reason !== "PB_SB" || record !== null && isEligiblePaceRecordCurrent(record, readRecords())
  const currentContext = React.useMemo(() => resolveCurrentCycleContext(state, history.history, readOriginalPlanAdaptationContext), [state, history.history])
  const canPrepareOrdinary = currentContext.kind === "current" && currentContext.current.activePlan.selectionActor === "SELF"
    && isPlanFrameCompletionEligible(currentContext.current, todayISO())
    && !currentContext.current.progress.some(progress => progress.state === "PAIN_CHECKIN")
  const cycleResponse = React.useMemo(
    () => derivePlanCycleResponse(onLoadEntries(), state, history.history),
    [onLoadEntries, history.history, state, step],
  )
  useActiveContentScroll(step === "closed" ? null : step, activeStepRef)

  React.useEffect(() => {
    requestEpoch.current += 1
    inFlight.current = false
    setBusy(false)
    openAfterRead.current = false
    setStep("closed")
    setReason(null)
    setRecord(null)
    setCurrentCheck(null)
    setPrepared(null)
    setMessage(null)
    return () => { requestEpoch.current += 1 }
  }, [state, history.scope])

  React.useEffect(() => {
    let current = true
    const scope = localAccountScopeSnapshot()
    setPendingState(null)
    setPendingScope(undefined)
    setPendingFailed(false)
    const loadPending = async () => {
      try {
        const loaded = state.version === 3 ? await onLoadPending(state) : null
        if (!current || !localAccountScopeIsCurrent(scope)) return
        setPending(loaded)
        setPendingState(state)
        setPendingScope(scope)
        setPendingFailed(false)
        onPendingChange?.(loaded !== null)
        if (loaded !== null) setStep(previous => previous === "cycle" ? "pending" : previous)
        if (openAfterRead.current) {
          openAfterRead.current = false
          setStep(loaded !== null ? "pending" : inspectNextFrameAdaptation(state).kind === "available" ? "reason" : "cycle")
        }
      } catch {
        if (!current || !localAccountScopeIsCurrent(scope)) return
        setPending(null)
        setPendingState(state)
        setPendingScope(scope)
        setPendingFailed(true)
        if (openAfterRead.current) {
          openAfterRead.current = false
          setMessage("선택해 둔 다음 계획을 확인하지 못했어요. 현재 계획은 그대로예요. 다시 열어 확인해 주세요.")
          setStep("result")
        }
      }
    }
    void loadPending()
    return () => {
      current = false
    }
  }, [onLoadPending, onPendingChange, state, pendingRevision, history.scope, history.revision])

  const prepareOrdinary = async () => {
    if (!onPrepareNextFrame || !canPrepareOrdinary || inFlight.current || state.version !== 3) return
    const epoch = ++requestEpoch.current, scope = localAccountScopeSnapshot()
    inFlight.current = true
    setBusy(true)
    try {
      const loaded = await onLoadPending(state)
      if (epoch !== requestEpoch.current || currentState.current !== state || !localAccountScopeIsCurrent(scope)) return
      setPending(loaded); setPendingState(state); setPendingScope(scope); setPendingFailed(false)
      onPendingChange?.(loaded !== null)
      if (loaded !== null) setStep("pending")
      else onPrepareNextFrame()
    } catch {
      if (epoch === requestEpoch.current && currentState.current === state && localAccountScopeIsCurrent(scope)) {
        setPendingFailed(true)
        setMessage("선택해 둔 다음 계획을 확인하지 못했어요. 현재 계획은 그대로예요. 다시 열어 확인해 주세요.")
        setStep("result")
      }
    } finally {
      if (epoch === requestEpoch.current && currentState.current === state && localAccountScopeIsCurrent(scope)) {
        inFlight.current = false; setBusy(false)
      }
    }
  }

  const chooseReason = (nextReason: Reason) => {
    setReason(nextReason)
    setRecord(null)
    setMessage(null)
    setStep(nextReason === "PB_SB" ? "record" : "safety")
  }

  const prepareCandidate = async () => {
    if (reason === null || currentCheck === null || inFlight.current) return
    if (!recordCurrent()) { setMessage("기준 기록이 바뀌었어요. 최신 기록을 다시 선택해 주세요."); setStep("record"); return }
    const epoch = ++requestEpoch.current
    inFlight.current = true
    setBusy(true)
    try {
      const operationAt = new Date()
      const safety = onEvaluateSafety(state, currentCheck, operationAt)
      const result = await onPrepare({ state, reason, record, safety, operationAt: operationAt.toISOString() })
      if (epoch === requestEpoch.current && currentState.current === state && recordCurrent()) {
        handlePrepared(result, setPrepared, setMessage, setStep)
      }
    } catch {
      if (epoch === requestEpoch.current && currentState.current === state) {
        setMessage("다음 계획안을 불러오지 못했어요. 현재 계획은 그대로예요. 잠시 후 다시 확인해 주세요.")
        setStep("result")
      }
    } finally {
      if (epoch === requestEpoch.current && currentState.current === state) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  const accept = async () => {
    if (prepared === null || currentCheck === null || inFlight.current) return
    if (!recordCurrent()) { setMessage("기준 기록이 바뀌었어요. 최신 기록을 다시 선택해 주세요."); setStep("record"); return }
    if (state.version !== 3) {
      setMessage("이전 계획은 다음 계획 조정을 지원하지 않아요.")
      setStep("result")
      return
    }
    const epoch = ++requestEpoch.current
    inFlight.current = true
    setBusy(true)
    try {
      const operationAt = new Date()
      const safety = onEvaluateSafety(state, currentCheck, operationAt)
      const result = await onAccept({ prepared, predecessorState: state, safety, operationAt: operationAt.toISOString() })
      if (epoch !== requestEpoch.current || currentState.current !== state) return
      if (result.kind === "accepted") {
        setPendingState(state)
        onPendingChange?.(true)
      }
      handleAccepted(result, setPending, setMessage, setStep)
    } catch {
      if (epoch === requestEpoch.current && currentState.current === state) {
        setMessage("다음 계획안이 저장됐는지 확인하지 못했어요. 다시 열어 선택해 둔 계획이 있는지 확인해 주세요.")
        setStep("result")
      }
    } finally {
      if (epoch === requestEpoch.current && currentState.current === state) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  const reset = () => {
    requestEpoch.current += 1
    inFlight.current = false
    setBusy(false)
    openAfterRead.current = false
    setReason(null)
    setRecord(null)
    setCurrentCheck(null)
    setPrepared(null)
    setMessage(null)
    setStep("closed")
  }

  const entryLabel = matchingPending !== null ? "선택한 다음 계획 보기"
    : !canRequest && !canUseRecord ? "이번 주기 기록 확인" : "기록 확인·다음 계획 조정"

  return (
    <section className="plan-adaptation" aria-label="다음 계획 조정">
      <button
        className="plan-adaptation__entry"
        type="button"
        aria-label={entryLabel}
        aria-expanded={step !== "closed"}
        aria-busy={!pendingReady || busy}
        disabled={!pendingReady || busy}
        onClick={() => {
          if (step !== "closed") { reset(); return }
          openAfterRead.current = true
          setPendingState(null)
          setPendingRevision(value => value + 1)
        }}
      >
        <SlidersHorizontal aria-hidden="true" size={18} />
        <span>
          <strong>{entryLabel}</strong>
          <small>{matchingPending !== null ? "선택해 둔 다음 계획 확인"
            : availability.kind === "available" ? "현재 계획은 바꾸지 않고 다음 주기 계획안만 확인"
              : "현재 계획은 그대로 두고 수행 기록 확인"}</small>
        </span>
      </button>

      {step !== "closed" && (
        <div ref={activeStepRef} className="plan-adaptation__panel active-content-scroll-target" aria-live="polite">
          {step === "reason" && (
            <DecisionStep title={availability.kind === "available" ? "조정 이유를 선택해 주세요" : "이번 주기 기록 확인"} onBack={reset}>
              {availability.kind === "unavailable" && (
                <p className="plan-adaptation__notice" role="status">{unavailableMessage(availability.code)}</p>
              )}
              {canUseRecord && <p className="plan-adaptation__term-help">
                PB<TermHelp term="pb" /> · SB<TermHelp term="sb" /> 뜻 확인
              </p>}
              {canUseRecord && <PlanChoice
                title="최근 기록이 좋아졌어요"
                detail="계획 시작 뒤 달성한 같은 종목 PB 또는 SB를 확인해요."
                selected={false}
                onClick={() => chooseReason("PB_SB")}
              />}
              {canRequest && <PlanChoice
                title="다음 계획을 조정하고 싶어요"
                detail="다음 주기의 훈련량만 비교해요."
                selected={false}
                onClick={() => chooseReason("EXPLICIT_REQUEST")}
              />}
              <PlanChoice
                title="이번 주기 수행 기록을 볼래요"
                detail="계획과 기록한 힘든 정도를 비교해요."
                selected={false}
                onClick={() => setStep("cycle")}
              />
            </DecisionStep>
          )}

          {step === "cycle" && (
            <DecisionStep title="이번 주기 기록 요약" onBack={availability.kind === "available" ? () => setStep("reason") : reset}>
              {availability.kind === "unavailable" && (
                <p className="plan-adaptation__notice" role="status">{unavailableMessage(availability.code)}</p>
              )}
              {cycleResponse.historyReadIncomplete && <PlanEvidenceHistoryNotice status={history.status} onRetry={history.retry} />}
              {history.journalReadComplete ? <PlanCycleEvidence response={cycleResponse} />
                : <p role="status">일지를 아직 모두 불러오지 못했어요. 조회가 끝나면 비교가 나타나요.</p>}
              {availability.kind === "unavailable" && onPrepareNextFrame && canPrepareOrdinary && pendingReady && !pendingFailed && matchingPending === null && <PlanChoice
                title="다음 주기 계획 만들기"
                detail="연결된 수행 기록을 확인해 상세 훈련을 이어가요. 시작하기 전까지 현재 계획은 그대로예요."
                selected={false}
                disabled={busy}
                onClick={() => void prepareOrdinary()}
              />}
              {availability.kind === "unavailable" && currentContext.kind === "current" && <InfoDisclosure title="어떤 계획을 기준으로 하나요?">
                <p>{state.version === 3
                  ? "같은 종목·목적·주기 조건에서는 확인 가능한 상세 훈련을 이어가요. 같은 목적의 직접 기록 RPE가 반복해서 높으면, 검토된 짧은 구성으로 다음 계획안을 조정해요. 줄일 수 있는 구성이 없으면 그 이유를 알려드려요."
                  : "현재 화면의 계획과 수행 여부를 기준으로 다음 주기를 이어가요. 변경 이력이 있는 이 계획의 상세 훈련을 그대로 복사하거나 자동으로 줄이지는 않아요."}</p>
                <p>{currentContext.origin.kind === "unavailable"
                  ? "변경 전 계획을 모두 확인하지 못했어요. 지금 계획은 보존하며, 확인하지 못한 이전 구성은 새 계획의 근거로 사용하지 않아요."
                  : currentContext.origin.changeCount > 0
                    ? `이번 주기에 계획을 바꾼 기록 ${currentContext.origin.changeCount}건을 원래 계획까지 확인했어요.`
                    : "현재 주기의 계획을 확인했어요."}</p>
              </InfoDisclosure>}
              {history.journalReadComplete && cycleResponse.recommendation === "REDUCE_OR_REVIEW"
                && canRequest
                && state.activePlan.candidateKind === "BALANCED" && (
                <PlanChoice
                  title="훈련량을 줄인 계획안 확인"
                  detail="현재 계획은 그대로 두고 지금 제공할 수 있는 보수적인 다음 계획안만 비교해요."
                  selected={false}
                  onClick={() => chooseReason("EXPLICIT_REQUEST")}
                />
              )}
              {availability.kind === "available" && <PlanChoice
                title="현재 기준 유지"
                detail="새 계획안을 저장하지 않고 현재 계획과 다음 계획 기준을 유지해요. 다른 훈련법으로 자동 교체하지 않아요."
                selected={false}
                onClick={() => {
                  setMessage("현재 기준을 유지해요. 강도·양·횟수와 훈련법은 바꾸지 않았습니다.")
                  setStep("result")
                }}
              />}
            </DecisionStep>
          )}

          {step === "record" && (
            <DecisionStep title="새 기록을 확인해 주세요" onBack={() => setStep("reason")}>
              {records.length === 0 ? (
                <p className="plan-adaptation__notice" role="status">
                  계획 시작 뒤 달성한 같은 종목 PB 또는 SB가 아직 없어요. 현재 계획은 그대로 유지됩니다.
                </p>
              ) : records.map((item) => (
                <PlanChoice
                  key={item.id}
                  title={`${item.eventDistanceM}m · ${recordPurposeLabel(item.purpose)}`}
                  detail={`${item.achievedOn} 달성 · 이 기록을 조정 이유로 확인`}
                  selected={record?.id === item.id}
                  onClick={() => {
                    setRecord(item)
                    setStep("safety")
                  }}
                />
              ))}
            </DecisionStep>
          )}

          {step === "safety" && (
            <DecisionStep title="현재 몸 상태를 확인해 주세요" onBack={() => setStep(reason === "PB_SB" ? "record" : "reason")}>
              <PlanChoice
                title="통증은 없고 몸 상태는 평소와 같아요"
                detail="저장된 통증·안전 확인 상태와 현재 계획이 중지되어 있는지 함께 확인해요."
                selected={currentCheck === "NO_KNOWN_RISK"}
                onClick={() => {
                  setCurrentCheck("NO_KNOWN_RISK")
                  setStep("choice")
                }}
              />
              <PlanChoice
                title="통증·부상·몸 이상이 있거나 잘 모르겠어요"
                detail="다음 계획안을 만들지 않고 현재 계획을 그대로 유지해요."
                selected={currentCheck === "REVIEW_REQUIRED"}
                onClick={() => {
                  const operationAt = new Date()
                  setCurrentCheck("REVIEW_REQUIRED")
                  const safety = onEvaluateSafety(state, "REVIEW_REQUIRED", operationAt)
                  setMessage(safety.kind === "blocked"
                    ? "현재 안전 상태를 먼저 확인해야 해서 다음 계획안을 만들지 않았어요. 현재 계획은 그대로예요."
                    : "현재 계획은 그대로 유지돼요.")
                  setStep("result")
                }}
              />
            </DecisionStep>
          )}

          {step === "choice" && (
            <DecisionStep title="다음 계획의 기준을 선택해 주세요" onBack={() => {
              requestEpoch.current += 1
              inFlight.current = false
              setBusy(false)
              setStep("safety")
            }}>
              <PlanChoice
                disabled={busy}
                title={reason === "PB_SB"
                  ? "기록 갱신을 반영한 다음 계획안"
                  : state.activePlan.candidateKind === "BALANCED"
                    ? "훈련량을 조금 줄인 다음 계획"
                    : "기본 훈련량 범위로 돌아간 다음 계획"}
                detail={reason === "PB_SB"
                  ? "PB·SB 뒤에도 강도·양·횟수를 함께 올리지 않고 현재 제공할 수 있는 기존 계획안만 비교해요."
                  : state.activePlan.candidateKind === "BALANCED"
                    ? "현재 제공할 수 있는 보수적인 계획안이 있을 때만 바뀐 세션을 비교해요."
                    : "이전에 줄여 둔 쉬운 훈련 시간을 원래 계획안 범위로 되돌려 비교해요. 강도와 횟수는 올리지 않아요."}
                selected={false}
                onClick={() => void prepareCandidate()}
              />
              <PlanChoice
                disabled={busy}
                title="현재 계획과 같은 기준 유지"
                detail="새 계획안을 만들지 않고 현재 계획과 다음 계획 기준을 유지해요."
                selected={false}
                onClick={() => {
                  setMessage("같은 기준을 선택했어요. 새 계획안은 만들지 않았고 현재 계획도 그대로예요.")
                  setStep("result")
                }}
              />
              {busy && <p className="plan-adaptation__notice" role="status">다음 계획안을 확인하고 있어요.</p>}
            </DecisionStep>
          )}

          {step === "review" && prepared !== null && (
            <PlanAdaptationReview prepared={prepared} busy={busy} onAccept={() => void accept()} onBack={() => setStep("choice")} />
          )}

          {step === "result" && (
            <PlanAdaptationResult message={message ?? "다음 계획안을 만들지 못했어요. 현재 계획은 그대로예요."} onClose={reset} />
          )}

          {step === "pending" && matchingPending !== null && (
            <PlanAdaptationResult
              message="다음 주기에 사용할 계획안을 저장했어요. 현재 계획과 진행 기록은 그대로예요."
              onClose={reset}
            />
          )}
        </div>
      )}
    </section>
  )
}

function DecisionStep({
  title,
  onBack,
  children,
}: {
  readonly title: string
  readonly onBack: () => void
  readonly children: React.ReactNode
}) {
  return (
    <div className="plan-adaptation__step">
      <div className="plan-adaptation__step-head">
        <button className="plan-adaptation__back" type="button" aria-label="이전 단계" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h2>{title}</h2>
      </div>
      <div className="plan-choice-list">{children}</div>
    </div>
  )
}

function handlePrepared(
  result: PrepareNextFrameResult,
  setPrepared: React.Dispatch<React.SetStateAction<PreparedNextFrameAdaptation | null>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setStep: React.Dispatch<React.SetStateAction<Step>>,
) {
  if (result.kind === "ready") {
    setPrepared(result.prepared)
    setStep("review")
    return
  }
  setMessage(result.kind === "blocked"
    ? "현재 안전 상태를 다시 확인해야 해서 다음 계획안을 만들지 않았어요. 현재 계획은 그대로예요."
    : unavailableMessage(result.code))
  setStep("result")
}

function unavailableMessage(code: string): string {
  switch (code) {
    case "CHANGED_PLAN_TRANSFORM_UNAVAILABLE":
      return "바꾼 훈련을 반영한 다음 주기 조정은 아직 지원하지 않아요. 수행 기록은 확인할 수 있어요."
    case "CATALOG_TRANSFORM_UNAVAILABLE":
      return "상세 훈련은 연결된 수행 기록을 확인해 다음 주기로 이어가요. 자동으로 더 강하게 만들지는 않아요."
    case "COACH_CONNECTION_REQUIRED":
      return "이 계획은 지도자 확인이 필요해요. 인증된 지도자 연결이 없어 선수 화면에서는 선택할 수 없고 현재 계획은 그대로예요."
    case "ADAPTATION_CONTEXT_MISMATCH":
      return "저장된 비교안이 현재 계획과 달라 사용할 수 없어요. 현재 계획과 기록은 그대로예요."
    case "ADAPTATION_CONTEXT_UNAVAILABLE":
      return "비교할 다음 계획안을 불러오지 못했어요. 현재 계획과 수행 기록은 그대로예요."
    case "NO_REGISTERED_TRANSFORM":
      return "이 계획에서 제안할 수 있는 다음 주기 조정안이 아직 없어요. 현재 계획과 기록은 그대로예요."
    case "RECORD_NOT_ELIGIBLE":
      return "이 기록은 이번 조정의 기준으로 사용할 수 없어요. 계획 시작 뒤의 같은 종목 기록인지 확인해 주세요."
    default:
      return "현재 조건에 맞는 다음 계획안을 만들지 못했어요. 현재 계획과 기록은 그대로예요."
  }
}

function handleAccepted(
  result: AdaptationAcceptanceResult,
  setPending: React.Dispatch<React.SetStateAction<PendingNextFrameSuccessor | null>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setStep: React.Dispatch<React.SetStateAction<Step>>,
) {
  if (result.kind === "accepted") {
    setPending(result.pending)
    setStep("pending")
    return
  }
  setMessage(result.kind === "blocked"
    ? "안전 상태가 바뀌었거나 확인 시간이 지나 계획안을 저장하지 않았어요. 현재 계획은 그대로예요."
    : "다음 계획안을 저장하지 못했어요. 현재 계획은 그대로이고 다시 확인할 수 있어요.")
  setStep("result")
}
