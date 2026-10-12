import React from "react"

type AnswerActivation = {
  readonly question: string
  readonly at: number
  readonly detail: number
  readonly point: { readonly x: number; readonly y: number } | null
}

// This is an interaction boundary, not an animation delay or a disabled form.
// Some touch browsers and automation send separate detail=1 clicks for a double tap.
const REPEAT_WINDOW_MS = 400
const REPEAT_RADIUS_PX = 12

export function isRepeatedAnswerActivation(previous: AnswerActivation | null, next: AnswerActivation): boolean {
  if (previous === null || previous.question === next.question || next.detail === 0) return false
  // A native multi-click belongs to the previous question even with a user's
  // longer OS double-click setting. Keyboard/assistive activation has detail=0.
  if (next.detail > 1) return true
  const elapsed = next.at - previous.at
  return elapsed >= 0 && elapsed <= REPEAT_WINDOW_MS
    && previous.point !== null && next.point !== null
    && Math.hypot(next.point.x - previous.point.x, next.point.y - previous.point.y) <= REPEAT_RADIUS_PX
}

/** Keep this hook in the flow owner, above any key={question} remount. */
export function useAutoAdvanceActivation(question: string) {
  const previous = React.useRef<AnswerActivation | null>(null)
  const answerButton = (event: React.SyntheticEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof Element)) return null
    const button = target.closest<HTMLButtonElement>("button[data-auto-advance]")
    return button && event.currentTarget.contains(button) && !button.disabled ? button : null
  }
  const onClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!answerButton(event)) return
    if (event.detail === 0) { previous.current = null; return }
    const next: AnswerActivation = {
      question, at: performance.now(), detail: event.detail,
      // (0,0) is also used by keyboard/assistive and coordinate-free test clicks.
      point: event.clientX === 0 && event.clientY === 0 ? null : { x: event.clientX, y: event.clientY },
    }
    if (isRepeatedAnswerActivation(previous.current, next)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    previous.current = next
  }
  const onKeyDownCapture = (event: React.KeyboardEvent<HTMLElement>) => {
    if (answerButton(event) && event.repeat && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  return { onClickCapture, onKeyDownCapture }
}
