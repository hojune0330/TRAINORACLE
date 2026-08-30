import React from "react"

export type JournalPageTurnDirection = "initial" | "previous" | "next"

type JournalPageTurnOptions = {
  readonly onPrevious: (() => void) | undefined
  readonly onNext: (() => void) | undefined
  readonly keyboard?: boolean
}

type TouchOrigin = {
  readonly x: number
  readonly y: number
  readonly blocked: boolean
}

const TURN_THRESHOLD_PX = 56
const HORIZONTAL_INTENT_RATIO = 1.2
const MAX_DRAG_OFFSET_PX = 20
const BOUNDARY_DRAG_OFFSET_PX = 8

export function useJournalPageTurn({
  onPrevious,
  onNext,
  keyboard = true,
}: JournalPageTurnOptions) {
  const touchOrigin = React.useRef<TouchOrigin | null>(null)
  const [dragOffset, setDragOffset] = React.useState(0)
  const [direction, setDirection] = React.useState<JournalPageTurnDirection>("initial")

  const finishTurn = React.useCallback((nextDirection: Exclude<JournalPageTurnDirection, "initial">) => {
    const action = nextDirection === "previous" ? onPrevious : onNext
    setDragOffset(0)
    if (action === undefined) return
    setDirection(nextDirection)
    action()
  }, [onNext, onPrevious])

  const goPrevious = React.useCallback(() => finishTurn("previous"), [finishTurn])
  const goNext = React.useCallback(() => finishTurn("next"), [finishTurn])

  React.useEffect(() => {
    if (!keyboard) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (isJournalNavigationBlockedTarget(event.target)) return
      if (event.key === "ArrowLeft") goPrevious()
      if (event.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goNext, goPrevious, keyboard])

  const resetTouch = React.useCallback(() => {
    touchOrigin.current = null
    setDragOffset(0)
  }, [])

  const onTouchStart = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0]
    touchOrigin.current = touch === undefined ? null : {
      x: touch.clientX,
      y: touch.clientY,
      blocked: isJournalNavigationBlockedTarget(event.target),
    }
  }, [])

  const onTouchMove = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const origin = touchOrigin.current
    const touch = event.touches[0] ?? event.changedTouches[0]
    if (origin === null || touch === undefined || origin.blocked) return
    const deltaX = touch.clientX - origin.x
    const deltaY = touch.clientY - origin.y
    if (Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_INTENT_RATIO) {
      setDragOffset(0)
      return
    }
    const actionAvailable = deltaX > 0 ? onPrevious !== undefined : onNext !== undefined
    const limit = actionAvailable ? MAX_DRAG_OFFSET_PX : BOUNDARY_DRAG_OFFSET_PX
    setDragOffset(Math.sign(deltaX) * Math.min(limit, Math.abs(deltaX) * 0.16))
  }, [onNext, onPrevious])

  const onTouchEnd = React.useCallback((event: React.TouchEvent<HTMLElement>) => {
    const origin = touchOrigin.current
    const touch = event.changedTouches[0]
    touchOrigin.current = null
    setDragOffset(0)
    if (
      origin === null
      || touch === undefined
      || origin.blocked
      || isJournalNavigationBlockedTarget(event.target)
    ) return
    const deltaX = touch.clientX - origin.x
    const deltaY = touch.clientY - origin.y
    if (
      Math.abs(deltaX) < TURN_THRESHOLD_PX
      || Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_INTENT_RATIO
    ) return
    finishTurn(deltaX > 0 ? "previous" : "next")
  }, [finishTurn])

  return {
    direction,
    dragOffset,
    isDragging: dragOffset !== 0,
    goPrevious,
    goNext,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: resetTouch,
    },
  }
}

export function isJournalNavigationBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest([
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "summary",
    "[role='button']",
    "[contenteditable]:not([contenteditable='false'])",
    "[data-decoration-interaction='true']",
  ].join(",")) !== null
}
