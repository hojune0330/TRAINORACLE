import React from "react"
import {
  AlertTriangle,
  Check,
  CircleMinus,
  HeartPulse,
  RefreshCw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { PlanProgressState } from "@impl/plan-generator/types"
import type {
  PlanBetaState,
  StoredPlanProgress,
} from "../../domain/plan-beta-store"
import { TermHelp } from "../../components/TermHelp"
import {
  candidateLabel,
  PROGRESS_LABELS,
  sessionSlotLabel,
} from "./labels"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import { DIVISION_LABELS } from "./plan-intake-meta"
import type { PlanCurrentCheck } from "../../domain/plan-beta-flow"
import type { StoredPaceTargetPrescription } from "../../domain/plan-session-schema"
import { PlanAdaptationFlow } from "./PlanAdaptationFlow"
import { todayISO } from "../../domain/journal-store"
import { isPlanFrameCompletionEligible } from "../../domain/plan-successor-activation"

const PROGRESS_ACTIONS: readonly {
  readonly state: PlanProgressState
  readonly icon: LucideIcon
}[] = [
  { state: "COMPLETED", icon: Check },
  { state: "RESTED", icon: CircleMinus },
  { state: "SKIPPED", icon: RefreshCw },
  { state: "PAIN_CHECKIN", icon: HeartPulse },
]

export function ActivePlan({
  state,
  onProgress,
  onNextFrame,
  onActivateNextFrame,
  onCheckDetailedExecution,
}: {
  readonly state: PlanBetaState
  readonly onProgress: (progress: StoredPlanProgress) => void
  readonly onNextFrame: () => void
  readonly onActivateNextFrame: (currentCheck: PlanCurrentCheck) => void
  readonly onCheckDetailedExecution: (
    prescription: StoredPaceTargetPrescription,
    operation: "START" | "RESTART",
    currentCheck: PlanCurrentCheck,
  ) => void
}) {
  const [hasPendingSuccessor, setHasPendingSuccessor] = React.useState(false)
  const [showActivationCheck, setShowActivationCheck] = React.useState(false)
  const { activePlan } = state
  const recorded = new Map(
    state.progress.map((progress) => [
      `${progress.sessionDay}:${progress.sessionSlot}`,
      progress.state,
    ]),
  )
  const label = candidateLabel(
    activePlan.candidateKind,
    activePlan.selectedEnergyIntent,
  )
  const frameLengthDays = "projectionLengthDays" in activePlan.frame
    ? activePlan.frame.projectionLengthDays ?? activePlan.frame.lengthDays
    : activePlan.frame.lengthDays
  const detailedPrescription = activePlan.sessions
    .map((session) => session.prescription)
    .find((prescription): prescription is StoredPaceTargetPrescription => (
      prescription.kind === "PACE_TARGET"
    ))
  const hasDetailedPrescription = detailedPrescription !== undefined
  const frameComplete = isPlanFrameCompletionEligible(state, todayISO())

  return (
    <section className="active-plan" aria-labelledby="active-plan-title">
      <div className="plan-eyebrow">내 훈련 일정</div>
      <h1 id="active-plan-title">{label.title} {frameLengthDays}일 계획</h1>
      <p className="plan-copy">
        오늘 할 훈련의 총 시간, RPE, 훈련 목적을 확인하세요.
        완료하지 못한 날을 다음 날에 몰아서 하지 마세요.
      </p>
      <div className="plan-source-strip">
        <AlertTriangle aria-hidden="true" size={17} />
        <span>
          <strong>
            <span className="plan-source-strip__title">
              {activePlan.sourceMode === "PROFILE_ONLY"
                ? "내가 고른 조건 · 베타 계획"
                : "최근 일지 확인 · 계획 수치에는 미반영"}
            </span>
            <TermHelp term="plan-beta-basis" />
          </strong>
          <small>이 계획과 진행 상태는 이 브라우저에만 저장 · 의료 판단 아님</small>
          {state.athleteEvidence !== undefined && (
            <small>
              저장된 경기 기록 {state.athleteEvidence.storedRecordCount}개
              {" · "}최근 구조화 일지 {state.athleteEvidence.recentJournalSessionCount}개 연결
              {" · "}{hasDetailedPrescription
                  ? `확인한 ${detailedPrescription.targetEventDistanceM}m 기록은 상세 세션 페이스에 사용 · 일지 값은 시간·RPE 계산에 미사용`
                : "개인 페이스·훈련 시간·RPE 계산에는 미사용"}
            </small>
          )}
          {state.intake.competitionDivision !== undefined
            && state.intake.competitionDivision !== "NOT_PROVIDED" && (
            <small>
              참가 부문: {DIVISION_LABELS[state.intake.competitionDivision].title} · 표시용 정보이며 훈련 강도와 안전 판정에는 미사용
            </small>
          )}
        </span>
      </div>
      {frameComplete ? (
        <PlanAdaptationFlow state={state} onPendingChange={setHasPendingSuccessor} />
      ) : (
        <div className="plan-adaptation__notice" role="status">
          보이는 훈련을 완료·휴식·건너뜀·통증 확인 중 하나로 기록하면 다음 계획 후보를 고를 수 있어요.
        </div>
      )}
      <PlanSchedulePreview
        startDate={state.intake.startDate ?? state.generatedAt.slice(0, 10)}
        frameLengthDays={frameLengthDays}
        sessions={activePlan.sessions}
        renderSessionFooter={(session) => {
          const current = recorded.get(`${session.day}:${session.slot}`)
          const detailedPrescription = session.prescription.kind === "PACE_TARGET"
            ? session.prescription
            : null
          return (
            <>
              {detailedPrescription !== null && (
                <details className="active-plan__execution-check">
                  <summary>
                    {current === undefined
                      ? "시작 전 확인"
                      : current === "PAIN_CHECKIN"
                        ? "통증 기록 후 확인"
                        : "기록 후 몸 상태 확인"}
                  </summary>
                  <p>누를 때마다 몸 상태와 저장된 처방의 승인·만료·철회 여부를 다시 확인해요.</p>
                  {current === undefined ? (
                    <button
                      className="active-plan__execution-primary"
                      type="button"
                      onClick={() => onCheckDetailedExecution(
                        detailedPrescription,
                        "START",
                        "NO_KNOWN_RISK",
                      )}
                    >
                      통증 없고 평소와 같음 · 시작 확인
                    </button>
                  ) : (
                    <p className="active-plan__execution-note">
                      이미 결과를 기록한 세션은 다시 시작하지 않아요. 몸 상태가 이상하면 아래에서 확인해 주세요.
                    </p>
                  )}
                  <button
                    className="active-plan__execution-review"
                    type="button"
                    onClick={() => onCheckDetailedExecution(
                      detailedPrescription,
                      "START",
                      "REVIEW_REQUIRED",
                    )}
                  >
                    <AlertTriangle aria-hidden="true" size={16} />
                    통증·이상 또는 잘 모르겠음
                  </button>
                </details>
              )}
              <em className="active-plan__status">
                {current === undefined ? "예정" : PROGRESS_LABELS[current]}
              </em>
              <div
                className="active-plan__actions"
                role="group"
                aria-label={`DAY ${session.day} ${sessionSlotLabel(session.slot)} 진행 기록`}
              >
                {actionsForRole(session.role).map(({ state: progressState, icon: Icon }) => (
                  <button
                    type="button"
                    key={progressState}
                    aria-pressed={current === progressState}
                    onClick={() => onProgress({
                      sessionDay: session.day,
                      sessionSlot: session.slot,
                      state: progressState,
                    })}
                  >
                    <Icon aria-hidden="true" size={15} />
                    {PROGRESS_LABELS[progressState]}
                  </button>
                ))}
              </div>
            </>
          )
        }}
      />
      <div className="active-plan__continuity">
        <strong>다음 계획에 이어지는 정보</strong>
        <p>
          어떤 계획을 골랐는지와 완료·휴식·건너뜀·통증 체크 횟수만 이어갑니다.
          이번 훈련의 거리·페이스·메모는 넘기지 않고 강도도 자동으로 올리지 않습니다.
          새 계획을 만들기 전에 몸 상태를 다시 확인합니다.
        </p>
        {frameComplete && hasPendingSuccessor ? (
          <>
            <button type="button" onClick={() => setShowActivationCheck(true)}>
              선택한 다음 계획 시작하기
            </button>
            {showActivationCheck && (
              <div
                className="plan-adaptation__panel"
                role="group"
                aria-label="다음 계획 시작 전 몸 상태 확인"
              >
                <strong>지금 몸 상태를 다시 확인해 주세요</strong>
                <button type="button" onClick={() => onActivateNextFrame("NO_KNOWN_RISK")}>
                  통증 없고 몸 상태는 평소와 같아요
                </button>
                <button type="button" onClick={() => onActivateNextFrame("REVIEW_REQUIRED")}>
                  통증·부상·몸 이상이 있거나 잘 모르겠어요
                </button>
              </div>
            )}
          </>
        ) : (
          <button type="button" disabled={!frameComplete} onClick={onNextFrame}>
            {frameComplete ? "현재 기준으로 다음 후보 만들기" : "현재 계획을 먼저 기록해 주세요"}
          </button>
        )}
      </div>
    </section>
  )
}

function actionsForRole(
  role: "REST" | "EASY" | "QUALITY",
): readonly (typeof PROGRESS_ACTIONS)[number][] {
  if (role !== "REST") return PROGRESS_ACTIONS
  return PROGRESS_ACTIONS.filter(({ state }) => state !== "COMPLETED")
}
