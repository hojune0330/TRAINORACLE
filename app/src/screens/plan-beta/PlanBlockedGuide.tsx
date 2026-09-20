import { AlertTriangle, ChevronRight, RotateCcw } from "lucide-react"
import { TermHelp } from "../../components/TermHelp"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { eventDistanceLabel } from "./plan-intake-navigation"
import { EXPERIENCE_LABELS } from "./labels"

/**
 * 몸 이상·통증·불확실 답변 뒤에 보이는 화면.
 *
 * 안전 불변식(PRODUCT_NORTH_STAR §3): 몸 상태 이상 시 계획 생성 차단.
 * 그래서 이 화면은 훈련 계획을 만들지 않는다. 대신 "흐름이 끊긴 느낌"을 줄이기 위해
 * (1) 지금까지 고른 것을 그대로 보여주고, (2) 다음에 할 일을 짧게 안내하고,
 * (3) 상태가 나아졌을 때 같은 자리에서 다시 확인해 계획을 이어받을 수 있게 한다.
 * 회복 운동 처방·통증 판정·의료 조언은 하지 않는다.
 */
export function PlanBlockedGuide({
  draft,
  onWriteLog,
  onRecheck,
}: {
  readonly draft: Partial<PlanBetaIntake>
  readonly onWriteLog: () => void
  readonly onRecheck: () => void
}) {
  const kept = [
    draft.eventDistanceM === undefined ? null : eventDistanceLabel(draft.eventDistanceM),
    draft.experienceBand === undefined ? null : EXPERIENCE_LABELS[draft.experienceBand].short,
    draft.availableDayCount === undefined
      ? null
      : draft.availableDayCount === "EVERY_DAY" ? "매일" : `${Math.ceil(draft.requestedFrameLength ?? 9)}일 중 ${draft.availableDayCount}일`,
  ].filter((value): value is string => value !== null)

  return (
    <section className="plan-blocked" aria-labelledby="plan-blocked-title">
      <AlertTriangle aria-hidden="true" size={28} />
      <div className="plan-eyebrow">계획을 만들 수 없음</div>
      <h1 id="plan-blocked-title">지금은 계획을 멈췄어요</h1>
      <p>
        이 앱은 사람에게 자동으로 연결하거나 몸 상태를 확인할 수 없어요.
        <br />
        계획을 만들지 말고 지도자·보호자 또는 의료진과 직접 상의해 주세요.
      </p>
      {kept.length > 0 && (
        <div className="plan-blocked__kept" aria-label="고른 내용은 그대로 남아 있어요">
          <strong>고른 내용은 남겨둘게요</strong>
          <span>{kept.join(" · ")}</span>
          <small>몸이 괜찮아지면 다시 확인만 하고 이 선택으로 바로 계획을 받아요.</small>
        </div>
      )}
      <ol className="plan-blocked__next" aria-label="다음에 할 일">
        <li>아픈 곳과 정도를 오늘 일지에 남겨요.</li>
        <li>지도자·보호자·의료진과 상의해요.</li>
        <li>괜찮아지면 아래에서 다시 확인해요.</li>
      </ol>
      <button type="button" onClick={onWriteLog}>
        지도자와 상의한 내용을 일지에 남기기
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button
        className="plan-text-action"
        type="button"
        onClick={onRecheck}
      >
        <RotateCcw aria-hidden="true" size={16} />
        다시 확인하기
      </button>
      <p className="plan-blocked__note">
        다시 확인해도 의료적 허가는 아니에요.
        <TermHelp term="review" />
      </p>
    </section>
  )
}
