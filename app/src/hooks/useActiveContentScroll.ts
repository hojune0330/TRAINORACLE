import React from "react"

function reducedMotionPreferred(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Move a newly opened page or decision step into the readable part of the app
 * shell. The target owns its visual offset through scroll-margin so sticky
 * chrome is never guessed in JavaScript.
 */
export function useActiveContentScroll(
  activeKey: string | number | null,
  targetRef: React.RefObject<HTMLElement>,
  focusRef?: React.RefObject<HTMLElement>,
  skipInitial = false,
): void {
  const initialRun = React.useRef(true)
  React.useEffect(() => {
    if (initialRun.current) {
      initialRun.current = false
      if (skipInitial) return
    }
    if (activeKey === null) return
    const target = targetRef.current
    if (target === null) return

    let settleTimer: number | undefined
    const alignTarget = () => {
      const behavior = reducedMotionPreferred() ? "auto" : "smooth"
      const scrollRegion = target.closest<HTMLElement>(".app-scroll-region")
      if (scrollRegion !== null && typeof scrollRegion.scrollTo === "function") {
        const targetRect = target.getBoundingClientRect()
        const regionRect = scrollRegion.getBoundingClientRect()
        const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0
        scrollRegion.scrollTo({
          top: Math.max(0, scrollRegion.scrollTop + targetRect.top - regionRect.top - scrollMargin),
          behavior,
        })
      } else if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({
          behavior,
          block: "start",
          inline: "nearest",
        })
      }
    }
    const frame = window.requestAnimationFrame(() => {
      alignTarget()
      focusRef?.current?.focus({ preventScroll: true })
      // Parent shell resets and short entry animations can land after a child
      // effect. Re-align once after those transitions settle; normally this is
      // a no-op, but it prevents a half-finished scroll on real diary turns.
      settleTimer = window.setTimeout(alignTarget, 220)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
    }
  }, [activeKey, focusRef, skipInitial, targetRef])
}
