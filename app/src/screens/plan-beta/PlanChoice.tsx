import { ChevronRight } from "lucide-react"

export function PlanChoice({
  title,
  detail,
  selected,
  onClick,
}: {
  readonly title: string
  readonly detail: string
  readonly selected: boolean
  readonly onClick: () => void
}) {
  return (
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
}
