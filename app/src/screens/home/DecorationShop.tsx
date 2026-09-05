import { Palette } from "lucide-react"
import React from "react"
import { loadDecorationState } from "../../domain/decorations"

/*
 * 2026-09-01 오너 실기기 리포트 후 통합: 홈의 꾸미기는 더 이상 별도 편집
 * 화면(구 DecorationStudio)을 열지 않는다. 그 화면은 실제 기록 대신
 * 자리표시 문구를 그려 "쓴 글이 연동 안 된다"는 혼란을 만들었다.
 * 이제 이 카드는 오늘 일지 상세로 이동해 진짜 페이지 위에서
 * P1~P6 편집기를 바로 연다. 포인트 구매도 그 편집기 서랍으로 옮겼다.
 */
/* 홈 카드 미리보기: 시작 재료 중 스티커·도장 4점 (문구용품 스타일). */
const HOME_PREVIEW_ASSETS = [
  "sticker-weather-sun.webp",
  "sticker-running-shoe.webp",
  "stamp-done-check.webp",
  "sticker-water-bottle.webp",
] as const

export function DecorationShop({
  earnedPoints,
  hasJournalEntries = true,
  onSpentPointsChange,
  onDecorateToday,
}: {
  readonly earnedPoints: number
  readonly hasJournalEntries?: boolean
  readonly onSpentPointsChange?: (spentPoints: number) => void
  readonly onDecorateToday?: () => void
}) {
  const [spentPoints] = React.useState(() => loadDecorationState().spentPoints)
  const available = Math.max(0, earnedPoints - spentPoints)

  React.useEffect(() => {
    onSpentPointsChange?.(spentPoints)
  }, [onSpentPointsChange, spentPoints])

  return (
    <section className="decoration-shop" aria-labelledby="decoration-shop-title">
      <header className="decoration-shop__header decoration-shop__header--compact">
        <span>
          <small>{hasJournalEntries ? "내 기록에 꾸미기" : "첫 기록 뒤 시작"}</small>
          <h3 id="decoration-shop-title">꾸미기 보관함 · 사용 가능 {available}P</h3>
        </span>
        {onDecorateToday !== undefined && (
          <button type="button" onClick={onDecorateToday} aria-label="꾸미기 열기">
            <Palette aria-hidden="true" size={14} />
            꾸미기
          </button>
        )}
      </header>
      <div className="decoration-shop__preview" aria-hidden="true">
        {HOME_PREVIEW_ASSETS.map((asset) => (
          <img key={asset} src={`${import.meta.env.BASE_URL}decorations/${asset}`} alt="" draggable="false" loading="lazy" />
        ))}
      </div>
      <p>
        {hasJournalEntries
          ? "오늘 일지 위에서 바로 꾸며요. 베타 포인트는 꾸미기에만 써요 — 현금으로 바꾸거나 다른 사람에게 보낼 수 없어요."
          : "일지를 하나 남기면 그 페이지 위에서 바로 꾸밀 수 있어요. 베타 포인트는 꾸미기에만 써요."}
      </p>
    </section>
  )
}
