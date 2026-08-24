import { ArrowLeft, CalendarX2 } from "lucide-react"
import type { PlanDraftGeneration } from "../../domain/plan-beta-flow"
import { RacePlacementNotice } from "./RacePlacementNotice"

type RaceDatePreviewResult = Extract<PlanDraftGeneration, { readonly kind: "preview_only" }>

export function RaceDatePreview({
  result,
  onChangeDate,
  onContinueWithoutDate,
}: {
  readonly result: RaceDatePreviewResult
  readonly onChangeDate: () => void
  readonly onContinueWithoutDate: () => void
}) {
  return (
    <section className="plan-race-preview" aria-labelledby="plan-race-preview-title">
      <button className="plan-back" type="button" onClick={onChangeDate}>
        <ArrowLeft aria-hidden="true" size={17} />
        날짜 바꾸기
      </button>
      <CalendarX2 aria-hidden="true" size={28} />
      <div className="plan-eyebrow">목표 경기 미리보기</div>
      <h1 id="plan-race-preview-title">아직 경기 날짜를 계획에 적용할 수 없어요</h1>
      <p className="plan-copy">
        {result.preview.eventDistanceM}m 목표 경기 날짜를 확인했지만, 현재 승인된 기준으로는 훈련 날짜를 옮기거나 계획을 저장할 수 없어요.
      </p>
      <RacePlacementNotice state={result.racePlacement} />
      <div className="plan-preview-boundary">
        <strong>입력한 날짜는 저장하지 않았어요.</strong>
        <p>이 결과에는 선택하거나 시작할 계획 후보가 없습니다.</p>
        <small>날짜 없이 진행하면 현재 선택을 바탕으로 일반 계획 후보 2개를 만들 수 있어요.</small>
      </div>
      <button className="plan-select-action" type="button" onClick={onContinueWithoutDate}>
        날짜 없이 일반 계획 보기
      </button>
    </section>
  )
}
