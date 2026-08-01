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
          <small>ORACLE POINTS · BETA</small>
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
        방문 1P · 기록한 날 4P. 쉰 날과 통증 체크도 같은 기록으로 인정해요.
        거리·속도·훈련 완료에는 점수를 주지 않아요.
      </p>
      {summary.recordingStreak === 0 && summary.journalDays > 0 && (
        <p>불꽃은 잠시 꺼지고 식물은 잠시 시들었지만, 함께한 날과 포인트는 그대로 남아 있어요.</p>
      )}
      {productFeatures().decorationShop && <DecorationShop earnedPoints={summary.points} />}
    </section>
  )
}
