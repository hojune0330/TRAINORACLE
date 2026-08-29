import { Check, Eye, Heart, HeartOff, MinusCircle } from "lucide-react"
import React from "react"
import type { DecorationCatalogItem } from "../../domain/decorations"

function ItemImage({ item }: { readonly item: DecorationCatalogItem }) {
  const [failed, setFailed] = React.useState(false)
  /* 이모지 스티커는 항상 유니코드 텍스트로만 렌더한다(벤더 아트워크 로드 금지). */
  if (item.category === "EMOJI_STICKER") {
    return (
      <span className="decoration-shop__preview decoration-shop__preview--emoji">
        <span role="img" aria-label={item.fallbackLabel}>{item.emoji}</span>
      </span>
    )
  }
  return (
    <span className="decoration-shop__preview">
      {failed ? (
        <span className="decoration-shop__fallback" role="img" aria-label={item.fallbackLabel}>{item.typeLabel}</span>
      ) : (
        <img src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  )
}

export function DecorationStudioItem({
  item,
  active,
  favorite,
  owned,
  onBuy,
  onFavorite,
  onPreview,
  onRemove,
  onUse,
}: {
  readonly item: DecorationCatalogItem
  readonly active: boolean
  readonly favorite: boolean
  readonly owned: boolean
  readonly onBuy: () => void
  readonly onFavorite: () => void
  readonly onPreview: () => void
  readonly onRemove: () => void
  readonly onUse: () => void
}) {
  const removable = active && item.id !== "THEME_TRACK_NOTEBOOK" && item.id !== "INK_NAVY"
  const useLabel = item.starterOwned ? "바로 사용" : "사용하기"
  return (
    <article className="decoration-shop__item">
      <ItemImage item={item} />
      <span className="decoration-shop__copy">
        <small>{item.typeLabel}</small>
        <strong>{item.name}</strong>
        <small>{item.description}</small>
      </span>
      <div className="decoration-shop__item-actions">
        {owned && (
          <button
            className="decoration-shop__icon-button"
            type="button"
            aria-label={`${item.name} ${favorite ? "즐겨찾기 해제" : "즐겨찾기"}`}
            aria-pressed={favorite}
            onClick={onFavorite}
            title={favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          >
            {favorite ? <HeartOff aria-hidden="true" size={16} /> : <Heart aria-hidden="true" size={16} />}
          </button>
        )}
        <button type="button" onClick={onPreview} aria-label={`${item.name} 미리보기`}>
          <Eye aria-hidden="true" size={15} />
          미리보기
        </button>
        {!owned ? (
          <button type="button" onClick={onBuy} aria-label={`${item.name} ${item.cost}P로 받기`}>
            {item.cost}P로 받기
          </button>
        ) : active ? (
          <>
            <button type="button" disabled aria-label={`${item.name} 사용 중`}>
              <Check aria-hidden="true" size={15} />
              사용 중
            </button>
            {removable && (
              <button type="button" onClick={onRemove} aria-label={`${item.name} 제거`}>
                <MinusCircle aria-hidden="true" size={15} />
                제거
              </button>
            )}
          </>
        ) : (
          <button type="button" data-testid={`decoration-item-use-${item.id}`} onClick={onUse} aria-label={`${item.name} ${useLabel}`}>{useLabel}</button>
        )}
      </div>
    </article>
  )
}
