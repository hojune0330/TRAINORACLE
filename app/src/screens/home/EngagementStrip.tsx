import type { EngagementSummary } from "../../domain/engagement"

function isUntouched(summary: EngagementSummary) {
  return summary.journalDays === 0
}

type PlantState = {
  readonly emoji: string
  readonly label: string
  readonly name: string
}

function plantState(recordingStreak: number): PlantState {
  if (recordingStreak === 0) return { emoji: "🍂", label: "천천히 다시 시작해요", name: "쉬는 중" }
  if (recordingStreak <= 2) return { emoji: "🌱", label: "새싹이 자라고 있어요", name: "새싹" }
  if (recordingStreak <= 6) return { emoji: "🌿", label: "잎이 자라고 있어요", name: "자라는 중" }
  return { emoji: "🌳", label: "튼튼하게 자랐어요", name: "무성함" }
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
          첫 기록을 남기면 일지를 꾸밀 수 있어요. 훈련 기록 또는 몸 상태·회복 체크를 남긴 날마다 4P가 쌓여요.
          거리·속도·훈련 강도에는 점수를 매기지 않아요.
        </p>
      </section>
    )
  }

  const plant = plantState(summary.recordingStreak)

  return (
    <section className="engagement-strip" aria-label="기록 습관">
      <div className="engagement-strip__metric" aria-label={`식물 상태: ${plant.label}`}>
        <span aria-hidden="true">{plant.emoji}</span>
        <span>
          <small>일지 정원</small>
          <strong>{plant.name}</strong>
        </span>
      </div>
      <div className="engagement-strip__metric">
        <span>
          <small>함께한 날</small>
          <strong>{summary.journalDays}일</strong>
        </span>
      </div>
      <div className="engagement-strip__metric">
        <span>
          <small>기록 연속</small>
          <strong>{summary.recordingStreak}일 · {summary.points}P</strong>
        </span>
      </div>
      <p className="engagement-strip__preservation">
        이 기기에 {savedCount}건 저장됨 · 온라인 보관은 계정 연동 후
        {onOpenMore !== undefined && (
          <button type="button" aria-label="백업 안내 보기" onClick={onOpenMore}>
            백업 안내 보기
          </button>
        )}
      </p>
      <p>
        훈련 기록 또는 몸 상태·회복 체크를 남긴 날마다 4P가 쌓여요.
        거리·속도·훈련 강도에는 점수를 매기지 않아요.
      </p>
    </section>
  )
}
