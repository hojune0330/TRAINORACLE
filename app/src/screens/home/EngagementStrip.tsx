import { CalendarCheck2, Flame, Sparkles, Sprout } from "lucide-react"
import type { EngagementSummary } from "../../domain/engagement"
import { productFeatures } from "../../domain/product-features"
import { DecorationShop } from "./DecorationShop"

export function EngagementStrip({
  summary,
}: {
  readonly summary: EngagementSummary
}) {
  return (
    <section className="engagement-strip" aria-label="기록 습관">
      <div className="engagement-strip__metric">
        <Sparkles aria-hidden="true" size={17} strokeWidth={1.7} />
        <span>
          <small>누적 획득 · BETA</small>
          <strong>{summary.points}P</strong>
        </span>
      </div>
      <div className="engagement-strip__metric">
        <CalendarCheck2 aria-hidden="true" size={17} strokeWidth={1.7} />
        <span>
          <small>기록 연속</small>
          <strong>{summary.recordingStreak}일</strong>
        </span>
      </div>
      <div className="engagement-strip__metric">
        {summary.recordingStreak > 0
          ? <Flame aria-hidden="true" size={17} strokeWidth={1.7} />
          : <Sprout aria-hidden="true" size={17} strokeWidth={1.7} />}
        <span>
          <small>함께한 날</small>
          <strong>{summary.journalDays}일</strong>
        </span>
      </div>
      <p>
        훈련 기록 또는 몸 상태·회복 체크를 남긴 날 4P. 쉰 날과 통증 체크도 같은 기록으로 인정해요.
        거리·속도·훈련 완료에는 점수를 주지 않아요.
      </p>
      {summary.recordingStreak === 0 && summary.journalDays > 0 && (
        <p>연속 기록은 쉬어가도, 함께한 날과 받은 포인트는 그대로 남아 있어요.</p>
      )}
      {productFeatures().decorationShop && <DecorationShop earnedPoints={summary.points} />}
    </section>
  )
}
