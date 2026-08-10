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
    state.progress.map((progress) => [
      `${progress.sessionDay}:${progress.sessionSlot}`,
      progress.state,
    ]),
  )
  const label = candidateLabel(
    activePlan.candidateKind,
    activePlan.selectedEnergyIntent,
  )

  return (
    <section className="active-plan" aria-labelledby="active-plan-title">
      <div className="plan-eyebrow">ACTIVE · LOCAL BETA</div>
      <h1 id="active-plan-title">{label.title} {activePlan.frame.lengthDays}일 계획</h1>
      <p className="plan-copy">
        오늘 할 훈련의 총 시간, RPE, 훈련 목적을 확인하세요.
        완료하지 못한 날을 다음 날에 몰아서 하지 마세요.
      </p>
      <div className="plan-source-strip">
        <AlertTriangle aria-hidden="true" size={17} />
        <span>
          <strong>
            {activePlan.sourceMode === "PROFILE_ONLY"
              ? "사용 정보 7가지 · 베타 계획"
              : "최근 일지 확인 · 계획 수치에는 미반영"}
            <TermHelp term="plan-beta-basis" />
          </strong>
          <small>이 계획과 진행 상태는 이 브라우저에만 저장 · 의료 판단 아님</small>
        </span>
      </div>
      <PlanSchedulePreview
        startDate={state.intake.startDate ?? state.generatedAt.slice(0, 10)}
        sessions={activePlan.sessions}
        renderSessionFooter={(session) => {
          const current = recorded.get(`${session.day}:${session.slot}`)
          return (
            <>
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
