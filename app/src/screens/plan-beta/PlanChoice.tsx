import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

export function PlanChoice({
  title,
  detail,
  selected,
  onClick,
  help,
  recommended = false,
}: {
  readonly title: string
  readonly detail: string
  readonly selected: boolean
  readonly onClick: () => void
  /** 물음표 아이콘 등 — 버튼 바깥에 놓아 선택과 설명 열기를 분리한다. */
  readonly help?: ReactNode
  /** 첫 카드에 "추천" 배지. 고민 없이 한 번 탭하면 다음으로. */
  readonly recommended?: boolean
}) {
  const button = (
    <button
      className="plan-choice"
      type="button"
      aria-pressed={selected}
      data-recommended={recommended ? "true" : undefined}
      onClick={onClick}
    >
      <span>
        <strong>{title}{recommended && <em className="plan-choice__badge">추천</em>}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  )
  if (help === undefined) return button
  return (
    <div className="plan-choice-row">
      {button}
      <span className="plan-choice-row__help">{help}</span>
    </div>
  )
}
