import { CalendarCheck2, Flame, Sparkles, Sprout } from "lucide-react"
import type { EngagementSummary } from "../../domain/engagement"
import { productFeatures } from "../../domain/product-features"
import { DecorationShop } from "./DecorationShop"

/**
 * 기록이 하나도 없으면 0 을 세 번 보여주지 않는다.
 *
 * ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT §17: "Empty and error states should be
 * useful and honest. They must not be styled as success." 숫자 칸을 그대로 두고 0 을
 * 채우면 성취 UI 의 형태를 빌려 성취가 없음을 표시하는 것이라 §17 위반이다.
 *
 * 동시에 JOURNAL_DELIGHT_AND_DECORATION_SPEC L460 `missed_day_shame_copy: forbidden`
 * 이므로 "아직 아무것도 안 했어요" 같은 재촉/부끄러움 문구도 쓸 수 없다.
 * 그래서 빈 상태는 **점수판이 아니라 규칙 안내 한 줄**로만 존재한다.
 */
function isUntouched(summary: EngagementSummary) {
  return summary.points === 0 && summary.journalDays === 0 && summary.recordingStreak === 0
}

export function EngagementStrip({ summary }: { readonly summary: EngagementSummary }) {
  if (isUntouched(summary)) {
    return (
      <section className="engagement-strip engagement-strip--untouched" aria-label="기록 습관">
        <p>
          훈련 기록 또는 몸 상태·회복 체크를 남긴 날 4P. 쉰 날과 통증 체크도 같은 기록으로 인정해요.
          거리·속도·훈련 완료에는 점수를 주지 않아요.
        </p>
      </section>
    )
  }

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
