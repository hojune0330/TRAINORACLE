import { ChevronDown, CircleHelp } from "lucide-react"
import type { ReactNode } from "react"
import "./InfoDisclosure.css"

/** Optional explanation only. Errors, consent and required actions stay outside. */
export function InfoDisclosure({ title, children, className = "" }: {
  readonly title: string
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <details className={`info-disclosure ${className}`.trim()}>
      <summary>
        <CircleHelp size={16} aria-hidden="true" />
        <span>{title}</span>
        <ChevronDown className="info-disclosure__chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="info-disclosure__content">{children}</div>
    </details>
  )
}
