import { ChevronDown, CircleHelp } from "lucide-react"
import { useState, type ReactNode } from "react"
import "./InfoDisclosure.css"

/** Optional depth. Action groups name their contents; errors and required actions stay outside. */
export function InfoDisclosure({ title, children, className = "", purpose = "help", preview }: {
  readonly title: string
  readonly children: ReactNode
  readonly className?: string
  readonly purpose?: "help" | "actions"
  readonly preview?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <details onToggle={event => setExpanded(event.currentTarget.open)} className={`info-disclosure ${purpose === "actions" ? "info-disclosure--actions" : ""} ${className}`.trim()}>
      <summary role="button" aria-expanded={expanded}>
        {purpose === "help" && <CircleHelp size={16} aria-hidden="true" />}
        <span><span>{title}</span>{preview && <small className="info-disclosure__preview">{preview}</small>}</span>
        <ChevronDown className="info-disclosure__chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="info-disclosure__content">{children}</div>
    </details>
  )
}
