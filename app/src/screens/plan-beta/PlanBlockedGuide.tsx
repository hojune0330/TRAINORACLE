import React from "react"
import { AlertTriangle, ChevronRight, RotateCcw } from "lucide-react"
import { TermHelp } from "../../components/TermHelp"
import type { PlanBetaIntake } from "../../domain/plan-beta-store"
import { eventDistanceLabel } from "./plan-intake-navigation"
import { EXPERIENCE_LABELS } from "./labels"
import { createBodyReviewPlanPreview } from "../../domain/plan-beta-flow"
import { PlanSchedulePreview } from "./PlanSchedulePreview"

/** Acknowledgement opens a read-only general plan, not safety clearance. */
export function PlanBlockedGuide({
  draft,
  onWriteLog,
  onRecheck,
}: {
  readonly draft: Partial<PlanBetaIntake>
  readonly onWriteLog: () => void
  readonly onRecheck: () => void
}) {
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [preview, setPreview] = React.useState<Extract<ReturnType<typeof createBodyReviewPlanPreview>, { kind: "safety_review_preview" }> | null>(null)
  const [error, setError] = React.useState<string | null>(null)
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
      <div className="plan-eyebrow">통증·몸 상태 확인 필요</div>
      <h1 id="plan-blocked-title">{preview ? "계획안을 만들었어요" : "계획안은 먼저 만들 수 있어요"}</h1>
      <p>{preview ? "지금은 미리보기예요. 통증에 맞춘 재활 훈련이나 시작 허가는 아니에요." : "통증이 있어도 계획안을 볼 수 있어요. 시작 전 몸 상태는 따로 확인해요."}</p>
      {!preview && kept.length > 0 && (
        <div className="plan-blocked__kept" aria-label="고른 내용은 그대로 남아 있어요">
          <strong>고른 내용은 남겨둘게요</strong>
          <span>{kept.join(" · ")}</span>
          <small>통증 체크 때문에 처음부터 다시 고르지 않아도 돼요.</small>
        </div>
      )}
      {!preview && <>
        <label className="plan-blocked__acknowledgement">
          <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
          <span>계획안은 미리보기이며, 시작 전 몸 상태를 확인할게요</span>
        </label>
        <button type="button" className="plan-blocked__create" disabled={!acknowledged} onClick={() => {
          const result = createBodyReviewPlanPreview(draft, acknowledged)
          if (result.kind === "safety_review_preview") { setPreview(result); setError(null) }
          else setError("계획안을 만들지 못했어요. 고른 내용은 그대로예요. 다시 시도해 주세요.")
        }}>계획안 만들기<ChevronRight aria-hidden="true" size={18} /></button>
      </>}
      {error && <p role="alert">{error}</p>}
      {preview && <>
        <p className="plan-blocked__review-status" role="status">몸 상태 확인 전 · 시작·적용하지 않은 계획안</p>
        <PlanSchedulePreview startDate={preview.startDate} frameLengthDays={preview.frameLengthDays}
          sessions={preview.sessions} detailsExpanded={false} showRpeGuide={false} allowMemoExport={false}
          readerNotice={<p className="plan-blocked__review-status">몸 상태 확인 필요 · 이 훈련은 아직 시작하지 않아요.</p>}
          renderSessionFooter={() => <p className="plan-blocked__review-status">몸 상태 확인 필요 · 계획안 미리보기</p>} />
      </>}
      <button type="button" className="plan-text-action" onClick={onWriteLog}>
        통증 기록 남기기
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button
        className="plan-text-action"
        type="button"
        onClick={onRecheck}
      >
        <RotateCcw aria-hidden="true" size={16} />
        몸 상태 다시 확인하기
      </button>
      <p className="plan-blocked__note">
        체크와 재확인은 의료적 허가가 아니에요.
        <TermHelp term="review" />
      </p>
      <details className="plan-support-more">
        <summary>통증이 있을 때는?</summary>
        <p>통증을 참고 이 계획을 따라 하지는 마세요. 지도자·보호자 또는 의료진과 직접 상의해 주세요. 이 앱은 몸 상태를 진단하지 않아요.</p>
        <p>계획안은 이 화면에서만 보여요. 현재 계획·일지·통증 기록은 바꾸지 않아요. 개인 목표 초와 계획 적용은 몸 상태를 다시 확인한 뒤 제공해요.</p>
        <a href="https://www.nhs.uk/live-well/exercise/knee-pain-and-other-running-injuries/" target="_blank" rel="noreferrer">러닝 통증 안내 · NHS</a>
      </details>
    </section>
  )
}
