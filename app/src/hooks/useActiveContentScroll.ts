import React from "react"
import { getBrowserNavigationEpoch, isBrowserPopScrollRestoration, subscribeBrowserPopNavigation } from "../navigation/browserNavigation"
import { localJournalScopeGeneration } from "../domain/account/local-journal-ownership"
import { calendarReducedMotion } from "./useCalendarMotion"

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
  const cancelAlignment = React.useRef<(() => void) | null>(null)
  React.useLayoutEffect(() => subscribeBrowserPopNavigation(() => cancelAlignment.current?.()), [])
  React.useLayoutEffect(() => {
    if (initialRun.current) {
      initialRun.current = false
      if (skipInitial) return
    }
    if (activeKey === null) return
    // Back/Forward restores reading position, not a new answer/decision.
    if (isBrowserPopScrollRestoration()) return
    const target = targetRef.current
    if (target === null) return

    let settleTimer: number | undefined
    const epoch = getBrowserNavigationEpoch()
    const scope = localJournalScopeGeneration()
    const alignTarget = () => {
      if (epoch !== getBrowserNavigationEpoch() || scope !== localJournalScopeGeneration()) return
      const behavior = calendarReducedMotion() ? "auto" : "smooth"
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
      if (epoch !== getBrowserNavigationEpoch() || scope !== localJournalScopeGeneration()) return
      alignTarget()
      focusRef?.current?.focus({ preventScroll: true })
      // Parent shell resets and short entry animations can land after a child
      // effect. Re-align once after those transitions settle; normally this is
      // a no-op, but it prevents a half-finished scroll on real diary turns.
      settleTimer = window.setTimeout(alignTarget, 220)
    })
    const cancel = () => {
      window.cancelAnimationFrame(frame)
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
    }
    cancelAlignment.current = cancel
    return () => {
      cancel()
      if (cancelAlignment.current === cancel) cancelAlignment.current = null
    }
  }, [activeKey, focusRef, skipInitial, targetRef])
}
