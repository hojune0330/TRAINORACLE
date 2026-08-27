import React from "react"
import { PencilLine } from "lucide-react"

export function GuidedEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly title: string
  readonly description: React.ReactNode
  readonly actionLabel: string
  readonly onAction?: (() => void) | undefined
}) {
  const titleId = React.useId()

  return (
    <section className="guided-empty-state" aria-labelledby={titleId}>
      <PencilLine className="guided-empty-state__icon" aria-hidden="true" size={22} />
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {onAction !== undefined && (
        <button type="button" onClick={onAction}>
          <PencilLine aria-hidden="true" size={17} />
          {actionLabel}
        </button>
      )}
    </section>
  )
}
