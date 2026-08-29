import { Award, Leaf, Share2, Sprout, TreePine, type LucideIcon } from "lucide-react"
import type { EngagementSummary } from "../../domain/engagement"
import { engagementBadges, engagementGarden, nextEngagementMilestone } from "../../domain/engagement-rewards"

function isUntouched(summary: EngagementSummary) {
  return summary.journalDays === 0 && summary.visitDays === 0
}

const GARDEN_ICONS = { SPROUT: Sprout, LEAF: Leaf, TREE: TreePine } satisfies Record<ReturnType<typeof engagementGarden>["icon"], LucideIcon>

export function EngagementStrip({
  summary,
  savedCount,
  notice,
  availablePoints = summary.points,
  spentPoints = 0,
  nextReward,
  onRecordVisit,
  onOpenMore,
  onShare,
  shareNotice,
}: {
  readonly summary: EngagementSummary
  readonly savedCount: number
  readonly notice?: string | null
  readonly availablePoints?: number
  readonly spentPoints?: number
  readonly nextReward?: {
    readonly name: string
    readonly cost: number
    readonly remainingPoints: number
  } | null
  readonly onRecordVisit?: () => void
  readonly onOpenMore?: () => void
  readonly onShare?: () => void
  readonly shareNotice?: string | null
}) {
  if (isUntouched(summary)) {
    return (
      <section className="engagement-strip engagement-strip--untouched" aria-label="기록 습관">
        <p>
          {savedCount > 0
            ? "기록은 이 기기에 저장됐어요. 포인트는 훈련·회복 항목을 남긴 날에 쌓여요. 메모 내용은 포인트 판단에 사용하지 않아요."
            : "첫 기록을 남기면 일지를 꾸밀 수 있어요. 훈련 기록 또는 몸 상태·회복 체크를 남긴 날마다 4P가 쌓여요."}
          {" "}<span className="engagement-strip__nowrap">
            거리·속도·훈련 강도에는 점수를 매기지 않아요.
          </span>
        </p>
        <VisitAction summary={summary} notice={notice} onRecordVisit={onRecordVisit} />
      </section>
    )
  }

  const plant = engagementGarden(summary.journalDays)
  const PlantIcon = GARDEN_ICONS[plant.icon]
  const badges = engagementBadges(summary.journalDays)
  const nextBadge = nextEngagementMilestone(summary.journalDays)
  /* 감사 F6: 성장 단계를 점 4개로 보여 준다 (재촉 없이 현재 위치만). */
  const growthStage = summary.journalDays === 0 ? 0 : summary.journalDays <= 6 ? 1 : summary.journalDays <= 13 ? 2 : summary.journalDays <= 29 ? 3 : 4

  return (
    <section className="engagement-strip" aria-label="기록 습관">
      <div className="engagement-strip__garden" aria-label={`식물 상태: ${plant.label}`}>
        <span className="engagement-strip__garden-icon">
          <PlantIcon aria-hidden="true" size={34} strokeWidth={1.6} />
        </span>
        <span className="engagement-strip__garden-copy">
          <small>일지 정원</small>
          <strong>{plant.name}</strong>
          <small>{plant.label}</small>
        </span>
        <span className="engagement-strip__garden-stages" aria-hidden="true">
          {[1, 2, 3, 4].map((stage) => (
            <i key={stage} data-reached={stage <= growthStage} />
          ))}
        </span>
      </div>
      <div className="engagement-strip__metric">
        <span>
          <small>기록한 날</small>
          <strong>{summary.journalDays}일</strong>
        </span>
      </div>
      <div className="engagement-strip__metric">
        <span>
          <small>사용 가능</small>
          <strong>{availablePoints}P</strong>
          <small>누적 {summary.points}P · 사용 {spentPoints}P</small>
        </span>
      </div>
      {nextReward !== undefined && (
        <section className="engagement-strip__goal" aria-label="다음 꾸미기 목표">
          {nextReward === null ? (
            <span>현재 공개된 꾸미기를 모두 모았어요.</span>
          ) : (
            <>
              <span><strong>{nextReward.name}</strong></span>
              <span>{nextReward.remainingPoints === 0 ? "지금 받을 수 있어요" : `${nextReward.remainingPoints}P 더 모으면 받을 수 있어요`}</span>
              <progress
                aria-label={`${nextReward.name} 포인트 진행`}
                max={nextReward.cost}
                value={Math.min(availablePoints, nextReward.cost)}
              />
            </>
          )}
        </section>
      )}
      <section className="engagement-strip__badges" aria-label="누적 기록 배지">
        <div>
          <Award aria-hidden="true" size={18} />
          <strong>누적 배지</strong>
          {badges.map((badge) => <span key={badge.id}>{badge.name}</span>)}
        </div>
        {nextBadge !== null && <small>다음 배지까지 기록한 날 {nextBadge.remainingJournalDays}일</small>}
        {onShare !== undefined && summary.journalDays > 0 && (
          <button type="button" onClick={onShare}>
            <Share2 aria-hidden="true" size={16} />
            정원과 배지 공유
          </button>
        )}
        {onShare !== undefined && <small>기록한 날·정원·배지·꾸미기·사용 가능 포인트만 공유해요.</small>}
        {shareNotice !== null && shareNotice !== undefined && <small role="status">{shareNotice}</small>}
      </section>
      <VisitAction summary={summary} notice={notice} onRecordVisit={onRecordVisit} />
      <p className="engagement-strip__preservation">
        <span>이 기기에 {savedCount}건 저장됨</span>
        <span className="engagement-strip__nowrap">온라인 보관은 계정 연동 후</span>
        {onOpenMore !== undefined && (
          <button type="button" aria-label="백업 안내 보기" onClick={onOpenMore}>
            백업 안내 보기
          </button>
        )}
      </p>
      <p>
        {savedCount === 0 && summary.journalDays > 0
          ? "일지를 삭제해도 이미 받은 일지 작성 포인트는 그대로 유지돼요."
          : summary.journalRecordedToday
          ? "오늘 기록한 날 4P도 반영됐어요. 다음 방문 때 편하게 이어가면 돼요."
          : "오늘 훈련 기록 또는 몸 상태·회복 체크를 남기면 기록한 날 4P가 한 번 쌓여요."}
        {" "}<span className="engagement-strip__nowrap">
          거리·속도·훈련 강도에는 점수를 매기지 않아요.
        </span>
      </p>
    </section>
  )
}

function VisitAction({
  summary,
  notice,
  onRecordVisit,
}: {
  readonly summary: EngagementSummary
  readonly notice?: string | null
  readonly onRecordVisit?: () => void
}) {
  return (
    <div className="engagement-strip__visit">
      {summary.visitedToday ? (
        <span><strong>오늘 방문 +1P 반영됨</strong> · 방문한 날 {summary.visitDays}일</span>
      ) : onRecordVisit !== undefined ? (
        <button type="button" onClick={onRecordVisit}>오늘 방문 확인 +1P</button>
      ) : (
        <span>오늘 방문은 직접 확인할 때만 1P가 쌓여요.</span>
      )}
      {notice !== null && notice !== undefined && <small role="status">{notice}</small>}
    </div>
  )
}
