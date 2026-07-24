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
import {
  CANDIDATE_LABELS,
  prescriptionLabel,
  PROGRESS_LABELS,
  sessionLabel,
} from "./labels"

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
}: {
  readonly state: PlanBetaState
  readonly onProgress: (progress: StoredPlanProgress) => void
  readonly onNextFrame: () => void
}) {
  const { activePlan } = state
  const recorded = new Map(
    state.progress.map((progress) => [progress.sessionDay, progress.state]),
  )
  const label = CANDIDATE_LABELS[activePlan.candidateKind]

  return (
    <section className="active-plan" aria-labelledby="active-plan-title">
      <div className="plan-eyebrow">ACTIVE · LOCAL BETA</div>
      <h1 id="active-plan-title">{label.title} {activePlan.frame.lengthDays}일 계획</h1>
      <p className="plan-copy">
        이 계획과 진행 상태는 이 브라우저에만 저장돼요.
        완료하지 못한 날은 몰아서 훈련하지 마세요.
      </p>
      <div className="plan-source-strip">
        <AlertTriangle aria-hidden="true" size={17} />
        <span>
          <strong>{activePlan.sourceMode === "PROFILE_ONLY" ? "프로필 기반 · 제한 신뢰도" : "일지 보유 · 처방 미반영"}</strong>
          <small>현재 응답 기준 · 의료 판단 아님</small>
        </span>
      </div>
      <ol className="active-plan__days">
        {activePlan.sessions.map((session) => {
          const current = recorded.get(session.day)
          return (
            <li key={session.day}>
              <div className="active-plan__session">
                <span>DAY {session.day}</span>
                <div>
                  <strong>{sessionLabel(session)}</strong>
                  <small className={session.role === "REST" ? "plan-session-help" : "plan-session-metric"}>
                    {prescriptionLabel(session)}
                  </small>
                </div>
                <em>{current === undefined ? "예정" : PROGRESS_LABELS[current]}</em>
              </div>
              <div className="active-plan__actions" aria-label={`DAY ${session.day} 진행 기록`}>
                {actionsForRole(session.role).map(({ state: progressState, icon: Icon }) => (
                  <button
                    type="button"
                    key={progressState}
                    aria-pressed={current === progressState}
                    onClick={() => onProgress({
                      sessionDay: session.day,
                      state: progressState,
                    })}
                  >
                    <Icon aria-hidden="true" size={15} />
                    {PROGRESS_LABELS[progressState]}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="active-plan__continuity">
        <strong>다음 계획도 이 기록에서 이어져요.</strong>
        <p>
          선택한 후보와 진행 상태만 보관합니다.
          다음 후보를 만들 때 몸 상태를 다시 확인해요.
          강도는 자동으로 올리지 않아요.
        </p>
        <button type="button" onClick={onNextFrame}>
          다음 주기 후보 만들기
        </button>
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
