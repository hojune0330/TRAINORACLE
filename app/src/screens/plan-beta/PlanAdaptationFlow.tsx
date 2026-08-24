import React from "react"
import { ArrowLeft, SlidersHorizontal } from "lucide-react"
import type { AthleteRecord } from "../../domain/athlete-records"
import {
  loadAthleteRecords,
  recordPurposeLabel,
} from "../../domain/athlete-records"
import type { PlanBetaState } from "../../domain/plan-beta-store"
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

type Step = "closed" | "reason" | "record" | "safety" | "choice" | "review" | "result" | "pending"
type Reason = "PB_SB" | "EXPLICIT_REQUEST"

type PlanAdaptationFlowProps = {
  readonly state: PlanBetaState
  readonly onPrepare?: typeof prepareNextFrameAdaptation
  readonly onAccept?: typeof acceptPreparedNextFrameAdaptation
  readonly onLoadRecords?: () => readonly AthleteRecord[]
  readonly onLoadPending?: typeof loadMatchingPendingSuccessor
  readonly onEvaluateSafety?: typeof evaluateActivePlanAdaptationSafety
  readonly onPendingChange?: (hasPending: boolean) => void
}

export function PlanAdaptationFlow({
  state,
  onPrepare = prepareNextFrameAdaptation,
  onAccept = acceptPreparedNextFrameAdaptation,
  onLoadRecords = loadAthleteRecords,
  onLoadPending = loadMatchingPendingSuccessor,
  onEvaluateSafety = evaluateActivePlanAdaptationSafety,
  onPendingChange,
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
  const pendingReady = pendingState === state
  const matchingPending = pendingReady ? pending : null
  const records = React.useMemo(
    () => eligiblePbSbRecords(state, onLoadRecords()),
    [onLoadRecords, state],
  )

  React.useEffect(() => {
    let current = true
    const loadPending = async () => {
      try {
        if (state.version !== 3) {
          setPending(null)
          setPendingState(state)
          return
        }
        const loaded = await onLoadPending(state)
        if (!current) return
        setPending(loaded)
        setPendingState(state)
        onPendingChange?.(loaded !== null)
      } catch {
        if (!current) return
        setPending(null)
        setPendingState(state)
      }
    }
    void loadPending()
    return () => {
      current = false
    }
  }, [onLoadPending, onPendingChange, state])

  const chooseReason = (nextReason: Reason) => {
    setReason(nextReason)
    setRecord(null)
    setMessage(null)
    setStep(nextReason === "PB_SB" ? "record" : "safety")
  }

  const prepareReduction = async () => {
    if (reason === null || currentCheck === null) return
    const operationAt = new Date()
    const safety = onEvaluateSafety(state, currentCheck, operationAt)
    setBusy(true)
    const result = await onPrepare({
      state,
      reason,
      record,
      safety,
      operationAt: operationAt.toISOString(),
    })
    setBusy(false)
    handlePrepared(result, setPrepared, setMessage, setStep)
  }

  const accept = async () => {
    if (prepared === null || currentCheck === null) return
    if (state.version !== 3) {
      setMessage("이전 계획은 다음 계획 조정을 지원하지 않아요.")
      setStep("result")
      return
    }
    const operationAt = new Date()
    const safety = onEvaluateSafety(state, currentCheck, operationAt)
    setBusy(true)
    const result = await onAccept({
      prepared,
      predecessorState: state,
      safety,
      operationAt: operationAt.toISOString(),
    })
    setBusy(false)
    if (result.kind === "accepted") {
      setPendingState(state)
      onPendingChange?.(true)
    }
    handleAccepted(result, setPending, setMessage, setStep)
  }

  const reset = () => {
    setReason(null)
    setRecord(null)
    setCurrentCheck(null)
    setPrepared(null)
    setMessage(null)
    setStep("closed")
  }

  return (
    <section className="plan-adaptation" aria-label="다음 계획 조정">
      <button
        className="plan-adaptation__entry"
        type="button"
        aria-label="다음 계획 조정하기"
        aria-expanded={step !== "closed"}
        aria-busy={!pendingReady}
        disabled={!pendingReady}
        onClick={() => setStep(matchingPending === null ? "reason" : "pending")}
      >
        <SlidersHorizontal aria-hidden="true" size={18} />
        <span>
          <strong>다음 계획 조정하기</strong>
          <small>{matchingPending === null ? "현재 계획은 바꾸지 않고 다음 주기 후보만 확인" : "선택해 둔 다음 계획 확인"}</small>
        </span>
      </button>

      {step !== "closed" && (
        <div className="plan-adaptation__panel" aria-live="polite">
          {step === "reason" && (
            <DecisionStep title="조정 이유를 선택해 주세요" onBack={reset}>
              <PlanChoice
                title="최근 기록이 좋아졌어요"
                detail="계획 시작 뒤 달성한 같은 종목 PB 또는 SB를 확인해요."
                selected={false}
                onClick={() => chooseReason("PB_SB")}
              />
              <PlanChoice
                title="다음 계획을 조정하고 싶어요"
                detail="메모를 쓰지 않고 다음 주기의 훈련량만 비교해요."
                selected={false}
                onClick={() => chooseReason("EXPLICIT_REQUEST")}
              />
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
                detail="현재 D9 안전 상태와 활성 계획의 hold를 함께 확인해요."
                selected={currentCheck === "NO_KNOWN_RISK"}
                onClick={() => {
                  setCurrentCheck("NO_KNOWN_RISK")
                  setStep("choice")
                }}
              />
              <PlanChoice
                title="통증·부상·몸 이상이 있거나 잘 모르겠어요"
                detail="후보를 만들지 않고 현재 계획을 그대로 유지해요."
                selected={currentCheck === "REVIEW_REQUIRED"}
                onClick={() => {
                  const operationAt = new Date()
                  setCurrentCheck("REVIEW_REQUIRED")
                  const safety = onEvaluateSafety(state, "REVIEW_REQUIRED", operationAt)
                  setMessage(safety.kind === "blocked"
                    ? "현재 안전 상태를 먼저 확인해야 해서 다음 계획 후보를 만들지 않았어요. 현재 계획은 그대로예요."
                    : "현재 계획은 그대로 유지돼요.")
                  setStep("result")
                }}
              />
            </DecisionStep>
          )}

          {step === "choice" && (
            <DecisionStep title="다음 계획의 기준을 선택해 주세요" onBack={() => setStep("safety")}>
              <PlanChoice
                title="훈련량을 조금 줄인 다음 계획"
                detail="승인된 보수적 후보가 있을 때만 바뀐 세션을 비교해요."
                selected={false}
                onClick={() => void prepareReduction()}
              />
              <PlanChoice
                title="현재 계획과 같은 기준 유지"
                detail="새 후보를 만들지 않고 현재 계획과 다음 계획 기준을 유지해요."
                selected={false}
                onClick={() => {
                  setMessage("같은 기준을 선택했어요. 새 후보는 만들지 않았고 현재 계획도 그대로예요.")
                  setStep("result")
                }}
              />
              {busy && <p className="plan-adaptation__notice" role="status">다음 계획 후보를 확인하고 있어요.</p>}
            </DecisionStep>
          )}

          {step === "review" && prepared !== null && (
            <PlanAdaptationReview prepared={prepared} busy={busy} onAccept={() => void accept()} onBack={() => setStep("choice")} />
          )}

          {step === "result" && (
            <PlanAdaptationResult message={message ?? "다음 계획 후보를 만들지 못했어요. 현재 계획은 그대로예요."} onClose={reset} />
          )}

          {step === "pending" && matchingPending !== null && (
            <PlanAdaptationResult
              message="다음 주기에 사용할 보수적인 계획을 이 기기에 저장했어요. 현재 활성 계획과 진행 기록은 바뀌지 않았습니다."
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
    ? "현재 안전 상태를 다시 확인해야 해서 다음 계획 후보를 만들지 않았어요. 현재 계획은 그대로예요."
    : result.code === "COACH_CONNECTION_REQUIRED"
      ? "이 계획은 지도자 확인이 필요해요. 인증된 지도자 연결이 없어 선수 화면에서는 선택할 수 없고 현재 계획은 그대로예요."
      : "이 계획에는 정확한 종목과 승인된 비교 후보가 함께 저장되어 있지 않아 조정 후보를 만들 수 없어요. 현재 계획은 그대로예요.")
  setStep("result")
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
    ? "안전 상태가 바뀌었거나 확인 시간이 지나 후보를 저장하지 않았어요. 현재 계획은 그대로예요."
    : "다음 계획 후보를 저장하지 못했어요. 현재 계획은 그대로이고 다시 확인할 수 있어요.")
  setStep("result")
}
