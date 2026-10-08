import { forwardRef } from "react"
import { AppHeading } from "./AppHeading"
import { ContextualIllustration, type ContextualIllustrationName } from "./ContextualIllustration"
import "../styles/task-guide.css"

interface TaskGuideProps {
  readonly title: string
  readonly description?: string
  readonly illustration?: ContextualIllustrationName
  readonly as?: "h1" | "h2" | "h3"
  readonly id?: string
  readonly className?: string
  readonly tabIndex?: number
}

/** A task landmark, not another card or an extra step. The words work without the artwork. */
export const TaskGuide = forwardRef<HTMLHeadingElement, TaskGuideProps>(function TaskGuide({
  title, description, illustration, as = "h2", id, className, tabIndex,
}, ref) {
  return <div className={["task-guide", className].filter(Boolean).join(" ")}>
    <div className="task-guide__copy">
      <AppHeading as={as} variant="screen" ref={ref} id={id} tabIndex={tabIndex}>{title}</AppHeading>
      {description && <p className="task-guide__description">{description}</p>}
    </div>
    {illustration && <ContextualIllustration image={illustration} />}
  </div>
})
