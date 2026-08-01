import React from "react"
import { Palette, Sparkle, UserRound } from "lucide-react"
import {
  DECORATION_CATALOG,
  decorationItemOwned,
  loadDecorationState,
  purchaseDecoration,
} from "../../domain/decorations"

const CATEGORY_ICON = {
  THEME: Palette,
  STICKER: Sparkle,
  AVATAR: UserRound,
} as const

export function DecorationShop({ earnedPoints }: { readonly earnedPoints: number }) {
  const [state, setState] = React.useState(loadDecorationState)
  const [notice, setNotice] = React.useState<string | null>(null)
  const available = Math.max(0, earnedPoints - state.spentPoints)

  const buy = (itemId: string) => {
    const result = purchaseDecoration(earnedPoints, state, itemId)
    setState(result.state)
    setNotice(result.kind === "PURCHASED"
      ? `받았어요. ${result.remainingPoints}P가 남았어요.`
      : result.kind === "INSUFFICIENT_POINTS"
        ? "포인트가 조금 더 필요해요."
        : "이미 가지고 있어요.")
  }

  return (
    <details className="decoration-shop" open>
      <summary>일지 꾸미기 · 사용 가능 {available}P</summary>
      <p>베타 포인트는 꾸미기에만 써요. 현금으로 바꾸거나 다른 사람에게 보낼 수 없어요.</p>
      <div className="decoration-shop__items">
        {DECORATION_CATALOG.map((item) => {
          const Icon = CATEGORY_ICON[item.category]
          const owned = decorationItemOwned(state, item.id)
          return (
            <div className="decoration-shop__item" key={item.id}>
              <Icon aria-hidden="true" size={17} />
              <span><strong>{item.name}</strong><small>{item.category}</small></span>
              {owned ? (
                <b>보유 중</b>
              ) : (
                <button type="button" onClick={() => buy(item.id)} aria-label={`${item.name} ${item.cost}P로 받기`}>
                  {item.cost}P
                </button>
              )}
            </div>
          )
        })}
      </div>
      {notice !== null && <p role="status">{notice}</p>}
    </details>
  )
}
