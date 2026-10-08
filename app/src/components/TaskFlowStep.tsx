import React from "react"
import { ArrowLeft } from "lucide-react"
import { AppHeading } from "./AppHeading"
import { useActiveContentScroll } from "../hooks/useActiveContentScroll"
import { useTaskStepMotion } from "../hooks/useTaskStepMotion"
import type { TaskStepMotion } from "../hooks/useTaskStepMotion"
import "../styles/task-flow.css"

type TaskFlowStepProps = {
  readonly stepKey: string
  readonly title: string
  readonly children: React.ReactNode
  readonly summary?: React.ReactNode
  readonly summaryFirst?: boolean
  readonly actions?: React.ReactNode
  readonly onBack?: () => void
  readonly busy?: boolean
  readonly className?: string
  readonly motion?: TaskStepMotion
  readonly headingAccessory?: React.ReactNode
}

/** Presentation only: each form owns its answers, validation, draft and save. */
export function TaskFlowStep({ stepKey, title, children, summary, summaryFirst = false, actions, onBack, busy = false, className, motion = "replace", headingAccessory }: TaskFlowStepProps) {
  const titleId = React.useId()
  const stageRef = React.useRef<HTMLElement>(null)
  const titleRef = React.useRef<HTMLHeadingElement>(null)
  useActiveContentScroll(stepKey, stageRef, titleRef)
  const reducedMotion = useTaskStepMotion(stepKey, stageRef, motion)
  const previousFocusKey = React.useRef(stepKey)
  React.useLayoutEffect(() => {
    if (previousFocusKey.current === stepKey) return
    previousFocusKey.current = stepKey
    // Focus the new question in this commit. Its parent may register a Back
    // sentinel afterward, invalidating delayed scroll work but not this question.
    titleRef.current?.focus({ preventScroll: true })
  }, [stepKey])

  const heading = <AppHeading ref={titleRef} id={titleId} as="h2" variant="screen" tabIndex={-1}>{title}</AppHeading>

  return <section ref={stageRef} className={["task-flow", "active-content-scroll-target", className].filter(Boolean).join(" ")}
    aria-labelledby={titleId} aria-busy={busy} data-task-step={stepKey} data-task-reduced-motion={reducedMotion || undefined}>
    <header className="task-flow__header">
      {onBack && <button type="button" className="task-flow__back" onClick={onBack} disabled={busy}>
        <ArrowLeft size={18} aria-hidden="true" />이전 질문
      </button>}
      {headingAccessory ? <div className="task-flow__title-row">{heading}{headingAccessory}</div> : heading}
    </header>
    {summaryFirst && summary && <div className="task-flow__summary">{summary}</div>}
    <div className="task-flow__body">{children}</div>
    {!summaryFirst && summary && <div className="task-flow__summary">{summary}</div>}
    {actions && <div className="task-flow__actions">{actions}</div>}
  </section>
}
