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
  owned,
  selected,
  onSelect,
}: {
  readonly item: DecorationCatalogItem
  readonly active: boolean
  readonly owned: boolean
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  return (
    <button
      className="decoration-shop__item"
      type="button"
      aria-label={`${item.name} 미리보기`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <ItemImage item={item} />
      <span className="decoration-shop__copy">
        <strong>{item.name}</strong>
        <small>{active ? "사용 중" : owned ? "보유" : `${item.cost}P`}</small>
      </span>
    </button>
  )
}
