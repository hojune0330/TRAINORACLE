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
import { TermHelp } from "../../components/TermHelp"
import { loadEntries } from "../../domain/journal-store"
import { derivePlanCycleResponse } from "../../domain/plan-cycle-response"
import type { JournalEntry } from "../../domain/journal-schema"

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
  readonly onPendingChange?: (hasPending: boolean) => void
}

export function PlanAdaptationFlow({
  state,
  onPrepare = prepareNextFrameAdaptation,
  onAccept = acceptPreparedNextFrameAdaptation,
  onLoadRecords = loadAthleteRecords,
  onLoadPending = loadMatchingPendingSuccessor,
  onEvaluateSafety = evaluateActivePlanAdaptationSafety,
  onLoadEntries = loadEntries,
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
  const cycleResponse = React.useMemo(
    () => derivePlanCycleResponse(onLoadEntries(), state),
    [onLoadEntries, state],
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

  const prepareCandidate = async () => {
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
              <p className="plan-adaptation__term-help">
                PB<TermHelp term="pb" /> · SB<TermHelp term="sb" /> 뜻 확인
              </p>
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
              <PlanChoice
                title="이번 주기 수행 기록을 볼래요"
                detail="계획에서 이어 쓴 일지의 RPE만 비교해 유지·감량·확인 방향을 설명해요."
                selected={false}
                onClick={() => setStep("cycle")}
              />
            </DecisionStep>
          )}

          {step === "cycle" && (
            <DecisionStep title="이번 주기에서 확인된 흐름" onBack={() => setStep("reason")}>
              <div className="plan-adaptation__evidence">
                <strong>{cycleResponse.headline}</strong>
                {cycleResponse.evidence.map((item) => <p key={item}>{item}</p>)}
                <small>일지 원문·비밀 메모·통증 문장은 읽지 않으며, 이 결과만으로 훈련량을 늘리지 않아요.</small>
              </div>
              {cycleResponse.recommendation === "REDUCE_OR_REVIEW"
                && state.activePlan.candidateKind === "BALANCED" && (
                <PlanChoice
                  title="훈련량을 줄인 후보 확인"
                  detail="현재 계획은 그대로 두고 승인된 보수적 다음 후보만 비교해요."
                  selected={false}
                  onClick={() => chooseReason("EXPLICIT_REQUEST")}
                />
              )}
              <PlanChoice
                title={cycleResponse.recommendation === "MAINTAIN_OR_VARY_METHOD" ? "현재 수준을 유지하고 방법을 다양화" : "현재 기준 유지"}
                detail={cycleResponse.recommendation === "MAINTAIN_OR_VARY_METHOD"
                  ? "훈련량은 올리지 않아요. 다음 계획에서 승인된 다른 상세 세션이 있으면 후보로 비교합니다."
                  : "새 후보를 저장하지 않고 현재 계획과 다음 계획 기준을 유지해요."}
                selected={false}
                onClick={() => {
                  setMessage(cycleResponse.recommendation === "MAINTAIN_OR_VARY_METHOD"
                    ? "훈련량은 그대로 유지해요. 승인된 다른 상세 세션이 있는 경우에만 다음 후보에서 방법을 바꿔 보여드려요."
                    : "현재 기준을 유지해요. 강도·양·횟수는 바꾸지 않았습니다.")
                  setStep("result")
                }}
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
                detail="저장된 통증·안전 확인 상태와 현재 계획이 중지되어 있는지 함께 확인해요."
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
                title={reason === "PB_SB"
                  ? "기록 갱신을 반영한 다음 후보"
                  : state.activePlan.candidateKind === "BALANCED"
                    ? "훈련량을 조금 줄인 다음 계획"
                    : "기본 훈련량 범위로 돌아간 다음 계획"}
                detail={reason === "PB_SB"
                  ? "PB·SB 뒤에도 강도·양·횟수를 함께 올리지 않고 승인된 기존 후보만 비교해요."
                  : state.activePlan.candidateKind === "BALANCED"
                    ? "승인된 보수적 후보가 있을 때만 바뀐 세션을 비교해요."
                    : "이전에 줄여 둔 쉬운 훈련 시간을 원래 후보 범위로 되돌려 비교해요. 강도와 횟수는 올리지 않아요."}
                selected={false}
                onClick={() => void prepareCandidate()}
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
