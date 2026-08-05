import type { EngagementSummary } from "../../domain/engagement"

/**
 * 기록이 하나도 없으면 저장 건수마저 0 으로 채우지 않는다.
 *
 * ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT §17: "Empty and error states should be
 * useful and honest. They must not be styled as success." 숫자 칸을 그대로 두고 0 을
 * 채우면 성취 UI 의 형태를 빌려 성취가 없음을 표시하는 것이라 §17 위반이다.
 *
 * 같은 이유로 포인트/불꽃/연속 기록 지표는 그리지 않는다 — PHILOSOPHY §9-9 가
 * 점수·스트릭·불꽃 게이미피케이션을 금지한다. 기록은 "이 기기에 보존됨"이라는
 * 사실만 정직하게 전한다 (WORK_ORDER_UX2 §2-2).
 */
function isUntouched(summary: EngagementSummary) {
  return summary.journalDays === 0
}

export function EngagementStrip({
  summary,
  savedCount,
  onOpenMore,
}: {
  readonly summary: EngagementSummary
  readonly savedCount: number
  readonly onOpenMore?: () => void
}) {
  if (isUntouched(summary)) {
    return (
      <section className="engagement-strip engagement-strip--untouched" aria-label="기록 습관">
        <p>
          훈련 기록 또는 몸 상태·회복 체크를 남긴 날이 이 기기에 기록으로 남아요.
          거리·속도·훈련 완료에는 점수를 매기지 않아요.
        </p>
      </section>
    )
  }

  return (
    <section className="engagement-strip" aria-label="기록 습관">
      <p className="engagement-strip__preservation">
        이 기기에 {savedCount}건 저장됨 · 온라인 보관은 계정 연동 후
        {onOpenMore !== undefined && (
          <button type="button" aria-label="백업 안내 보기" onClick={onOpenMore}>
            백업 안내 보기
          </button>
        )}
      </p>
      <p>
        훈련 기록 또는 몸 상태·회복 체크를 남긴 날이 이 기기에 기록으로 남아요.
        거리·속도·훈련 완료에는 점수를 매기지 않아요.
      </p>
    </section>
  )
}
