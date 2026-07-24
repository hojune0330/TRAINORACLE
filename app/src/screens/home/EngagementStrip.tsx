import { CalendarCheck2, Sparkles } from "lucide-react"
import type { EngagementSummary } from "../../domain/engagement"

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
      <p>
        방문 1P · 기록한 날 4P. 쉰 날과 통증 체크도 같은 기록으로 인정해요.
        거리·속도·훈련 완료에는 점수를 주지 않아요.
      </p>
    </section>
  )
}
