import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"

export function PlanChoice({
  title,
  detail,
  selected,
  onClick,
  help,
}: {
  readonly title: string
  readonly detail: string
  readonly selected: boolean
  readonly onClick: () => void
  /** 물음표 아이콘 등 — 버튼 바깥에 놓아 선택과 설명 열기를 분리한다. */
  readonly help?: ReactNode
}) {
  const button = (
    <button
      className="plan-choice"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>
        <strong>{title}</strong>
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
